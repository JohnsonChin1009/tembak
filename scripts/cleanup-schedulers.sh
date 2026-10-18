#!/usr/bin/env bash
# Deletes Cloud Scheduler jobs that ping Tembak's cron tick but aren't the current one
# (left behind by a renamed SERVICE, an old region, or manual experiments). deploy.sh runs
# it after every deploy; run it by hand to check:
#   ./scripts/cleanup-schedulers.sh            # delete dangling jobs
#   ./scripts/cleanup-schedulers.sh --dry-run  # only list them
#
# Workflows themselves are Firestore docs, not scheduler jobs. They're deleted with their
# channel or workspace (and on demo reset), and the tick drops any whose channel is gone.
set -euo pipefail

cd "$(dirname "$0")/.."
[ -f deploy.env ] || { echo "Missing deploy.env (copy deploy.env.example)"; exit 1; }
set -a; source deploy.env; set +a
: "${PROJECT_ID:?Set PROJECT_ID in deploy.env}"
REGION="${REGION:-asia-southeast1}"
SERVICE="${SERVICE:-tembak}"
KEEP="${SERVICE}-tick"
DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

# With no CRON_SECRET, workflows are off and even the main tick job is dangling.
if ! gcloud secrets describe CRON_SECRET --project "$PROJECT_ID" >/dev/null 2>&1; then
  KEEP=""
fi

# Only touch jobs aimed at a tick endpoint, so unrelated jobs in the project are safe.
jobs="$(gcloud scheduler jobs list --project "$PROJECT_ID" --location "$REGION" \
  --filter='httpTarget.uri~/api/cron/tick' --format='value(name.basename())')"

found=0
for job in $jobs; do
  [ "$job" = "$KEEP" ] && continue
  found=1
  if [ $DRY_RUN = 1 ]; then
    echo "dangling: ${job}"
  else
    gcloud scheduler jobs delete "$job" --project "$PROJECT_ID" --location "$REGION" --quiet >/dev/null
    echo "==> Deleted dangling scheduler job ${job}"
  fi
done
[ $found = 0 ] && echo "==> No dangling scheduler jobs in ${REGION}"
exit 0
