import { completeALUCircuit } from "./alu.ts";
import { assemble } from "./computer.ts";
import { snakeGame } from "./snake.ts";
import type { Circuit, Signal } from "./index.ts";

export interface ProcessorState {
  registers: number[];
  pc: number;
  sp: number;
  zero: boolean;
  carry: boolean;
  halted: boolean;
  error: string;
  cycles: number;
  signals: Signal[];
  phase?: number;
}
export const initialProcessor = (): ProcessorState => ({
  registers: Array(8).fill(0),
  pc: 0,
  sp: 0xefff,
  zero: false,
  carry: false,
  halted: false,
  error: "",
  cycles: 0,
  signals: Array(45).fill(0),
});
export const bitsOf = (value: number, length: number): Signal[] =>
  Array.from({ length }, (_, i) => (value >> i & 1) as Signal);
export const numberOf = (bits: Signal[]) =>
  bits.includes("X")
    ? null
    : bits.reduce<number>((n, bit, i) => n | (Number(bit) << i), 0);
export function computerCircuit(source = snakeGame): Circuit {
  const alu = completeALUCircuit();
  const circuit: Circuit = {
    version: 1,
    name: "Literal 8 · Snake computer",
    definitions: [{
      id: "literal-alu8",
      name: "ALU 8",
      color: "#527d3c",
      shape: "rounded",
      components: alu.components,
      wires: alu.wires,
    }],
    components: [
      { id: "clock", kind: "CLOCK", x: 0, y: 0, label: "Clock", value: 0 },
      {
        id: "reset",
        kind: "INPUT",
        x: 0,
        y: 140,
        label: "Reset / zero",
        value: 0,
      },
      {
        id: "cpu",
        kind: "BUS_CPU",
        x: 300,
        y: 540,
        label: "Literal 8 control",
      },
      {
        id: "alu",
        kind: "CUSTOM",
        definition: "literal-alu8",
        x: 700,
        y: 1080,
        label: "ALU",
      },
      {
        id: "rom",
        kind: "BUS_ROM",
        x: 700,
        y: 0,
        label: "Boot ROM",
        contents: [...assemble(source).rom],
        source,
      },
      { id: "ram", kind: "BUS_RAM", x: 1050, y: 0, label: "RAM" },
      {
        id: "keyboard",
        kind: "BUS_KEYBOARD",
        x: 700,
        y: 600,
        label: "Keyboard",
      },
      { id: "screen", kind: "BUS_SCREEN", x: 1050, y: 600, label: "Screen" },
      {
        id: "terminal",
        kind: "BUS_TERMINAL",
        x: 1400,
        y: 600,
        label: "Terminal",
      },
    ],
    wires: [],
  };
  const wire = (from: string, fromPort: number, to: string, port: number) =>
    circuit.wires.push({
      id: `wire-${circuit.wires.length}`,
      from,
      ...(fromPort ? { fromPort } : {}),
      to,
      port,
    });
  wire("clock", 0, "cpu", 18);
  wire("reset", 0, "cpu", 19);
  wire("reset", 0, "alu", 19);
  for (let i = 0; i < 19; i++) wire("cpu", 26 + i, "alu", i);
  for (let i = 0; i < 10; i++) wire("alu", i, "cpu", 8 + i);
  for (const device of ["rom", "ram", "keyboard", "screen", "terminal"]) {
    for (let i = 0; i < 16; i++) wire("cpu", i, device, i);
    if (["ram", "screen", "terminal"].includes(device)) {
      for (let i = 0; i < 8; i++) wire("cpu", 16 + i, device, 16 + i);
      wire("cpu", 24, device, 24);
    }
  }
  for (let bit = 0; bit < 8; bit++) {
    let from = "rom", fromPort = bit;
    for (const [index, device] of ["ram", "keyboard", "screen"].entries()) {
      const id = `read-${bit}-${index}`;
      circuit.components.push({
        id,
        kind: "OR",
        x: 1500 + index * 180,
        y: bit * 120 - 220,
        label: `Data ${bit}`,
      });
      wire(from, fromPort, id, 0);
      wire(device, bit, id, 1);
      from = id;
      fromPort = 0;
    }
    wire(from, fromPort, "cpu", bit);
  }
  return circuit;
}
