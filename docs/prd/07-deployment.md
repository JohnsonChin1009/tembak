# PRD 07: Deployment to Google Cloud

## Goal

A short, repeatable path from a fresh GCP project to a live URL, runnable by
one person in under an hour. The step-by-step runbook is in [../DEPLOY.md](../DEPLOY.md).

## Target topology

- **Cloud Run** service `tembak` in `asia-southeast1` (change via `REGION`), built from the repo `Dockerfile`
  (Next.js `output: "standalone"`), `--min-instances=1 --no-cpu-throttling --timeout=300`
  (agent runs continue after the HTTP response; SSE streams are long-lived).
- **Firestore** (Native mode), same region. Rules deny all client access; the server uses ADC.
- **Firebase Auth** with the Google provider; authorized domains include the custom domain.
- **Secret Manager**: `GEMINI_API_KEY`, `SESSION_SECRET` mounted as env vars.
- **Service account** `tembak@PROJECT.iam.gserviceaccount.com` with `roles/datastore.user`,
  `roles/secretmanager.secretAccessor`, `roles/firebaseauth.admin` (session cookies),
  and optionally `roles/aiplatform.user` if Vertex AI is used instead of an API key.
- **Domain**: Cloud Run domain mapping (or Firebase Hosting rewrite to Cloud Run) for `app.<domain>`
  and `apps.<domain>`, both pointing to the same service.

## Pipeline

- `scripts/setup-gcp.sh`: one-time setup. Enables APIs, creates the SA, Firestore DB, secrets, and IAM bindings. Idempotent.
- `scripts/deploy.sh`: `gcloud run deploy --source .` (Cloud Build builds the Dockerfile remotely, so
  no local Docker is needed) with all flags and env vars.
- `cloudbuild.yaml`: the same deploy as a Cloud Build trigger on push to `main` (optional; set up from the console).
- `firestore.rules`, `firestore.indexes.json`, `firebase.json` for `firebase deploy --only firestore`.

## Stretch: per-app Cloud Run

`POST /api/apps/:id/deploy-cloud-run` wraps the HTML in an `nginx:alpine` image via
Cloud Build and deploys `app-<slug>` as its own service. Not in the MVP: deploys take 1 to 3 minutes,
which is bad for a live demo, but it's a good "and it scales to real services" talking point.

## Acceptance

- From a clean project: `setup-gcp.sh`, then `deploy.sh`, gives a working URL with Google sign-in and a real Gemini build.
- Redeploy takes about 3 minutes and needs no manual steps.
