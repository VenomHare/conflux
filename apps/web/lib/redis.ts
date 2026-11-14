import { createClient } from "redis";

const PAGE_DOCUMENT_CACHE_PREFIX = "conflux:ws:page:";

const redisClient = process.env.REDIS_URL
  ? createClient({ url: process.env.REDIS_URL })
  : null;

redisClient?.on("error", (error) => {
  console.error(`[redis] connection error: ${String(error)}`);
});

let redisConnection: Promise<unknown> | null = null;

async function getRedisClient() {
  if (!redisClient) throw new Error("REDIS_URL is not configured");
  if (!redisConnection) {
    redisConnection = redisClient.connect().catch((error: unknown) => {
      redisConnection = null;
      throw error;
    });
  }
  await redisConnection;
  return redisClient;
}

export async function clearPageDocumentCache(pageId: string) {
  try {
    const client = await getRedisClient();
    await client.del(`${PAGE_DOCUMENT_CACHE_PREFIX}${pageId}:document`);
    return true;
  } catch (error) {
    console.error(
      `[restore] Redis cache clear failed page=${pageId}: ${String(error)}`,
    );
    return false;
  }
}
