import { Computer } from "./reference-computer.ts";
import assert from "node:assert/strict";
import {
  aluCircuit,
  aluNetlist,
  assemble,
  evaluateALU,
  parseCircuit,
  simulate,
} from "@literal/core";

Deno.test("primitive ALU gates match all byte pairs and arithmetic flags", () => {
  for (let a = 0; a < 256; a++) {
    for (let b = 0; b < 256; b++) {
      for (
        const [operation, expected] of [
          ["ADD", a + b],
          ["SUB", a - b],
          ["AND", a & b],
          ["OR", a | b],
          ["XOR", a ^ b],
        ] as const
      ) {
        const result = evaluateALU(operation, a, b);
        assert.equal(result.value, expected & 255);
        assert.equal(result.zero, (expected & 255) === 0);
        assert.equal(result.carry, expected < 0 || expected > 255);
      }
    }
    assert.equal(evaluateALU("SHL", a, 0).value, (a << 1) & 255);
    assert.equal(evaluateALU("SHL", a, 0).carry, !!(a & 128));
    assert.equal(evaluateALU("SHR", a, 0).value, a >> 1);
    assert.equal(evaluateALU("SHR", a, 0).carry, !!(a & 1));
  }
});
Deno.test("exploded ALU is a portable editable circuit with identical outputs", () => {
  for (
    const operation of ["ADD", "SUB", "AND", "OR", "XOR", "SHL", "SHR"] as const
  ) {
    assert.ok(
      aluNetlist(operation).nodes.every((n) =>
        ["INPUT", "AND", "OR", "NOT"].includes(n.kind)
      ),
    );
    for (const [a, b] of [[255, 1], [0, 255], [85, 170], [37, 37]]) {
      const circuit = parseCircuit(JSON.stringify(aluCircuit(operation, a, b)));
      const result = simulate(circuit), expected = evaluateALU(operation, a, b);
      const value = Array.from(
        { length: 8 },
        (_, i) => result.values[`out-${i}`],
      ).reduce<number>((sum, bit, i) => sum | (Number(bit) << i), 0);
      assert.equal(value, expected.value);
      assert.equal(result.values["out-8"], +expected.carry);
      assert.equal(result.values["out-9"], +expected.zero);
      assert.deepEqual(result.warnings, []);
    }
  }
});
Deno.test("CPU instruction fetch and device operations use the connected bus", () => {
  const cpu = new Computer(
    assemble(
      "LDI R0, 42\nST R0, 0x2000\nLD R1, 0x2000\nST R1, 0xF000\nLD R2, 0xFF00\nHALT",
    ).rom,
  );
  cpu.keyboard = { code: 131, pressed: true };
  cpu.run(20);
  assert.equal(cpu.registers[1], 42);
  assert.equal(cpu.registers[2], 131);
  assert.equal(cpu.framebuffer[0], 2);
  assert.ok(cpu.activity.get("ROM")!.reads > 0);
  assert.equal(cpu.activity.get("RAM")!.writes, 1);
  assert.equal(cpu.activity.get("RAM")!.reads, 1);
  assert.equal(cpu.activity.get("Screen")!.writes, 1);
  assert.equal(cpu.activity.get("Keyboard")!.reads, 1);
  const unplugged = new Computer(assemble("NOP").rom);
  unplugged.connected.delete("ROM");
  unplugged.step();
  assert.match(unplugged.error, /ROM is disconnected/);
  const ram = new Computer(assemble("LD R0, 0x2000").rom);
  ram.connected.delete("RAM");
  ram.step();
  assert.match(ram.error, /RAM is disconnected/);
  const screen = new Computer(assemble("CLS").rom);
  screen.connected.delete("Screen");
  screen.step();
  assert.match(screen.error, /Screen is disconnected/);
});
