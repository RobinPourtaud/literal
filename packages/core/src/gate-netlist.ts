import type { Signal } from "./index.ts";
export type GateOp = "INPUT" | "LOW" | "HIGH" | "NAND" | "WIRE" | "INSTANCE";
export interface GateNode {
  op: GateOp;
  inputs: number[];
  label: string;
  seed: Signal;
  transparent?: boolean;
  instance?: number;
  port?: number;
}
export interface GateModel {
  name: string;
  nodes: GateNode[];
  inputs: number[];
  outputs: number[];
  clockInputs: number[];
  probes: Record<string, number[]>;
  instances?: {
    model: GateModel;
    inputs: number[];
    label: string;
    offset?: number;
  }[];
  coldOutputs?: Signal[];
  resetInputs?: number[];
  groups?: { label: string; nodes: number[]; outputs: number[] }[];
  clockSignals?: number[];
  storageShape?: { addressBits: number; width: number };
  expansion?: { source: GateModel; offsets: number[] };
}
export class GateBuilder {
  readonly model: GateModel;
  private cache = new Map<string, number>();
  readonly low: number;
  readonly high: number;
  constructor(name: string) {
    this.model = {
      name,
      nodes: [],
      inputs: [],
      outputs: [],
      clockInputs: [],
      probes: {},
    };
    this.low = this.add("LOW", [], "Ground", 0);
    this.high = this.add("HIGH", [], "VDD", 1);
  }
  add(
    op: GateOp,
    inputs: number[],
    label = op as string,
    seed: Signal = 0,
  ): number {
    const id = this.model.nodes.length;
    this.model.nodes.push({ op, inputs, label, seed });
    return id;
  }
  input(label: string, clock = false) {
    const id = this.add("INPUT", [], label, "X");
    this.model.inputs.push(id);
    if (clock) this.model.clockInputs.push(this.model.inputs.length - 1);
    return id;
  }
  bus(label: string, width: number) {
    return Array.from({ length: width }, (_, i) => this.input(`${label}${i}`));
  }
  nand(a: number, b: number): number {
    if (a === this.low || b === this.low) return this.high;
    if (a === this.high && b === this.high) return this.low;
    if (a === this.high) return this.nand(b, b);
    if (b === this.high) return this.nand(a, a);
    const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
    if (this.cache.has(key)) return this.cache.get(key)!;
    const id = this.add("NAND", [a, b]);
    this.cache.set(key, id);
    return id;
  }
  not(a: number) {
    const n = this.model.nodes[a];
    if (n.op === "NAND" && n.inputs[0] === n.inputs[1]) return n.inputs[0];
    return this.nand(a, a);
  }
  and(a: number, b: number) {
    if (a === this.low || b === this.low) return this.low;
    if (a === this.high || a === b) return b;
    if (b === this.high) return a;
    return this.not(this.nand(a, b));
  }
  or(a: number, b: number) {
    if (a === this.high || b === this.high) return this.high;
    if (a === this.low || a === b) return b;
    if (b === this.low) return a;
    return this.nand(this.not(a), this.not(b));
  }
  xor(a: number, b: number) {
    const t = this.nand(a, b);
    return this.nand(this.nand(a, t), this.nand(b, t));
  }
  all(bits: number[]) {
    return bits.reduce((a, b) => this.and(a, b), this.high);
  }
  any(bits: number[]) {
    return bits.reduce((a, b) => this.or(a, b), this.low);
  }
  constant(value: number, width: number) {
    return Array.from(
      { length: width },
      (_, i) => value >> i & 1 ? this.high : this.low,
    );
  }
  equal(bits: number[], value: number): number {
    const start = this.model.nodes.length;
    const output = this.all(
      bits.map((n, i) => value >> i & 1 ? n : this.not(n)),
    );
    if (this.model.nodes.length > start) {
      this.group(`Decode ${value.toString(16)}`, start, [output]);
    }
    return output;
  }
  mux(a: number, b: number, select: number) {
    return this.any([
      this.and(a, this.not(select)),
      this.and(b, select),
      this.and(a, b),
    ]);
  }
  select(a: number[], b: number[], select: number) {
    return a.map((n, i) => this.mux(n, b[i], select));
  }
  choose(options: { when: number; bits: number[] }[], width: number): number[] {
    const start = this.model.nodes.length;
    const result = Array.from(
      { length: width },
      (_, i) => this.any(options.map((o) => this.and(o.when, o.bits[i]))),
    );
    if (this.model.nodes.length > start) {
      this.group(`Select ${width} bits`, start, result);
    }
    return result;
  }
  ref(label: string, seed: Signal = 0) {
    return this.add("WIRE", [this.low], label, seed);
  }
  bind(ref: number, source: number) {
    this.model.nodes[ref].inputs = [source];
  }
  latch(
    data: number,
    enable: number,
    reset: number,
    initial = 0,
    label = "Latch",
  ) {
    const start = this.model.nodes.length;
    (this.model.clockSignals ??= []).push(enable);
    const q = this.ref(`${label} Q`, initial as 0 | 1),
      qb = this.ref(`${label} Qbar`, (1 - initial) as 0 | 1);
    const set = this.nand(data, enable),
      clear = this.nand(this.not(data), enable);
    const s = initial ? this.and(set, this.not(reset)) : this.or(set, reset);
    const r = initial
      ? this.or(clear, reset)
      : this.and(clear, this.not(reset));
    this.bind(q, this.nand(s, qb));
    this.bind(qb, this.nand(r, q));
    this.group(label, start, [q, qb]);
    return q;
  }
  flipFlop(
    data: number,
    clock: number,
    reset: number,
    initial = 0,
    label = "DFF",
  ) {
    const start = this.model.nodes.length;
    (this.model.clockSignals ??= []).push(clock, this.not(clock));
    const master = this.latch(
      data,
      this.not(clock),
      reset,
      initial,
      `${label} master`,
    );
    const output = this.latch(master, clock, reset, initial, `${label} slave`);
    this.group(label, start, [output]);
    return output;
  }
  register(
    data: number[],
    clock: number,
    enable: number,
    reset: number,
    initial = 0,
    label = "Register",
  ) {
    const start = this.model.nodes.length;
    const q = data.map((_, i) =>
      this.ref(`${label} Q${i}`, (initial >> i & 1) as 0 | 1)
    );
    q.forEach((n, i) =>
      this.bind(
        n,
        this.flipFlop(
          this.mux(n, data[i], enable),
          clock,
          reset,
          initial >> i & 1,
          `${label} bit ${i}`,
        ),
      )
    );
    this.model.probes[label] = q;
    this.group(label, start, q);
    return q;
  }
  group(label: string, start: number, outputs: number[]) {
    if (this.model.nodes.length === start || outputs.some((n) => n < start)) {
      return;
    }
    (this.model.groups ??= []).push({
      label,
      nodes: Array.from(
        { length: this.model.nodes.length - start },
        (_, i) => start + i,
      ),
      outputs,
    });
  }
  adder(a: number[], b: number[], cin = this.low) {
    const start = this.model.nodes.length;
    let carry = cin;
    const sum = a.map((n, i) => {
      const x = this.xor(n, b[i]), s = this.xor(x, carry);
      carry = this.or(this.and(n, b[i]), this.and(x, carry));
      return s;
    });
    this.group(`Adder ${a.length}`, start, sum.concat(carry));
    return { sum, carry };
  }
  increment(bits: number[], amount = 1) {
    return this.adder(bits, this.constant(amount, bits.length)).sum;
  }
  switch(a: number, b: number, select: number) {
    if (a === b) return a;
    return this.nand(this.nand(this.not(select), a), this.nand(select, b));
  }
  instance(model: GateModel, inputs: number[], label = model.name) {
    const instance = (this.model.instances ??= []).length;
    this.model.instances.push({ model, inputs, label });
    return model.outputs.map((_, port) => {
      const id = this.add("INSTANCE", inputs, `${label} output ${port}`);
      this.model.nodes[id].instance = instance;
      this.model.nodes[id].port = port;
      return id;
    });
  }
  output(bits: number[], label = "Result") {
    bits.forEach((n, i) => {
      this.model.outputs.push(n);
      this.model.probes[`${label}${i}`] = [n];
    });
  }
}
const encode = (s: Signal) => s === 0 ? 0 : s === 1 ? 1 : s === "X" ? 2 : 3;
const decode = (s: number): Signal =>
  s === 0 ? 0 : s === 1 ? 1 : s === 2 ? "X" : "Z";
