import { createHash } from 'node:crypto';

const MAX_BODY_BYTES = 8192;
const WINDOW_MS = 60000;
const MAX_CLIENTS = 1024;
const SYSTEM = 'You are Puente, a bilingual community-resource assistant for El Paso and Ciudad Juarez. Help users find relevant healthcare, education, food, employment, and community support resources. Keep answers under 200 words. Do not invent verified availability, eligibility, phone numbers, or current facts. Encourage checking details with the named organization. Do not request documentation status.';

function error(status, message, headers = {}) {
  return Response.json({error: message}, {status, headers: {'Cache-Control':'no-store', ...headers}});
}
async function boundedJson(request) {
  const declared = request.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_BODY_BYTES))
    throw new Error('size');
  if (!request.body) throw new Error('json');
  const reader = request.body.getReader();
  const chunks = []; let length = 0;
  try {
    for (;;) {
      const {done,value} = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) { await reader.cancel(); throw new Error('size'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const joined = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { joined.set(chunk,offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(joined)); }
  catch { throw new Error('json'); }
}

export function createChatHandler({fetchImpl = fetch, env = () => process.env, now = Date.now} = {}) {
  const clients = new Map();
  let globalWindow = 0, globalCount = 0, inFlight = 0;
  return async function chat(request) {
    if (request.method !== 'POST') return error(405,'Use POST.',{Allow:'POST'});
    const config = env();
    const origins = String(config.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
    const origin = request.headers.get('origin');
    if (!origins.length || !config.GEMINI_API_KEY) return error(503,'Chat is not configured.');
    if (!origin || !origins.includes(origin)) return error(403,'Origin is not allowed.');
    if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') || ''))
      return error(415,'Send JSON.');

    const timestamp = now();
    for (const [key,value] of clients) if (timestamp >= value.expires) clients.delete(key);
    if (timestamp >= globalWindow) { globalWindow = timestamp + WINDOW_MS; globalCount = 0; }
    // Vercel sets this header; the local adapter replaces it with the socket peer.
    // Missing identities share one bucket, rather than trusting client-supplied IDs.
    const identity = request.headers.get('x-vercel-forwarded-for') || 'anonymous';
    const key = createHash('sha256').update(identity).digest('hex');
    const bucket = clients.get(key) || {expires:timestamp + WINDOW_MS,count:0};
    if ((!clients.has(key) && clients.size >= MAX_CLIENTS) ||
        bucket.count >= 5 || globalCount >= 20 || inFlight >= 4)
      return error(429,'Too many requests.',{'Retry-After':'60'});
    bucket.count++; globalCount++; clients.set(key,bucket);

    let body;
    try { body = await boundedJson(request); }
    catch (cause) { return error(cause.message === 'size' ? 413 : 400,'Invalid or oversized request.'); }
    if (!body || !['en','es'].includes(body.language) || !Array.isArray(body.messages) ||
        body.messages.length < 1 || body.messages.length > 12 ||
        !body.messages.every(m => m && ['user','assistant'].includes(m.role) &&
          typeof m.content === 'string' && m.content.trim().length > 0 && m.content.length <= 2000) ||
        body.messages.at(-1).role !== 'user')
      return error(400,'Invalid conversation.');
    inFlight++;
    try {
      const upstream = await fetchImpl(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        {
          method:'POST',
          headers:{'Content-Type':'application/json','x-goog-api-key':config.GEMINI_API_KEY},
          signal:AbortSignal.timeout(20000),
          body:JSON.stringify({
            system_instruction:{parts:[{text:SYSTEM + (body.language === 'es' ? ' Answer in Spanish.' : ' Answer in English.')}]},
            generationConfig:{maxOutputTokens:512},
            contents:body.messages.map(m => ({role:m.role === 'assistant' ? 'model' : 'user',parts:[{text:m.content}]}))
          })
        });
      if (!upstream.ok) return error(502,'The assistant service is unavailable.');
      const data = await upstream.json();
      const reply = data.candidates?.[0]?.content?.parts?.map(p => typeof p.text === 'string' ? p.text : '').join('');
      if (!reply || reply.length > 12000) return error(502,'The assistant returned no usable response.');
      return Response.json({reply},{headers:{'Cache-Control':'no-store'}});
    } catch { return error(502,'The assistant service is unavailable.'); }
    finally { inFlight--; }
  };
}
export { MAX_BODY_BYTES };
