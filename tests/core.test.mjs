import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gate, simulate, parseCircuit, truthTable, connect } from '../packages/core/dist/index.js';
const node = (id, kind, value) => ({ id, kind, x: 0, y: 0, label: id, ...(value === undefined ? {} : { value }) });
const wire = (id, from, to, port = 0) => ({ id, from, to, port });
const circuit = (components, wires = []) => ({ version: 1, name: 'Test', components, wires });
test('binary gates have the expected complete truth tables', () => {
  const pairs = [[0,0], [0,1], [1,0], [1,1]];
  for (const [kind, expected] of Object.entries({ AND:[0,0,0,1], OR:[0,1,1,1], XOR:[0,1,1,0], NAND:[1,1,1,0], NOR:[1,0,0,0], XNOR:[1,0,0,1] })) assert.deepEqual(pairs.map(p => gate(kind,p)), expected);
});
test('unknown signals preserve controlling gate inputs', () => {
  assert.equal(gate('AND', [0,'X']), 0);
  assert.equal(gate('OR', [1,'X']), 1);
  assert.equal(gate('XOR', [1,'X']), 'X');
  assert.equal(gate('NOT', ['X']), 'X');
  assert.equal(gate('MUX', [1,1,'X']), 1);
  assert.equal(gate('MUX', [0,1,'X']), 'X');
});
test('fan-out and evaluation do not depend on component ordering', () => {
  const c = circuit([node('out','OUTPUT'), node('not','NOT'), node('a','INPUT',1)], [wire('w1','a','not'),wire('w2','not','out')]);
  assert.equal(simulate(c).values.out, 0);
  assert.equal(simulate(circuit([node('out','OUTPUT')])).values.out, 'X');
});
test('D flip-flop captures on a known rising edge, then holds', () => {
  const c = circuit([node('d','INPUT',1),node('clock','CLOCK',0),node('q','DFF')], [wire('w1','d','q'),wire('w2','clock','q',1)]);
  let result = simulate(c);
  assert.equal(result.values.q, 0);
  c.components[1].value = 1;
  result = simulate(c, result.memory);
  assert.equal(result.values.q, 1);
  c.components[0].value = 0;
  result = simulate(c, result.memory);
  assert.equal(result.values.q, 1);
  c.components[1].value = 0;
  result = simulate(c, result.memory);
  assert.equal(result.values.q, 1);
  c.components[1].value = 1;
  assert.equal(simulate(c, result.memory).values.q, 0);
});
test('combinational feedback reports a warning and terminates', () => {
  const result = simulate(circuit([node('a','NOT')], [wire('w','a','a')]));
  assert.equal(result.values.a, 'X');
  assert.equal(result.warnings.length, 1);
});
test('connections reject invalid directions and multiple drivers', () => {
  const c = circuit([node('a','INPUT'),node('b','INPUT'),node('o','OUTPUT')]);
  const wired = connect(c,'a','o',0,'w');
  assert.throws(() => connect(wired,'b','o',0,'w2'), /already connected/);
  assert.throws(() => connect(c,'o','a',0,'w'), /Choose an output/);
});
test('documents round-trip and reject malformed or unsafe input', () => {
  const c = circuit([node('a','INPUT',1),node('o','OUTPUT')],[wire('w','a','o')]);
  assert.deepEqual(parseCircuit(JSON.stringify(c)), c);
  assert.throws(() => parseCircuit(JSON.stringify(circuit([node('__proto__','INPUT')]))));
  assert.throws(() => parseCircuit(JSON.stringify({ ...c, wires:[...c.wires,wire('w2','a','o')] })));
  assert.throws(() => parseCircuit(JSON.stringify({ ...c, version: 2 })));
});
test('truth tables enumerate inputs without mutating the circuit', () => {
  const c = circuit([node('a','INPUT',1),node('b','INPUT',0),node('xor','XOR'),node('o','OUTPUT')],[wire('w1','a','xor'),wire('w2','b','xor',1),wire('w3','xor','o')]);
  const before = JSON.stringify(c);
  assert.deepEqual(truthTable(c).rows.map(r => r.outputs[0]), [0,1,1,0]);
  assert.equal(JSON.stringify(c),before);
  assert.throws(() => truthTable(circuit([node('q','DFF'),node('o','OUTPUT')])), /combinational/);
});
