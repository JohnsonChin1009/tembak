#!/usr/bin/env bash
# Builds the repo with Cloud Build and deploys it to Cloud Run.
#   ./scripts/deploy.sh
set -euo pipefail

cd "$(dirname "$0")/.."
[ -f deploy.env ] || { echo "Missing deploy.env (copy deploy.env.example)"; exit 1; }
set -a; source deploy.env; set +a
: "${PROJECT_ID:?Set PROJECT_ID in deploy.env}"
REGION="${REGION:-asia-southeast1}"
SERVICE="${SERVICE:-tembak}"
SA="${SERVICE}@${PROJECT_ID}.iam.gserviceaccount.com"

if [ -z "${FIREBASE_WEB_API_KEY:-}" ]; then
  echo "warning: FIREBASE_WEB_API_KEY is empty, so Google sign-in won't work. Falling back to AUTH_MODE=dev."
  AUTH_MODE=dev
else
  AUTH_MODE=firebase
fi

env_vars() {
  local app_url="$1" apps_url="$2"
  local vars=(
    "STORE=firestore"
    "AUTH_MODE=${AUTH_MODE}"
    "APP_URL=${app_url}"
    "APPS_URL=${apps_url}"
    "GOOGLE_CLOUD_PROJECT=${PROJECT_ID}"
    "FIREBASE_PROJECT_ID=${PROJECT_ID}"
    "FIREBASE_WEB_API_KEY=${FIREBASE_WEB_API_KEY:-}"
    "FIREBASE_AUTH_DOMAIN=${FIREBASE_AUTH_DOMAIN:-${PROJECT_ID}.firebaseapp.com}"
    "ALLOWED_EMAIL_DOMAINS=${ALLOWED_EMAIL_DOMAINS:-}"
    "SERVICE_ACCOUNT_EMAIL=${SA}"
    "GEMINI_MODEL=${GEMINI_MODEL:-gemini-3.5-flash-lite}"
    "GEMINI_FAST_MODEL=${GEMINI_FAST_MODEL:-gemini-3.5-flash-lite}"
    "GOOGLE_GENAI_USE_VERTEXAI=${GOOGLE_GENAI_USE_VERTEXAI:-false}"
    "GOOGLE_CLOUD_LOCATION=${GOOGLE_CLOUD_LOCATION:-global}"
  )
  # gcloud's ^DELIM^ syntax lets values contain commas and @.
  local out="^##^" first=1
  for v in "${vars[@]}"; do
    if [ $first = 1 ]; then out+="$v"; first=0; else out+="##$v"; fi
  done
  printf '%s' "$out"
}

# Placeholder URL on the very first deploy; fixed up right after.
FIRST_URL="${APP_URL:-https://placeholder.invalid}"

echo "==> Deploying ${SERVICE} to ${REGION} (Cloud Build, takes about 3 to 5 minutes)"
gcloud run deploy "$SERVICE" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --source . \
  --service-account "$SA" \
  --allow-unauthenticated \
  --min-instances "${MIN_INSTANCES:-0}" \
  --max-instances "${MAX_INSTANCES:-1}" \
  --no-cpu-throttling \
  --cpu 1 \
  --memory 1Gi \
  --concurrency 80 \
  --timeout 300 \
  --set-env-vars "$(env_vars "$FIRST_URL" "${APPS_URL:-$FIRST_URL}")" \
  --set-secrets "GEMINI_API_KEY=GEMINI_API_KEY:latest,SESSION_SECRET=SESSION_SECRET:latest" \
  --quiet

URL="$(gcloud run services describe "$SERVICE" --project "$PROJECT_ID" --region "$REGION" --format='value(status.url)')"

if [ -z "${APP_URL:-}" ]; then
  echo "==> Pointing APP_URL at ${URL}"
  gcloud run services update "$SERVICE" --project "$PROJECT_ID" --region "$REGION" \
    --update-env-vars "APP_URL=${URL},APPS_URL=${URL}" --quiet >/dev/null
fi

cat <<EOF

Live: ${APP_URL:-$URL}
Cloud Run URL: ${URL}

If sign-in fails with auth/unauthorized-domain, add $(echo "${APP_URL:-$URL}" | sed -E 's#https?://##') to
Firebase console > Authentication > Settings > Authorized domains.
EOF
