import assert from "node:assert/strict";
import { assemble } from "@literal/core";
import { type ALUOperation, evaluateALU } from "../packages/core/src/alu.ts";
import { gateCPU } from "../packages/core/src/gate-cpu.ts";
import {
  GateEngine,
  type GateState,
} from "../packages/core/src/gate-netlist.ts";
import type { Signal } from "@literal/core";
const bits = (n: number, width = 8) =>
  Array.from({ length: width }, (_, i) => (n >> i & 1) as Signal);
const number = (bits: Signal[]) =>
  bits.reduce<number>((n, b, i) => n | Number(b) << i, 0);
export function cpuBench(source: string) {
  const rom = assemble(source).rom,
    ram = new Uint8Array(65536),
    engine = new GateEngine(gateCPU());
  let state: GateState | undefined,
    ports: Signal[] = Array(20).fill(0),
    writing = 0;
  const level = (clock: 0 | 1, reset: 0 | 1 = 0) => {
    ports[18] = clock;
    ports[19] = reset;
    for (let settle = 0; settle < 4; settle++) {
      state = engine.evaluate(ports, state);
      const out = engine.outputs(state), address = number(out.slice(0, 16));
      if (out[24] === 1 && writing === 0) {
        ram[address] = number(out.slice(16, 24));
      }
      writing = Number(out[24]);
      const alu = evaluateALU(
        (["ADD", "SUB", "AND", "OR", "XOR", "SHL", "SHR"] as ALUOperation[])[
          number(out.slice(42, 45))
        ] ?? "ADD",
        number(out.slice(26, 34)),
        number(out.slice(34, 42)),
      );
      ports = bits(address < 8192 ? rom[address] : ram[address]).concat(
        bits(alu.value),
        [Number(alu.carry) as Signal, Number(alu.zero) as Signal, clock, reset],
      );
    }
  };
  level(0, 1);
  level(0, 0);
  const run = (instructions = 100) => {
    for (let i = 0; i < instructions * 16; i++) {
      level(i % 2 === 0 ? 1 : 0);
      if (engine.probe(state!, "Halted")[0] === 1) break;
    }
  };
  return {
    run,
    level,
    ram,
    engine,
    get state() {
      return state!;
    },
    probe: (name: string) => number(engine.probe(state!, name)),
  };
}
Deno.test("CPU fetches, decodes and executes through NAND circuits", () => {
  const b = cpuBench("LDI R0, 7\nLDI R1, 5\nADD R0, R1\nST R0, 0x2000\nHALT");
  b.run();
  assert.equal(b.probe("Fault"), 0);
  assert.equal(b.probe("Halted"), 1);
  assert.equal(b.probe("R0"), 12);
  assert.equal(b.ram[0x2000], 12);
  assert.equal(b.probe("Retired"), 5);
  assert.ok(
    b.engine.model.nodes.every((n) =>
      ["INPUT", "LOW", "HIGH", "NAND", "WIRE"].includes(n.op)
    ),
  );
});
Deno.test("gate CPU stack, branches, load, indexed addressing and shifts", () => {
  const b = cpuBench(`LDI R0, 19
CALL sub
ST R0, 0x2000
LDI R2, 3
STX R0, 0x2100, R2
LDX R4, 0x2100, R2
CMPI R4, 42
JNZ failed
SHL R4
SHR R4
PUSH R4
POP R5
HALT
failed:
LDI R5, 255
HALT
sub:
ADDI R0, 23
RET`);
  b.run();
  assert.equal(b.probe("Fault"), 0);
  assert.equal(b.probe("Halted"), 1);
  assert.equal(b.probe("R5"), 42);
  assert.equal(b.ram[0x2103], 42);
  assert.equal(b.probe("SP"), 0xefff);
});
Deno.test("gate faults stop invalid instructions without writing aliased registers", () => {
  for (
    const [source, fault] of [[".byte 255", 1], [".byte 16, 8, 42", 2], [
      "RET",
      5,
    ], ["JMP 0x2000", 3]] as const
  ) {
    const b = cpuBench(source);
    b.run();
    assert.equal(b.probe("Halted"), 1, source);
    assert.equal(b.probe("Fault"), fault, source);
    assert.equal(b.probe("R0"), 0, source);
    const retired = b.probe("Retired");
    for (let i = 0; i < 4; i++) {
      b.level(0);
      b.level(1);
    }
    assert.equal(b.probe("Retired"), retired);
    b.level(0, 1);
    b.level(0, 0);
    assert.equal(b.probe("Halted"), 0);
    assert.equal(b.probe("Fault"), 0);
    assert.equal(b.probe("PC"), 0);
  }
});
