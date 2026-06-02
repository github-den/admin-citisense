export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiUrl = process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1';
  const apiKey = process.env.NEXT_GROQ_API_KEY || process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY not configured on server' });

  try {
    const body = req.body ?? {};
    const targetUrl = `${apiUrl.replace(/\/$/, '')}/responses`;
    console.info('Groq proxy sending request to', targetUrl);

    // Map incoming frontend payload to Groq's expected shape when possible
    const outgoingBody = (() => {
      if (!body || typeof body !== 'object') return body;
      const { prompt, model: incomingModel, max_tokens, temperature, top_p } = body;
      // Map OpenAI-like fields to Groq-compatible fields and default model from env
      const modelVal = incomingModel || process.env.NEXT_GROQ_MODEL || process.env.GROQ_MODEL;
      const out = {};
      if (prompt) out.input = prompt;
      if (modelVal) out.model = modelVal;
      if (typeof max_tokens !== 'undefined') out.max_output_tokens = max_tokens;
      if (typeof temperature !== 'undefined') out.temperature = temperature;
      if (typeof top_p !== 'undefined') out.top_p = top_p;
      return out;
    })();

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(outgoingBody),
    });

    const contentType = response.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      console.error('Groq proxy non-OK response', { status: response.status, body: data });
      return res.status(response.status).json({ error: data });
    }

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error('Groq proxy error', err);
    return res.status(500).json({ error: err?.message ?? 'Proxy request failed', details: String(err) });
  }
}
