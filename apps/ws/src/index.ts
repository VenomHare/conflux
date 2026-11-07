import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import * as syncProtocol from "y-protocols/sync";
import { WebSocket, WebSocketServer, type RawData } from "ws";

function toBytes(data: RawData): Uint8Array {
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (Array.isArray(data)) return new Uint8Array(Buffer.concat(data));
    return new Uint8Array(data);
}

type Room = {
    doc: Y.Doc;
    clients: Set<WebSocket>;
    pendingUpdates: Uint8Array[];
    flushTimer: ReturnType<typeof setTimeout> | null;
};
const rooms = new Map<string, Room>();

const ws = new WebSocketServer({ port: 8008 });

ws.on("connection", (socket, request) => {
    const roomName = new URL(
        request.url ?? "/",
        "http://localhost",
    ).pathname.slice(1);

    if (!roomName) {
        socket.close(1008, "Room name required");
        return;
    }

    let room = rooms.get(roomName);

    if (!room) {
        room = {
            doc: new Y.Doc(),
            clients: new Set(),
            pendingUpdates: [],
            flushTimer: null,
        };
        rooms.set(roomName, room);

        room.doc.on("update", (update) => {
            if (!room) return;
            room.pendingUpdates.push(update);

            if (room.flushTimer) clearTimeout(room.flushTimer);

            room.flushTimer = setTimeout(() => {
                if (!room) return;
                room.flushTimer = null;

                const mergedUpdate = Y.mergeUpdates(room.pendingUpdates);
                room.pendingUpdates = [];

                const encoder = encoding.createEncoder();
                encoding.writeVarUint(encoder, 0);
                syncProtocol.writeUpdate(encoder, mergedUpdate);
                const message = encoding.toUint8Array(encoder);

                for (const client of room.clients) {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(message);
                    }
                }
            }, 150);
        });



    }

    room.clients.add(socket);
    socket.on("message", (data) => {
        const decoder = decoding.createDecoder(toBytes(data));
        const messageType = decoding.readVarUint(decoder);

        if (messageType !== 0) return; // sync only for now

        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, 0);
        syncProtocol.readSyncMessage(decoder, encoder, room.doc, socket);

        if (encoding.length(encoder) > 1) {
            socket.send(encoding.toUint8Array(encoder));
        }
    });
    socket.on("close", () => {
        room.clients.delete(socket);
    });
});
