import assert from "node:assert/strict";
import {
  assemble,
  biosGame,
  Computer,
  grayOrder,
  minimizeLogic,
  snakeGame,
} from "@literal/core";

Deno.test("assembler resolves forward labels and emits little-endian addresses", () => {
  const result = assemble(
    "CALL start\nHALT\n.org 0x0200\nstart:\nLDI R7, 'A'\nRET",
  );
  assert.deepEqual([...result.rom.slice(0, 4)], [0x44, 0, 2, 1]);
  assert.equal(result.labels.start, 512);
  const cpu = new Computer(result.rom);
  cpu.run(20);
  assert.equal(cpu.registers[7], 65);
  assert.equal(cpu.halted, true);
  assert.equal(cpu.error, "");
  assert.equal(cpu.sp, 0xefff);
  for (
    const code of [
      "LDI R8, 0",
      "LDI R0, 256",
      "JMP missing",
      ".org 8192\nNOP",
      ".byte 1\n.org 0\n.byte 2",
      "x:\nx:\nHALT",
    ]
  ) assert.throws(() => assemble(code));
});
Deno.test("CPU executes arithmetic, branches, shifts, stack, RAM and indexed addressing", () => {
  const program = assemble(`LDI R0, 255
ADDI R0, 1
JZ zero
HALT
zero:
JC carry
HALT
carry:
LDI R1, 3
LDI R2, 5
ADD R1, R2
ST R1, 0x2000
LD R3, 0x2000
SHL R3
SHR R3
PUSH R3
LDI R3, 0
POP R3
LDI R4, 2
STX R3, 0x2100, R4
LDX R5, 0x2100, R4
SUBI R5, 1
ANDI R5, 3
CMP R5, R4
JNZ done
LDI R7, 255
done:
HALT`);
  const cpu = new Computer(program.rom);
  cpu.run(100);
  assert.equal(cpu.error, "");
  assert.equal(cpu.read(0x2000), 8);
  assert.equal(cpu.read(0x2102), 8);
  assert.equal(cpu.registers[3], 8);
  assert.equal(cpu.registers[5], 3);
  assert.equal(cpu.registers[7], 0);
  assert.throws(() => cpu.write(0, 1), /ROM/);
  const broken = new Computer(assemble("RET").rom);
  broken.step();
  assert.match(broken.error, /underflow/);
  const unknown = new Computer(Uint8Array.of(255));
  unknown.step();
  assert.match(unknown.error, /opcode/);
});
Deno.test("BIOS boots the opcode demo and keyboard instructions move the pixel", () => {
  const cpu = new Computer(assemble(biosGame).rom);
  cpu.run(10000);
  assert.match(cpu.terminal, /RAM: 256-byte self-test OK/);
  assert.equal(cpu.read(0x20ff), 0);
  assert.equal(cpu.framebuffer[12 * 32 + 16], 7);
  assert.equal(cpu.error, "");
  cpu.keyboard = { code: 131, pressed: true };
  cpu.run(200);
  assert.equal(cpu.registers[0], 17);
  assert.equal(cpu.read(0x2000), 1);
  assert.equal(cpu.framebuffer[17 * 32 + 24], 2);
  assert.equal(cpu.framebuffer[12 * 32 + 16], 0);
  assert.equal(cpu.framebuffer[12 * 32 + 17], 7);
  cpu.run(200);
  assert.equal(cpu.registers[0], 17);
  cpu.keyboard.pressed = false;
  cpu.run(100);
  cpu.keyboard = { code: 128, pressed: true };
  cpu.run(100);
  assert.equal(cpu.registers[1], 11);
  assert.equal(cpu.error, "");
  cpu.write(0xff02, 1);
  assert.ok(cpu.framebuffer.every((p) => p === 0));
});
Deno.test("Snake opcodes grow, reject reversal, collide, restart and avoid occupied food", () => {
  const cpu = new Computer(assemble(snakeGame).rom);
  cpu.run(10000);
  const press = (code: number) => {
    cpu.keyboard = { code, pressed: true };
    cpu.run(4000);
    cpu.keyboard.pressed = false;
    cpu.run(1000);
    assert.equal(cpu.error, "");
  };
  assert.match(cpu.terminal, /self-test OK\nSNAKE/);
  assert.equal(cpu.read(0x2000), 3);
  assert.equal(cpu.framebuffer[0], 4);
  press(131);
  assert.equal(cpu.read(0x2000), 4);
  assert.equal(cpu.read(0x2001), 1);
  assert.equal(cpu.read(0x2100), 17);
  assert.deepEqual(Array.from({ length: 4 }, (_, i) => cpu.read(0x2100 + i)), [
    17,
    16,
    15,
    14,
  ]);
  assert.equal(cpu.framebuffer[17 * 32 + 24], 2);
  press(130);
  assert.equal(cpu.read(0x2100), 17);
  cpu.registers[5] = 18;
  cpu.registers[6] = 12;
  press(131);
  assert.equal(cpu.read(0x2000), 5);
  press(129);
  press(130);
  press(128);
  assert.equal(cpu.read(0x2004), 1);
  assert.match(cpu.terminal, /Game over/);
  press(82);
  assert.equal(cpu.read(0x2004), 0);
  assert.equal(cpu.read(0x2001), 0);
  for (let i = 0; i < 15; i++) press(131);
  assert.equal(cpu.read(0x2004), 1);
  press(82);
  cpu.registers[5] = 17;
  cpu.registers[6] = 12;
  cpu.write(0x2101, 24);
  cpu.write(0x2201, 17);
  press(131);
  assert.notEqual(cpu.framebuffer[17 * 32 + 24], 2);
  assert.equal(cpu.framebuffer[22 * 32 + 1], 2);
});
Deno.test("BIOS reports a RAM self-test failure and does not launch the game", () => {
  class FaultyRAM extends Computer {
    override write(address: number, value: number) {
      super.write(address, address === 0x2080 ? 0 : value);
    }
  }
  const cpu = new FaultyRAM(assemble(snakeGame).rom);
  cpu.run(10000);
  assert.equal(cpu.halted, true);
  assert.match(cpu.terminal, /RAM self-test failed/);
  assert.ok(cpu.framebuffer.every((v) => v === 0));
});
Deno.test("Karnaugh minimization matches every three-variable function and don't-care groups", () => {
  for (let table = 0; table < 256; table++) {
    const cells = Array.from(
        { length: 8 },
        (_, i) => (table >> i & 1) as 0 | 1,
      ),
      result = minimizeLogic(["A", "B", "C"], cells);
    for (let i = 0; i < 8; i++) {
      assert.equal(
        result.groups.some((g) => g.cells.includes(i)),
        !!cells[i],
        `table ${table} cell ${i}`,
      );
    }
  }
  const cells: (0 | 1 | "X")[] = Array(16).fill(0);
  for (const i of [0, 2, 8, 10]) cells[i] = 1;
  const result = minimizeLogic(["A", "B", "C", "D"], cells);
  assert.equal(result.groups.length, 1);
  assert.equal(result.expression, "¬B · ¬D");
  const dc = minimizeLogic(["A", "B"], [1, "X", 0, 0]);
  assert.equal(dc.expression, "¬A");
  assert.deepEqual(grayOrder(2), [0, 1, 3, 2]);
  assert.throws(() => minimizeLogic(["A"], [1]));
});
