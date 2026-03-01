export async function onRequestPost(context) {
  try {
    const payload = await context.request.json().catch(() => ({}))
    const summary = {
      ok: true,
      receivedAt: new Date().toISOString(),
      kind: payload?.kind || 'unknown',
    }
    return new Response(JSON.stringify(summary), {
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    })
  } catch {
    return new Response(JSON.stringify({ ok: false }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }
}
