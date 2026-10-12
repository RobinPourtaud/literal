import {
  type Circuit,
  type Component,
  componentOutputs,
  type Definition,
  inputCount,
  type Memory,
  type Signal,
  type Simulation,
} from "./index.ts";
import {
  engineFor,
  expandGateState,
  flattenGateModel,
  GateBuilder,
  type GateModel,
  type GateState,
  modelSignature,
} from "./gate-netlist.ts";
import { gateDevice } from "./gate-devices.ts";
import {
  gateNumber,
  processorSnapshot,
  storedWords,
} from "./gate-snapshots.ts";
import type { KeyboardState } from "./peripherals.ts";
export interface GateBinding {
  component: Component;
  inputs: number[];
  outputs: number[];
  model?: GateModel;
  instance?: number;
}
export interface CompiledCircuit {
  model: GateModel;
  bindings: GateBinding[];
  sources: { id: string; slot: number; host?: number }[];
  unknown: number;
}
const cache = new WeakMap<
  Circuit,
  { shape: string; compiled: CompiledCircuit | null }
>();
let definitions = new WeakMap<Definition, GateModel>();
let definitionCircuits = new WeakMap<Definition, CompiledCircuit>();
const definitionIds = new WeakMap<Definition, { id: number; shape: string }>();
let nextDefinitionId = 0;
function definitionIdentity(def: Definition) {
  const shape = JSON.stringify([def.components, def.wires]);
  const old = definitionIds.get(def);
  if (old?.shape === shape) return old.id;
  if (old) {
    definitions = new WeakMap();
    definitionCircuits = new WeakMap();
  }
  const id = nextDefinitionId++;
  definitionIds.set(def, { id, shape });
  return id;
}
const sourceKinds = new Set(["INPUT", "CLOCK", "POWER", "GROUND"]);
export function compileCircuit(circuit: Circuit): CompiledCircuit | null {
  const shape = JSON.stringify([
    circuit.components.map((
      c,
    ) => [
      c.id,
      c.kind,
      c.definition,
      c.contents,
      c.clockInput,
      c.kind === "BUFFER" ? c.value : undefined,
      c.kind === "INPUT" ? c.label : undefined,
    ]),
    circuit.wires.map((w) => [w.from, w.fromPort, w.to, w.port]),
    circuit.definitions?.map((def) => definitionIdentity(def)),
  ]);
  const cached = cache.get(circuit);
  if (cached?.shape === shape) return cached.compiled;
  const supports = (
    components: Component[],
    seen = new Set<string>(),
  ): boolean =>
    components.every((c) => {
      if (["NMOS", "PMOS", "JUNCTION"].includes(c.kind)) return false;
      if (c.kind !== "CUSTOM") return true;
      if (seen.has(c.definition!)) return false;
      const def = circuit.definitions?.find((d) => d.id === c.definition);
      return !!def && supports(def.components, new Set([...seen, def.id]));
    });
  if (!supports(circuit.components)) {
    cache.set(circuit, { shape, compiled: null });
    return null;
  }
  const compile = (c: Circuit, external: boolean): CompiledCircuit => {
    const b = new GateBuilder(c.name),
      sources: CompiledCircuit["sources"] = [],
      bindings: GateBinding[] = [];
    const unknown = b.input("Disconnected pin");
    const outputs = new Map<string, number[]>(),
      incoming = new Map(c.wires.map((w) => [`${w.to}:${w.port}`, w]));
    for (const n of c.components) {
      if (sourceKinds.has(n.kind)) {
        let id: number;
        if (external || n.kind === "INPUT") {
          id = b.input(
            n.label,
            n.clockInput === true || n.kind === "CLOCK" ||
              /clock|clk/i.test(n.label),
          );
          sources.push({ id: n.id, slot: b.model.inputs.length - 1 });
        } else id = n.kind === "GROUND" || n.value === 0 ? b.low : b.high;
        outputs.set(n.id, [id]);
      } else {outputs.set(
          n.id,
          Array.from(
            { length: Math.max(1, componentOutputs(n, c)) },
            (_, i) => {
              const ref = b.ref(`${n.label} output ${i}`, n.value ?? 0);
              b.model.nodes[ref].transparent = n.kind !== "BUFFER" ||
                n.value === undefined;
              return ref;
            },
          ),
        );}
    }
    const ports = (n: Component) =>
      Array.from({
        length: n.kind === "CUSTOM"
          ? c.definitions!.find((d) => d.id === n.definition)!.components
            .filter((n) => n.kind === "INPUT").length
          : inputCount(n.kind),
      }, (_, port) => {
        const w = incoming.get(`${n.id}:${port}`);
        return w ? outputs.get(w.from)?.[w.fromPort ?? 0] ?? unknown : unknown;
      });
    for (const n of c.components) {
      const ins = ports(n), drivers = outputs.get(n.id)!;
      const binding: GateBinding = {
        component: n,
        inputs: ins,
        outputs: drivers,
      };
      bindings.push(binding);
      if (sourceKinds.has(n.kind)) continue;
      let expr: number[];
      if (n.kind === "CUSTOM") {
        const def = c.definitions!.find((d) => d.id === n.definition)!;
        let model = definitions.get(def);
        if (!model) {
          const child = compile({
            version: 1,
            name: def.name,
            components: def.components,
            wires: def.wires,
            definitions: c.definitions,
          }, false);
          definitionCircuits.set(def, child);
          model = flattenGateModel(child.model);
          model.resetInputs = model.inputs.flatMap((id, i) =>
            /reset|clear/i.test(model!.nodes[id].label) ? [i] : []
          );
          if (model.clockInputs.length && model.outputs.length <= 32) {
            const test = model.inputs.map((_, i) =>
              model!.clockInputs.includes(i) || model!.resetInputs!.includes(i)
                ? 0 as Signal
                : "X" as Signal
            );
            try {
              const e = engineFor(model), proof = e.outputs(e.evaluate(test));
              if (proof.every((bit) => bit === 0 || bit === 1)) {
                model.coldOutputs = proof;
              }
            } catch {}
          }
          definitions.set(def, model);
        }
        binding.model = model;
        binding.instance = (b.model.instances ?? []).length;
        expr = b.instance(model, ins.concat(b.low), n.label);
      } else if (
        ["AND", "OR", "NOT", "NAND", "NOR", "XOR", "XNOR", "BUFFER", "MUX"]
          .includes(n.kind)
      ) {
        const [a, other, select] = ins;
        expr = [
          n.kind === "AND"
            ? b.and(a, other)
            : n.kind === "OR"
            ? b.or(a, other)
            : n.kind === "NOT"
            ? b.not(a)
            : n.kind === "NAND"
            ? b.nand(a, other)
            : n.kind === "NOR"
            ? b.not(b.or(a, other))
            : n.kind === "XOR"
            ? b.xor(a, other)
            : n.kind === "XNOR"
            ? b.not(b.xor(a, other))
            : n.kind === "MUX"
            ? b.mux(a, other, select)
            : a,
        ];
      } else if (n.kind === "LED" || n.kind === "OUTPUT") expr = [ins[0]];
      else {
        const model = gateDevice(n);
        if (!model) throw Error(`No gate circuit for ${n.kind}.`);
        const pins = [...ins];
        if (n.kind === "KEYBOARD" || n.kind === "BUS_KEYBOARD") {
          for (let host = 0; host < 9; host++) {
            pins.push(b.input(`${n.label} physical ${host}`));
            sources.push({ id: n.id, slot: b.model.inputs.length - 1, host });
          }
        }
        binding.model = model;
        binding.instance = (b.model.instances ?? []).length;
        expr = b.instance(model, pins, n.label);
        if (expr.length > drivers.length) {
          const hidden = expr.slice(drivers.length).map((_, i) =>
            b.ref(`${n.label} internal ${i}`)
          );
          drivers.push(...hidden);
        }
      }
      if (binding.model) {
        for (const port of binding.model.clockInputs) {
          const inputIndex = b.model.inputs.indexOf(ins[port]);
          if (inputIndex >= 0 && !b.model.clockInputs.includes(inputIndex)) {
            b.model.clockInputs.push(inputIndex);
          }
        }
      }
      drivers.forEach((ref, i) => b.bind(ref, expr[i] ?? b.low));
    }
    if (external) b.output([...outputs.values()].flat());
    else {b.output(
        c.components.filter((n) => n.kind === "OUTPUT").map((n) =>
          outputs.get(n.id)![0]
        ),
      );}
    if (!external) {
      const clockIds = new Set(
        b.model.clockInputs.map((i) => b.model.inputs[i]),
      );
      const interfaceInputs = c.components.filter((n) => n.kind === "INPUT")
        .map((n) => outputs.get(n.id)![0]);
      b.model.inputs = interfaceInputs.concat(unknown);
      b.model.clockInputs = interfaceInputs.flatMap((id, i) =>
        clockIds.has(id) || /clock|clk/i.test(b.model.nodes[id].label)
          ? [i]
          : []
      );
    }
    return { model: b.model, bindings, sources, unknown };
  };
  const compiled = compile(circuit, true);
  cache.set(circuit, { shape, compiled });
  return compiled;
}
export function simulateGates(
  circuit: Circuit,
  compiled: CompiledCircuit,
  previous: Memory,
  overrides: Record<string, Signal>,
  keyboards: Record<string, KeyboardState>,
): Simulation {
  const engine = engineFor(compiled.model),
    input: Signal[] = Array(compiled.model.inputs.length).fill("X");
  input[compiled.model.inputs.indexOf(compiled.unknown)] = "X";
  for (const source of compiled.sources) {
    const n = circuit.components.find((c) => c.id === source.id)!;
    if (source.host !== undefined) {
      const key = keyboards[n.id] ?? { code: 0, pressed: false };
      input[source.slot] = source.host === 8
        ? key.pressed ? 1 : 0
        : (key.code >> source.host & 1) as Signal;
    } else {input[source.slot] = n.kind === "GROUND"
        ? 0
        : overrides[n.id] ?? n.value ?? (n.kind === "POWER" ? 1 : 0);}
  }
  let state: GateState;
  const warnings: string[] = [];
  try {
    let prior = previous.gates?.["$circuit"];
    if (prior && prior.signature !== modelSignature(compiled.model)) {
      const fresh = engine.evaluate(
        input.map((p, i) => compiled.model.clockInputs.includes(i) ? 0 : p),
      );
      fresh.children = { ...fresh.children };
      for (const binding of compiled.bindings) {
        if (binding.model && binding.instance !== undefined) {
          const old = previous.gates?.[binding.component.id];
          if (old?.signature === modelSignature(binding.model)) {
            fresh.children[binding.instance] = old;
          }
        }
      }
      prior = fresh;
    }
    state = engine.evaluate(input, prior);
  } catch (error) {
    warnings.push(
      `Gate feedback failed to settle: ${(error as Error).message}`,
    );
    return {
      values: Object.fromEntries(
        compiled.bindings.map((b) => [b.component.id, "X" as Signal]),
      ),
      inputs: Object.fromEntries(
        compiled.bindings.map((b) => [
          b.component.id,
          b.inputs.map(() => "X" as Signal),
        ]),
      ),
      outputValues: Object.fromEntries(
        compiled.bindings.map((b) => [
          b.component.id,
          b.outputs.map(() => "X" as Signal),
        ]),
      ),
      memory: previous,
      warnings,
    };
  }
  return circuitSnapshot(compiled, state, warnings);
}
function circuitSnapshot(
  compiled: CompiledCircuit,
  state: GateState,
  warnings: string[] = [],
): Simulation {
  const val = (id: number): Signal =>
    state.values[id] === 0
      ? 0
      : state.values[id] === 1
      ? 1
      : state.values[id] === 2
      ? "X"
      : "Z";
  const memory: Memory = {
    q: {},
    clock: {},
    gates: { "$circuit": state },
    bytes: {},
    ram: {},
    busRAM: {},
    screens: {},
    terminals: {},
    processors: {},
    displays: {},
  };
  const values: Simulation["values"] = {},
    inputs: Simulation["inputs"] = {},
    outputValues: Simulation["outputValues"] = {};
  for (const binding of compiled.bindings) {
    const { component: c, model, instance } = binding;
    inputs[c.id] = binding.inputs.map(val);
    outputValues[c.id] = binding.outputs.map(val);
    values[c.id] = outputValues[c.id][0] ?? 0;
    if (model && instance !== undefined) {
      const child = state.children?.[instance];
      if (!child) continue;
      memory.gates![c.id] = child;
      const e = engineFor(model), out = e.outputs(child);
      if (c.kind === "BUS_CPU") {
        const cpu = processorSnapshot(model, child);
        memory.processors![c.id] = cpu;
        if (cpu.error) warnings.push(`${c.label}: ${cpu.error}`);
      }
      if (c.kind === "DFF") memory.q[c.id] = out[0];
      if (c.kind === "COUNTER8" || c.kind === "REGISTER8") {
        memory.bytes![c.id] = out;
      }
      if (c.kind === "HEX_DISPLAY" || c.kind === "SEVEN_SEG") {
        memory.displays![c.id] = out;
      }
      if (c.kind === "BUS_RAM") {
        memory.busRAM![c.id] = Object.fromEntries(
          [...storedWords(model, child)].map((
            [a, b],
          ) => [a, gateNumber(b) ?? 0]),
        );
      }
      if (c.kind === "RAM") {
        const bits = Array<Signal>(2048).fill(0);
        for (const [a, b] of storedWords(model, child)) {
          bits.splice(a * 8, 8, ...b);
        }
        memory.ram![c.id] = bits;
      }
      if (c.kind === "VGA" || c.kind === "BUS_SCREEN") {
        const frame = Array<number>(768).fill(0);
        for (const [a, b] of storedWords(model, child)) {
          if (a < 768) frame[a] = gateNumber(b) ?? 0;
        }
        memory.screens![c.id] = frame;
      }
      if (c.kind === "BUS_TERMINAL") {
        const count = (gateNumber(e.probe(child, "Count")) ?? 0) +
            (gateNumber(e.probe(child, "Write")) ?? 0),
          words = storedWords(model, child),
          length = Math.min(count, 4096),
          start = Math.max(0, count - 4096);
        memory.terminals![c.id] = Array.from(
          { length },
          (_, i) =>
            String.fromCharCode(
              gateNumber(words.get((start + i) % 4096) ?? []) ?? 0,
            ),
        ).join("");
      }
    }
    if (
      c.kind === "VGA" && inputs[c.id][13] === 1 &&
      inputs[c.id].slice(0, 13).some((s) => s === "X" || s === "Z")
    ) {
      warnings.push(
        `${c.label}: pixel write needs known coordinates and RGB inputs.`,
      );
    }
  }
  return { values, inputs, outputValues, memory, warnings };
}

export function inspectCustomCircuit(
  component: Component,
  parent: Circuit,
  simulation: Simulation,
) {
  if (component.kind !== "CUSTOM") return null;
  const definition = parent.definitions?.find((d) =>
    d.id === component.definition
  );
  const state = simulation.memory.gates?.[component.id];
  if (!definition || !state) return null;
  const compiled = definitionCircuits.get(definition),
    model = definitions.get(definition);
  if (!compiled || !model) return null;
  return {
    circuit: {
      version: 1 as const,
      name: definition.name,
      components: definition.components,
      wires: definition.wires,
      definitions: parent.definitions,
    },
    simulation: circuitSnapshot(compiled, expandGateState(model, state)),
  };
}
