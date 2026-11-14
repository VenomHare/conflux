import { createHmac, timingSafeEqual } from "node:crypto";
import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import { getDb } from "@repo/database";

const SESSION_COOKIE = "conflux_session=";
const EDIT_ROLES = new Set(["OWNER", "ADMIN", "EDITOR"]);
const PAGE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AUTH_SECRET = process.env.AUTH_SECRET;
const MAX_MESSAGE_BYTES = 1024 * 1024;
const ACCESS_RECHECK_MS = 15_000;
const AUTO_SNAPSHOT_INTERVAL_MS = 30 * 1000;
const AUTO_SNAPSHOT_RETENTION = 20;

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

function sanitizeAwarenessUpdate(
  update: Uint8Array,
  identity: { userId: string; name: string; avatarUrl: string | null; color: string },
  ownedClients: Set<number>,
) {
  const decoder = decoding.createDecoder(update);
  const encoder = encoding.createEncoder();
  const count = decoding.readVarUint(decoder);
  if (count > 64) throw new Error("Too many awareness states");
  const entries: { clientId: number; clock: number; state: string }[] = [];
  for (let index = 0; index < count; index += 1) {
    const clientId = decoding.readVarUint(decoder);
    const clock = decoding.readVarUint(decoder);
    const state: unknown = JSON.parse(decoding.readVarString(decoder));
    if (state === null) {
      if (!ownedClients.has(clientId)) continue;
      entries.push({ clientId, clock, state: "null" });
      continue;
    }
    if (!state || typeof state !== "object" || Array.isArray(state)) continue;
    const supplied = state as Record<string, unknown>;
    const clean: Record<string, unknown> = { user: identity };
    const cursor = supplied.cursor;
    if (
      cursor &&
      typeof cursor === "object" &&
      Number.isSafeInteger((cursor as Record<string, unknown>).anchor) &&
      Number.isSafeInteger((cursor as Record<string, unknown>).head)
    ) {
      clean.cursor = cursor;
    }
    ownedClients.add(clientId);
    entries.push({ clientId, clock, state: JSON.stringify(clean) });
  }
  encoding.writeVarUint(encoder, entries.length);
  for (const entry of entries) {
    encoding.writeVarUint(encoder, entry.clientId);
    encoding.writeVarUint(encoder, entry.clock);
    encoding.writeVarString(encoder, entry.state);
  }
  return encoding.toUint8Array(encoder);
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
  awareness: awarenessProtocol.Awareness;
  persistedDoc: Y.Doc;
  updatedAt: string;
  clients: Set<WebSocket>;
  canEdit: Map<WebSocket, boolean>;
  awarenessClients: Map<WebSocket, Set<number>>;
  users: Map<WebSocket, string>;
  userColors: Map<string, string>;
  refreshTimer: ReturnType<typeof setInterval> | null;
  persistQueue: Promise<void>;
  stale: boolean;
};

function getUserColor(room: Room, userId: string) {
  const assigned = room.userColors.get(userId);
  if (assigned) return assigned;
  const used = new Set(room.userColors.values());
  for (let slot = 0; slot < 360; slot += 1) {
    const hue = Math.round((slot * 137.508) % 360);
    const candidate = `hsl(${hue} 76% 40%)`;
    if (!used.has(candidate)) {
      room.userColors.set(userId, candidate);
      return candidate;
    }
  }
  const fallback = `hsl(${(room.userColors.size * 53) % 360} 76% 40%)`;
  room.userColors.set(userId, fallback);
  return fallback;
}

