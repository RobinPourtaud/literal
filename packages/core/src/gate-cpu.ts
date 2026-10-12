import { instructionSet } from "./computer.ts";
import { GateBuilder, type GateModel } from "./gate-netlist.ts";
export function gateCPU(): GateModel {
  const b = new GateBuilder("Literal 8 · gate CPU");
  const data = b.bus("Data ", 8),
    result = b.bus("Result ", 8),
    carryIn = b.input("Carry"),
    zeroIn = b.input("Zero"),
    clock = b.input("Clock", true),
    reset = b.input("Reset");
  const group = (label: string, start: number) => {
    (b.model.groups ??= []).push({
      label,
      nodes: b.model.nodes.slice(start).map((_, i) => start + i),
      outputs: [b.model.nodes.length - 1],
    });
  };
  const running = b.ref("Execute allowed", 1);
  const halted = b.ref("Halted"),
    phase = Array.from({ length: 3 }, (_, i) => b.ref(`Phase ${i}`));
  const p = Array.from({ length: 8 }, (_, i) => b.equal(phase, i));
  const pc = Array.from({ length: 16 }, (_, i) => b.ref(`PC ${i}`));
  const sp = Array.from(
    { length: 16 },
    (_, i) => b.ref(`SP ${i}`, ((0xefff >> i) & 1) as 0 | 1),
  );
  const registers = Array.from(
    { length: 8 },
    (_, r) => Array.from({ length: 8 }, (_, i) => b.ref(`R${r} bit ${i}`)),
  );
  const section0 = b.model.nodes.length;
  const ir = b.register(data, clock, p[0], reset, 0, "Instruction");
  const decoded = Object.fromEntries(
    instructionSet.map((op) => [op.name, b.equal(ir, op.code)]),
  );
  const op = (...names: string[]) => b.any(names.map((n) => decoded[n]));
  const operands = instructionSet.map((o) =>
    [...o.args].reduce((n, c) => n + (c === "a" ? 2 : 1), 0)
  );
  const has = Array.from(
    { length: 4 },
    (_, i) =>
      b.any(
        instructionSet.filter((_, j) => operands[j] > i).map((o) =>
          decoded[o.name]
        ),
      ),
  );
  const args = Array.from(
    { length: 4 },
    (_, i) =>
      b.register(
        data,
        clock,
        b.and(p[i + 1], has[i]),
        reset,
        0,
        `Operand ${i + 1}`,
      ),
  );
  group("Instruction fetch and decode", section0);
  const section1 = b.model.nodes.length;
  const readRegister = (index: number[]) =>
    b.choose(
      registers.map((bits, i) => ({
        when: b.equal(index.slice(0, 3), i),
        bits,
      })),
      8,
    );
  const ra = readRegister(args[0]),
    rb = readRegister(args[1]),
    rc = readRegister(args[2]),
    index = readRegister(args[3]);
  group("Register read selectors", section1);
  const section2 = b.model.nodes.length;
  const aluOps = [
    { names: ["ADD", "ADDI"], code: 0 },
    { names: ["SUB", "SUBI", "CMP", "CMPI"], code: 1 },
    { names: ["AND", "ANDI"], code: 2 },
    { names: ["OR"], code: 3 },
    { names: ["XOR"], code: 4 },
    { names: ["SHL"], code: 5 },
    { names: ["SHR"], code: 6 },
  ];
  const isALU = b.any(aluOps.map((row) => op(...row.names)));
  const aluB = b.choose([{
    when: op("ADD", "SUB", "AND", "OR", "XOR", "CMP"),
    bits: rb,
  }, { when: op("ADDI", "SUBI", "ANDI", "CMPI"), bits: args[1] }], 8);
  const aluSelect = b.choose(
    aluOps.map((row) => ({
      when: op(...row.names),
      bits: b.constant(row.code, 3),
    })),
    3,
  );
  const flags = b.register(
    [carryIn, zeroIn],
    clock,
    b.and(running, b.and(p[5], isALU)),
    reset,
    0,
    "Flags",
  );
  group("ALU control and flags", section2);
  const section3 = b.model.nodes.length;
  const fetch = b.any([p[0], ...has.map((n, i) => b.and(p[i + 1], n))]);
  const jump = b.and(
    p[5],
    b.any([
      op("JMP"),
      b.and(op("JZ"), flags[1]),
      b.and(op("JNZ"), b.not(flags[1])),
      b.and(op("JC"), flags[0]),
    ]),
  );
  const retLow = b.register(
    data,
    clock,
    b.and(p[5], op("RET")),
    reset,
    0,
    "Return low byte",
  );
  const returned = b.and(p[6], op("RET")), called = b.and(p[7], op("CALL"));
  const pcEnable = b.any([fetch, jump, returned, called]);
  const pcNext = b.choose([{ when: fetch, bits: b.increment(pc) }, {
    when: b.or(jump, called),
    bits: args[0].concat(args[1]),
  }, { when: returned, bits: retLow.concat(data) }], 16);
  const pcStorage = b.register(
    pcNext,
    clock,
    b.and(running, pcEnable),
    reset,
    0,
    "PC",
  );
  pc.forEach((n, i) => b.bind(n, pcStorage[i]));
  group("Program counter and returns", section3);
  const section4 = b.model.nodes.length;
  const pushing = b.or(
    b.and(p[5], op("PUSH", "CALL")),
    b.and(p[6], op("CALL")),
  );
  const popping = b.or(b.and(p[5], op("POP", "RET")), b.and(p[6], op("RET")));
  const spNext = b.select(b.increment(sp), b.increment(sp, -1), pushing);
  const spStorage = b.register(
    spNext,
    clock,
    b.and(running, b.or(pushing, popping)),
    reset,
    0xefff,
    "SP",
  );
  sp.forEach((n, i) => b.bind(n, spStorage[i]));
  group("Stack pointer", section4);
  const section5 = b.model.nodes.length;
  const indexed =
    b.adder(args[1].concat(args[2]), index.concat(b.constant(0, 8))).sum;
  const pixels = b.and(
    b.equal(ra.slice(5), 0),
    b.and(b.equal(rb.slice(5), 0), b.not(b.and(rb[4], rb[3]))),
  );
  const pixelAddress = ra.slice(0, 5).concat(
    rb.slice(0, 5),
    b.constant(0, 2),
    b.constant(15, 4),
  );
  const executeMemory = b.and(p[5], op("LD", "ST", "LDX", "STX"));
  const address = b.choose([
    { when: fetch, bits: pc },
    {
      when: executeMemory,
      bits: b.select(args[1].concat(args[2]), indexed, op("LDX", "STX")),
    },
    { when: pushing, bits: sp },
    { when: popping, bits: b.increment(sp) },
    { when: b.and(p[5], op("PIXEL")), bits: pixelAddress },
    { when: b.and(p[5], op("CLS")), bits: b.constant(0xff02, 16) },
  ], 16);
  group("Address selection", section5);
  const section6 = b.model.nodes.length;
  const writeCommand = b.any([
    b.and(p[5], op("ST", "STX", "PUSH", "CALL", "CLS")),
    b.and(p[5], b.and(op("PIXEL"), pixels)),
    b.and(p[6], op("CALL")),
  ]);
  const write = b.and(clock, b.and(writeCommand, running));
  const outputData = b.choose([
    { when: b.and(p[5], op("ST", "STX", "PUSH")), bits: ra },
    { when: b.and(p[5], op("PIXEL")), bits: rc },
    { when: b.and(p[5], op("CALL")), bits: pc.slice(8) },
    { when: b.and(p[6], op("CALL")), bits: pc.slice(0, 8) },
    { when: b.and(p[5], op("CLS")), bits: b.constant(1, 8) },
  ], 8);
  const read = b.any([
    fetch,
    b.and(p[5], op("LD", "LDX", "POP", "RET")),
    b.and(p[6], op("RET")),
  ]);
  group("Bus control and data", section6);
  const section7 = b.model.nodes.length;
  const storeALU = b.and(p[5], b.and(isALU, b.not(op("CMP", "CMPI"))));
  const writeReg = b.or(
    storeALU,
    b.and(p[5], op("LDI", "LD", "LDX", "POP", "MOV")),
  );
  const regData = b.choose([
    { when: storeALU, bits: result },
    { when: b.and(p[5], op("LDI")), bits: args[1] },
    { when: b.and(p[5], op("MOV")), bits: rb },
    { when: b.and(p[5], op("LD", "LDX", "POP")), bits: data },
  ], 8);
  registers.forEach((bits, i) => {
    const q = b.register(
      regData,
      clock,
      b.and(running, b.and(writeReg, b.equal(args[0].slice(0, 3), i))),
      reset,
      0,
      `R${i}`,
    );
    bits.forEach((n, j) => b.bind(n, q[j]));
  });
  group("Register writeback", section7);
  const section8 = b.model.nodes.length;
  const reg1 = b.any(
    instructionSet.filter((o) => o.args[0] === "r").map((o) => decoded[o.name]),
  );
  const reg2 = b.any(
    instructionSet.filter((o) => o.args[1] === "r").map((o) => decoded[o.name]),
  );
  const invalidRegister = b.any([
    b.and(reg1, b.any(args[0].slice(3))),
    b.and(reg2, b.any(args[1].slice(3))),
    b.and(op("PIXEL"), b.any(args[2].slice(3))),
    b.and(op("LDX", "STX"), b.any(args[3].slice(3))),
  ]);
  const invalidOpcode = b.not(b.any(Object.values(decoded)));
  const invalidPC = b.and(p[0], b.any(pc.slice(13)));
  const overflow = b.and(pushing, b.equal(sp.slice(13), 0)),
    underflow = b.and(popping, b.equal(sp, 0xefff));
  const fault = b.any([
    b.and(p[5], b.or(invalidOpcode, invalidRegister)),
    invalidPC,
    overflow,
    underflow,
  ]);
  b.bind(running, b.not(b.or(halted, fault)));
  const errorData = b.choose([
    { when: b.and(p[5], invalidOpcode), bits: b.constant(1, 3) },
    { when: b.and(p[5], invalidRegister), bits: b.constant(2, 3) },
    { when: invalidPC, bits: b.constant(3, 3) },
    { when: overflow, bits: b.constant(4, 3) },
    { when: underflow, bits: b.constant(5, 3) },
  ], 3);
  const errors = b.register(errorData, clock, fault, reset, 0, "Fault");
  group("Fault detection", section8);
  const section9 = b.model.nodes.length;
  const haltNow = b.or(b.and(p[5], op("HALT")), fault);
  b.bind(halted, b.register([b.high], clock, haltNow, reset, 0, "Halted")[0]);
  const phaseNext = b.increment(phase),
    phaseQ = b.register(
      phaseNext,
      b.not(clock),
      b.not(halted),
      reset,
      0,
      "Phase",
    );
  phase.forEach((n, i) => b.bind(n, phaseQ[i]));
  group("Halt and phase counter", section9);
  const section10 = b.model.nodes.length;
  const retiredRefs = Array.from(
    { length: 32 },
    (_, i) => b.ref(`Retired ${i}`),
  );
  const retired = b.register(
    b.increment(retiredRefs),
    clock,
    b.and(b.not(halted), b.or(p[7], b.and(p[5], op("HALT")))),
    reset,
    0,
    "Retired",
  );
  retiredRefs.forEach((n, i) => b.bind(n, retired[i]));
  group("Instruction counter", section10);
  const section11 = b.model.nodes.length;
  const heldAddress = address.map((bit, i) =>
    b.latch(bit, b.not(clock), reset, 0, `Address hold ${i}`)
  );
  group("Address hold", section11);
  b.output(
    heldAddress.concat(outputData, [write, read], ra, aluB, aluSelect),
    "Bus ",
  );
  b.model.resetInputs = [19];
  b.model.probes = {
    ...b.model.probes,
    PC: pc,
    SP: sp,
    IR: ir,
    Phase: phase,
    Flags: flags,
    Halted: [halted],
    Fault: errors,
    Retired: retired,
  };
  return b.model;
}
