import { solveSwitches } from "./transistors.ts";
import {
  bitsOf,
  initialProcessor,
  numberOf,
  type ProcessorState,
  runProcessor,
} from "./wired-computer.ts";
import {
  type KeyboardState,
  screenHeight,
  screenWidth,
  virtualKeys,
} from "./peripherals.ts";
export * from "./peripherals.ts";
export type Signal = 0 | 1 | "X" | "Z";
export const kinds = [
  "NMOS",
  "PMOS",
  "POWER",
  "GROUND",
  "JUNCTION",
  "BUS_CPU",
  "BUS_ROM",
  "BUS_RAM",
  "BUS_SCREEN",
  "BUS_KEYBOARD",
  "BUS_TERMINAL",
  "INPUT",
  "OUTPUT",
  "LED",
  "SEVEN_SEG",
  "HEX_DISPLAY",
  "VGA",
  "KEYBOARD",
  "REGISTER8",
  "COUNTER8",
  "ADDER8",
  "RAM",
  "ROM",
  "CUSTOM",
  "AND",
  "OR",
  "NOT",
  "NAND",
  "NOR",
  "XOR",
  "XNOR",
  "BUFFER",
  "MUX",
  "CLOCK",
  "DFF",
] as const;
export type Kind = typeof kinds[number];
export interface Component {
  id: string;
  kind: Kind;
  x: number;
  y: number;
  label: string;
  value?: 0 | 1;
  definition?: string;
  keyMap?: Record<string, string>;
  contents?: number[];
  source?: string;
}
export interface Wire {
  id: string;
  from: string;
  to: string;
  port: number;
  fromPort?: number;
}
export interface Circuit {
  version: 1;
  name: string;
  components: Component[];
  wires: Wire[];
  definitions?: Definition[];
}
export interface Definition {
  description?: string;
  id: string;
  name: string;
  color: string;
  shape: "rectangle" | "rounded" | "diamond";
  components: Component[];
  wires: Wire[];
}
export const definitionOf = (c: Component, circuit: Circuit) =>
  circuit.definitions?.find((d) => d.id === c.definition);
export const componentInputs = (c: Component, circuit: Circuit) =>
  c.kind === "CUSTOM"
    ? definitionOf(c, circuit)?.components.filter((n) => n.kind === "INPUT")
      .length ?? 0
    : inputCount(c.kind);
export const componentOutputs = (c: Component, circuit: Circuit) =>
  c.kind === "CUSTOM"
    ? definitionOf(c, circuit)?.components.filter((n) => n.kind === "OUTPUT")
      .length ?? 0
    : c.kind === "BUS_CPU"
    ? 45
    : ["BUS_ROM", "BUS_RAM", "BUS_SCREEN", "BUS_KEYBOARD"].includes(c.kind)
    ? 8
    : ["KEYBOARD", "ADDER8"].includes(c.kind)
    ? 9
    : ["REGISTER8", "COUNTER8", "RAM", "ROM"].includes(c.kind)
    ? 8
    : hasOutput(c.kind)
    ? 1
    : 0;
export const componentInputLabel = (
  c: Component,
  port: number,
  circuit: Circuit,
) =>
  c.kind === "CUSTOM"
    ? definitionOf(c, circuit)?.components.filter((n) =>
      n.kind === "INPUT"
    )[port]?.label ?? "Input"
    : inputLabel(c.kind, port);
export const componentOutputLabel = (
  c: Component,
  port: number,
  circuit: Circuit,
) =>
  c.kind === "CUSTOM"
    ? definitionOf(c, circuit)?.components.filter((n) =>
      n.kind === "OUTPUT"
    )[port]?.label ?? "Output"
    : c.kind === "BUS_CPU"
    ? port < 16
      ? `A${port}`
      : port < 24
      ? `D${port - 16}`
      : port === 24
      ? "Write"
      : port === 25
      ? "Read"
      : port < 34
      ? `ALU A${port - 26}`
      : port < 42
      ? `ALU B${port - 34}`
      : `Op ${port - 42}`
    : ["BUS_ROM", "BUS_RAM", "BUS_SCREEN", "BUS_KEYBOARD"].includes(c.kind)
    ? `D${port}`
    : c.kind === "KEYBOARD"
    ? (port === 8 ? "Pressed" : `D${port}`)
    : c.kind === "ADDER8"
    ? (port === 8 ? "Carry" : `S${port}`)
    : ["REGISTER8", "COUNTER8", "RAM", "ROM"].includes(c.kind)
    ? `D${port}`
    : "Output";
export interface Memory {
  q: Record<string, Signal>;
  clock: Record<string, Signal>;
  screens?: Record<string, number[]>;
  writes?: Record<string, Signal>;
  bytes?: Record<string, Signal[]>;
  ram?: Record<string, Signal[]>;
  processors?: Record<string, ProcessorState>;
  busRAM?: Record<string, Record<number, number>>;
  terminals?: Record<string, string>;
  voltages?: Record<string, Signal>;
  channels?: Record<string, number>;
  nested?: Record<string, Memory>;
}
export interface Simulation {
  values: Record<string, Signal>;
  inputs: Record<string, Signal[]>;
  memory: Memory;
  warnings: string[];
  outputValues: Record<string, Signal[]>;
}
export const inputCount = (kind: Kind): number =>
  ({
    POWER: 0,
    GROUND: 0,
    NMOS: 2,
    PMOS: 2,
    JUNCTION: 2,
    BUS_CPU: 20,
    BUS_ROM: 16,
    BUS_RAM: 25,
    BUS_SCREEN: 25,
    BUS_KEYBOARD: 16,
    BUS_TERMINAL: 25,
    INPUT: 0,
    CLOCK: 0,
    OUTPUT: 1,
    LED: 1,
    SEVEN_SEG: 8,
    HEX_DISPLAY: 4,
    VGA: 15,
    KEYBOARD: 0,
    REGISTER8: 11,
    COUNTER8: 3,
    ADDER8: 17,
    RAM: 18,
    ROM: 8,
    NOT: 1,
    BUFFER: 1,
    MUX: 3,
    DFF: 2,
  } as Partial<Record<Kind, number>>)[kind] ?? 2;