const rooms = new Map<string, Promise<Room | null>>();
let snapshotJobRunning = false;
const ws = new WebSocketServer({
  port: Number(process.env.PORT ?? 8008),
  maxPayload: MAX_MESSAGE_BYTES,
  perMessageDeflate: false,
});
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
  room.awareness.destroy();
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
    awareness: new awarenessProtocol.Awareness(doc),
    persistedDoc: new Y.Doc(),
    updatedAt: pageUpdatedAt,
    clients: new Set(),
    canEdit: new Map(),
    awarenessClients: new Map(),
    users: new Map(),
    userColors: new Map(),
    refreshTimer: null,
    persistQueue: Promise.resolve(),
    stale: false,
  };
  room.awareness.on(
    "update",
    (
      { added, updated, removed }: {
        added: number[];
        updated: number[];
        removed: number[];
      },
      origin: unknown,
    ) => {
    const changed = [...added, ...updated, ...removed];
    if (changed.length === 0) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 1);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(room.awareness, changed),
    );
    const message = encoding.toUint8Array(encoder);
    for (const client of room.clients) {
      if (
        client !== origin &&
        client.readyState === WebSocket.OPEN &&
        message.byteLength <= MAX_MESSAGE_BYTES
      ) client.send(message);
    }
    },
  );
  Y.applyUpdate(room.persistedDoc, Y.encodeStateAsUpdate(doc));
  console.log(
    `[restore] room loaded page=${pageId} updatedAt=${room.updatedAt} stateVectorBytes=${Y.encodeStateVector(doc).byteLength} paragraphs=${doc.getXmlFragment("default").length}`,
  );

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

