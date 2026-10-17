import "server-only";
import { getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { config } from "@/lib/config";

// Uses Application Default Credentials: the Cloud Run service account in
// production, `gcloud auth application-default login` locally.
function adminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  const projectId = config().gemini.project;
  return initializeApp(projectId ? { projectId } : undefined);
}

let db: Firestore | undefined;
export function firestore(): Firestore {
  if (!db) {
    db = getFirestore(adminApp());
    db.settings({ ignoreUndefinedProperties: true });
  }
  return db;
}

export function adminAuth() {
  return getAuth(adminApp());
}
