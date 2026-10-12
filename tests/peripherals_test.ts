import assert from "node:assert/strict";
import {
  type Circuit,
  keyboardCode,
  type Kind,
  parseCircuit,
  type Signal,
  simulate,
  truthTable,
} from "@literal/core";
function fixture(kind: Kind, count: number): Circuit {
  return {
    version: 1,
    name: kind,
    components: [
      ...Array.from(
        { length: count },
        (_, i) => ({
          id: `i${i}`,
          kind: "INPUT" as const,
          label: `i${i}`,
          x: 0,
          y: i * 20,
          value: 0 as const,
        }),
      ),
      { id: "device", kind, label: kind, x: 300, y: 200 },
    ],
    wires: Array.from(
      { length: count },
      (_, i) => ({ id: `w${i}`, from: `i${i}`, to: "device", port: i }),
    ),
  };
}
const byte = (bits: Signal[]) =>
  bits.reduce<number>((n, b, i) => n + (b === 1 ? 2 ** i : 0), 0);
function set(c: Circuit, port: number, value: number) {
  c.components[port].value = value ? 1 : 0;
}
function setByte(c: Circuit, start: number, value: number) {
  for (let i = 0; i < 8; i++) set(c, start + i, value >> i & 1);
}
Deno.test("VGA writes only on a known rising edge, holds pixels, clips Y and clears", () => {
  const c = fixture("VGA", 15);
  set(c, 0, 1);
  set(c, 5, 1);
  set(c, 10, 1);
  let sim = simulate(c);
  const initial = sim.memory;
  set(c, 13, 1);
  sim = simulate(c, sim.memory);
  assert.equal(sim.memory.screens!.device[33], 4);
  assert.equal(initial.screens!.device[33], 0);
  set(c, 11, 1);
  sim = simulate(c, sim.memory);
  assert.equal(sim.memory.screens!.device[33], 4);
  set(c, 13, 0);
  sim = simulate(c, sim.memory);
  set(c, 13, 1);
  sim = simulate(c, sim.memory);
  assert.equal(sim.memory.screens!.device[33], 6);
  set(c, 14, 1);
  sim = simulate(c, sim.memory);
  assert.ok(sim.memory.screens!.device.every((p) => p === 0));
  set(c, 14, 0);
  set(c, 13, 0);
  set(c, 8, 1);
  set(c, 9, 1);
  sim = simulate(c, sim.memory);
  set(c, 13, 1);
  sim = simulate(c, sim.memory);
  assert.ok(sim.memory.screens!.device.every((p) => p === 0));
  c.wires = c.wires.filter((w) => w.port !== 0);
  set(c, 13, 0);
  sim = simulate(c, sim.memory);
  set(c, 13, 1);
  sim = simulate(c, sim.memory);
  assert.match(sim.warnings.join(""), /known coordinates/);
});
Deno.test("keyboard byte, pressed output and mapping validation", () => {
  const c = fixture("KEYBOARD", 0),
    sim = simulate(c, undefined, {}, { device: { code: 65, pressed: true } });
  assert.equal(byte(sim.outputValues.device.slice(0, 8)), 65);
  assert.equal(sim.outputValues.device[8], 1);
  assert.equal(keyboardCode("KeyA"), 65);
  assert.equal(keyboardCode("KeyW", { KeyW: "↑" }), 128);
  c.components[0].keyMap = { KeyW: "↑" };
  assert.deepEqual(
    parseCircuit(JSON.stringify(c)).components[0].keyMap,
    c.components[0].keyMap,
  );
  c.components[0].keyMap = { KeyW: "invalid" };
  assert.throws(() => parseCircuit(JSON.stringify(c)), /mapping/);
  assert.throws(() => truthTable(c), /interactive/);
});
Deno.test("adder computes all byte pairs and carry, unknown inputs propagate", () => {
  const c = fixture("ADDER8", 17);
  for (const a of [0, 1, 127, 128, 255]) {
    for (const b of [0, 1, 127, 128, 255]) {
      for (const carry of [0, 1]) {
        setByte(c, 0, a);
        setByte(c, 8, b);
        set(c, 16, carry);
        const sim = simulate(c);
        assert.equal(byte(sim.outputValues.device), a + b + carry);
      }
    }
  }
  c.wires.pop();
  assert.ok(simulate(c).outputValues.device.some((b) => b === "X"));
});
Deno.test("registers, counters, RAM and ROM preserve synchronous and asynchronous semantics", () => {
  const reg = fixture("REGISTER8", 11);
  setByte(reg, 0, 173);
  set(reg, 9, 1);
  let s = simulate(reg);
  set(reg, 8, 1);
  s = simulate(reg, s.memory);
  assert.equal(byte(s.outputValues.device), 173);
  setByte(reg, 0, 42);
  s = simulate(reg, s.memory);
  assert.equal(byte(s.outputValues.device), 173);
  set(reg, 10, 1);
  s = simulate(reg, s.memory);
  assert.equal(byte(s.outputValues.device), 0);
  const counter = fixture("COUNTER8", 3);
  set(counter, 1, 1);
  s = simulate(counter);
  for (let i = 0; i < 257; i++) {
    set(counter, 0, 1);
    s = simulate(counter, s.memory);
    set(counter, 0, 0);
    s = simulate(counter, s.memory);
  }
  assert.equal(byte(s.outputValues.device), 1);
  const ram = fixture("RAM", 18);
  setByte(ram, 0, 255);
  setByte(ram, 8, 213);
  set(ram, 16, 1);
  s = simulate(ram);
  const before = s.memory;
  set(ram, 17, 1);
  s = simulate(ram, s.memory);
  assert.equal(byte(s.outputValues.device), 213);
  assert.equal(byte(before.ram!.device.slice(255 * 8)), 0);
  setByte(ram, 8, 7);
  s = simulate(ram, s.memory);
  assert.equal(byte(s.outputValues.device), 213);
  setByte(ram, 0, 0);
  s = simulate(ram, s.memory);
  assert.equal(byte(s.outputValues.device), 0);
  const rom = fixture("ROM", 8);
  rom.components.at(-1)!.contents = [42, 255];
  assert.equal(byte(simulate(rom).outputValues.device), 42);
  set(rom, 0, 1);
  assert.equal(byte(simulate(rom).outputValues.device), 255);
  assert.deepEqual(
    parseCircuit(JSON.stringify(rom)).components.at(-1)!.contents,
    [42, 255],
  );
  rom.components.at(-1)!.contents = [256];
  assert.throws(() => parseCircuit(JSON.stringify(rom)), /ROM/);
});