export const hasOutput = (kind: Kind) =>
  !["OUTPUT", "LED", "SEVEN_SEG", "HEX_DISPLAY", "VGA", "BUS_TERMINAL"]
    .includes(kind);
export const segmentNames = ["a", "b", "c", "d", "e", "f", "g", "dp"] as const;
export const inputLabel = (kind: Kind, port: number): string =>
  kind === "BUS_CPU"
    ? port < 8
      ? `Data ${port}`
      : port < 16
      ? `Result ${port - 8}`
      : ["Carry", "Zero", "Clock", "Reset"][port - 16]
    : ["BUS_ROM", "BUS_RAM", "BUS_SCREEN", "BUS_KEYBOARD", "BUS_TERMINAL"]
        .includes(kind)
    ? port < 16 ? `A${port}` : port < 24 ? `D${port - 16}` : "Write"
    : ["NMOS", "PMOS"].includes(kind)
    ? ["Gate", "Source"][port]
    : kind === "REGISTER8"
    ? (port < 8 ? `D${port}` : ["Clock", "Enable", "Clear"][port - 8])
    : kind === "COUNTER8"
    ? ["Clock", "Enable", "Clear"][port]
    : kind === "ADDER8"
    ? (port < 8 ? `A${port}` : port < 16 ? `B${port - 8}` : "Carry in")
    : kind === "RAM"
    ? (port < 8
      ? `A${port}`
      : port < 16
      ? `D${port - 8}`
      : ["Write", "Clock"][port - 16])
    : kind === "ROM"
    ? `A${port}`
    : kind === "VGA"
    ? [
      "X0",
      "X1",
      "X2",
      "X3",
      "X4",
      "Y0",
      "Y1",
      "Y2",
      "Y3",
      "Y4",
      "Red",
      "Green",
      "Blue",
      "Write",
      "Clear",
    ][port]
    : kind === "SEVEN_SEG"
    ? segmentNames[port]
    : kind === "HEX_DISPLAY"
    ? `Bit ${port} (${2 ** port})`
    : kind === "DFF"
    ? ["Data", "Clock"][port]
    : kind === "MUX"
    ? ["Data 0", "Data 1", "Select"][port]
    : `Input ${port + 1}`;
export function hexValue(inputs: Signal[]): number | null {
  const bits = Array.from({ length: 4 }, (_, i) => inputs[i] ?? "X");
  return bits.some((bit) => bit === "X" || bit === "Z")
    ? null
    : bits.reduce<number>(
      (value, bit, i) => value + (bit === 1 ? 2 ** i : 0),
      0,
    );
}
export function displaySegments(
  kind: "SEVEN_SEG" | "HEX_DISPLAY",
  inputs: Signal[],
): Signal[] {
  if (kind === "SEVEN_SEG") return segmentNames.map((_, i) => inputs[i] ?? "X");
  const value = hexValue(inputs);
  if (value === null) return [...Array<Signal>(7).fill("X"), 0];
  const digits = [
    "abcdef",
    "bc",
    "abdeg",
    "abcdg",
    "bcfg",
    "acdfg",
    "acdefg",
    "abc",
    "abcdefg",
    "abcdfg",
    "abcefg",
    "cdefg",
    "adef",
    "bcdeg",
    "adefg",
    "aefg",
  ];
  return segmentNames.map((name) => digits[value].includes(name) ? 1 : 0);
}
export const invert = (value: Signal): Signal =>
  value === "X" ? "X" : value === 0 ? 1 : 0;
