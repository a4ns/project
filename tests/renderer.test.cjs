'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/renderer.js'), 'utf8');
function context() {
  const labels = []; let depth = 0;
  const ctx = { canvas: { width: 960, height: 640 }, labels,
    save() { depth++; }, restore() { depth--; }, get depth() { return depth; },
    fillText(t) { labels.push(t); }, measureText(t) { return { width: t.length * 7 }; },
    createLinearGradient() { return { addColorStop() {} }; } };
  for (const k of ['fillRect','strokeRect','translate','beginPath','moveTo','lineTo','stroke','arc','fill','setTransform']) ctx[k] = () => {};
  return ctx;
}
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
const level = { id: 'fixture', title: 'Тестовый сектор', map: ['########', '#......#', '#......#', '#......#', '########'], spawn: {x:1,y:1}, exit: {x:6,y:3}, circuits: {A:0,B:0,C:0}, doors: [{x:3,y:1,circuit:'A',openWhen:1}], traps: [{x:4,y:2,circuit:'B',activeWhen:0}], hint:'Доберитесь до выхода', solution:['DO-NOT-DISPLAY'] };
const sandbox = { window: {} }; vm.runInNewContext(source, sandbox);
for (const mode of ['menu','playing','paused','won']) {
  test(`${mode}: render frozen snapshot without mutation, balanced canvas state`, () => {
    const s = freeze({ mode, levelIndex: 0, level: structuredClone(level), player: {x:1.5,y:1.5,radius:.25}, circuits:{A:0,B:0,C:0}, elapsedSeconds:125.9, resets:3 });
    const before = JSON.stringify(s), ctx = context();
    sandbox.window.CoopView.draw(ctx, s);
    assert.equal(JSON.stringify(s), before); assert.equal(ctx.depth, 0);
    assert.ok(ctx.labels.length > 3); assert.ok(!ctx.labels.some(t => t.includes('DO-NOT-DISPLAY')));
    if (mode === 'playing' || mode === 'won') assert.ok(ctx.labels.some(t => t.includes('02:05')));
  });
}
test('all circuit combinations draw labeled doors/traps and controls', () => {
  for (let bits = 0; bits < 8; bits++) {
    const ctx = context(); sandbox.window.CoopView.draw(ctx, freeze({mode:'playing',level,player:{x:1.5,y:1.5,radius:.25},circuits:{A:bits&1,B:(bits>>1)&1,C:(bits>>2)&1},elapsedSeconds:0,resets:0}));
    for (const id of ['A','B','C']) assert.ok(ctx.labels.some(t => t.includes(id)));
    assert.equal(ctx.depth, 0);
  }
});
test('largest contract map uses compact controls without an extra top overlay', () => {
  const large = {...level, map:Array.from({length:16},(_,y)=>y===0||y===15?'#'.repeat(24):'#'+'.'.repeat(22)+'#')};
  const ctx = context(); sandbox.window.CoopView.draw(ctx, {mode:'playing',level:large,circuits:{A:0,B:1,C:0}});
  assert.ok(ctx.labels.includes('J:A=0')); assert.ok(ctx.labels.includes('K:B=1')); assert.ok(ctx.labels.includes('L:C=0'));
});
test('missing level remains a readable menu and input is never installed', () => {
  const ctx=context(); sandbox.window.CoopView.draw(ctx,{mode:'menu'});
  assert.ok(ctx.labels.some(t=>t.includes('НАЧАТЬ')));
  assert.deepEqual(Object.keys(sandbox.window),['CoopView']);
  assert.doesNotMatch(source,/addEventListener|onkeydown|onkeyup|requestAnimationFrame|setTimeout/);
});
