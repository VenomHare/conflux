import "dotenv/config";
import postgres from "@prisma/orm-postgres/runtime";
import postgresStatic from "@prisma/orm-postgres/static";
import type { Contract } from "../generated/contract.d";
import contractJson from "../generated/contract.json" with { type: "json" };
import { Runtime } from "@prisma/orm-postgres/family-runtime";

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
