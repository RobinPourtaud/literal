const test = Deno.test;
import assert from "node:assert/strict";
import {
  type Circuit,
  type Component,
  connect,
  gate,
  type Kind,
  parseCircuit,
  type Signal,
  simulate,
  truthTable,
  type Wire,
} from "../packages/core/src/index.ts";
const node = (id: string, kind: Kind, value?: 0 | 1): Component => ({
  id,
  kind,
  x: 0,
  y: 0,
  label: id,
  ...(value === undefined ? {} : { value }),
});
const wire = (id: string, from: string, to: string, port = 0): Wire => ({
  id,
  from,
  to,
  port,
});
const circuit = (components: Component[], wires: Wire[] = []): Circuit => ({
  version: 1,
  name: "Test",
  components,
  wires,
});
test("binary gates have the expected complete truth tables", () => {
  const pairs: Signal[][] = [[0, 0], [0, 1], [1, 0], [1, 1]];
  for (
    const [kind, expected] of Object.entries({
      AND: [0, 0, 0, 1],
      OR: [0, 1, 1, 1],
      XOR: [0, 1, 1, 0],
      NAND: [1, 1, 1, 0],
      NOR: [1, 0, 0, 0],
      XNOR: [1, 0, 0, 1],
    })
  ) assert.deepEqual(pairs.map((p) => gate(kind as Kind, p)), expected);
});
test("unknown signals preserve controlling gate inputs", () => {
  assert.equal(gate("AND", [0, "X"]), 0);
  assert.equal(gate("OR", [1, "X"]), 1);
  assert.equal(gate("XOR", [1, "X"]), "X");
  assert.equal(gate("NOT", ["X"]), "X");
  assert.equal(gate("MUX", [1, 1, "X"]), 1);
  assert.equal(gate("MUX", [0, 1, "X"]), "X");
});
test("fan-out and evaluation do not depend on component ordering", () => {
  const c = circuit([
    node("out", "OUTPUT"),
    node("not", "NOT"),
    node("a", "INPUT", 1),
  ], [wire("w1", "a", "not"), wire("w2", "not", "out")]);
  assert.equal(simulate(c).values.out, 0);
  assert.equal(simulate(circuit([node("out", "OUTPUT")])).values.out, "X");
});
test("D flip-flop captures on a known rising edge, then holds", () => {
  const c = circuit([
    node("d", "INPUT", 1),
    node("clock", "CLOCK", 0),
    node("q", "DFF"),
  ], [wire("w1", "d", "q"), wire("w2", "clock", "q", 1)]);
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
test("combinational feedback reports a warning and terminates", () => {
  const result = simulate(circuit([node("a", "NOT")], [wire("w", "a", "a")]));
  assert.equal(result.values.a, "X");
  assert.equal(result.warnings.length, 1);
});
test("connections reject invalid directions and multiple drivers", () => {
  const c = circuit([
    node("a", "INPUT"),
    node("b", "INPUT"),
    node("o", "OUTPUT"),
  ]);
  const wired = connect(c, "a", "o", 0, "w");
  assert.throws(() => connect(wired, "b", "o", 0, "w2"), /already connected/);
  assert.throws(() => connect(c, "o", "a", 0, "w"), /Choose an output/);
});
test("documents round-trip and reject malformed or unsafe input", () => {
  const c = circuit([node("a", "INPUT", 1), node("o", "OUTPUT")], [
    wire("w", "a", "o"),
  ]);
  assert.deepEqual(parseCircuit(JSON.stringify(c)), c);
  assert.throws(() =>
    parseCircuit(JSON.stringify(circuit([node("__proto__", "INPUT")])))
  );
  assert.throws(() =>
    parseCircuit(
      JSON.stringify({ ...c, wires: [...c.wires, wire("w2", "a", "o")] }),
    )
  );
  assert.throws(() => parseCircuit(JSON.stringify({ ...c, version: 2 })));
});
test("truth tables enumerate inputs without mutating the circuit", () => {
  const c = circuit([
    node("a", "INPUT", 1),
    node("b", "INPUT", 0),
    node("xor", "XOR"),
    node("o", "OUTPUT"),
  ], [
    wire("w1", "a", "xor"),
    wire("w2", "b", "xor", 1),
    wire("w3", "xor", "o"),
  ]);
  const before = JSON.stringify(c);
  assert.deepEqual(truthTable(c).rows.map((r) => r.outputs[0]), [0, 1, 1, 0]);
  assert.equal(JSON.stringify(c), before);
  assert.throws(
    () => truthTable(circuit([node("q", "DFF"), node("o", "OUTPUT")])),
    /combinational/,
  );
});

test("simultaneous flip-flops sample old outputs rather than updated neighbors", () => {
  const c = circuit([
    node("data", "INPUT", 1),
    node("clk", "CLOCK", 0),
    node("first", "DFF"),
    node("second", "DFF"),
  ], [
    wire("w1", "data", "first"),
    wire("w2", "clk", "first", 1),
    wire("w3", "first", "second"),
    wire("w4", "clk", "second", 1),
  ]);
  let result = simulate(c);
  c.components[1].value = 1;
  result = simulate(c, result.memory);
  assert.equal(result.values.first, 1);
  assert.equal(result.values.second, 0);
  c.components[1].value = 0;
  result = simulate(c, result.memory);
  c.components[1].value = 1;
  result = simulate(c, result.memory);
  assert.equal(result.values.second, 1);
});
test("a toggle flip-flop oscillates only on rising edges without feedback warnings", () => {
  const c = circuit([
    node("clock", "CLOCK", 0),
    node("q", "DFF"),
    node("inv", "NOT"),
  ], [
    wire("w1", "clock", "q", 1),
    wire("w2", "q", "inv"),
    wire("w3", "inv", "q"),
  ]);
  let result = simulate(c);
  for (const clock of [1, 0, 1, 0, 1] as const) {
    c.components[0].value = clock;
    const prior = result.values.q;
    result = simulate(c, result.memory);
    assert.equal(result.values.q, clock === 1 ? prior === 0 ? 1 : 0 : prior);
    assert.deepEqual(result.warnings, []);
  }
});
test("connections reject duplicate IDs and documents handle null entries", () => {
  const c = circuit([node("a", "INPUT"), node("o", "OUTPUT")]);
  assert.throws(() => connect(c, "a", "o", 0, "a"), /unique/);
  assert.throws(() => connect(c, "a", "o", 0, "__proto__"), /valid/);
  assert.throws(
    () => parseCircuit(JSON.stringify({ ...c, components: [null] })),
    /Invalid component/,
  );
  assert.throws(
    () => parseCircuit(JSON.stringify({ ...c, wires: [null] })),
    /Invalid connection/,
  );
});
test("mux routes the selected input and propagates unknown data", () => {
  for (const a of [0, 1, "X"] as const) {
    for (const b of [0, 1, "X"] as const) {
      assert.equal(gate("MUX", [a, b, 0]), a);
      assert.equal(gate("MUX", [a, b, 1]), b);
    }
  }
});
test("all shipped examples validate and full adder has correct sum and carry", async () => {
  const { examples } = await import("../apps/web/src/examples.ts");
  for (const example of examples) {
    assert.deepEqual(
      parseCircuit(JSON.stringify(example.circuit)),
      example.circuit,
    );
  }
  const full = examples.find((e) => e.id === "full-adder")!.circuit;
  for (const row of truthTable(full).rows) {
    const count = row.inputs.reduce<number>((sum, n) => sum + n, 0);
    assert.deepEqual(row.outputs, [count % 2, count > 1 ? 1 : 0]);
  }
});
