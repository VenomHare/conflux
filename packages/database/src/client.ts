import "dotenv/config";
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "@prisma/orm-postgres/runtime";
import postgresStatic from "@prisma/orm-postgres/static";
import type { Contract } from "../generated/contract.d";
import contractJson from "../generated/contract.json" with { type: "json" };
import type { Runtime } from "@prisma/orm-postgres/family-runtime";

config({
  path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env"),
});

const staticContext = postgresStatic({
  contractJson,
});

export const db = postgres({
  contract: staticContext.contract,
  url: process.env.DATABASE_URL!,
});

// Singleton pattern to ensure only one connection
let connectionPromise: Promise<Runtime> | null = null;

export async function getDb() {
  if (!connectionPromise) {
    connectionPromise = db.connect();
  }
  await connectionPromise;
  return db;
}
