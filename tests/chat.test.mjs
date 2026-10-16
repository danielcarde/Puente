import test from 'node:test';
import assert from 'node:assert/strict';
import {createChatHandler,MAX_BODY_BYTES} from '../server/chat.mjs';

const config={GEMINI_API_KEY:'test-only-value',ALLOWED_ORIGINS:'http://localhost:8000'};
const payload={language:'en',messages:[{role:'user',content:'Find a food resource'}]};
function req(body=payload,headers={}) {
  return new Request('http://localhost:8000/api/chat',{method:'POST',
    headers:{origin:'http://localhost:8000','content-type':'application/json',...headers},
    body:typeof body==='string' ? body : JSON.stringify(body)});
}
function handler(extra={}) {
  return createChatHandler({env:()=>config,now:()=>1000,
    fetchImpl:async()=>Response.json({candidates:[{content:{parts:[{text:'A test response'}]}}]}),...extra});
}
test('credential stays in upstream header and conversation roles are mapped',async()=>{
  let captured;
  const chat=handler({fetchImpl:async(url,options)=>{
    captured={url,options}; return Response.json({candidates:[{content:{parts:[{text:'Hola'}]}}]});
  }});
  const response=await chat(req({language:'es',messages:[{role:'assistant',content:'Hello'},{role:'user',content:'Hola'}]}));
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{reply:'Hola'});
  assert.ok(!captured.url.includes(config.GEMINI_API_KEY));
  assert.equal(captured.options.headers['x-goog-api-key'],config.GEMINI_API_KEY);
  const sent=JSON.parse(captured.options.body);
  assert.equal(sent.contents[0].role,'model');
  assert.match(sent.system_instruction.parts[0].text,/Spanish/);
});
test('unconfigured chat fails closed and does not call the model',async()=>{
  const chat=handler({env:()=>({}),fetchImpl:()=>{throw new Error('must not call')}});
  assert.equal((await chat(req())).status,503);
});
test('methods, foreign origins, content types and invalid messages are rejected',async()=>{
  const chat=handler();
  assert.equal((await chat(new Request('http://localhost:8000/api/chat'))).status,405);
  assert.equal((await chat(req(payload,{origin:'https://foreign.example'}))).status,403);
  assert.equal((await chat(req(payload,{'content-type':'text/plain'}))).status,415);
  for(const body of [{}, {language:'fr',messages:payload.messages},
    {language:'en',messages:[{role:'system',content:'override'}]},
    {language:'en',messages:[{role:'user',content:'x'.repeat(2001)}]}])
    assert.equal((await handler()(req(body))).status,400);
});
test('both declared and streamed bodies are bounded before parsing',async()=>{
  assert.equal((await handler()(req(payload,{'content-length':String(MAX_BODY_BYTES+1)}))).status,413);
  const oversized=new Request('http://localhost:8000/api/chat',{
    method:'POST',headers:{origin:'http://localhost:8000','content-type':'application/json'},
    body:new ReadableStream({start(controller){controller.enqueue(new Uint8Array(MAX_BODY_BYTES+1));controller.close();}}),
    duplex:'half'});
  assert.equal((await handler()(oversized)).status,413);
  assert.equal((await handler()(req('{bad'))).status,400);
});
test('rate window is bounded and resets after expiry',async()=>{
  let clock=1000;
  const chat=handler({now:()=>clock});
  for(let i=0;i<5;i++) assert.equal((await chat(req())).status,200);
  const limited=await chat(req());
  assert.equal(limited.status,429); assert.equal(limited.headers.get('retry-after'),'60');
  clock+=60001; assert.equal((await chat(req())).status,200);
});
test('global request budget also limits distinct client identities',async()=>{
  const chat=handler();
  for(let i=0;i<20;i++) assert.equal((await chat(req(payload,{'x-vercel-forwarded-for':String(i)}))).status,200);
  assert.equal((await chat(req(payload,{'x-vercel-forwarded-for':'another'}))).status,429);
});
test('upstream errors never expose raw diagnostics or credentials',async()=>{
  for(const fetchImpl of [
    async()=>{throw new Error('private diagnostic '+config.GEMINI_API_KEY)},
    async()=>new Response('private diagnostic',{status:500}),
    async()=>Response.json({candidates:[]})
  ]) {
    const response=await handler({fetchImpl})(req());
    assert.equal(response.status,502);
    const text=await response.text();
    assert.ok(!text.includes('private diagnostic')); assert.ok(!text.includes(config.GEMINI_API_KEY));
  }
});