export interface GateState {
  signature?: string;
  values: Uint8Array;
  inputs: Signal[];
  children?: Record<number, GateState>;
}
export class GateEngine {
  readonly signature: string;
  private fanout: number[][];
  private offsets: Int32Array;
  private targets: Int32Array;
  private operations: Uint8Array;
  private first: Int32Array;
  private second: Int32Array;
  constructor(readonly model: GateModel) {
    this.signature = modelSignature(model);
    if (model.instances?.length) {
      throw Error("Use the hierarchical gate engine for circuit instances.");
    }
    this.fanout = model.nodes.map(() => []);
    model.nodes.forEach((n, id) =>
      n.inputs.forEach((from) => this.fanout[from].push(id))
    );
    this.offsets = new Int32Array(model.nodes.length + 1);
    this.fanout.forEach((nodes, i) =>
      this.offsets[i + 1] = this.offsets[i] + nodes.length
    );
    this.targets = Int32Array.from(this.fanout.flat());
    this.operations = Uint8Array.from(
      model.nodes,
      (n) =>
        n.op === "INPUT"
          ? 0
          : n.op === "NAND"
          ? 1
          : n.op === "WIRE"
          ? 2
          : n.op === "LOW"
          ? 3
          : 4,
    );
    this.first = Int32Array.from(model.nodes, (n) => n.inputs[0] ?? 0);
    this.second = Int32Array.from(model.nodes, (n) => n.inputs[1] ?? 0);
  }
  evaluate(inputs: Signal[], previous?: GateState): GateState {
    if (previous?.signature !== this.signature) previous = undefined;
    const values = previous
      ? previous.values.slice()
      : Uint8Array.from(this.model.nodes, (n) => encode(n.seed));
    const capacity = 2 ** Math.ceil(Math.log2(Math.max(2, values.length))),
      mask = capacity - 1;
    const pending = new Uint8Array(values.length),
      queue = new Int32Array(capacity);
    let head = 0, tail = 0, count = 0;
    const enqueue = (id: number) => {
      if (!pending[id]) {
        pending[id] = 1;
        queue[tail] = id;
        tail = (tail + 1) & mask;
        count++;
      }
    };
    const set = (id: number, value: number) => {
      if (values[id] === value) return;
      values[id] = value;
      for (let j = this.offsets[id]; j < this.offsets[id + 1]; j++) {
        enqueue(this.targets[j]);
      }
    };
    const settle = () => {
      let events = 0;
      while (count) {
        if (events++ > Math.max(10000, values.length * 64)) {
          throw Error("Gate network failed to settle.");
        }
        const id = queue[head];
        head = (head + 1) & mask;
        count--;
        pending[id] = 0;
        const op = this.operations[id];
        if (op === 0) continue;
        const a = values[this.first[id]], b = values[this.second[id]];
        const value = op === 3
          ? 0
          : op === 4
          ? 1
          : op === 2
          ? a
          : a === 0 || b === 0
          ? 1
          : a === 1 && b === 1
          ? 0
          : 2;
        set(id, value);
      }
    };
    if (!previous) {
      this.model.inputs.forEach((id, i) =>
        values[id] = encode(
          this.model.clockInputs.includes(i) ? 0 : inputs[i] ?? "X",
        )
      );
      const initialized = new Set<number>();
      const prime = (id: number): number => {
        if (initialized.has(id)) return values[id];
        initialized.add(id);
        const n = this.model.nodes[id];
        if (n.op === "INPUT" || n.op === "WIRE" && !n.transparent) {
          return values[id];
        }
        if (n.op === "WIRE") return values[id] = prime(n.inputs[0]);
        if (n.op === "LOW" || n.op === "HIGH") {
          return values[id] = n.op === "LOW" ? 0 : 1;
        }
        const [a, b] = n.inputs.map(prime);
        return values[id] = a === 0 || b === 0 ? 1 : a === 1 && b === 1 ? 0 : 2;
      };
      this.model.nodes.forEach((_, id) => prime(id));
      this.model.nodes.forEach((n, id) => {
        if (n.op !== "INPUT") enqueue(id);
      });
      settle();
    }
    const clocks = new Set(this.model.clockInputs);
    this.model.inputs.forEach((id, i) => {
      if (!clocks.has(i)) set(id, encode(inputs[i] ?? "X"));
    });
    settle();
    this.model.inputs.forEach((id, i) => {
      if (clocks.has(i)) set(id, encode(inputs[i] ?? "X"));
    });
    settle();
    return { signature: this.signature, values, inputs: [...inputs] };
  }
  outputs(state: GateState) {
    return this.model.outputs.map((id) => decode(state.values[id]));
  }
  probe(state: GateState, name: string) {
    return (this.model.probes[name] ?? []).map((id) =>
      decode(state.values[id])
    );
  }
}

