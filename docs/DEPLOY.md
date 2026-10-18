# Deploying Tembak to Google Cloud

Budget about 45 minutes the first time. Afterwards a redeploy is one command
(`./scripts/deploy.sh`, about 4 minutes).

What you get: one Cloud Run service running the whole app, Firestore for
data, Firebase Auth for Google sign-in, Secret Manager for the Gemini key,
and an optional custom domain.

## 0. Prerequisites (on your laptop)

```bash
brew install --cask google-cloud-sdk    # provides gcloud
gcloud auth login
gcloud auth application-default login   # only needed to run locally against Firestore
```

You need a GCP project **with billing enabled** (Cloud Run, Cloud Build, and
Secret Manager all require it, but the hackathon usage will fit in free tiers).

## 1. Gemini API key

Create one at <https://aistudio.google.com/apikey>, ideally in the same GCP project.
(Alternatively set `GOOGLE_GENAI_USE_VERTEXAI=true` in `deploy.env` and skip the
key; the service account already has `roles/aiplatform.user`.)

**Check model IDs first:** builds default to `gemini-3.5-flash` and triage to `gemini-3.5-flash-lite`, both on the
free tier for AI Studio keys (separate models also means separate rate limits). Confirm they're listed at
<https://ai.google.dev/gemini-api/docs/models> for your key and change
`GEMINI_MODEL` / `GEMINI_FAST_MODEL` in `deploy.env` if needed.

## 2. One-time project setup

```bash
cp deploy.env.example deploy.env      # set PROJECT_ID (and REGION if not Singapore)
GEMINI_API_KEY=AIza... ./scripts/setup-gcp.sh
```

This script enables APIs, creates the `tembak@PROJECT.iam.gserviceaccount.com`
runtime service account with its roles, creates the Firestore database, and stores
`GEMINI_API_KEY` and a random `SESSION_SECRET` in Secret Manager. It's safe to re-run.

## 3. Firebase Auth (console, about 5 minutes)

1. <https://console.firebase.google.com> > **Add project** > choose your **existing** GCP project.
2. **Build > Authentication > Get started > Sign-in method > Google > Enable.** Set a support email.
3. **Project settings (gear) > General > Your apps > Web (`</>`)**. Register an app (no Hosting needed).
   Copy `apiKey` and `authDomain` into `deploy.env` as `FIREBASE_WEB_API_KEY` and `FIREBASE_AUTH_DOMAIN`.
4. Optional: set `ALLOWED_EMAIL_DOMAINS=yourcompany.com` in `deploy.env` to lock sign-in to your team.

## 4. Deploy

```bash
./scripts/deploy.sh
```

The first run builds remotely with Cloud Build (no local Docker), deploys, then
points `APP_URL` at the new `https://tembak-xxxx.a.run.app` URL.

Then, in **Firebase > Authentication > Settings > Authorized domains**, add the
`tembak-xxxx.a.run.app` host (and later your custom domains).

Smoke test:
1. Open the URL, sign in with Google, and go to `#marketing`.
2. Send `@tembak make us a dashboard for this`. The preview should open in about 30 to 90 seconds.
3. Click **Publish**, then open the link in an incognito window.

## 5. Custom domain (optional, recommended)

Use two subdomains on the same service so generated apps get their own origin:

| Host | Purpose |
|---|---|
| `app.<domain>` | The workspace |
| `apps.<domain>` | Published apps and their data API |

```bash
# Verify the domain once (opens Search Console)
gcloud domains verify <domain>

gcloud beta run domain-mappings create --service tembak --region asia-southeast1 --domain app.<domain>
gcloud beta run domain-mappings create --service tembak --region asia-southeast1 --domain apps.<domain>
gcloud beta run domain-mappings describe --region asia-southeast1 --domain app.<domain>   # shows DNS records
```

Add the CNAME records it prints (`ghs.googlehosted.com.`) at your DNS provider.
Certificates take 15 to 60 minutes, so **start this early**. Then:

```bash
# in deploy.env
APP_URL=https://app.<domain>
APPS_URL=https://apps.<domain>
```

Redeploy, and add `app.<domain>` to Firebase authorized domains.

If domain mapping isn't available in your region, put a global external
Application Load Balancer with a serverless NEG in front of the service instead
(console: Network services > Load balancing). Firebase Hosting rewrites also work,
but they cap requests at 60s, which makes the live chat stream reconnect every minute.

## 6. Optional: deploy on push

Console > Cloud Build > Triggers > Create trigger > connect the GitHub repo >
branch `^main$` > configuration file `cloudbuild.yaml`. It reuses the env vars and
secrets from the last `deploy.sh` run and only swaps the image.

## Runtime settings and why

| Flag | Why |
|---|---|
| `--min-instances` (`MIN_INSTANCES`, default 0) | Scales to zero when idle so it costs almost nothing; set 1 before a demo to skip the cold start (bills 24/7 while set) |
| `--no-cpu-throttling` | The agent keeps working after the HTTP response returns (`after()`) |
| `--timeout 300` | SSE chat streams are long-lived and reconnect automatically |
| `--max-instances` (`MAX_INSTANCES`, default 1) | Caps spend at a single instance; raise it if traffic grows (realtime goes through Firestore listeners, so scaling out is safe) |

## Troubleshooting

| Symptom | Fix |
|---|---|
| `PERMISSION_DENIED` during `deploy.sh` build | Re-run `setup-gcp.sh` (it grants Cloud Build roles to the compute service account) and wait a minute for IAM to propagate |
| Sign-in popup: `auth/unauthorized-domain` | Add the host to Firebase > Authentication > Settings > Authorized domains |
| Sign-in: "Firebase web config is missing" | `FIREBASE_WEB_API_KEY` is empty in `deploy.env`; redeploy |
| Agent replies with a model error | Model ID not available to your key; change `GEMINI_MODEL` / `GEMINI_FAST_MODEL` and redeploy |
| Agent stays on the mock dashboard | `GEMINI_API_KEY` secret is still `unset`; run `GEMINI_API_KEY=... ./scripts/setup-gcp.sh` then redeploy |
| Sheet won't connect | Share it with `tembak@PROJECT.iam.gserviceaccount.com` as Viewer, or set "Anyone with the link" |
| Logs | `gcloud run services logs tail tembak --region asia-southeast1` (needs `gcloud components install beta`), or Cloud Run > tembak > Logs |
