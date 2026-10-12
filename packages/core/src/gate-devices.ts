import type { Component, Kind } from "./index.ts";
import { GateBuilder, type GateModel } from "./gate-netlist.ts";
import { gateCPU } from "./gate-cpu.ts";
import { gateMemory, gateROM } from "./gate-memory.ts";
const cache = new Map<string, GateModel>();
const masks = [
  0x3f,
  0x06,
  0x5b,
  0x4f,
  0x66,
  0x6d,
  0x7d,
  0x07,
  0x7f,
  0x6f,
  0x77,
  0x7c,
  0x39,
  0x5e,
  0x79,
  0x71,
];
export function gateDevice(
  c: Pick<Component, "kind" | "contents">,
): GateModel | null {
  const key = `${c.kind}:${JSON.stringify(c.contents ?? [])}`;
  if (cache.has(key)) return cache.get(key)!;
  const b = new GateBuilder(c.kind);
  let supported = true;
  const bitInputs = (labels: string[]) => labels.map((label) => b.input(label));
  switch (c.kind) {
    case "BUS_CPU":
      return gateCPUModel();
    case "DFF": {
      const d = b.input("Data"), clk = b.input("Clock", true);
      b.output([b.flipFlop(d, clk, b.low)]);
      break;
    }
    case "REGISTER8": {
      const d = b.bus("D", 8),
        clk = b.input("Clock", true),
        enable = b.input("Enable"),
        reset = b.input("Clear");
      b.output(b.register(d, clk, enable, reset));
      b.model.resetInputs = [10];
      break;
    }
    case "COUNTER8": {
      const clk = b.input("Clock", true),
        enable = b.input("Enable"),
        clear = b.input("Clear"),
        q = Array.from({ length: 8 }, (_, i) => b.ref(`Q${i}`));
      const saved = b.register(b.increment(q), clk, enable, clear);
      q.forEach((n, i) => b.bind(n, saved[i]));
      b.output(q);
      b.model.resetInputs = [2];
      break;
    }
    case "ADDER8": {
      const a = b.bus("A", 8),
        other = b.bus("B", 8),
        carry = b.input("Carry in"),
        sum = b.adder(a, other, carry);
      b.output(sum.sum.concat(sum.carry));
      break;
    }
    case "RAM": {
      const a = b.bus("A", 8),
        d = b.bus("D", 8),
        write = b.input("Write"),
        clk = b.input("Clock", true);
      const enable = b.latch(write, b.not(clk), b.low, 0, "Write enable");
      b.output(
        b.instance(gateMemory(8), a.concat(d, [b.and(clk, enable), b.low])),
      );
      break;
    }
    case "ROM":
      return gateROMModel(c.contents ?? [], 8);
    case "BUS_ROM": {
      const a = b.bus("A", 16),
        bits = b.instance(gateROMModel(c.contents ?? [], 13), a.slice(0, 13)),
        enabled = b.equal(a.slice(13), 0);
      b.output(bits.map((n) => b.and(n, enabled)));
      break;
    }
    case "BUS_RAM": {
      const a = b.bus("A", 16),
        d = b.bus("D", 8),
        write = b.input("Write", true),
        selected = b.and(
          b.not(b.equal(a.slice(13), 0)),
          b.not(b.equal(a.slice(12), 15)),
        );
      const memory = b.instance(
        gateMemory(16),
        a.concat(d, [b.and(write, selected), b.low]),
        "RAM array",
      );
      b.output(memory.map((n) => b.and(n, selected)));
      b.model.probes.Memory = memory;
      break;
    }
    case "BUS_SCREEN": {
      const a = b.bus("A", 16),
        d = b.bus("D", 8),
        write = b.input("Write", true),
        frame = b.and(b.equal(a.slice(10), 60), b.not(b.and(a[9], a[8]))),
        clear = b.all([b.equal(a, 0xff02), write, b.any(d)]);
      const memory = b.instance(
        gateMemory(10, 3),
        a.slice(0, 10).concat(d.slice(0, 3), [b.and(write, frame), clear]),
        "Framebuffer",
      );
      b.output(memory.map((n) => b.and(n, frame)).concat(b.constant(0, 5)));
      b.model.probes.Framebuffer = memory;
      break;
    }
    case "VGA": {
      const x = b.bus("X", 5),
        y = b.bus("Y", 5),
        rgb = bitInputs(["Red", "Green", "Blue"]),
        write = b.input("Write", true),
        clear = b.input("Clear");
      const valid = b.not(b.and(y[4], y[3]));
      const memory = b.instance(
        gateMemory(10, 3),
        x.concat(y, rgb.reverse(), [b.and(write, valid), clear]),
        "Framebuffer",
      );
      b.output(memory);
      b.model.probes.Framebuffer = memory;
      b.model.resetInputs = [14];
      break;
    }
    case "HEX_DISPLAY": {
      const d = b.bus("Bit ", 4),
        select = Array.from({ length: 16 }, (_, i) => b.equal(d, i));
      b.output(
        Array.from(
          { length: 7 },
          (_, bit) => b.any(select.filter((_, n) => masks[n] >> bit & 1)),
        ).concat(b.low),
        "Segment ",
      );
      break;
    }
    case "SEVEN_SEG":
      b.output(bitInputs(["a", "b", "c", "d", "e", "f", "g", "dp"]));
      break;
    case "KEYBOARD": {
      const data = b.bus("Physical code ", 8),
        pressed = b.input("Physical pressed");
      b.output(data.concat(pressed));
      break;
    }
    case "BUS_KEYBOARD": {
      const a = b.bus("A", 16),
        code = b.bus("Physical code ", 8),
        pressed = b.input("Physical pressed"),
        readCode = b.equal(a, 0xff00),
        readPressed = b.equal(a, 0xff01);
      b.output(
        code.map((n, i) =>
          b.or(
            b.and(n, readCode),
            i === 0 ? b.and(pressed, readPressed) : b.low,
          )
        ),
      );
      break;
    }
    case "BUS_TERMINAL": {
      const a = b.bus("A", 16),
        data = b.bus("D", 8),
        write = b.input("Write", true),
        strobe = b.and(write, b.equal(a, 0xff03));
      const counter = Array.from(
        { length: 32 },
        (_, i) => b.ref(`Character count ${i}`),
      );
      const next = b.register(
        b.increment(counter),
        b.not(strobe),
        b.high,
        b.low,
        0,
        "Character count",
      );
      counter.forEach((n, i) => b.bind(n, next[i]));
      const memory = b.instance(
        gateMemory(12),
        counter.slice(0, 12).concat(data, [strobe, b.low]),
        "Character buffer",
      );
      b.output(memory);
      b.model.probes.Write = [strobe];
      b.model.probes.Count = counter;
      b.model.probes.Characters = memory;
      break;
    }
    case "AND":
    case "OR":
    case "NOT":
    case "NAND":
    case "NOR":
    case "XOR":
    case "XNOR":
    case "BUFFER":
    case "MUX": {
      const ins = bitInputs(
          c.kind === "NOT" || c.kind === "BUFFER"
            ? ["A"]
            : c.kind === "MUX"
            ? ["Data 0", "Data 1", "Select"]
            : ["A", "B"],
        ),
        [a, other, s] = ins;
      const out = c.kind === "AND"
        ? b.and(a, other)
        : c.kind === "OR"
        ? b.or(a, other)
        : c.kind === "NOT"
        ? b.not(a)
        : c.kind === "NAND"
        ? b.nand(a, other)
        : c.kind === "NOR"
        ? b.not(b.or(a, other))
        : c.kind === "XOR"
        ? b.xor(a, other)
        : c.kind === "XNOR"
        ? b.not(b.xor(a, other))
        : c.kind === "MUX"
        ? b.mux(a, other, s)
        : a;
      b.output([out]);
      break;
    }
    default:
      supported = false;
  }
  if (!supported) return null;
  if (cache.size > 100) cache.clear();
  cache.set(key, b.model);
  return b.model;
}
let cpu: GateModel | undefined;
function gateCPUModel() {
  return cpu ??= gateCPU();
}
function gateROMModel(contents: number[], bits: number) {
  const key = `ROM:${bits}:${JSON.stringify(contents)}`;
  let model = cache.get(key);
  if (!model) {
    model = gateROM(contents, bits);
    cache.set(key, model);
  }
  return model;
}
export const gateComputationalKinds: Kind[] = [
  "BUS_CPU",
  "BUS_ROM",
  "BUS_RAM",
  "BUS_SCREEN",
  "BUS_KEYBOARD",
  "BUS_TERMINAL",
  "DFF",
  "REGISTER8",
  "COUNTER8",
  "ADDER8",
  "RAM",
  "ROM",
  "VGA",
  "HEX_DISPLAY",
  "SEVEN_SEG",
  "KEYBOARD",
];