const signatures = new WeakMap<GateModel, string>();
export function modelSignature(model: GateModel): string {
  const cached = signatures.get(model);
  if (cached) return cached;
  let hash = 2166136261;
  const add = (n: number) => {
    hash = Math.imul(hash ^ n, 16777619);
  };
  for (const node of model.nodes) {
    for (const c of node.op) add(c.charCodeAt(0));
    add(encode(node.seed));
    add(node.transparent ? 1 : 0);
    node.inputs.forEach(add);
    add(node.instance ?? -1);
    add(node.port ?? -1);
  }
  model.inputs.forEach(add);
  model.outputs.forEach(add);
  model.clockInputs.forEach(add);
  for (const instance of model.instances ?? []) {
    for (const c of modelSignature(instance.model)) {
      add(c.charCodeAt(0));
    }
  }
  const signature = `${model.nodes.length}:${hash >>> 0}`;
  signatures.set(model, signature);
  return signature;
}
const engines = new WeakMap<GateModel, GateEngine | HierarchyEngine>();
export function engineFor(model: GateModel): GateEngine | HierarchyEngine {
  let engine = engines.get(model);
  if (!engine) {
    engine = model.instances?.length
      ? new HierarchyEngine(model)
      : new GateEngine(model);
    engines.set(model, engine);
  }
  return engine;
}
export class HierarchyEngine {
  readonly signature: string;
  private costs: number[];
  private instanceOutputs: { id: number; port: number }[][];
  private orderedInputs: number[][];
  constructor(readonly model: GateModel) {
    this.signature = modelSignature(model);
    this.costs = model.nodes.map((n) =>
      n.op === "INSTANCE"
        ? 1000000
        : n.op === "INPUT" || n.op === "LOW" || n.op === "HIGH"
        ? 0
        : 1
    );
    for (let pass = 0; pass < 8; pass++) {
      model.nodes.forEach((n, i) => {
        if (n.op === "NAND") {
          this.costs[i] = Math.min(
            1000000,
            1 + n.inputs.reduce((sum, id) => sum + this.costs[id], 0),
          );
        }
      });
    }
    this.instanceOutputs = (model.instances ?? []).map((_, index) =>
      model.nodes.flatMap((n, id) =>
        n.op === "INSTANCE" && n.instance === index
          ? [{ id, port: n.port! }]
          : []
      )
    );
    this.orderedInputs = model.nodes.map((n) =>
      [...n.inputs].sort((a, b) => this.costs[a] - this.costs[b])
    );
  }
  evaluate(inputs: Signal[], previous?: GateState): GateState {
    if (previous?.signature !== this.signature) previous = undefined;
    if (
      this.model.storageShape &&
      this.model.clockInputs.some((i) => inputs[i] !== 0 && inputs[i] !== 1)
    ) {
      throw Error(
        "Memory write clock must be connected to a known 0 or 1 signal.",
      );
    }
    const values = previous
      ? previous.values.slice()
      : Uint8Array.from(this.model.nodes, (n) => encode(n.seed));
    const children = { ...(previous?.children ?? {}) };
    const current = [...inputs];
    const clocks = new Set(this.model.clockInputs);
    this.model.inputs.forEach((id, i) =>
      values[id] = encode(
        clocks.has(i) ? previous?.inputs[i] ?? 0 : inputs[i] ?? "X",
      )
    );
    let risingStage = false;
    const settle = () => {
      for (let pass = 0; pass < 32; pass++) {
        let instanceChanged = false;
        const memo = new Map<number, number>(), visiting = new Set<number>();
        const read = (id: number): number => {
          if (memo.has(id)) return memo.get(id)!;
          if (visiting.has(id)) return values[id];
          visiting.add(id);
          const n = this.model.nodes[id];
          let value: number;
          if (n.op === "INPUT") value = values[id];
          else if (n.op === "LOW" || n.op === "HIGH") {
            value = n.op === "LOW" ? 0 : 1;
          } else if (n.op === "INSTANCE") {
            const spec = this.model.instances![n.instance!];
            const pins = spec.inputs.map((input) => decode(read(input)));
            const old = children[n.instance!];
            if (
              risingStage && old &&
              spec.model.clockInputs.some((i) =>
                old.inputs[i] !== pins[i] &&
                (old.inputs[i] === 0 || old.inputs[i] === 1) &&
                (pins[i] === 0 || pins[i] === 1)
              )
            ) {
              pins.forEach((_, i) => {
                if (
                  !spec.model.clockInputs.includes(i) &&
                  !(spec.model.resetInputs ?? []).includes(i)
                ) pins[i] = old.inputs[i];
              });
            }
            if (
              !old && spec.model.coldOutputs &&
              spec.model.clockInputs.every((i) => pins[i] === 0) &&
              (spec.model.resetInputs ?? []).every((i) => pins[i] === 0)
            ) value = encode(spec.model.coldOutputs[n.port!]);
            else {
              const engine = engineFor(spec.model);
              const child = old && old.inputs.length === pins.length &&
                  old.inputs.every((pin, i) => pin === pins[i])
                ? old
                : engine.evaluate(pins, old);
              children[n.instance!] = child;
              const outputs = engine.outputs(child);
              for (const { id, port } of this.instanceOutputs[n.instance!]) {
                const nextValue = encode(outputs[port]);
                if (values[id] !== nextValue) instanceChanged = true;
                memo.set(id, nextValue);
              }
              value = encode(outputs[n.port!]);
            }
          } else if (n.op === "WIRE") value = read(n.inputs[0]);
          else {
            const [a, b] = this.orderedInputs[id];
            const first = read(a);
            if (first === 0) value = 1;
            else {
              const second = read(b);
              value = second === 0 ? 1 : first === 1 && second === 1 ? 0 : 2;
            }
          }
          visiting.delete(id);
          memo.set(id, value);
          return value;
        };
        let changed = false;
        for (const [index, child] of Object.entries(children)) {
          const spec = this.model.instances![Number(index)];
          const watched = [
            ...spec.model.clockInputs,
            ...spec.model.resetInputs ?? [],
          ];
          if (
            watched.some((i) =>
              decode(read(spec.inputs[i])) !== child.inputs[i]
            )
          ) {
            read(this.instanceOutputs[Number(index)][0].id);
          }
        }
        this.model.nodes.forEach((n, i) => {
          if (n.op === "WIRE") {
            const next = read(i);
            if (next !== values[i]) {
              values[i] = next;
              changed = true;
            }
          }
        });
        this.model.outputs.forEach(read);
        for (const [i, value] of memo) values[i] = value;
        if (!changed && !instanceChanged) return;
      }
      throw Error("Hierarchical gate feedback failed to settle.");
    };
    settle();
    risingStage = true;
    this.model.inputs.forEach((id, i) => {
      if (clocks.has(i)) values[id] = encode(inputs[i] ?? "X");
    });
    settle();
    return { signature: this.signature, values, inputs: current, children };
  }
  outputs(state: GateState) {
    return this.model.outputs.map((id) => decode(state.values[id]));
  }
  probe(state: GateState, name: string) {
    return (this.model.probes[name] ?? []).map((id) =>
      decode(state.values[id])
    );
  }
}
export function flattenGateModel(model: GateModel, limit = 30_000): GateModel {
  const sizes = new Map<GateModel, number>();
  const size = (m: GateModel): number => {
    if (sizes.has(m)) return sizes.get(m)!;
    let n = m.nodes.length;
    for (const child of m.instances ?? []) {
      n += size(child.model);
      if (n > limit) break;
    }
    sizes.set(m, n);
    return n;
  };
  if (!model.instances?.length || size(model) > limit) return model;
  const flat: GateModel = {
    ...model,
    nodes: [],
    instances: undefined,
    expansion: { source: model, offsets: [] },
  };
  const append = (m: GateModel, pins?: number[]): number[] => {
    const offset = flat.nodes.length;
    const ids = m.nodes.map((_, i) => offset + i);
    flat.nodes.push(
      ...m.nodes.map((n) => ({ ...n, inputs: n.inputs.map((i) => ids[i]) })),
    );
    if (pins) {
      m.inputs.forEach((id, i) => {
        flat.nodes[ids[id]] = {
          ...flat.nodes[ids[id]],
          op: "WIRE",
          inputs: [pins[i]],
          transparent: true,
        };
      });
    }
    (m.instances ?? []).forEach((spec, index) => {
      if (m === model) flat.expansion!.offsets[index] = flat.nodes.length;
      const outputs = append(spec.model, spec.inputs.map((i) => ids[i]));
      m.nodes.forEach((node, i) => {
        if (node.op === "INSTANCE" && node.instance === index) {
          flat.nodes[ids[i]] = {
            ...flat.nodes[ids[i]],
            op: "WIRE",
            inputs: [outputs[node.port!]],
            transparent: true,
          };
        }
      });
    });
    return m.outputs.map((i) => ids[i]);
  };
  append(model);
  return flat;
}

export function expandGateState(model: GateModel, state: GateState): GateState {
  if (!model.expansion) return state;
  const { source, offsets } = model.expansion;
  const children: Record<number, GateState> = {};
  for (const [index, spec] of (source.instances ?? []).entries()) {
    const offset = offsets[index];
    children[index] = {
      signature: modelSignature(spec.model),
      values: state.values.slice(offset, offset + spec.model.nodes.length),
      inputs: spec.inputs.map((i) => decode(state.values[i])),
    };
  }
  return {
    ...state,
    signature: modelSignature(source),
    values: state.values.slice(0, source.nodes.length),
    children,
  };
}
