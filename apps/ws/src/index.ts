import { createHmac, timingSafeEqual } from "node:crypto";
import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import * as syncProtocol from "y-protocols/sync";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import { getDb } from "@repo/database";

const SESSION_COOKIE = "conflux_session=";
const EDIT_ROLES = new Set(["OWNER", "ADMIN", "EDITOR"]);
const PAGE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AUTH_SECRET = process.env.AUTH_SECRET;

if (
  !AUTH_SECRET ||
  AUTH_SECRET.length < 32 ||
  AUTH_SECRET.startsWith("replace-with-")
) {
  throw new Error(
    "AUTH_SECRET must be set to at least 32 random characters for the collaboration server",
  );
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
  const expected = Buffer.from(
    createHmac("sha256", AUTH_SECRET!).update(payload).digest("base64url"),
  );
  const supplied = Buffer.from(signature);
  if (
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  )
    return null;

  try {
    const claims: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    if (
      typeof claims !== "object" ||
      claims === null ||
      !("sub" in claims) ||
      typeof claims.sub !== "string" ||
      !("exp" in claims) ||
      typeof claims.exp !== "number" ||
      claims.exp <= Math.floor(Date.now() / 1000)
    ) {
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
  const page = await db.orm
    .public!.Page!.where({ id: pageId, deleted_at: null })
    .first();
  if (!page || typeof page.workspace_id !== "string") return null;
  const membership = await db.orm
    .public!.WorkspaceMember!.where({
      workspace_id: page.workspace_id,
      user_id: userId,
    })
    .first();
  if (!membership) return null;
  return { db, canEdit: EDIT_ROLES.has(String(membership.role)) };
}

type Room = {
  doc: Y.Doc;
  persistedDoc: Y.Doc;
  updatedAt: string;
  clients: Set<WebSocket>;
  canEdit: Map<WebSocket, boolean>;
  refreshTimer: ReturnType<typeof setInterval> | null;
  persistQueue: Promise<void>;
  stale: boolean;
};

const rooms = new Map<string, Promise<Room | null>>();
const ws = new WebSocketServer({ port: Number(process.env.PORT ?? 8008) });
const PAGE_DOCUMENT_CACHE_PREFIX = "conflux:ws:page:";
const redis = process.env.REDIS_URL
  ? new Bun.RedisClient(process.env.REDIS_URL)
  : null;
let redisConnection: Promise<void> | null = null;

async function getRedis() {
  if (!redis) return null;
  if (!redisConnection) {
    redisConnection = redis.connect().catch((error: unknown) => {
      redisConnection = null;
      throw error;
    });
  }
  await redisConnection;
  return redis;
}

function pageDocumentCacheKey(pageId: string) {
  return `${PAGE_DOCUMENT_CACHE_PREFIX}${pageId}:document`;
}

async function readCachedDocument(pageId: string, updatedAt: string) {
  try {
    const client = await getRedis();
    if (!client) return null;
    const value = await client.get(pageDocumentCacheKey(pageId));
    if (typeof value !== "string") return null;
    const cached: unknown = JSON.parse(value);
    if (
      typeof cached !== "object" ||
      cached === null ||
      !("updatedAt" in cached) ||
      cached.updatedAt !== updatedAt ||
      !("state" in cached) ||
      typeof cached.state !== "string"
    )
      return null;
    return Buffer.from(cached.state, "base64");
  } catch (error) {
    console.error(
      `[restore] Redis cache read failed page=${pageId}: ${String(error)}`,
    );
    return null;
  }
}

async function cacheDocument(
  pageId: string,
  updatedAt: string,
  document: Y.Doc,
) {
  try {
    const client = await getRedis();
    if (!client) return;
    const state = Buffer.from(Y.encodeStateAsUpdate(document)).toString(
      "base64",
    );
    await client.set(
      pageDocumentCacheKey(pageId),
      JSON.stringify({ updatedAt, state }),
    );
    console.log(
      `[restore] Redis cache updated page=${pageId} updatedAt=${updatedAt} bytes=${Buffer.from(state, "base64").byteLength}`,
    );
  } catch (error) {
    console.error(
      `[restore] Redis cache write failed page=${pageId}: ${String(error)}`,
    );
  }
}

function matchesPersistedDocument(
  document: Y.Doc,
  updates: readonly { update: unknown }[],
) {
  const stored = new Y.Doc();
  for (const record of updates) {
    if (!(record.update instanceof Uint8Array)) {
      stored.destroy();
      throw new Error("Stored page update is not binary");
    }
    Y.applyUpdate(stored, record.update);
  }
  const same = Buffer.from(Y.encodeStateAsUpdate(document)).equals(
    Buffer.from(Y.encodeStateAsUpdate(stored)),
  );
  stored.destroy();
  return same;
}

async function evictStaleRoom(pageId: string, room: Room) {
  if (room.stale) return;
  const currentRoom = await rooms.get(pageId);
  if (currentRoom !== room) return;
  room.stale = true;
  console.log(
    `[restore] stale room evicted page=${pageId} clients=${room.clients.size} persistedVectorBytes=${Y.encodeStateVector(room.persistedDoc).byteLength} liveVectorBytes=${Y.encodeStateVector(room.doc).byteLength}`,
  );
  if (room.refreshTimer) clearInterval(room.refreshTimer);
  rooms.delete(pageId);
  for (const client of room.clients) {
    if (client.readyState === WebSocket.OPEN)
      client.close(4401, "Document restored");
  }
  room.doc.destroy();
  room.persistedDoc.destroy();
}

async function loadRoom(pageId: string): Promise<Room | null> {
  const db = await getDb();
  const page = await db.orm
    .public!.Page!.where({ id: pageId, deleted_at: null })
    .first();
  if (!page) return null;

  const pageUpdatedAt = page.updated_at as string;
  const cachedState = await readCachedDocument(pageId, pageUpdatedAt);
  const updates = cachedState
    ? []
    : ((await db.orm
        .public!.PageUpdate!.where({ page_id: pageId })
        .all()) as unknown as { update: unknown }[]);
  console.log(
    `[restore] loading room page=${pageId} source=${cachedState ? "redis" : "database"} updateCount=${updates.length} cachedBytes=${cachedState?.byteLength ?? 0}`,
  );
  const doc = new Y.Doc();
  if (cachedState) {
    Y.applyUpdate(doc, cachedState);
  } else {
    for (const record of updates) {
      if (!(record.update instanceof Uint8Array))
        throw new Error(`Invalid stored Yjs update for page ${pageId}`);
      Y.applyUpdate(doc, record.update);
    }
    await cacheDocument(pageId, pageUpdatedAt, doc);
  }

  const room: Room = {
    doc,
    persistedDoc: new Y.Doc(),
    updatedAt: pageUpdatedAt,
    clients: new Set(),
    canEdit: new Map(),
    refreshTimer: null,
    persistQueue: Promise.resolve(),
    stale: false,
  };
  Y.applyUpdate(room.persistedDoc, Y.encodeStateAsUpdate(doc));
  console.log(
    `[restore] room loaded page=${pageId} updatedAt=${room.updatedAt} stateVectorBytes=${Y.encodeStateVector(doc).byteLength} paragraphs=${doc.getXmlFragment("default").length}`,
  );

  doc.on("update", (update, origin) => {
    const canWrite =
      !room.stale &&
      origin instanceof WebSocket &&
      room.canEdit.get(origin) === true;
    if (!canWrite) return;

    room.persistQueue = room.persistQueue
      .then(async () => {
        if (room.stale) return;
        const currentDb = await getDb();
        let restored = false;
        let persistedAt = room.updatedAt;
        await currentDb.transaction(async (tx) => {
          // Take the same page-row lock as restore before persisting.
          // This orders writes on either side of the restore boundary.
          const updatedAt = new Date().toISOString();
          const page = await tx.orm
            .public!.Page!.where({ id: pageId, deleted_at: null })
            .update({ updated_at: updatedAt });
          const updates = (await tx.orm
            .public!.PageUpdate!.where({ page_id: pageId })
            .all()) as unknown as { update: unknown }[];
          if (!matchesPersistedDocument(room.persistedDoc, updates)) {
            console.log(
              `[restore] stale room write rejected page=${pageId} bytes=${update.byteLength} roomUpdatedAt=${room.updatedAt} databaseUpdateCount=${updates.length}`,
            );
            restored = true;
            return;
          }
          await tx.orm.public!.PageUpdate!.create({
            page_id: pageId,
            update: Buffer.from(update),
          });
          persistedAt = (page?.updated_at as string | undefined) ?? updatedAt;
        });
        if (restored) await evictStaleRoom(pageId, room);
        else {
          Y.applyUpdate(room.persistedDoc, Buffer.from(update));
          room.updatedAt = persistedAt;
          await cacheDocument(pageId, room.updatedAt, room.persistedDoc);
        }
      })
      .catch((error: unknown) => {
        console.error(
          `[restore] Yjs persistence failed page=${pageId}: ${String(error)}`,
        );
        for (const client of room.clients) {
          if (client.readyState === WebSocket.OPEN)
            client.close(1011, "Document persistence failed");
        }
      });
  });

  // A restore replaces persisted updates outside this process. Compare the
  // database state with our last persisted Y.Doc so title-only timestamp
  // changes don't evict the room.
  const refreshTimer = setInterval(() => {
    void getDb()
      .then(async (currentDb) => {
        if (room.stale || room.clients.size === 0) return;
        const page = await currentDb.orm
          .public!.Page!.where({ id: pageId, deleted_at: null })
          .first();
        if (
          !page ||
          Date.parse(page.updated_at as string) === Date.parse(room.updatedAt)
        )
          return;
        const updates = (await currentDb.orm
          .public!.PageUpdate!.where({ page_id: pageId })
          .all()) as unknown as { update: unknown }[];
        if (!matchesPersistedDocument(room.persistedDoc, updates)) {
          console.log(
            `[restore] refresh found replacement page=${pageId} roomUpdatedAt=${room.updatedAt} databaseUpdatedAt=${page.updated_at} databaseUpdateCount=${updates.length}`,
          );
          await evictStaleRoom(pageId, room);
        } else room.updatedAt = page.updated_at as string;
      })
      .catch((error: unknown) =>
        console.error(
          `[restore] room refresh failed page=${pageId}: ${String(error)}`,
        ),
      );
  }, 1000);
  room.refreshTimer = refreshTimer;
  refreshTimer.unref();

  return room;
}

ws.on("connection", async (socket, request) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  const pageId = decodeURIComponent(url.pathname.slice(1));
  const cookie = request.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(SESSION_COOKIE))
    ?.slice(SESSION_COOKIE.length);
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
      console.error(
        `[restore] room load failed page=${pageId}: ${String(error)}`,
      );
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

  const currentPage = await access.db.orm
    .public!.Page!.where({ id: pageId, deleted_at: null })
    .first();
  const currentUpdates = (await access.db.orm
    .public!.PageUpdate!.where({ page_id: pageId })
    .all()) as unknown as { update: unknown }[];
  console.log(
    `[restore] websocket joined page=${pageId} user=${userId} roomUpdatedAt=${room.updatedAt} databaseUpdatedAt=${currentPage?.updated_at ?? "missing"} databaseUpdateCount=${currentUpdates.length}`,
  );
  if (
    !currentPage ||
    !matchesPersistedDocument(room.persistedDoc, currentUpdates)
  ) {
    await evictStaleRoom(pageId, room);
    socket.close(4401, "Document restored");
    return;
  }
  room.updatedAt = currentPage.updated_at as string;

  room.clients.add(socket);
  room.canEdit.set(socket, access.canEdit);
  socket.on("message", async (data) => {
    if (socket.readyState !== WebSocket.OPEN) return;
    try {
      const decoder = decoding.createDecoder(toBytes(data));
      const messageType = decoding.readVarUint(decoder);
      if (messageType !== 0) return;
      const syncMessageType = decoding.readVarUint(decoder);
      console.log(
        `[restore] websocket sync request page=${pageId} user=${userId} type=${syncMessageType} bytes=${toBytes(data).byteLength} stale=${room.stale}`,
      );
      if (!access.canEdit && syncMessageType !== 0) {
        // Ignore any client state from a view-only session, but keep the
        // socket open so it can continue receiving updates from editors.
        return;
      }

      const messageDecoder = decoding.createDecoder(toBytes(data));
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, 0);
      decoding.readVarUint(messageDecoder);
      syncProtocol.readSyncMessage(messageDecoder, encoder, room.doc, socket);
      if (syncMessageType !== 0) {
        const updateEncoder = encoding.createEncoder();
        encoding.writeVarUint(updateEncoder, 0);
        syncProtocol.writeUpdate(updateEncoder, Y.encodeStateAsUpdate(room.doc));
        const updateMessage = encoding.toUint8Array(updateEncoder);
        let peers = 0;
        for (const client of room.clients) {
          if (client !== socket && client.readyState === WebSocket.OPEN) {
            client.send(updateMessage);
            peers += 1;
          }
        }
        console.log(
          `[restore] live update broadcast page=${pageId} user=${userId} type=${syncMessageType} bytes=${updateMessage.byteLength} peers=${peers}`,
        );
      }
      await room.persistQueue;
      if (socket.readyState !== WebSocket.OPEN) return;
      const response = encoding.toUint8Array(encoder);
      console.log(
        `[restore] websocket sync response page=${pageId} user=${userId} requestType=${syncMessageType} bytes=${response.byteLength} paragraphs=${room.doc.getXmlFragment("default").length}`,
      );
      if (response.byteLength > 1) socket.send(response);
    } catch (error) {
      console.error(
        `[restore] invalid websocket sync page=${pageId}: ${String(error)}`,
      );
      socket.close(1003, "Invalid sync message");
    }
  });
  socket.on("close", () => {
    room.clients.delete(socket);
    room.canEdit.delete(socket);
  });
  socket.on("error", (error) =>
    console.error(`[restore] websocket error page=${pageId}: ${String(error)}`),
  );

  // Push the authoritative room state immediately. A SyncStep1 only asks the
  // client for its state and does not deliver the restored document.
  const initialSync = encoding.createEncoder();
  encoding.writeVarUint(initialSync, 0);
  syncProtocol.writeSyncStep2(initialSync, room.doc);
  const initialSyncMessage = encoding.toUint8Array(initialSync);
  console.log(
    `[restore] initial document sent page=${pageId} user=${userId} bytes=${initialSyncMessage.byteLength} paragraphs=${room.doc.getXmlFragment("default").length}`,
  );
  if (socket.readyState === WebSocket.OPEN) socket.send(initialSyncMessage);
});

ws.on("listening", () =>
  console.log(
    `Collaboration WebSocket server listening on port ${process.env.PORT ?? 8008}`,
  ),
);
