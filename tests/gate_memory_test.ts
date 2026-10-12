import assert from "node:assert/strict";
import { gateMemory, gateROM } from "../packages/core/src/gate-memory.ts";
import {
  engineFor,
  type GateState,
} from "../packages/core/src/gate-netlist.ts";
import type { Signal } from "@literal/core";
const bits = (n: number, width: number) =>
  Array.from({ length: width }, (_, i) => (n >> i & 1) as Signal);
const number = (bits: Signal[]) =>
  bits.reduce<number>((n, b, i) => n | Number(b) << i, 0);
Deno.test("hierarchical RAM stores independent words through clock decoders and NAND cells", () => {
  const e = engineFor(gateMemory(8));
  let s: GateState | undefined;
  const apply = (addr: number, n: number, clock: 0 | 1, clear: 0 | 1 = 0) => {
    s = e.evaluate(bits(addr, 8).concat(bits(n, 8), clock, clear), s);
    return number(e.outputs(s));
  };
  assert.equal(apply(3, 0, 0), 0);
  assert.equal(apply(3, 165, 0), 0);
  assert.equal(apply(3, 165, 1), 165);
  apply(3, 165, 0);
  apply(7, 60, 0);
  assert.equal(apply(7, 60, 1), 60);
  apply(7, 60, 0);
  assert.equal(apply(3, 0, 0), 165);
  assert.equal(apply(7, 0, 0), 60);
  assert.equal(apply(128, 0, 0), 0);
  assert.equal(apply(7, 0, 0, 1), 0);
  assert.equal(apply(3, 0, 0), 0);
});
Deno.test("64K gate RAM elaborates active paths rather than allocating every cell", () => {
  const e = engineFor(gateMemory(16));
  let s = e.evaluate(bits(0xefff, 16).concat(bits(42, 8), 0, 0));
  s = e.evaluate(bits(0xefff, 16).concat(bits(42, 8), 1, 0), s);
  assert.equal(number(e.outputs(s)), 42);
  const count = (state: GateState): number =>
    1 + Object.values(state.children ?? {}).reduce((n, c) => n + count(c), 0);
  assert.ok(count(s) < 40);
  assert.ok(s.values.length < 300);
});
Deno.test("ROM bytes are selected by a NAND multiplexer tree", () => {
  const e = engineFor(gateROM([16, 0, 42], 8));
  for (const [addr, value] of [[0, 16], [1, 0], [2, 42], [128, 0]]) {
    assert.equal(number(e.outputs(e.evaluate(bits(addr, 8)))), value);
  }
});
Deno.test("an unconnected bus RAM reports floating write signals without expanding 64K unknown paths", async () => {
  const { simulate, inspectHardware } = await import("@literal/core");
  const c = {
    version: 1 as const,
    name: "RAM",
    components: [{
      id: "ram",
      kind: "BUS_RAM" as const,
      label: "RAM",
      x: 0,
      y: 0,
    }],
    wires: [],
  };
  const s = simulate(c);
  assert.match(s.warnings.join(" "), /Memory write clock/);
  assert.equal(s.values.ram, "X");
  assert.ok(inspectHardware(c.components[0], c, s)?.circuit.components.length);
});