export function gate(kind: Kind, values: Signal[]): Signal {
  if (kind === "POWER") return 1;
  if (kind === "GROUND") return 0;
  if (kind === "NMOS" || kind === "PMOS") {
    return values[0] === (kind === "NMOS" ? 1 : 0)
      ? values[1]
      : values[0] === "X" || values[0] === "Z"
      ? "X"
      : "Z";
  }
  if (kind === "JUNCTION") {
    const driven = values.filter((v) => v !== "Z");
    return !driven.length
      ? "Z"
      : driven.every((v) => v === driven[0])
      ? driven[0]
      : "X";
  }
  values = values.map((v) => v === "Z" ? "X" : v);
  const [a = "X", b = "X", select = "X"] = values;
  const and = (): Signal =>
    a === 0 || b === 0 ? 0 : a === "X" || b === "X" ? "X" : 1;
  const or = (): Signal =>
    a === 1 || b === 1 ? 1 : a === "X" || b === "X" ? "X" : 0;
  const xor = (): Signal => a === "X" || b === "X" ? "X" : a === b ? 0 : 1;
  switch (kind) {
    case "AND":
      return and();
    case "NAND":
      return invert(and());
    case "OR":
      return or();
    case "NOR":
      return invert(or());
    case "XOR":
      return xor();
    case "XNOR":
      return invert(xor());
    case "NOT":
      return invert(a);
    case "MUX":
      return select === "X" ? a === b ? a : "X" : select === 0 ? a : b;
    case "SEVEN_SEG":
    case "HEX_DISPLAY":
      return "X";
    default:
      return a;
  }
}
export function simulate(
  circuit: Circuit,
  previous: Memory = { q: {}, clock: {} },
  overrides: Record<string, Signal> = {},
  keyboards: Record<string, KeyboardState> = {},
): Simulation {
  const components = new Map(circuit.components.map((c) => [c.id, c]));
  const incoming = new Map(
    circuit.wires.map((w) => [`${w.to}:${w.port}`, w]),
  );
  const memory: Memory = {
    q: {},
    clock: {},
    screens: {},
    writes: {},
    bytes: {},
    ram: {},
    processors: {},
    busRAM: {},
    terminals: { ...(previous.terminals ?? {}) },
    voltages: { ...(previous.voltages ?? {}) },
    channels: { ...(previous.channels ?? {}) },
    nested: { ...(previous.nested ?? {}) },
  };
  for (const c of circuit.components) {
    if (c.kind === "DFF") memory.q[c.id] = previous.q[c.id] ?? 0;
    if (["REGISTER8", "COUNTER8"].includes(c.kind)) {
      memory.bytes![c.id] = [
        ...(previous.bytes?.[c.id] ?? Array<Signal>(8).fill(0)),
      ];
    }
    if (c.kind === "RAM") {
      memory.ram![c.id] = [
        ...(previous.ram?.[c.id] ?? Array<Signal>(2048).fill(0)),
      ];
    }
  }
  for (const c of circuit.components) {
    if (c.kind === "BUS_CPU") {
      memory.processors![c.id] = structuredClone(
        previous.processors?.[c.id] ?? initialProcessor(),
      );
    }
    if (c.kind === "BUS_RAM") {
      memory.busRAM![c.id] = { ...(previous.busRAM?.[c.id] ?? {}) };
    }
    if (c.kind === "BUS_SCREEN") {
      memory.screens![c.id] = [
        ...(previous.screens?.[c.id] ?? Array(768).fill(0)),
      ];
    }
  }
  const warnings = new Set<string>();
  const primitiveCache = new Map<
    string,
    {
      nodes: { kind: Kind; inputs: number[]; input: number }[];
      outputs: number[];
    }
  >();
  const customCache = new Map<string, { key: string; outputs: Signal[] }>();
  function settle(): Pick<Simulation, "values" | "inputs" | "outputValues"> {
    const values: Record<string, Signal> = Object.create(null);
    const inputs: Record<string, Signal[]> = Object.create(null);
    const outputValues: Record<string, Signal[]> = Object.create(null);
    const visiting = new Set<string>();
    function read(id: string, outputPort = 0): Signal {
      if (id in values) {
        return outputValues[id]?.[outputPort] ??
          (outputPort === 0 ? values[id] : "X");
      }
      const component = components.get(id);
      if (!component) return "X";
      if (component.kind === "POWER") {
        return values[id] = overrides[id] ?? component.value ?? 1;
      }
      if (component.kind === "INPUT" || component.kind === "CLOCK") {
        return values[id] = overrides[id] ?? component.value ?? 0;
      }
      if (["REGISTER8", "COUNTER8"].includes(component.kind)) {
        outputValues[id] = memory.bytes![id];
        values[id] = outputValues[id][0];
        return outputValues[id][outputPort] ?? "X";
      }
      if (component.kind === "KEYBOARD") {
        const state = keyboards[id] ?? { code: 0, pressed: false };
        outputValues[id] = [
          ...Array.from(
            { length: 8 },
            (_, i) => (state.code >> i & 1) as Signal,
          ),
          state.pressed ? 1 : 0,
        ];
        values[id] = outputValues[id][0];
        return outputValues[id][outputPort] ?? "X";
      }
      if (component.kind === "BUS_CPU") {
        outputValues[id] = memory.processors![id].signals;
        values[id] = outputValues[id][0];
        return outputValues[id][outputPort] ?? "X";
      }
      if (component.kind === "DFF") return values[id] = memory.q[id];
      if (visiting.has(id)) {
        if (
          ["NMOS", "PMOS", "JUNCTION", "OUTPUT"].includes(component.kind) &&
          circuit.components.some((n) => n.kind === "NMOS" || n.kind === "PMOS")
        ) return memory.voltages?.[id] ?? 0;
        warnings.add(
          "Combinational feedback detected. Use a D flip-flop to store state.",
        );
        return "X";
      }
      visiting.add(id);
      const ports = Array.from(
        { length: componentInputs(component, circuit) },
        (_, port) => {
          const from = incoming.get(`${id}:${port}`);
          return from ? read(from.from, from.fromPort ?? 0) : "X";
        },
      );
      inputs[id] = ports;
      let value: Signal;
      if (
        ["BUS_ROM", "BUS_RAM", "BUS_KEYBOARD", "BUS_SCREEN"].includes(
          component.kind,
        )
      ) {
        const address = numberOf(ports.slice(0, 16));
        const byte = address === null
          ? null
          : component.kind === "BUS_ROM"
          ? address < 0x2000 ? component.contents?.[address] ?? 0 : 0
          : component.kind === "BUS_RAM"
          ? address >= 0x2000 && address < 0xf000
            ? memory.busRAM![id][address] ?? 0
            : 0
          : component.kind === "BUS_SCREEN"
          ? address >= 0xf000 && address < 0xf300
            ? memory.screens![id][address - 0xf000]
            : 0
          : address === 0xff00
          ? keyboards[id]?.code ?? 0
          : address === 0xff01
          ? +(keyboards[id]?.pressed ?? false)
          : 0;
        outputValues[id] = byte === null ? Array(8).fill("X") : bitsOf(byte, 8);
        value = outputValues[id][0];
      } else if (["RAM", "ROM", "ADDER8"].includes(component.kind)) {
        const number = (bits: Signal[]) =>
          bits.some((bit) => bit === "X" || bit === "Z")
            ? null
            : bits.reduce<number>((n, b, i) => n + (b === 1 ? 2 ** i : 0), 0);
        if (component.kind === "ADDER8") {
          const a = number(ports.slice(0, 8)), b = number(ports.slice(8, 16));
          outputValues[id] = a === null || b === null || ports[16] === "X"
            ? Array<Signal>(9).fill("X")
            : Array.from(
              { length: 9 },
              (_, i) => (a + b + (ports[16] === 1 ? 1 : 0)) >> i & 1,
            ) as Signal[];
        } else {
          const address = number(ports.slice(0, 8));
          outputValues[id] = address === null
            ? Array<Signal>(8).fill("X")
            : component.kind === "RAM"
            ? memory.ram![id].slice(address * 8, address * 8 + 8)
            : Array.from({ length: 8 }, (_, i) =>
              (component.contents?.[address] ?? 0) >> i & 1) as Signal[];
        }
        value = outputValues[id][0];
      } else if (component.kind === "CUSTOM") {
        const def = definitionOf(component, circuit);
        if (!def) value = "X";
        else {
          const key = ports.join(",");
          const cached = customCache.get(id);
          if (cached?.key === key) outputValues[id] = cached.outputs;
          else {
            if (
              def.components.every((n) =>
                [
                  "INPUT",
                  "OUTPUT",
                  "AND",
                  "OR",
                  "NOT",
                  "NAND",
                  "NOR",
                  "XOR",
                  "XNOR",
                  "BUFFER",
                  "MUX",
                  "NMOS",
                  "PMOS",
                  "POWER",
                  "GROUND",
                  "JUNCTION",
                ].includes(n.kind)
              )
            ) {
              let compiled = primitiveCache.get(def.id);
              if (!compiled) {
                const nodes: { kind: Kind; inputs: number[]; input: number }[] =
                    [],
                  ids = new Map<string, number>(),
                  visiting = new Set<string>();
                const inputs = def.components.filter((n) => n.kind === "INPUT");
                const definitionNodes = new Map(
                  def.components.map((n) => [n.id, n]),
                );
                const definitionWires = new Map(
                  def.wires.map((w) => [`${w.to}:${w.port}`, w]),
                );
                const visit = (node: Component): number => {
                  if (ids.has(node.id)) return ids.get(node.id)!;
                  if (visiting.has(node.id)) {
                    throw Error("Combinational feedback in custom component.");
                  }
                  visiting.add(node.id);
                  const connections = Array.from({
                    length: inputCount(node.kind),
                  }, (_, port) => {
                    const wire = definitionWires.get(`${node.id}:${port}`);
                    return wire ? visit(definitionNodes.get(wire.from)!) : -1;
                  });
                  const id = nodes.length;
                  nodes.push({
                    kind: node.kind,
                    inputs: connections,
                    input: inputs.indexOf(node),
                  });
                  ids.set(node.id, id);
                  visiting.delete(node.id);
                  return id;
                };
                try {
                  compiled = {
                    nodes,
                    outputs: def.components.filter((n) => n.kind === "OUTPUT")
                      .map(visit),
                  };
                  primitiveCache.set(def.id, compiled);
                } catch {}
              }
              if (compiled) {
                const values: Signal[] = [];
                for (const node of compiled.nodes) {
                  values.push(
                    node.kind === "INPUT" ? ports[node.input] ?? "X" : gate(
                      node.kind,
                      node.inputs.map((id) => id < 0 ? "X" : values[id]),
                    ),
                  );
                }
                outputValues[id] = compiled.outputs.map((output) =>
                  values[output]
                );
              } else {
                const nested = simulate(
                  {
                    version: 1,
                    name: def.name,
                    components: def.components,
                    wires: def.wires,
                    definitions: circuit.definitions,
                  },
                  memory.nested?.[id],
                  Object.fromEntries(
                    def.components.filter((n) => n.kind === "INPUT").map((
                      n,
                      i,
                    ) => [n.id, ports[i]]),
                  ),
                );
                memory.nested![id] = nested.memory;
                nested.warnings.forEach((w) =>
                  warnings.add(`${component.label}: ${w}`)
                );
                outputValues[id] = def.components.filter((n) =>
                  n.kind === "OUTPUT"
                ).map((n) => nested.values[n.id]);
              }
            } else {
              const inputs = def.components.filter((n) => n.kind === "INPUT");
              const nested = simulate(
                {
                  version: 1,
                  name: def.name,
                  components: def.components,
                  wires: def.wires,
                  definitions: circuit.definitions,
                },
                memory.nested?.[id],
                Object.fromEntries(inputs.map((n, i) => [n.id, ports[i]])),
              );
              memory.nested![id] = nested.memory;
              nested.warnings.forEach((w) =>
                warnings.add(`${component.label}: ${w}`)
              );
              outputValues[id] = def.components.filter((n) =>
                n.kind === "OUTPUT"
              )
                .map((n) => nested.values[n.id]);
            }
            customCache.set(id, { key, outputs: outputValues[id] });
          }
          value = outputValues[id][0] ?? "X";
        }
      } else value = gate(component.kind, ports);
      visiting.delete(id);
      values[id] = value;
      return outputValues[id]?.[outputPort] ?? (outputPort === 0 ? value : "X");
    }
    for (const c of circuit.components) read(c.id);
    for (const c of circuit.components) {
      inputs[c.id] = Array.from(
        { length: componentInputs(c, circuit) },
        (_, port) => {
          const wire = incoming.get(`${c.id}:${port}`);
          return wire ? read(wire.from, wire.fromPort ?? 0) : "X";
        },
      );
    }
    return { values, inputs, outputValues };
  }
  function settleElectrical() {
    if (
      circuit.components.some((n) => n.kind === "NMOS" || n.kind === "PMOS") &&
      circuit.components.every((n) =>
        ["INPUT", "OUTPUT", "POWER", "GROUND", "NMOS", "PMOS", "JUNCTION"]
          .includes(n.kind)
      )
    ) {
      const result = solveSwitches(circuit, overrides, memory.channels);
      memory.channels = result.masks;
      if (!result.settled) {
        warnings.add("Transistor network did not settle. Check feedback.");
      }
      return result;
    }
    let result = settle();
    if (
      !circuit.components.some((n) => n.kind === "NMOS" || n.kind === "PMOS")
    ) return result;
    for (let i = 0; i < 24; i++) {
      const stable = circuit.components.every((c) =>
        memory.voltages![c.id] === result.values[c.id]
      );
      memory.voltages = { ...result.values };
      if (stable) return result;
      result = settle();
    }
    warnings.add(
      "Transistor network did not settle. Check feedback and conflicting drivers.",
    );
    return result;
  }
  const before = settleElectrical();
  for (const c of circuit.components) {
    if (c.kind === "DFF") {
      const [data, clock] = before.inputs[c.id];
      if (previous.clock[c.id] === 0 && clock === 1) memory.q[c.id] = data;
      memory.clock[c.id] = clock;
    }
  }
  for (const c of circuit.components) {
    const ports = before.inputs[c.id];
    if (["REGISTER8", "COUNTER8"].includes(c.kind)) {
      const offset = c.kind === "REGISTER8" ? 8 : 0;
      const [clock, enable, clear] = ports.slice(offset);
      if (clear === 1) memory.bytes![c.id] = Array<Signal>(8).fill(0);
      else if (previous.clock[c.id] === 0 && clock === 1 && enable === 1) {
        if (c.kind === "REGISTER8") memory.bytes![c.id] = ports.slice(0, 8);
        else {
          const bits = memory.bytes![c.id];
          const value = bits.some((bit) => bit === "X" || bit === "Z")
            ? null
            : bits.reduce<number>((n, b, i) => n + (b === 1 ? 2 ** i : 0), 0) +
              1;
          memory.bytes![c.id] = value === null
            ? Array<Signal>(8).fill("X")
            : Array.from({ length: 8 }, (_, i) => value >> i & 1) as Signal[];
        }
      }
      memory.clock[c.id] = clock;
    }
    if (c.kind === "RAM") {
      if (
        previous.clock[c.id] === 0 && ports[17] === 1 && ports[16] === 1 &&
        !ports.slice(0, 8).some((bit) => bit === "X" || bit === "Z")
      ) {
        const address = ports.slice(0, 8).reduce<number>(
          (n, b, i) => n + (b === 1 ? 2 ** i : 0),
          0,
        );
        memory.ram![c.id].splice(address * 8, 8, ...ports.slice(8, 16));
      }
      memory.clock[c.id] = ports[17];
    }
  }
  const after = settleElectrical();
  for (const c of circuit.components) {
    if (c.kind !== "VGA") continue;
    const ports = after.inputs[c.id];
    const pixels = [
      ...(previous.screens?.[c.id] ??
        Array<number>(screenWidth * screenHeight).fill(0)),
    ];
    if (ports[14] === 1) pixels.fill(0);
    else if (previous.writes?.[c.id] === 0 && ports[13] === 1) {
      if (ports.slice(0, 13).some((bit) => bit === "X" || bit === "Z")) {
        warnings.add(
          `${c.label}: pixel write needs known coordinates and RGB inputs.`,
        );
      } else {
        const bits = (start: number, count: number) =>
          ports.slice(start, start + count).reduce<number>(
            (n, bit, i) => n + (bit === 1 ? 2 ** i : 0),
            0,
          );
        const x = bits(0, 5), y = bits(5, 5);
        if (y < screenHeight) {
          pixels[y * screenWidth + x] = (ports[10] === 1 ? 4 : 0) +
            (ports[11] === 1 ? 2 : 0) + (ports[12] === 1 ? 1 : 0);
        }
      }
    }
    memory.screens![c.id] = pixels;
    memory.writes![c.id] = ports[13];
  }
  for (const c of circuit.components) {
    if (c.kind !== "BUS_CPU") continue;
    const ports = after.inputs[c.id], state = memory.processors![c.id];
    if (ports[19] === 1) memory.processors![c.id] = initialProcessor();
    else if (previous.clock[c.id] === 0 && ports[18] === 1) {
      const bus = (address: number, value?: number) => {
        state.signals.splice(0, 16, ...bitsOf(address, 16));
        state.signals.splice(16, 8, ...bitsOf(value ?? 0, 8));
        state.signals[24] = value === undefined ? 0 : 1;
        state.signals[25] = value === undefined ? 1 : 0;
        const current = settle();
        if (value !== undefined) {
          for (const device of circuit.components) {
            if (
              !["BUS_RAM", "BUS_SCREEN", "BUS_TERMINAL"].includes(device.kind)
            ) continue;
            const input = current.inputs[device.id];
            if (input[24] !== 1) continue;
            const at = numberOf(input.slice(0, 16)),
              data = numberOf(input.slice(16, 24));
            if (at === null || data === null) {
              throw Error(`${device.label}: floating address or data.`);
            }
            if (device.kind === "BUS_RAM" && at >= 0x2000 && at < 0xf000) {
              memory.busRAM![device.id][at] = data;
            }
            if (device.kind === "BUS_SCREEN") {
              if (at >= 0xf000 && at < 0xf300) {
                memory.screens![device.id][at - 0xf000] = data & 7;
              }
              if (at === 0xff02 && data) memory.screens![device.id].fill(0);
            }
            if (device.kind === "BUS_TERMINAL" && at === 0xff03) {
              memory.terminals![device.id] =
                ((memory.terminals![device.id] ?? "") +
                  String.fromCharCode(data)).slice(-4096);
            }
          }
          state.signals[24] = 0;
          return 0;
        }
        const byte = numberOf(current.inputs[c.id].slice(0, 8));
        if (byte === null) {
          throw Error(
            "CPU data bus is floating. Check memory and device wires.",
          );
        }
        return byte;
      };
      const alu = (
        operation: import("./alu.ts").ALUOperation,
        a: number,
        b: number,
      ) => {
        state.signals.splice(26, 8, ...bitsOf(a, 8));
        state.signals.splice(34, 8, ...bitsOf(b, 8));
        state.signals.splice(
          42,
          3,
          ...bitsOf(
            ["ADD", "SUB", "AND", "OR", "XOR", "SHL", "SHR"].indexOf(operation),
            3,
          ),
        );
        const result = settle().inputs[c.id];
        const value = numberOf(result.slice(8, 16));
        if (
          value === null ||
          [result[16], result[17]].some((v) => v === "X" || v === "Z")
        ) throw Error("CPU ALU inputs are floating. Check ALU wires.");
        return { value, carry: result[16] === 1, zero: result[17] === 1 };
      };
      memory.processors![c.id] = runProcessor(state, bus, alu);
    }
    memory.clock[c.id] = ports[18];
    if (memory.processors![c.id].error) {
      warnings.add(`${c.label}: ${memory.processors![c.id].error}`);
    }
  }
  return { ...settleElectrical(), memory, warnings: [...warnings] };
}
const validId = (id: unknown): id is string =>
  typeof id === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(id) &&
  !["__proto__", "constructor", "prototype"].includes(id);
