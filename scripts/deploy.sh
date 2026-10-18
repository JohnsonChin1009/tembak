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
    "DEMO_OWNER_EMAILS=${DEMO_OWNER_EMAILS:-}"
    "SERVICE_ACCOUNT_EMAIL=${SA}"
    "GEMINI_MODEL=${GEMINI_MODEL:-gemini-3.5-flash-lite}"
    "GEMINI_FAST_MODEL=${GEMINI_FAST_MODEL:-gemini-3.5-flash-lite}"
    "GOOGLE_GENAI_USE_VERTEXAI=${GOOGLE_GENAI_USE_VERTEXAI:-false}"
    "GOOGLE_CLOUD_LOCATION=${GOOGLE_CLOUD_LOCATION:-global}"
    "NOTION_OAUTH_CLIENT_ID=${NOTION_OAUTH_CLIENT_ID:-}"
    "LINEAR_OAUTH_CLIENT_ID=${LINEAR_OAUTH_CLIENT_ID:-}"
    "WORKFLOW_DEFAULT_TZ=${WORKFLOW_DEFAULT_TZ:-Asia/Kuala_Lumpur}"
  )
  # gcloud's ^DELIM^ syntax lets values contain commas and @.
  local out="^##^" first=1
  for v in "${vars[@]}"; do
    if [ $first = 1 ]; then out+="$v"; first=0; else out+="##$v"; fi
  done
  printf '%s' "$out"
}

# Secrets mounted as env vars. The connector ones are skipped until setup-gcp.sh has created them.
secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest,SESSION_SECRET=SESSION_SECRET:latest"
for name in NOTION_OAUTH_CLIENT_SECRET LINEAR_OAUTH_CLIENT_SECRET; do
  if gcloud secrets describe "$name" --project "$PROJECT_ID" >/dev/null 2>&1; then
    secrets+=",${name}=${name}:latest"
  fi
done

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
  --set-secrets "$secrets" \
  --quiet

URL="$(gcloud run services describe "$SERVICE" --project "$PROJECT_ID" --region "$REGION" --format='value(status.url)')"

if [ -z "${APP_URL:-}" ]; then
  echo "==> Pointing APP_URL at ${URL}"
  gcloud run services update "$SERVICE" --project "$PROJECT_ID" --region "$REGION" \
    --update-env-vars "APP_URL=${URL},APPS_URL=${URL}" --quiet >/dev/null
fi

# --- Scheduled workflows (docs/prd/15-workflows.md) -----------------------------------
# A second, private service from the same image with request-based billing: Cloud
# Scheduler pings it every minute, and it costs only while a tick runs. The main service
# keeps always-on CPU (needed for after() agent runs) but no CRON_SECRET, so its tick
# endpoint stays disabled and pings never keep it awake.
if gcloud secrets describe CRON_SECRET --project "$PROJECT_ID" >/dev/null 2>&1; then
  CRON_SERVICE="${SERVICE}-cron"
  IMAGE="$(gcloud run services describe "$SERVICE" --project "$PROJECT_ID" --region "$REGION" --format='value(spec.template.spec.containers[0].image)')"
  LIVE_URL="${APP_URL:-$URL}"

  echo "==> Deploying ${CRON_SERVICE} (same image, private, billed per request)"
  gcloud run deploy "$CRON_SERVICE" \
    --project "$PROJECT_ID" \
    --region "$REGION" \
    --image "$IMAGE" \
    --service-account "$SA" \
    --no-allow-unauthenticated \
    --cpu-throttling \
    --min-instances 0 \
    --max-instances 1 \
    --cpu 1 \
    --memory 1Gi \
    --concurrency 10 \
    --timeout 300 \
    --set-env-vars "$(env_vars "$LIVE_URL" "${APPS_URL:-$LIVE_URL}")" \
    --set-secrets "${secrets},CRON_SECRET=CRON_SECRET:latest" \
    --quiet

  CRON_URL="$(gcloud run services describe "$CRON_SERVICE" --project "$PROJECT_ID" --region "$REGION" --format='value(status.url)')"
  gcloud run services add-iam-policy-binding "$CRON_SERVICE" --project "$PROJECT_ID" --region "$REGION" \
    --member "serviceAccount:${SA}" --role roles/run.invoker --quiet >/dev/null

  CRON_SECRET_VALUE="$(gcloud secrets versions access latest --secret CRON_SECRET --project "$PROJECT_ID")"
  JOB="${SERVICE}-tick"
  job_flags=(
    --project "$PROJECT_ID" --location "$REGION"
    --schedule "* * * * *" --time-zone "UTC"
    --uri "${CRON_URL}/api/cron/tick" --http-method POST
    --oidc-service-account-email "$SA" --oidc-token-audience "$CRON_URL"
    --attempt-deadline 300s
  )
  if gcloud scheduler jobs describe "$JOB" --project "$PROJECT_ID" --location "$REGION" >/dev/null 2>&1; then
    gcloud scheduler jobs update http "$JOB" "${job_flags[@]}" --update-headers "x-cron-secret=${CRON_SECRET_VALUE}" --quiet >/dev/null
  else
    gcloud scheduler jobs create http "$JOB" "${job_flags[@]}" --headers "x-cron-secret=${CRON_SECRET_VALUE}" --quiet >/dev/null
  fi
  echo "==> Workflows: ${JOB} pings ${CRON_URL}/api/cron/tick every minute"
else
  echo "note: no CRON_SECRET secret, so scheduled workflows are off. Re-run ./scripts/setup-gcp.sh to enable them."
fi

cat <<EOF

Live: ${APP_URL:-$URL}
Cloud Run URL: ${URL}

If sign-in fails with auth/unauthorized-domain, add $(echo "${APP_URL:-$URL}" | sed -E 's#https?://##') to
Firebase console > Authentication > Settings > Authorized domains.
EOF
