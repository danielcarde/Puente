import test from 'node:test';
import assert from 'node:assert/strict';
import {appendChatMessage,renderResourceCards} from '../src/safeRender.js';

class Element {
  constructor(tag){this.tag=tag;this.children=[];this.style={};this.attributes={};this.events={};}
  set innerHTML(value){throw new Error('Dynamic HTML is forbidden in these renderers');}
  setAttribute(k,v){this.attributes[k]=v;}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=[...nodes];}
  addEventListener(k,v){this.events[k]=v;}
}
test('chat text remains literal for user and model output',()=>{
  globalThis.document={createElement:tag=>new Element(tag)};
  const root=new Element('div');
  const attack='<img src=x onerror=alert(1)>\n<script>bad()</script>';
  appendChatMessage(root,'user',attack); appendChatMessage(root,'bot',attack);
  assert.equal(root.children[0].children[0].textContent,attack);
  assert.equal(root.children[1].children[1].textContent,attack);
  assert.equal(root.children[0].children[0].children.length,0);
});
test('resource content is literal and selection uses a callback',()=>{
  globalThis.document={createElement:tag=>new Element(tag)};
  const root=new Element('div'); let selected;
  const name='Resource <img src=x onerror=alert(1)>';
  renderResourceCards(root,[{name,icon:'<script>',desc:'<b>literal</b>',tags:['<img>',{}],bilingual:true}],value=>selected=value);
  const card=root.children[0];
  assert.equal(card.children[1].textContent,name);
  assert.equal(card.children[2].textContent,'<b>literal</b>');
  assert.equal(card.children[3].children.length,2);
  card.events.click(); assert.equal(selected,name);
  renderResourceCards(root,[],()=>{}); assert.equal(root.children.length,0);
});
