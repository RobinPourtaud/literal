import type { Circuit, Component, Kind, Wire } from "@literal/core";
const n = (
  id: string,
  kind: Kind,
  x: number,
  y: number,
  label = id,
  value?: 0 | 1,
): Component => ({
  id,
  kind,
  x,
  y,
  label,
  ...(value === undefined ? {} : { value }),
});
const w = (id: string, from: string, to: string, port = 0): Wire => ({
  id,
  from,
  to,
  port,
});
export const examples: {
  id: string;
  name: string;
  description: string;
  circuit: Circuit;
}[] = [
  {
    id: "half-adder",
    name: "Half adder",
    description: "Two inputs, sum and carry.",
    circuit: {
      version: 1,
      name: "Half adder",
      components: [
        n("a", "INPUT", 140, 160, "A", 1),
        n("b", "INPUT", 140, 320, "B", 0),
        n("xor", "XOR", 400, 160, "XOR"),
        n("and", "AND", 400, 320, "AND"),
        n("sum", "OUTPUT", 660, 160, "Sum"),
        n("carry", "OUTPUT", 660, 320, "Carry"),
      ],
      wires: [
        w("w1", "a", "xor"),
        w("w2", "b", "xor", 1),
        w("w3", "a", "and"),
        w("w4", "b", "and", 1),
        w("w5", "xor", "sum"),
        w("w6", "and", "carry"),
      ],
    },
  },
  {
    id: "full-adder",
    name: "Full adder",
    description: "Add A, B, and carry-in.",
    circuit: {
      version: 1,
      name: "Full adder",
      components: [
        n("a", "INPUT", 100, 100, "A", 1),
        n("b", "INPUT", 100, 220, "B", 1),
        n("cin", "INPUT", 100, 400, "Carry in", 0),
        n("x1", "XOR", 320, 140, "XOR"),
        n("x2", "XOR", 560, 120, "XOR"),
        n("a1", "AND", 320, 300, "AND"),
        n("a2", "AND", 560, 320, "AND"),
        n("o", "OR", 760, 300, "OR"),
        n("sum", "OUTPUT", 780, 120, "Sum"),
        n("carry", "OUTPUT", 960, 300, "Carry"),
      ],
      wires: [
        w("w1", "a", "x1"),
        w("w2", "b", "x1", 1),
        w("w3", "x1", "x2"),
        w("w4", "cin", "x2", 1),
        w("w5", "a", "a1"),
        w("w6", "b", "a1", 1),
        w("w7", "cin", "a2"),
        w("w8", "x1", "a2", 1),
        w("w9", "a1", "o"),
        w("w10", "a2", "o", 1),
        w("w11", "x2", "sum"),
        w("w12", "o", "carry"),
      ],
    },
  },
  {
    id: "mux",
    name: "Multiplexer",
    description: "Select between two signals.",
    circuit: {
      version: 1,
      name: "Multiplexer",
      components: [
        n("a", "INPUT", 140, 100, "Data 0", 0),
        n("b", "INPUT", 140, 220, "Data 1", 1),
        n("s", "INPUT", 140, 340, "Select", 0),
        n("mux", "MUX", 420, 220, "MUX"),
        n("out", "OUTPUT", 700, 220, "Output"),
      ],
      wires: [
        w("w1", "a", "mux"),
        w("w2", "b", "mux", 1),
        w("w3", "s", "mux", 2),
        w("w4", "mux", "out"),
      ],
    },
  },
  {
    id: "register",
    name: "D flip-flop",
    description: "Capture data on a rising edge.",
    circuit: {
      version: 1,
      name: "D flip-flop",
      components: [
        n("data", "INPUT", 160, 140, "Data", 1),
        n("clk", "CLOCK", 160, 300, "Clock", 0),
        n("dff", "DFF", 440, 220, "D flip-flop"),
        n("out", "OUTPUT", 700, 220, "Q"),
      ],
      wires: [
        w("w1", "data", "dff"),
        w("w2", "clk", "dff", 1),
        w("w3", "dff", "out"),
      ],
    },
  },
  {
    id: "counter",
    name: "Toggle flip-flop",
    description: "One bit of state with feedback.",
    circuit: {
      version: 1,
      name: "Toggle flip-flop",
      components: [
        n("clk", "CLOCK", 140, 300, "Clock", 0),
        n("dff", "DFF", 400, 220, "D flip-flop"),
        n("not", "NOT", 660, 100, "NOT"),
        n("out", "OUTPUT", 660, 300, "Q"),
      ],
      wires: [
        w("w1", "clk", "dff", 1),
        w("w2", "dff", "not"),
        w("w3", "not", "dff"),
        w("w4", "dff", "out"),
      ],
    },
  },
];
export const clone = <T>(value: T): T => structuredClone(value);
export const blank = (): Circuit => ({
  version: 1,
  name: "Untitled circuit",
  components: [],
  wires: [],
});
