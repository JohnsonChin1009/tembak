"use client";

import { useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";

type FirebaseWeb = { apiKey: string; authDomain: string; projectId: string } | null;

export function LoginForm({
  mode,
  firebase,
  next,
}: {
  mode: "dev" | "firebase";
  firebase: FirebaseWeb;
  next: string;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startSession(body: { name?: string; idToken?: string }) {
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? "Sign-in failed");
    }
    window.location.assign(next);
  }

  async function google() {
    if (!firebase) {
      setError("Firebase web config is missing (FIREBASE_WEB_API_KEY).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const [{ initializeApp, getApps }, { getAuth, GoogleAuthProvider, signInWithPopup }] =
        await Promise.all([import("firebase/app"), import("firebase/auth")]);
      const app = getApps()[0] ?? initializeApp(firebase);
      const cred = await signInWithPopup(getAuth(app), new GoogleAuthProvider());
      await startSession({ idToken: await cred.user.getIdToken() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setBusy(false);
    }
  }

  async function dev(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await startSession({ name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {mode === "firebase" ? (
        <button
          onClick={google}
          disabled={busy}
          className="flex h-11 w-full items-center justify-center gap-3 rounded-lg bg-fg font-medium text-bg transition hover:bg-white disabled:opacity-60"
        >
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <GoogleG />}
          Continue with Google
        </button>
      ) : (
        <form onSubmit={dev} className="space-y-3">
          <label className="block text-sm font-medium text-muted" htmlFor="name">
            Your name
          </label>
          <input
            id="name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Johnson"
            className="h-11 w-full rounded-lg border border-line-strong bg-raised px-3 text-fg outline-none transition placeholder:text-faint focus:border-accent"
          />
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent font-medium text-accent-ink transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
            Enter workspace
            <ArrowRight className="size-4" />
          </button>
        </form>
      )}
      {error ? (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="size-4" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