export function connect(
  circuit: Circuit,
  from: string,
  to: string,
  port: number,
  id: string,
  fromPort = 0,
): Circuit {
  if (
    !validId(id) || circuit.components.some((c) => c.id === id) ||
    circuit.wires.some((w) => w.id === id)
  ) throw Error("Connection ID must be valid and unique.");
  if (circuit.wires.length >= 2000) throw Error("Limit: 2,000 wires.");
  const source = circuit.components.find((c) => c.id === from),
    target = circuit.components.find((c) => c.id === to);
  if (
    !source || !target || !Number.isInteger(fromPort) || fromPort < 0 ||
    fromPort >= componentOutputs(source, circuit) || !Number.isInteger(port) ||
    port < 0 || port >= componentInputs(target, circuit)
  ) throw Error("Choose an output pin and an input pin.");
  if (circuit.wires.some((w) => w.to === to && w.port === port)) {
    throw Error("This input is already connected. Delete its wire first.");
  }
  return {
    ...circuit,
    wires: [...circuit.wires, {
      id,
      from,
      to,
      port,
      ...(fromPort === 0 ? {} : { fromPort }),
    }],
  };
}
export function parseCircuit(text: string): Circuit {
  if (text.length > 2_000_000) {
    throw Error("Circuit file is too large (2 MB maximum).");
  }
  const data = JSON.parse(text);
  if (
    data?.definitions !== undefined &&
    (!Array.isArray(data.definitions) || data.definitions.length > 100)
  ) throw Error("Invalid component library (100 definitions maximum).");
  const definitions: Definition[] = (data?.definitions ?? []).map(
    (d: Definition) => {
      if (
        !d || !validId(d.id) || typeof d.name !== "string" || !d.name.trim() ||
        (d.description !== undefined &&
          (typeof d.description !== "string" || d.description.length > 600)) ||
        d.name.length > 80 || !/^#[0-9a-f]{6}$/i.test(d.color) ||
        !["rectangle", "rounded", "diamond"].includes(d.shape)
      ) throw Error("Invalid custom component definition.");
      return {
        id: d.id,
        name: d.name,
        ...(d.description !== undefined ? { description: d.description } : {}),
        color: d.color,
        shape: d.shape,
        components: d.components,
        wires: d.wires,
      };
    },
  );
  if (new Set(definitions.map((d) => d.id)).size !== definitions.length) {
    throw Error("Duplicate component definition.");
  }
  function validate(c: Circuit): Circuit {
    if (
      c?.version !== 1 || typeof c.name !== "string" || c.name.length > 100 ||
      !Array.isArray(c.components) || !Array.isArray(c.wires)
    ) throw Error("Not a supported circuit file.");
    if (c.components.length > 2000 || c.wires.length > 2000) {
      throw Error("Limit: 2,000 components and 2,000 wires.");
    }
    const context = { ...c, definitions },
      ids = new Set<string>(),
      targets = new Set<string>();
    const components = c.components.map((n) => {
      if (
        !n || !validId(n.id) || ids.has(n.id) || !kinds.includes(n.kind) ||
        !Number.isFinite(n.x) || !Number.isFinite(n.y) ||
        Math.abs(n.x) > 100000 || Math.abs(n.y) > 100000 ||
        typeof n.label !== "string" || n.label.length > 80 ||
        (n.value !== undefined && n.value !== 0 && n.value !== 1) ||
        (n.kind === "CUSTOM" && !definitionOf(n, context))
      ) throw Error("Invalid component in circuit file.");
      if (
        n.keyMap !== undefined &&
        (!["KEYBOARD", "BUS_KEYBOARD"].includes(n.kind) || !n.keyMap ||
          typeof n.keyMap !== "object" ||
          Array.isArray(n.keyMap) || Object.entries(n.keyMap).length > 100 ||
          Object.entries(n.keyMap).some(([physical, key]) =>
            !/^[A-Za-z0-9]{1,40}$/.test(physical) ||
            !virtualKeys.some((k) => k.key === key)
          ))
      ) throw Error("Invalid keyboard mapping.");
      if (
        n.contents !== undefined &&
        (!["ROM", "BUS_ROM"].includes(n.kind) || !Array.isArray(n.contents) ||
          n.contents.length > (n.kind === "BUS_ROM" ? 8192 : 256) ||
          n.contents.some((b) => !Number.isInteger(b) || b < 0 || b > 255))
      ) throw Error("ROM contents must be up to 256 bytes.");
      if (
        n.source !== undefined &&
        (n.kind !== "BUS_ROM" || typeof n.source !== "string" ||
          n.source.length > 200000)
      ) throw Error("Invalid ROM assembly source.");
      ids.add(n.id);
      return {
        id: n.id,
        kind: n.kind,
        x: n.x,
        y: n.y,
        label: n.label,
        ...(n.value === undefined ? {} : { value: n.value }),
        ...(n.kind === "CUSTOM" ? { definition: n.definition } : {}),
        ...(n.keyMap === undefined ? {} : { keyMap: { ...n.keyMap } }),
        ...(n.source === undefined ? {} : { source: n.source }),
        ...(n.contents === undefined ? {} : { contents: [...n.contents] }),
      };
    });
    const wires = c.wires.map((w) => {
      if (!w) throw Error("Invalid connection.");
      const source = components.find((n) => n.id === w.from),
        target = components.find((n) => n.id === w.to),
        key = `${w.to}:${w.port}`,
        fromPort = w.fromPort ?? 0;
      if (
        !validId(w.id) || ids.has(w.id) || !source || !target ||
        !Number.isInteger(fromPort) || fromPort < 0 ||
        fromPort >= componentOutputs(source, context) ||
        !Number.isInteger(w.port) || w.port < 0 ||
        w.port >= componentInputs(target, context) || targets.has(key)
      ) throw Error("Invalid or multiply driven connection.");
      ids.add(w.id);
      targets.add(key);
      return {
        id: w.id,
        from: w.from,
        to: w.to,
        port: w.port,
        ...(fromPort === 0 ? {} : { fromPort }),
      };
    });
    return { version: 1, name: c.name, components, wires };
  }
  for (const d of definitions) {
    if (
      !Array.isArray(d.components) ||
      d.components.some((n) =>
        [
          "CLOCK",
          "DFF",
          "VGA",
          "KEYBOARD",
          "REGISTER8",
          "COUNTER8",
          "RAM",
          "BUS_CPU",
          "BUS_RAM",
          "BUS_SCREEN",
          "BUS_KEYBOARD",
          "BUS_TERMINAL",
        ]
          .includes(n?.kind)
      )
    ) {
      throw Error(
        "Custom components support combinational gates and CMOS switches; behavioral state and interactive devices must stay outside.",
      );
    }
    const normalized = validate({
      version: 1,
      name: d.name,
      components: d.components,
      wires: d.wires,
    });
    d.components = normalized.components;
    d.wires = normalized.wires;
    if (!d.components.some((n) => n.kind === "OUTPUT")) {
      throw Error("A custom component needs at least one Output block.");
    }
  }
  function check(id: string, path: Set<string>, depth: number): number {
    if (path.has(id) || depth > 12) {
      throw Error(
        "Recursive or excessively nested custom components are not supported.",
      );
    }
    const d = definitions.find((d) => d.id === id)!;
    const next = new Set([...path, id]);
    let size = d.components.length;
    for (const n of d.components) {
      if (n.kind === "CUSTOM") size += check(n.definition!, next, depth + 1);
    }
    if (size > 2000) {
      throw Error("Custom components exceed 2,000 expanded components.");
    }
    return size;
  }
  definitions.forEach((d) => check(d.id, new Set(), 0));
  const result = validate(data);
  let expanded = result.components.length;
  for (const n of result.components) {
    if (n.kind === "CUSTOM") expanded += check(n.definition!, new Set(), 0);
  }
  if (expanded > 5000) {
    throw Error("Circuit exceeds 5,000 expanded components.");
  }
  return { ...result, ...(definitions.length ? { definitions } : {}) };
}
export function truthTable(circuit: Circuit) {
  const inputs = circuit.components.filter((c) => c.kind === "INPUT");
  const outputs = circuit.components.filter((c) => !hasOutput(c.kind)).flatMap(
    (c) =>
      Array.from(
        { length: inputCount(c.kind) },
        (_, port) => ({
          ...c,
          port,
          label: inputCount(c.kind) === 1
            ? c.label
            : `${c.label}.${inputLabel(c.kind, port)}`,
        }),
      ),
  );
  if (
    circuit.components.some((c) =>
      [
        "CLOCK",
        "DFF",
        "VGA",
        "KEYBOARD",
        "REGISTER8",
        "COUNTER8",
        "RAM",
        "BUS_CPU",
        "BUS_RAM",
        "BUS_SCREEN",
        "BUS_KEYBOARD",
        "BUS_TERMINAL",
      ]
        .includes(c.kind)
    )
  ) {
    throw Error(
      "Truth tables are available for combinational circuits. Remove stateful and interactive components first.",
    );
  }
  if (inputs.length > 8) throw Error("Truth tables support up to 8 inputs.");
  if (!outputs.length) throw Error("Add an output to generate a truth table.");
  const rows = Array.from({ length: 2 ** inputs.length }, (_, n) => {
    const bits = inputs.map((_, i) =>
      (n >> (inputs.length - i - 1) & 1) as 0 | 1
    );
    const copy = {
      ...circuit,
      components: circuit.components.map((c) => {
        const i = inputs.findIndex((input) => input.id === c.id);
        return i < 0 ? c : { ...c, value: bits[i] };
      }),
    };
    const result = simulate(copy);
    if (result.warnings.length) {
      throw Error(
        "Remove combinational feedback before generating a truth table.",
      );
    }
    return {
      inputs: bits,
      outputs: outputs.map((c) => result.inputs[c.id][c.port]),
    };
  });
  return { inputs, outputs, rows };
}

