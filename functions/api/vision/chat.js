export async function onRequestPost(context) {
  try {
    const key = context.env.OPENROUTER_API_KEY
    if (!key) {
      return new Response(JSON.stringify({ error: 'OPENROUTER_API_KEY not configured' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      })
    }

    const body = await context.request.json().catch(() => ({}))
    const model = body?.model || 'openai/gpt-4o-mini'
    const messages = Array.isArray(body?.messages) ? body.messages : []

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: typeof body?.temperature === 'number' ? body.temperature : 0.1,
        messages,
      }),
    })

    const text = await res.text()
    return new Response(text, {
      status: res.status,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}
