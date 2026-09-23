// Model providers for the wish proxy. Each is (system, user, schema) → the model's text, or throws.
// Chosen with WISH_PROVIDER: "ollama" (default: Bielik on a machine running Ollama), "anthropic".
// No provider sees anything but the system prompt and the traveller's fenced words.

const TIMEOUT_MS = 9000;

async function post(url, headers, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`provider HTTP ${res.status}`);
  return res.json();
}

/**
 * Ollama's chat API in JSON mode, temperature 0, a short output cap. JSON mode, not the full schema:
 * measured 23.09.2026, Bielik held to the schema stopped after the first key ({"mode":"eat"}),
 * while plain JSON mode gave the whole answer; cleanIntent drops anything outside the lists anyway.
 * Default model: Bielik-Minitron-7B v3.0 (SpeakLeash), a Polish model that fits in 8 GB.
 */
export function ollama({ url = 'http://127.0.0.1:11434', model = 'SpeakLeash/bielik-minitron-7B-v3.0-instruct:Q5_K_M' } = {}) {
  return async (system, user) => {
    const data = await post(`${url.replace(/\/+$/, '')}/api/chat`, {}, {
      model,
      stream: false,
      format: 'json',
      keep_alive: '30m',
      options: { temperature: 0, num_predict: 200, num_ctx: 4096 },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    return data?.message?.content ?? '';
  };
}

/** Claude Haiku 4.5 through the Messages API, for when no Ollama machine is reachable. */
export function anthropic({ key, model = 'claude-haiku-4-5-20251001' }) {
  if (!key) throw new Error('ANTHROPIC_API_KEY missing');
  return async (system, user) => {
    const data = await post('https://api.anthropic.com/v1/messages', { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, {
      model,
      max_tokens: 200,
      temperature: 0,
      system: `${system}\nOdpowiedz wyłącznie obiektem JSON.`,
      messages: [{ role: 'user', content: user }],
    });
    return (data?.content ?? []).map((b) => (b.type === 'text' ? b.text : '')).join('');
  };
}

export function fromEnv(env) {
  const which = (env.WISH_PROVIDER || 'ollama').toLowerCase();
  if (which === 'anthropic') return anthropic({ key: env.ANTHROPIC_API_KEY, model: env.WISH_MODEL || undefined });
  return ollama({ url: env.OLLAMA_URL || undefined, model: env.WISH_MODEL || undefined });
}
