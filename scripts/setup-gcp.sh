#!/usr/bin/env bash
# One-time Google Cloud setup for Tembak. Safe to re-run.
#
#   cp deploy.env.example deploy.env   # fill in PROJECT_ID at least
#   GEMINI_API_KEY=... ./scripts/setup-gcp.sh
#
# GEMINI_API_KEY is optional if you use Vertex AI (GOOGLE_GENAI_USE_VERTEXAI=true).
# Connector OAuth secrets are optional too (Notion/Linear fall back to API keys):
#   NOTION_OAUTH_CLIENT_SECRET=... LINEAR_OAUTH_CLIENT_SECRET=... ./scripts/setup-gcp.sh
set -euo pipefail

cd "$(dirname "$0")/.."
[ -f deploy.env ] || { echo "Missing deploy.env (copy deploy.env.example)"; exit 1; }
set -a; source deploy.env; set +a
: "${PROJECT_ID:?Set PROJECT_ID in deploy.env}"
REGION="${REGION:-asia-southeast1}"
SA_NAME="${SERVICE:-tembak}"
SA="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

step() { printf '\n\033[1;32m==>\033[0m %s\n' "$*"; }

step "Using project ${PROJECT_ID} in ${REGION}"
gcloud config set project "$PROJECT_ID" >/dev/null
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"

step "Enabling APIs (takes a minute the first time)"
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com \
  sheets.googleapis.com \
  identitytoolkit.googleapis.com \
  generativelanguage.googleapis.com \
  aiplatform.googleapis.com \
  cloudscheduler.googleapis.com

step "Creating runtime service account ${SA}"
gcloud iam service-accounts describe "$SA" >/dev/null 2>&1 ||
  gcloud iam service-accounts create "$SA_NAME" --display-name="Tembak runtime"

for role in roles/datastore.user roles/secretmanager.secretAccessor roles/firebaseauth.admin roles/aiplatform.user; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA}" --role="$role" --condition=None --quiet >/dev/null
  echo "  granted $role"
done

step "Letting Cloud Build deploy from source"
BUILD_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
for role in roles/run.builder roles/logging.logWriter roles/artifactregistry.writer roles/storage.objectViewer; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${BUILD_SA}" --role="$role" --condition=None --quiet >/dev/null || true
done

step "Creating Firestore database (Native mode)"
if gcloud firestore databases describe --database='(default)' >/dev/null 2>&1; then
  echo "  already exists"
else
  gcloud firestore databases create --location="$REGION" --type=firestore-native
fi

put_secret() {
  local name="$1" value="$2"
  if gcloud secrets describe "$name" >/dev/null 2>&1; then
    printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=- >/dev/null
    echo "  updated $name"
  else
    printf '%s' "$value" | gcloud secrets create "$name" --data-file=- --replication-policy=automatic >/dev/null
    echo "  created $name"
  fi
}

step "Storing secrets in Secret Manager"
if gcloud secrets describe SESSION_SECRET >/dev/null 2>&1; then
  echo "  SESSION_SECRET exists (kept)"
else
  put_secret SESSION_SECRET "$(openssl rand -base64 32)"
fi
if [ -n "${GEMINI_API_KEY:-}" ]; then
  put_secret GEMINI_API_KEY "$GEMINI_API_KEY"
elif ! gcloud secrets describe GEMINI_API_KEY >/dev/null 2>&1; then
  # deploy.sh always mounts it; a placeholder keeps the mock agent working.
  put_secret GEMINI_API_KEY "unset"
  echo "  (no GEMINI_API_KEY given; set it later with: GEMINI_API_KEY=... ./scripts/setup-gcp.sh)"
fi
# Shared secret Cloud Scheduler sends to the tembak-cron service (scheduled workflows).
if gcloud secrets describe CRON_SECRET >/dev/null 2>&1; then
  echo "  CRON_SECRET exists (kept)"
else
  put_secret CRON_SECRET "$(openssl rand -hex 24)"
fi
# OAuth client secrets for the Notion and Linear connectors. "unset" means API keys only.
for name in NOTION_OAUTH_CLIENT_SECRET LINEAR_OAUTH_CLIENT_SECRET; do
  if [ -n "${!name:-}" ]; then
    put_secret "$name" "${!name}"
  elif ! gcloud secrets describe "$name" >/dev/null 2>&1; then
    put_secret "$name" "unset"
  fi
done

cat <<EOF

$(printf '\033[1;32mDone.\033[0m') Remaining console steps (see docs/DEPLOY.md):
  1. Firebase console: add Firebase to project ${PROJECT_ID}, enable the Google sign-in provider,
     register a Web app, and copy apiKey/authDomain into deploy.env.
  2. Run ./scripts/deploy.sh
  3. Share any Google Sheets you want Tembak to read with: ${SA}
EOF
