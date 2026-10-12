import assert from "node:assert/strict";
import {
  GateBuilder,
  GateEngine,
  type GateState,
} from "../packages/core/src/gate-netlist.ts";
Deno.test("NAND feedback flip-flop captures rising edges, holds, resets and preserves old state", () => {
  const b = new GateBuilder("DFF"),
    d = b.input("D"),
    clock = b.input("Clock", true),
    reset = b.input("Reset");
  b.output([b.flipFlop(d, clock, reset)]);
  const engine = new GateEngine(b.model);
  let state: GateState | undefined;
  const apply = (data: 0 | 1, clk: 0 | 1, rst: 0 | 1 = 0) => {
    const before = state?.values.slice();
    const next = engine.evaluate([data, clk, rst], state);
    if (state) assert.deepEqual(state.values, before);
    state = next;
    return engine.outputs(state)[0];
  };
  assert.equal(apply(0, 0, 1), 0);
  assert.equal(apply(1, 0), 0);
  assert.equal(apply(1, 1), 1);
  assert.equal(apply(0, 1), 1);
  assert.equal(apply(0, 0), 1);
  assert.equal(apply(0, 1), 0);
  assert.equal(apply(1, 0), 0);
  assert.equal(apply(1, 1), 1);
  assert.equal(apply(1, 1, 1), 0);
  assert.ok(
    b.model.nodes.every((n) =>
      ["INPUT", "LOW", "HIGH", "NAND", "WIRE"].includes(n.op)
    ),
  );
});
Deno.test("gate register captures simultaneously, enables, holds, and resets to a constant", () => {
  const b = new GateBuilder("Register"),
    data = b.bus("D", 8),
    clock = b.input("Clock", true),
    enable = b.input("Enable"),
    reset = b.input("Reset");
  b.output(b.register(data, clock, enable, reset, 0xa5));
  const e = new GateEngine(b.model);
  let s: GateState | undefined;
  const apply = (n: number, c: 0 | 1, en: 0 | 1, r: 0 | 1 = 0) => {
    s = e.evaluate(
      Array.from({ length: 8 }, (_, i) => (n >> i & 1) as 0 | 1).concat(
        c,
        en,
        r,
      ),
      s,
    );
    return e.outputs(s).reduce<number>((n, bit, i) => n | Number(bit) << i, 0);
  };
  assert.equal(apply(0, 0, 0, 1), 165);
  assert.equal(apply(60, 0, 1), 165);
  assert.equal(apply(60, 1, 1), 60);
  assert.equal(apply(255, 0, 0), 60);
  assert.equal(apply(255, 1, 0), 60);
});
