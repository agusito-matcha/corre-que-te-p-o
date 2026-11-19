'use strict';
// Genera test/harness.bundle.js: motor + salas + red falsa + bots, ejecutándose dentro del navegador.
const fs = require('fs'), path = require('path');
const R = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const out = `(function(){
var setImmediate=function(f){return setTimeout(f,0)};
var Buffer={from:function(s){return new TextEncoder().encode(String(s));}};
var cryptoShim={randomBytes:function(n){var a=new Uint8Array(n);crypto.getRandomValues(a);return{toString:function(){return Array.from(a).map(function(b){return b.toString(16).padStart(2,'0')}).join('')}}},randomInt:function(n){return Math.floor(Math.random()*n)},timingSafeEqual:function(a,b){for(var i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true}};
var defs={};
function load(n){var d=defs[n];if(d.m)return d.m.exports;var m={exports:{}};d.m=m;d.f(m,m.exports,res);return m.exports}
function res(r){if(r==='crypto')return cryptoShim;if(/cards$/.test(r))return load('cards');if(/engine$/.test(r))return load('engine');if(/rooms$/.test(r))return load('rooms');throw new Error('módulo '+r)}
defs.cards={f:function(module,exports,require){${R('src/game/cards.js')}\n}};
defs.engine={f:function(module,exports,require){${R('src/game/engine.js')}\n}};
defs.rooms={f:function(module,exports,require){${R('src/multiplayer/rooms.js')}\n}};
defs.fake={f:function(module,exports,require){${R('test/fake-net.js')}\n}};
var CARDS=load('cards').CARDS;
var rooms=load('rooms').createRooms(), net=load('fake').createFakeNet(rooms);
setInterval(rooms.tick,250);
function io(){var c=net.connect();setTimeout(function(){(c.listeners.connect||[]).forEach(function(f){f()})},0);return c}
window.io=io;
var rnd=function(n){return Math.floor(Math.random()*n)};
function makeBot(code,name,avatar,speed){
  var c=net.connect(),tried={},busy=false;
  c.on('game:update',function(m){c.state=m.state});
  c.emit('room:join',{code:code,name:name,avatar:avatar},function(r){c.me=r&&r.id});
  setInterval(function(){ if(busy||!c.state||!c.me)return; busy=true; step().then(function(){busy=false},function(){busy=false}) },speed||650);
  function call(e,d){return new Promise(function(r){c.emit(e,d||{},r)})}
  async function step(){
    var s=c.state; if(s.phase==='intro'){ if(!s.ready.includes(c.me)) await call('game:ready'); return }
    if(window.__harness.pauseBots) return;
    if(s.phase==='reaction'&&s.reaction&&s.reaction.mine&&!s.reaction.passed){
      if(Math.random()<0.45){ var hs=s.hand.filter(function(h){return CARDS[h.id].timing==='react'}); for(var i=0;i<hs.length;i++){ var o=s.players.filter(function(p){return p.id!==c.me}); var r=await call('game:react',{uid:hs[i].uid,target:o[rnd(o.length)].id}); if(r.ok)return } }
      await call('game:pass'); return }
    if(s.phase==='play'&&s.turn===c.me){
      if(s.actions>0&&Math.random()>0.1){ var opts=s.hand.filter(function(h){return CARDS[h.id].timing!=='react'&&!tried[h.uid+':'+s.deckCount]});
        if(opts.length){ var h=opts[rnd(opts.length)],o2=s.players.filter(function(p){return p.id!==c.me&&!p.gone}); var r2=await call('game:play',{uid:h.uid,target:o2.length?o2[rnd(o2.length)].id:null}); if(!r2.ok)tried[h.uid+':'+s.deckCount]=1; return } }
      tried={}; await call('game:end') } }
  return c }
window.__harness={rooms:rooms,net:net,pauseBots:false,bots:[],
  addBots:function(code,n,speed){var names=['Ana','Beni','Carla','Dani','Eva','Fran','Gema','Hugo','Inés'],av=['🦊','🐷','🐮','🐸','🐙','🦆','🐢','🐝','🐺'];for(var i=0;i<n;i++)this.bots.push(makeBot(code,names[i],av[i],speed))},
  game:function(code){return rooms.rooms.get(code).game}};
})();`;
fs.writeFileSync(path.join(__dirname, 'harness.bundle.js'), out);
console.log('harness.bundle.js', (out.length / 1024).toFixed(0), 'KB');
