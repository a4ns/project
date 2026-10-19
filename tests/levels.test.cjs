'use strict';
const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'), vm=require('node:vm');
const file=path.join(__dirname,'../src/levels.js');
const exists=fs.existsSync(file);
function load() { const box={window:{}}; vm.runInNewContext(fs.readFileSync(file,'utf8'),box); return JSON.parse(JSON.stringify(box.window.CoopLevels)); }
const keys=['A','B','C'];
function safe(l,x,y,bits) {
  if (!l.map[y] || l.map[y][x]!=='.') return false;
  const value=id=>(bits>>keys.indexOf(id))&1;
  return !l.doors.some(d=>d.x===x&&d.y===y&&value(d.circuit)!==d.openWhen) && !l.traps.some(t=>t.x===x&&t.y===y&&value(t.circuit)===t.activeWhen);
}
function reach(l,startBits,switching) {
  if(!safe(l,l.spawn.x,l.spawn.y,startBits))return false;
  const q=[[l.spawn.x,l.spawn.y,startBits]],seen=new Set([q[0].join(',')]);
  for(let i=0;i<q.length;i++) {
    const [x,y,b]=q[i]; if(x===l.exit.x&&y===l.exit.y)return true;
    const next=[[x+1,y,b],[x-1,y,b],[x,y+1,b],[x,y-1,b]];
    if(switching)for(let k=0;k<3;k++)next.push([x,y,b^(1<<k)]);
    for(const n of next)if(safe(l,...n)&&!seen.has(n.join(','))){seen.add(n.join(','));q.push(n);}
  } return false;
}
test('five levels satisfy structure, safe spawn, dynamic reachability and no static bypass', {skip:!exists?'LEVELS file not yet integrated':false},()=>{
  const levels=load(); assert.equal(levels.length,5); assert.equal(new Set(levels.map(l=>l.id)).size,5);
  for(const l of levels) {
    assert.ok(l.map.length<=16&&l.map.length>=3,l.id); const w=l.map[0].length; assert.ok(w<=24&&w>=3);
    for(const [y,row] of l.map.entries()){assert.equal(row.length,w);assert.match(row,/^[#.]+$/);assert.equal(row[0],'#');assert.equal(row[w-1],'#');if(y===0||y===l.map.length-1)assert.match(row,/^#+$/);}
    for(const k of keys) assert.ok(l.circuits[k]===0||l.circuits[k]===1);
    const occupied=new Set();
    for(const e of [l.spawn,l.exit,...l.doors,...l.traps]){assert.ok(Number.isInteger(e.x)&&Number.isInteger(e.y));assert.equal(l.map[e.y]?.[e.x],'.');const key=`${e.x},${e.y}`;assert.ok(!occupied.has(key),`overlap ${l.id} ${key}`);occupied.add(key);}
    for(const d of l.doors){assert.ok(keys.includes(d.circuit));assert.ok(d.openWhen===0||d.openWhen===1);}
    for(const t of l.traps){assert.ok(keys.includes(t.circuit));assert.ok(t.activeWhen===0||t.activeWhen===1);}
    assert.equal(typeof l.hint,'string');assert.equal(typeof l.title,'string');assert.ok(Array.isArray(l.solution));for(const token of l.solution)assert.match(token,/^[ABC][01]$/);
    const start=keys.reduce((b,k,i)=>b|(l.circuits[k]<<i),0);
    assert.ok(safe(l,l.spawn.x,l.spawn.y,start),`${l.id}: unsafe spawn`);
    assert.ok(reach(l,start,true),`${l.id}: no safe dynamic route`);
    for(let bits=0;bits<8;bits++) assert.equal(reach(l,bits,false),false,`${l.id}: static bypass ${bits}`);
  }
});
