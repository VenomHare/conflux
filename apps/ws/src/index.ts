import { createHmac, timingSafeEqual } from "node:crypto";
import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import * as syncProtocol from "y-protocols/sync";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import { getDb } from "@repo/database";

const SESSION_COOKIE = "conflux_session=";
const EDIT_ROLES = new Set(["OWNER", "ADMIN", "EDITOR"]);
const PAGE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AUTH_SECRET = process.env.AUTH_SECRET;

if (!AUTH_SECRET || AUTH_SECRET.length < 32 || AUTH_SECRET.startsWith("replace-with-")) {
    throw new Error("AUTH_SECRET must be set to at least 32 random characters for the collaboration server");
}

function toBytes(data: RawData): Uint8Array {
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (Array.isArray(data)) return new Uint8Array(Buffer.concat(data));
    return new Uint8Array(data);
}

function getUserId(token: string | null): string | null {
    if (!token) return null;
    const separator = token.indexOf(".");
    if (separator < 1 || separator === token.length - 1) return null;

    const payload = token.slice(0, separator);
    const signature = token.slice(separator + 1);
    const expected = Buffer.from(createHmac("sha256", AUTH_SECRET).update(payload).digest("base64url"));
    const supplied = Buffer.from(signature);
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;

    try {
        const claims: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
        if (typeof claims !== "object" || claims === null || !("sub" in claims) || typeof claims.sub !== "string" ||
            !("exp" in claims) || typeof claims.exp !== "number" || claims.exp <= Math.floor(Date.now() / 1000)) {
            return null;
        }
        return claims.sub;
    } catch {
        return null;
    }
}

async function getPageAccess(pageId: string, userId: string) {
    if (!PAGE_ID_PATTERN.test(pageId)) return null;
    const db = await getDb();
    const page = await db.orm.public!.Page!.where({ id: pageId, deleted_at: null }).first();
    if (!page || typeof page.workspace_id !== "string") return null;
    const membership = await db.orm.public!.WorkspaceMember!.where({
        workspace_id: page.workspace_id,
        user_id: userId,
    }).first();
    if (!membership) return null;
    return { db, canEdit: EDIT_ROLES.has(String(membership.role)) };
}

type Room = {
    doc: Y.Doc;
    clients: Set<WebSocket>;
    canEdit: Map<WebSocket, boolean>;
    pendingUpdates: Uint8Array[];
    flushTimer: ReturnType<typeof setTimeout> | null;
    persistQueue: Promise<void>;
};

const rooms = new Map<string, Promise<Room | null>>();
const ws = new WebSocketServer({ port: Number(process.env.PORT ?? 8008) });

async function loadRoom(pageId: string): Promise<Room | null> {
    const db = await getDb();
    const page = await db.orm.public!.Page!.where({ id: pageId, deleted_at: null }).first();
    if (!page) return null;

    const doc = new Y.Doc();
    const updates = await db.orm.public!.PageUpdate!.where({ page_id: pageId }).all();
    for (const record of updates as unknown as { update: unknown }[]) {
        if (!(record.update instanceof Uint8Array)) throw new Error(`Invalid stored Yjs update for page ${pageId}`);
        Y.applyUpdate(doc, record.update);
    }

    const room: Room = {
        doc,
        clients: new Set(),
        clients: new Set(),
        canEdit: new Map(),
        pendingUpdates: [],
        flushTimer: null,
        persistQueue: Promise.resolve(),
    };

    doc.on("update", (update, origin) => {
        const canWrite = origin instanceof WebSocket && room.canEdit.get(origin) === true;
        if (!canWrite) return;

        room.persistQueue = room.persistQueue
            .then(async () => {
                const currentDb = await getDb();
                await currentDb.orm.public!.PageUpdate!.create({ page_id: pageId, update: Buffer.from(update) });
                await currentDb.orm.public!.Page!.where({ id: pageId, deleted_at: null }).update({
                    updated_at: new Date().toISOString(),
                });
            })
            .catch((error: unknown) => {
                console.error(`Could not persist Yjs update for page ${pageId}`, error);
                for (const client of room.clients) {
                    if (client.readyState === WebSocket.OPEN) client.close(1011, "Document persistence failed");
                }
            });

        room.pendingUpdates.push(update);
        if (room.flushTimer) clearTimeout(room.flushTimer);
        room.flushTimer = setTimeout(() => {
            room.flushTimer = null;
            const pending = room.pendingUpdates.splice(0);
            if (!pending.length) return;
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, 0);
            syncProtocol.writeUpdate(encoder, Y.mergeUpdates(pending));
            const message = encoding.toUint8Array(encoder);
            for (const client of room.clients) {
                if (client !== origin && client.readyState === WebSocket.OPEN) client.send(message);
            }
        }, 150);
    });

    return room;
}

ws.on("connection", async (socket, request) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const pageId = decodeURIComponent(url.pathname.slice(1));
    const cookie = request.headers.cookie?.split(";").map((part) => part.trim())
        .find((part) => part.startsWith(SESSION_COOKIE))?.slice(SESSION_COOKIE.length);
    const userId = getUserId(url.searchParams.get("token") ?? cookie ?? null);
    if (!userId) {
        socket.close(1008, "Authentication required");
        return;
    }

    let access: Awaited<ReturnType<typeof getPageAccess>>;
    try {
        access = await getPageAccess(pageId, userId);
    } catch (error) {
        console.error("WebSocket page access check failed", error);
        socket.close(1011, "Could not check page access");
        return;
    }
    if (!access) {
        socket.close(1008, "Page access denied");
        return;
    }

    let roomPromise = rooms.get(pageId);
    if (!roomPromise) {
        roomPromise = loadRoom(pageId).catch((error: unknown) => {
            console.error(`Could not load Yjs document for page ${pageId}`, error);
            return null;
        });
        rooms.set(pageId, roomPromise);
    }
    const room = await roomPromise;
    if (!room) {
        rooms.delete(pageId);
        socket.close(1011, "Could not load page document");
        return;
    }

    room.clients.add(socket);
    room.canEdit.set(socket, access.canEdit);
    socket.on("message", async (data) => {
        if (socket.readyState !== WebSocket.OPEN) return;
        try {
            const decoder = decoding.createDecoder(toBytes(data));
            const messageType = decoding.readVarUint(decoder);
            if (messageType !== 0) return;
            const syncMessageType = decoding.readVarUint(decoder);
            if (!access.canEdit && syncMessageType !== 0) {
                socket.close(1008, "Read only access");
                return;
            }

            const messageDecoder = decoding.createDecoder(toBytes(data));
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, 0);
            decoding.readVarUint(messageDecoder);
            syncProtocol.readSyncMessage(messageDecoder, encoder, room.doc, socket);
            await room.persistQueue;
            if (socket.readyState !== WebSocket.OPEN) return;
            if (encoding.length(encoder) > 1) socket.send(encoding.toUint8Array(encoder));
        } catch (error) {
            console.error(`Invalid WebSocket sync message for page ${pageId}`, error);
            socket.close(1003, "Invalid sync message");
        }
    });
    socket.on("close", () => {
        room.clients.delete(socket);
        room.canEdit.delete(socket);
    });
    socket.on("error", (error) => console.error(`WebSocket error for page ${pageId}`, error));
});

ws.on("listening", () => console.log(`Collaboration WebSocket server listening on port ${process.env.PORT ?? 8008}`));
