import "server-only";

/** Shown for unknown, unpublished, and other-workspace apps alike, so links don't leak which exist. */
export function appNotFound() {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Not found · Tembak</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0c0e;color:#e9ebee;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif}
  .card{max-width:420px;padding:32px;text-align:center}
  .mark{width:44px;height:44px;margin:0 auto 20px}
  h1{font-size:22px;margin:0 0 8px;letter-spacing:-.01em}
  p{color:#9ba1a8;line-height:1.55;margin:0}
</style></head><body><div class="card">
<svg class="mark" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#c6f432"/><path d="M9 23 L21 11 M14 11 H21 V18" stroke="#0b0c0e" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
<h1>This app isn't live</h1>
<p>It may have been unpublished, the link may be wrong, or it belongs to a workspace you're not in. Ask whoever shared it to check.</p>
</div></body></html>`;
  return new Response(html, {
    status: 404,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