export function createDefinition(
  circuit: Circuit,
  selected: Set<string>,
  options: Pick<Definition, "id" | "name" | "color" | "shape" | "description">,
): Definition {
  const components = structuredClone(
    circuit.components.filter((c) => selected.has(c.id)),
  );
  if (!components.length) throw Error("Select components to save first.");
  if (
    components.some((c) =>
      [
        "CLOCK",
        "DFF",
        "VGA",
        "KEYBOARD",
        "REGISTER8",
        "COUNTER8",
        "RAM",
        "BUS_CPU",
        "BUS_RAM",
        "BUS_SCREEN",
        "BUS_KEYBOARD",
        "BUS_TERMINAL",
      ]
        .includes(c.kind)
    )
  ) {
    throw Error(
      "Custom components support combinational gates and CMOS switches. Keep behavioral state and interactive devices outside the selection.",
    );
  }
  const wires = structuredClone(
    circuit.wires.filter((w) => selected.has(w.from) && selected.has(w.to)),
  );
  const used = new Set([...components, ...wires].map((n) => n.id));
  let serial = 0;
  const uid = () => {
    let id: string;
    do {
      id = `boundary-${++serial}`;
    } while (used.has(id));
    used.add(id);
    return id;
  };
  const boundary = new Map<string, string>();
  for (const c of [...components]) {
    for (let port = 0; port < componentInputs(c, circuit); port++) {
      if (
        wires.some((w) => w.to === c.id && w.port === port)
      ) continue;
      const external = circuit.wires.find((w) =>
        w.to === c.id && w.port === port
      );
      const key = external
        ? `${external.from}:${external.fromPort ?? 0}`
        : `${c.id}:${port}`;
      let id = boundary.get(key);
      if (!id) {
        id = uid();
        boundary.set(key, id);
        const source = circuit.components.find((n) => n.id === external?.from);
        components.push({
          id,
          kind: "INPUT",
          x: c.x - 160,
          y: c.y + port * 40,
          label: (source?.label ??
            `${c.label} ${componentInputLabel(c, port, circuit)}`).slice(0, 80),
        });
      }
      wires.push({ id: uid(), from: id, to: c.id, port });
    }
  }
  for (const c of [...components].filter((c) => selected.has(c.id))) {
    for (let port = 0; port < componentOutputs(c, circuit); port++) {
      const outgoing = circuit.wires.filter((w) =>
        w.from === c.id && (w.fromPort ?? 0) === port
      );
      if (
        outgoing.some((w) => !selected.has(w.to)) || !outgoing.length
      ) {
        const id = uid();
        components.push({
          id,
          kind: "OUTPUT",
          x: c.x + 160,
          y: c.y + port * 40,
          label: componentOutputs(c, circuit) > 1
            ? componentOutputLabel(c, port, circuit)
            : c.label,
        });
        wires.push({
          id: uid(),
          from: c.id,
          to: id,
          port: 0,
          ...(port ? { fromPort: port } : {}),
        });
      }
    }
  }
  const definition = { ...options, components, wires };
  const checked = parseCircuit(
    JSON.stringify({
      ...circuit,
      definitions: [...(circuit.definitions ?? []), definition],
    }),
  );
  return checked.definitions!.find((d) => d.id === definition.id)!;
}

export * from "./computer.ts";
export * from "./snake.ts";
export * from "./alu.ts";
export * from "./karnaugh.ts";

export * from "./wired-computer.ts";
export * from "./transistors.ts";
