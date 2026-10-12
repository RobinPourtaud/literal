import assert from "node:assert/strict";
import {
  assemble,
  bootProgram,
  GateComputer,
  programGateMemory,
  simulate,
} from "@literal/core";
import { Computer } from "./reference-computer.ts";
Deno.test("connected NAND computer matches instruction results, stack and devices", () => {
  const source = `LDI R0, 255
LDI R1, 1
ADD R0, R1
JC carry
HALT
carry: SUB R0, R1
AND R0, R1
OR R0, R1
XOR R0, R1
ADDI R0, 4
SUBI R0, 2
ANDI R0, 3
MOV R2, R0
CMP R0, R2
JZ equal
HALT
equal: CMPI R0, 3
JNZ next
HALT
next: SHL R0
SHR R0
PUSH R0
POP R3
CALL sub
ST R3, 0x2000
LD R4, 0x2000
STX R4, 0x2000, R1
LDX R5, 0x2000, R1
LD R6, 0xFF00
LDI R0, 4
LDI R1, 6
LDI R2, 7
PIXEL R0, R1, R2
CLS
PIXEL R0, R1, R2
LDI R7, 65
ST R7, 0xFF03
NOP
HALT
sub: ADDI R3, 5
RET`;
  const gate = new GateComputer(source),
    reference = new Computer(assemble(source).rom);
  gate.keyboard = reference.keyboard = { code: 131, pressed: true };
  for (let i = 0; i < 100 && !reference.halted; i++) {
    reference.step();
    gate.step();
    const p = gate.processor;
    assert.equal(p.error, "", `Instruction ${i}`);
    assert.deepEqual(p.registers, [...reference.registers], `Instruction ${i}`);
    assert.equal(p.pc, reference.pc);
    assert.equal(p.sp, reference.sp);
    assert.equal(p.carry, reference.carry);
    assert.equal(p.zero, reference.zero);
    assert.equal(p.halted, reference.halted);
    assert.deepEqual(gate.simulation.memory.screens!.screen, [
      ...reference.framebuffer,
    ]);
    assert.equal(
      gate.simulation.memory.terminals!.terminal,
      reference.terminal,
    );
  }
  assert.equal(gate.processor.halted, true);
  assert.equal(gate.simulation.memory.busRAM!.ram[0x2000], reference.ram[0]);
  gate.reset();
  assert.equal(gate.processor.pc, 0);
  assert.equal(gate.processor.cycles, 0);
  assert.equal(gate.simulation.memory.terminals!.terminal, "");
});
Deno.test("BIOS self-test, terminal and application run through the connected gate computer", () => {
  const source = bootProgram(
    ".org 0x0200\ngame:\nLDI R0, 42\nST R0, 0x2000\nHALT",
    "Gate test",
    "Ready",
  );
  const gate = new GateComputer(source),
    reference = new Computer(assemble(source).rom);
  reference.run(10000);
  gate.step(reference.cycles);
  assert.equal(gate.processor.error, "");
  assert.equal(gate.processor.halted, true);
  assert.equal(gate.processor.cycles, reference.cycles);
  assert.equal(gate.simulation.memory.terminals!.terminal, reference.terminal);
  assert.equal(gate.simulation.memory.busRAM!.ram[0x2000], 42);
  for (let i = 1; i < 256; i++) {
    assert.equal(gate.simulation.memory.busRAM!.ram[0x2000 + i] ?? 0, 0);
  }
});
Deno.test("RAM programmer pulses actual storage gates and preserves them in the connected circuit", () => {
  const gate = new GateComputer("HALT");
  const previous = gate.simulation.memory;
  const next = programGateMemory(gate.circuit, previous, "ram", 0x2000, [
    0xa5,
    0x3c,
  ]);
  const result = simulate(gate.circuit, next);
  assert.equal(result.memory.busRAM!.ram[0x2000], 0xa5);
  assert.equal(result.memory.busRAM!.ram[0x2001], 0x3c);
  assert.equal(previous.busRAM!.ram[0x2000] ?? 0, 0);
});
Deno.test("Snake boots and grows through gate memory, keyboard and framebuffer connections", async () => {
  const { snakeGame } = await import("@literal/core");
  const program = assemble(snakeGame),
    reference = new Computer(program.rom),
    gate = new GateComputer(snakeGame);
  const until = (pc: number) => {
    for (let i = 0; i < 10000; i++) {
      reference.step();
      if (reference.error) throw Error(reference.error);
      if (reference.pc === pc) return;
    }
    throw Error("Snake did not reach its input loop.");
  };
  until(program.labels.wait_key);
  gate.step(reference.cycles);
  assert.match(
    gate.simulation.memory.terminals!.terminal,
    /self-test OK\nSNAKE/,
  );
  assert.deepEqual(gate.simulation.memory.screens!.screen, [
    ...reference.framebuffer,
  ]);
  const start = reference.cycles;
  reference.keyboard = gate.keyboard = { code: 131, pressed: true };
  until(program.labels.release_key);
  gate.step(reference.cycles - start);
  assert.equal(gate.processor.error, "");
  assert.equal(gate.simulation.memory.busRAM!.ram[0x2000], 4);
  assert.equal(gate.simulation.memory.busRAM!.ram[0x2001], 1);
  assert.equal(gate.simulation.memory.busRAM!.ram[0x2100], 17);
  assert.deepEqual(gate.simulation.memory.screens!.screen, [
    ...reference.framebuffer,
  ]);
});
