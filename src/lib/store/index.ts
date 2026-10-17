import "server-only";
import { config } from "@/lib/config";
import { FirestoreStore } from "./firestore";
import { MemoryStore } from "./memory";
import { seed } from "./seed";
import type { Store } from "./types";

export type { Store } from "./types";

// Keep one instance across dev hot reloads.
const g = globalThis as unknown as { __tembakStore?: Promise<Store> };

async function create(): Promise<Store> {
  const store: Store = config().store === "firestore" ? new FirestoreStore() : new MemoryStore();
  try {
    await seed(store);
  } catch (err) {
    console.error("[store] seeding failed", err);
  }
  return store;
}

export function getStore(): Promise<Store> {
  return (g.__tembakStore ??= create());
}