async function persistRoomChanges(pageId: string, room: Room) {
  const operation = room.persistQueue.then(async () => {
    if (room.stale) throw new Error("Room is stale");
    const pendingUpdate = Y.encodeStateAsUpdate(
      room.doc,
      Y.encodeStateVector(room.persistedDoc),
    );
    if (pendingUpdate.byteLength <= 2) return;
    console.log(
      `[persistence] update queued page=${pageId} bytes=${pendingUpdate.byteLength}`,
    );

    const db = await getDb();
    let staleRoom = false;
    let persistedAt = room.updatedAt;
    try {
      await db.transaction(async (tx) => {
        const updatedAt = new Date().toISOString();
        const page = await tx.orm.public!.Page!
          .where({ id: pageId, deleted_at: null })
          .update({ updated_at: updatedAt });
        const updates = (await tx.orm.public!.PageUpdate!
          .where({ page_id: pageId })
          .all()) as unknown as { update: unknown }[];
        if (!matchesPersistedDocument(room.persistedDoc, updates)) {
          staleRoom = true;
          throw new Error("Document state changed outside this room");
        }
        if (!page) throw new Error("Page was deleted before persistence");
        await tx.orm.public!.PageUpdate!.create({
          page_id: pageId,
          update: Buffer.from(pendingUpdate),
        });
        persistedAt = (page.updated_at as string | undefined) ?? updatedAt;
      });
    } catch (error) {
      if (staleRoom) {
        await evictStaleRoom(pageId, room);
        throw new Error("Document was restored; reconnect to the current version");
      }
      throw error;
    }
    Y.applyUpdate(room.persistedDoc, pendingUpdate);
    room.updatedAt = persistedAt;
    await cacheDocument(pageId, room.updatedAt, room.persistedDoc);
    console.log(
      `[persistence] update committed page=${pageId} bytes=${pendingUpdate.byteLength} updatedAt=${persistedAt}`,
    );
  });
  room.persistQueue = operation.catch((error: unknown) => {
    console.error(
      `[persistence] update failed page=${pageId}: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    for (const client of room.clients) {
      if (client.readyState === WebSocket.OPEN)
        client.close(1011, "Document persistence failed");
    }
  });
  await operation;
}

async function createAutomaticSnapshots() {
  const startedAt = Date.now();
  console.log(`[snapshots] scheduler tick intervalMs=${AUTO_SNAPSHOT_INTERVAL_MS}`);
  if (snapshotJobRunning) {
    console.log("[snapshots] previous run still active; this tick skipped");
    return;
  }
  snapshotJobRunning = true;
  try {
    const db = await getDb();
    const pages = await db.orm.public!.Page!
      .where({ auto_snapshots_enabled: true, deleted_at: null })
      .all();
    console.log(`[snapshots] enabled pages found count=${pages.length}`);
    for (const page of pages) {
      if (
        typeof page.id !== "string" ||
        typeof page.created_by !== "string" ||
        typeof page.updated_at !== "string"
      ) {
        console.warn("[snapshots] enabled page skipped: incomplete page metadata");
        continue;
      }
      const outcome = await db.transaction(async (tx) => {
          const current = await tx.orm.public!.Page!
            .where({ id: page.id, deleted_at: null })
            .first();
          if (!current || typeof current.updated_at !== "string")
            return { kind: "page_missing" as const };
          const revisionLabel = `auto:${current.updated_at}`;
          const existing = await tx.orm.public!.PageSnapshot!
            .where({ page_id: page.id, label: revisionLabel })
            .first();
          if (existing) return { kind: "unchanged" as const };
          const updates = (await tx.orm.public!.PageUpdate!
            .where({ page_id: page.id })
            .all()) as unknown as { update: unknown }[];
          if (updates.length === 0) return { kind: "no_persisted_updates" as const };
          const document = new Y.Doc();
          let state: Uint8Array;
          try {
            for (const update of updates) {
              if (!(update.update instanceof Uint8Array))
                throw new Error("Stored page update is not binary");
              Y.applyUpdate(document, update.update);
            }
            state = Y.encodeStateAsUpdate(document);
          } finally {
            document.destroy();
          }
          await tx.orm.public!.PageSnapshot!.create({
            page_id: page.id,
            created_by: page.created_by,
            document_state: state,
            label: revisionLabel,
          });
          const automatic = (await tx.orm.public!.PageSnapshot!
            .where({ page_id: page.id })
            .all())
            .filter((snapshot) =>
              typeof snapshot.label === "string" &&
              snapshot.label.startsWith("auto:"),
            )
            .sort((left, right) =>
              Date.parse(right.created_at as string) -
              Date.parse(left.created_at as string),
            );
          for (const oldSnapshot of automatic.slice(AUTO_SNAPSHOT_RETENTION)) {
            if (typeof oldSnapshot.id === "string")
              await tx.orm.public!.PageSnapshot!
                .where({ id: oldSnapshot.id })
                .delete();
          }
          return {
            kind: "created" as const,
            revision: current.updated_at,
            bytes: state.byteLength,
            retained: Math.min(automatic.length + 1, AUTO_SNAPSHOT_RETENTION),
          };
      });
      if (outcome.kind === "created") {
        console.log(
          `[snapshots] snapshot created page=${page.id} revision=${outcome.revision} bytes=${outcome.bytes} retained=${outcome.retained}`,
        );
      } else {
        console.log(`[snapshots] page skipped page=${page.id} reason=${outcome.kind}`);
      }
    }
    console.log(
      `[snapshots] scheduler complete pages=${pages.length} durationMs=${Date.now() - startedAt}`,
    );
  } catch (error) {
    console.error(
      `[snapshots] automatic snapshot job failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  } finally {
    snapshotJobRunning = false;
  }
}

const automaticSnapshotTimer = setInterval(
  () => void createAutomaticSnapshots(),
  AUTO_SNAPSHOT_INTERVAL_MS,
);
automaticSnapshotTimer.unref();
console.log(
  `[snapshots] scheduler started intervalMs=${AUTO_SNAPSHOT_INTERVAL_MS} retention=${AUTO_SNAPSHOT_RETENTION}`,
);

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
  const user = await access.db.orm.public!.User!.where({ id: userId }).first();
  if (!user) {
    socket.close(1008, "User no longer exists");
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
  const identity = {
    userId,
    name: String(user.name),
    avatarUrl: typeof user.avatar_url === "string" ? user.avatar_url : null,
    color: getUserColor(room, userId),
  };

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
  room.users.set(socket, userId);
  room.canEdit.set(socket, access.canEdit);
  const ownedAwarenessClients = new Set<number>();
  room.awarenessClients.set(socket, ownedAwarenessClients);
  // Membership changes must take effect for long-lived connections too. The
  // check is intentionally repeated independently of incoming client traffic.
  const accessTimer = setInterval(() => {
    void getPageAccess(pageId, userId)
      .then((latest) => {
        if (!latest) {
          socket.close(1008, "Page access revoked");
          return;
        }
        room.canEdit.set(socket, latest.canEdit);
      })
      .catch(() => socket.close(1011, "Could not recheck page access"));
  }, ACCESS_RECHECK_MS);
  accessTimer.unref();
  socket.on("message", async (data) => {
    if (socket.readyState !== WebSocket.OPEN) return;
    try {
      const bytes = toBytes(data);
      if (bytes.byteLength > MAX_MESSAGE_BYTES) {
        socket.close(1009, "Message too large");
        return;
      }
      // Use the latest capability, including changes detected by the timer.
      const canEdit = room.canEdit.get(socket) === true;
      const decoder = decoding.createDecoder(bytes);
      const messageType = decoding.readVarUint(decoder);
      if (messageType === 1) {
        if (bytes.byteLength > 64 * 1024) {
          socket.close(1009, "Awareness update too large");
          return;
        }
        const update = decoding.readVarUint8Array(decoder);
        const sanitized = sanitizeAwarenessUpdate(
          update,
          identity,
          ownedAwarenessClients,
        );
        awarenessProtocol.applyAwarenessUpdate(
          room.awareness,
          sanitized,
          socket,
        );
        return;
      }
      if (messageType === 3) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, 1);
        encoding.writeVarUint8Array(
          encoder,
          awarenessProtocol.encodeAwarenessUpdate(
            room.awareness,
            [...room.awareness.getStates().keys()],
          ),
        );
        socket.send(encoding.toUint8Array(encoder));
        return;
      }
      if (messageType !== 0) return;
      const syncMessageType = decoding.readVarUint(decoder);
      console.log(
        `[restore] websocket sync request page=${pageId} user=${userId} type=${syncMessageType} bytes=${toBytes(data).byteLength} stale=${room.stale}`,
      );
      if (!canEdit && syncMessageType !== 0) {
        // Ignore any client state from a view-only session, but keep the
        // socket open so it can continue receiving updates from editors.
        return;
      }

      const messageDecoder = decoding.createDecoder(toBytes(data));
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, 0);
      decoding.readVarUint(messageDecoder);
      syncProtocol.readSyncMessage(messageDecoder, encoder, room.doc, socket);
      // Persist the exact delta missing from PostgreSQL before confirming the
      // message to peers. This is scoped to authenticated editable sync frames.
      if (canEdit && (syncMessageType === 1 || syncMessageType === 2)) {
        try {
          await persistRoomChanges(pageId, room);
        } catch {
          return;
        }
      }
      if (socket.readyState !== WebSocket.OPEN || room.stale) return;
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
    clearInterval(accessTimer);
    const awarenessClients = room.awarenessClients.get(socket);
    if (awarenessClients?.size)
      awarenessProtocol.removeAwarenessStates(
        room.awareness,
        [...awarenessClients],
        socket,
      );
    room.awarenessClients.delete(socket);
    room.clients.delete(socket);
    room.canEdit.delete(socket);
    room.users.delete(socket);
    if (![...room.users.values()].includes(userId)) room.userColors.delete(userId);
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
  // y-websocket publishes each client's own state on open but does not ask
  // the server for the states already in the room. Send the current roster to
  // every joining client so presence is symmetric regardless of join order.
  const presentClientIds = [...room.awareness.getStates().entries()]
    .filter(([, state]) =>
      Boolean(
        state.user &&
          typeof state.user === "object" &&
          typeof state.user.userId === "string",
      ),
    )
    .map(([clientId]) => clientId);
  if (presentClientIds.length && socket.readyState === WebSocket.OPEN) {
    const awarenessMessage = encoding.createEncoder();
    encoding.writeVarUint(awarenessMessage, 1);
    encoding.writeVarUint8Array(
      awarenessMessage,
      awarenessProtocol.encodeAwarenessUpdate(
        room.awareness,
        presentClientIds,
      ),
    );
    socket.send(encoding.toUint8Array(awarenessMessage));
  }
});

ws.on("listening", () =>
  console.log(
    `Collaboration WebSocket server listening on port ${process.env.PORT ?? 8008}`,
  ),
);
