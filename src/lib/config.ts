import "server-only";
import { z } from "zod";

const csv = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  STORE: z.enum(["memory", "firestore"]).default("memory"),
  AUTH_MODE: z.enum(["dev", "firebase"]).default("dev"),
  AGENT_MODE: z.enum(["mock", "gemini"]).optional(),
  GEMINI_API_KEY: z.string().optional(),
  GOOGLE_GENAI_USE_VERTEXAI: z.string().optional(),
  GOOGLE_CLOUD_PROJECT: z.string().optional(),
  GOOGLE_CLOUD_LOCATION: z.string().default("global"),
  GEMINI_MODEL: z.string().default("gemini-3.5-flash-lite"),
  GEMINI_FAST_MODEL: z.string().default("gemini-3.5-flash-lite"),
  APP_URL: z.string().default("http://localhost:3000"),
  APPS_URL: z.string().optional(),
  ALLOWED_EMAIL_DOMAINS: csv,
  // Maintainers of the Demo workspace. Emails, or "dev:<name>" for dev-mode sign-ins.
  DEMO_OWNER_EMAILS: csv,
  // An empty value (as in .env.example) falls back to the dev default too.
  SESSION_SECRET: z.string().optional().transform((v) => v || "tembak-dev-secret-change-me"),
  FIREBASE_WEB_API_KEY: z.string().optional(),
  FIREBASE_AUTH_DOMAIN: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),
  SERVICE_ACCOUNT_EMAIL: z.string().optional(),
  // OAuth apps for the Notion and Linear connectors. Unset = API-key fallback only.
  NOTION_OAUTH_CLIENT_ID: z.string().optional(),
  NOTION_OAUTH_CLIENT_SECRET: z.string().optional(),
  LINEAR_OAUTH_CLIENT_ID: z.string().optional(),
  LINEAR_OAUTH_CLIENT_SECRET: z.string().optional(),
});

// setup-gcp.sh stores "unset" for secrets that weren't provided.
const present = (v: string | undefined) => (v && v !== "unset" ? v : undefined);

function oauthApp(id: string | undefined, secret: string | undefined) {
  const clientId = present(id);
  const clientSecret = present(secret);
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

function load() {
  const env = schema.parse(process.env);
  const useVertex = env.GOOGLE_GENAI_USE_VERTEXAI === "true";
  const apiKey = present(env.GEMINI_API_KEY);
  const agentMode = env.AGENT_MODE ?? (apiKey || useVertex ? "gemini" : "mock");
  const appUrl = env.APP_URL.replace(/\/$/, "");
  const appsUrl = (env.APPS_URL ?? appUrl).replace(/\/$/, "");

  if (env.NODE_ENV === "production" && env.AUTH_MODE === "firebase") {
    if (env.SESSION_SECRET === "tembak-dev-secret-change-me") {
      console.warn("[tembak] SESSION_SECRET is the dev default");
    }
  }

  return {
    isProd: env.NODE_ENV === "production",
    store: env.STORE,
    authMode: env.AUTH_MODE,
    agentMode,
    gemini: {
      apiKey,
      useVertex,
      project: env.GOOGLE_CLOUD_PROJECT ?? env.FIREBASE_PROJECT_ID,
      location: env.GOOGLE_CLOUD_LOCATION,
      model: env.GEMINI_MODEL,
      fastModel: env.GEMINI_FAST_MODEL,
    },
    appUrl,
    appsUrl,
    appsHost: new URL(appsUrl).host,
    appHost: new URL(appUrl).host,
    allowedEmailDomains: env.ALLOWED_EMAIL_DOMAINS,
    demoOwners: env.DEMO_OWNER_EMAILS,
    sessionSecret: env.SESSION_SECRET,
    firebaseWeb: env.FIREBASE_WEB_API_KEY
      ? {
          apiKey: env.FIREBASE_WEB_API_KEY,
          authDomain:
            env.FIREBASE_AUTH_DOMAIN ?? `${env.FIREBASE_PROJECT_ID}.firebaseapp.com`,
          projectId: env.FIREBASE_PROJECT_ID ?? "",
        }
      : null,
    serviceAccountEmail: env.SERVICE_ACCOUNT_EMAIL,
    oauth: {
      notion: oauthApp(env.NOTION_OAUTH_CLIENT_ID, env.NOTION_OAUTH_CLIENT_SECRET),
      linear: oauthApp(env.LINEAR_OAUTH_CLIENT_ID, env.LINEAR_OAUTH_CLIENT_SECRET),
    },
  };
}

export type Config = ReturnType<typeof load>;

let cached: Config | undefined;
export function config(): Config {
  return (cached ??= load());
}
