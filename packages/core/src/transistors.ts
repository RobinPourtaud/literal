import type { Circuit, Kind } from "./index.ts";

export function transistorCircuit(kind: Kind): Circuit | null {
  if (
    !["AND", "OR", "NOT", "NAND", "NOR", "XOR", "XNOR", "BUFFER", "MUX"]
      .includes(kind)
  ) return null;
  const circuit: Circuit = {
    version: 1,
    name: `${kind} · CMOS switches`,
    components: [],
    wires: [],
  };
  const add = (kind: Kind, label: string) => {
    const id = `t-${circuit.components.length}`;
    circuit.components.push({
      id,
      kind,
      label,
      x: 0,
      y: 0,
      ...(kind === "INPUT" ? { value: 0 as const } : {}),
    });
    return id;
  };
  const wire = (from: string, to: string, port: number) =>
    circuit.wires.push({ id: `tw-${circuit.wires.length}`, from, to, port });
  const a = add("INPUT", "A"),
    b = kind === "NOT" || kind === "BUFFER" ? a : add("INPUT", "B");
  const select = kind === "MUX" ? add("INPUT", "Select") : a;
  const power = add("POWER", "VDD"), ground = add("GROUND", "GND");
  const transistor = (kind: "NMOS" | "PMOS", gate: string, source: string) => {
    const id = add(kind, kind);
    wire(gate, id, 0);
    wire(source, id, 1);
    return id;
  };
  const join = (x: string, y: string) => {
    const id = add("JUNCTION", "Junction");
    wire(x, id, 0);
    wire(y, id, 1);
    return id;
  };
  const not = (x: string) =>
    join(transistor("PMOS", x, power), transistor("NMOS", x, ground));
  const nand = (x: string, y: string) =>
    join(
      join(transistor("PMOS", x, power), transistor("PMOS", y, power)),
      transistor("NMOS", y, transistor("NMOS", x, ground)),
    );
  const nor = (x: string, y: string) =>
    join(
      transistor("PMOS", y, transistor("PMOS", x, power)),
      join(transistor("NMOS", x, ground), transistor("NMOS", y, ground)),
    );
  const and = (x: string, y: string) => not(nand(x, y));
  const or = (x: string, y: string) => not(nor(x, y));
  const xor = (x: string, y: string) => or(and(x, not(y)), and(not(x), y));
  const result = kind === "NOT"
    ? not(a)
    : kind === "BUFFER"
    ? not(not(a))
    : kind === "NAND"
    ? nand(a, b)
    : kind === "NOR"
    ? nor(a, b)
    : kind === "AND"
    ? and(a, b)
    : kind === "OR"
    ? or(a, b)
    : kind === "XOR"
    ? xor(a, b)
    : kind === "XNOR"
    ? not(xor(a, b))
    : or(and(a, not(select)), and(b, select));
  const output = add("OUTPUT", "Output");
  wire(result, output, 0);
  const depth = new Map<string, number>(), counts = new Map<number, number>();
  for (const node of circuit.components) {
    const inputs = circuit.wires.filter((w) => w.to === node.id);
    const d = inputs.length
      ? Math.max(...inputs.map((w) => depth.get(w.from) ?? 0)) + 1
      : 0;
    const row = counts.get(d) ?? 0;
    counts.set(d, row + 1);
    depth.set(node.id, d);
    node.x = d * 180 + 80;
    node.y = row * 140 + 80;
  }
  return circuit;
}

export function solveSwitches(
  circuit: Circuit,
  overrides: Record<string, import("./index.ts").Signal>,
  previous: Record<string, number> = {},
) {
  type Signal = import("./index.ts").Signal;
  const masks = Object.fromEntries(
    circuit.components.map((n) => [n.id, previous[n.id] ?? 1]),
  );
  const incoming = new Map(
    circuit.wires.map((w) => [`${w.to}:${w.port}`, w.from]),
  );
  const mask = (value: Signal) =>
    value === 0 ? 1 : value === 1 ? 2 : value === "Z" ? 4 : 3;
  const signal = (value: number): Signal =>
    value === 1 ? 0 : value === 2 ? 1 : value === 4 ? "Z" : "X";
  const join = (a: number, b: number) => {
    let value = 0;
    for (const x of [1, 2, 4]) {
      for (const y of [1, 2, 4]) {
        if ((a & x) && (b & y)) {
          value |= x === 4 ? y : y === 4 ? x : x === y ? x : 3;
        }
      }
    }
    return value;
  };
  let settled = false;
  for (
    let iteration = 0;
    iteration < Math.min(1024, circuit.components.length * 4 + 8);
    iteration++
  ) {
    const next: Record<string, number> = {};
    for (const node of circuit.components) {
      const a = masks[incoming.get(`${node.id}:0`)!] ?? 3,
        b = masks[incoming.get(`${node.id}:1`)!] ?? 3;
      next[node.id] = node.kind === "INPUT"
        ? mask(overrides[node.id] ?? node.value ?? 0)
        : node.kind === "POWER"
        ? mask(overrides[node.id] ?? node.value ?? 1)
        : node.kind === "GROUND"
        ? 1
        : node.kind === "OUTPUT"
        ? a
        : node.kind === "JUNCTION"
        ? join(a, b)
        : ((a & (node.kind === "NMOS" ? 1 : 2)) ? 4 : 0) |
          ((a & (node.kind === "NMOS" ? 2 : 1)) ? b : 0) |
          ((a & 4) ? b | 4 : 0);
    }
    settled = circuit.components.every((n) => next[n.id] === masks[n.id]);
    Object.assign(masks, next);
    if (settled) break;
  }
  const values = Object.fromEntries(
    circuit.components.map((n) => [n.id, signal(masks[n.id])]),
  );
  const inputs = Object.fromEntries(
    circuit.components.map((n) => [
      n.id,
      n.kind === "OUTPUT"
        ? [signal(masks[incoming.get(`${n.id}:0`)!] ?? 3)]
        : ["NMOS", "PMOS", "JUNCTION"].includes(n.kind)
        ? [0, 1].map((port) =>
          signal(masks[incoming.get(`${n.id}:${port}`)!] ?? 3)
        )
        : [],
    ]),
  );
  return {
    values,
    inputs,
    outputValues: Object.fromEntries(
      circuit.components.map((n) => [n.id, [values[n.id]]]),
    ),
    masks,
    settled,
  };
}
