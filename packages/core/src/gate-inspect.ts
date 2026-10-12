import { componentInputs, componentOutputs } from "./index.ts";
import type {
  Circuit,
  Component,
  Definition,
  Signal,
  Simulation,
} from "./index.ts";
import {
  engineFor,
  type GateModel,
  type GateState,
  modelSignature,
} from "./gate-netlist.ts";
import { gateComputationalKinds, gateDevice } from "./gate-devices.ts";
interface Projection {
  model: GateModel;
  scope: number[];
  outputs: number[];
  label: string;
}
const projections = new WeakMap<Definition, Projection>();
const byId = new Map<string, Definition>();
const definitions = new WeakMap<GateModel, Map<string, Definition>>();
const signal = (state: GateState, id: number): Signal =>
  state.values[id] === 0
    ? 0
    : state.values[id] === 1
    ? 1
    : state.values[id] === 2
    ? "X"
    : "Z";
function preview(model: GateModel, pins: Signal[]): GateState {
  try {
    return engineFor(model).evaluate(pins);
  } catch {
    return { values: new Uint8Array(model.nodes.length).fill(2), inputs: pins };
  }
}
function view(
  projection: Projection,
  state: GateState,
): { circuit: Circuit; simulation: Simulation } {
  const { model, scope, outputs, label } = projection;
  let cached = definitions.get(model);
  if (!cached) {
    cached = new Map();
    definitions.set(model, cached);
  }
  const registered: Definition[] = [];
  const make = (p: Projection): Definition => {
    const key = `${p.label}:${p.scope[0]}:${p.scope.length}`;
    const known = cached!.get(key);
    if (known) {
      collect(known);
      return known;
    }
    const members = new Set(p.scope),
      groups = (model.groups ?? []).filter((g) =>
        g.nodes.length > 0 && g.nodes.length < p.scope.length &&
        g.outputs.every((n) => g.nodes.includes(n)) && g.nodes.every((n) =>
          members.has(n)
        )
      );
    const outer = groups.filter((g) =>
      !groups.some((other) =>
        other !== g && other.nodes.length > g.nodes.length &&
        g.nodes.every((n) => other.nodes.includes(n))
      )
    );
    const covered = new Set(outer.flatMap((g) => g.nodes));
    const childOutputs = new Map<number, { id: string; port: number }>();
    const comps: Component[] = [],
      wires: Circuit["wires"] = [],
      inputs = new Map<number, string>();
    const def: Definition = {
      internal: true,
      id: `hardware-${modelSignature(model).replace(":", "-")}-${cached!.size}`,
      name: p.label,
      color: "#527d3c",
      shape: "rounded",
      components: comps,
      wires,
    };
    cached!.set(key, def);
    registered.push(def);
    byId.set(def.id, def);
    projections.set(def, p);
    const addWire = (
      from: { id: string; port: number },
      to: string,
      port: number,
    ) =>
      wires.push({
        id: `w-${wires.length}`,
        from: from.id,
        fromPort: from.port,
        to,
        port,
      });
    const boundary = (n: number) => {
      if (!inputs.has(n)) {
        const id = `input-${n}`;
        inputs.set(n, id);
        comps.push({
          id,
          kind: "INPUT",
          label: model.nodes[n].label === "NAND"
            ? `Shared signal ${n}`
            : model.nodes[n].label,
          x: 0,
          y: inputs.size * 90,
          value: signal(state, n) === 1 ? 1 : 0,
          clockInput: model.clockSignals?.includes(n) ||
            model.inputs.some((id, i) =>
              id === n && model.clockInputs.includes(i)
            ),
        });
      }
      return { id: inputs.get(n)!, port: 0 };
    };
    const endpoint = (n: number): { id: string; port: number } => {
      if (childOutputs.has(n)) return childOutputs.get(n)!;
      if (!members.has(n)) return boundary(n);
      const node = model.nodes[n];
      return node.op === "INSTANCE"
        ? { id: `instance-${node.instance}`, port: node.port! }
        : { id: `gate-${n}`, port: 0 };
    };
    outer.forEach((g, index) => {
      const inside = new Set(g.nodes);
      const outward = [
        ...new Set([
          ...g.outputs,
          ...p.scope.flatMap((n) =>
            model.nodes[n].inputs.filter((from) =>
              inside.has(from) && !inside.has(n)
            )
          ),
          ...p.outputs.filter((n) => inside.has(n)),
        ]),
      ];
      const child = make({
        model,
        scope: g.nodes,
        outputs: outward,
        label: g.label,
      });
      const id = `group-${index}`;
      comps.push({
        id,
        kind: "CUSTOM",
        definition: child.id,
        label: g.label,
        x: 400 + index % 3 * 240,
        y: Math.floor(index / 3) * 240,
      });
      outward.forEach((n, port) => childOutputs.set(n, { id, port }));
    });
    const instances = new Set<number>();
    for (const n of p.scope) {
      if (covered.has(n)) continue;
      const node = model.nodes[n];
      if (node.op === "INSTANCE") {
        if (instances.has(node.instance!)) continue;
        instances.add(node.instance!);
        const spec = model.instances![node.instance!], childModel = spec.model;
        const childView = view(
          {
            model: childModel,
            scope: childModel.nodes.map((_, i) => i),
            outputs: childModel.outputs,
            label: spec.label,
          },
          state.children?.[node.instance!] ??
            preview(childModel, spec.inputs.map((i) => signal(state, i))),
        );
        registered.push(...childView.circuit.definitions!);
        const childDef = childView.circuit.definitions![0];
        comps.push({
          id: `instance-${node.instance}`,
          kind: "CUSTOM",
          definition: childDef.id,
          label: spec.label,
          x: 480,
          y: instances.size * 280,
        });
      } else {comps.push({
          id: `gate-${n}`,
          kind: node.op === "INPUT"
            ? "INPUT"
            : node.op === "LOW"
            ? "GROUND"
            : node.op === "HIGH"
            ? "POWER"
            : node.op === "WIRE"
            ? "BUFFER"
            : "NAND",
          label: node.label === "NAND" ? `NAND ${n}` : node.label,
          x: 200 + (comps.length % 12) * 200,
          y: Math.floor(comps.length / 12) * 120,
          value: node.op === "WIRE"
            ? (node.seed === 1 ? 1 : 0)
            : node.op === "HIGH"
            ? 1
            : node.op === "INPUT"
            ? (signal(state, n) === 1 ? 1 : 0)
            : undefined,
          clockInput: node.op === "INPUT" &&
            model.clockInputs.some((i) => model.inputs[i] === n),
        });}
    }
    for (const n of p.scope) {
      if (covered.has(n)) continue;
      const node = model.nodes[n];
      if (node.op === "INSTANCE") {
        if (node.port !== 0) continue;
        node.inputs.forEach((from, port) =>
          addWire(endpoint(from), `instance-${node.instance}`, port)
        );
      } else {node.inputs.forEach((from, port) =>
          addWire(endpoint(from), `gate-${n}`, port)
        );}
    }
    outer.forEach((g, index) => {
      const child = registered.find((d) =>
        d.id === comps.find((c) => c.id === `group-${index}`)!.definition
      )!;
      const projection = projections.get(child)!;
      const inputNodes = child.components.filter((c) => c.kind === "INPUT");
      inputNodes.forEach((input, port) => {
        const original = Number(
          input.id.replace("input-", "").replace("gate-", ""),
        );
        addWire(endpoint(original), `group-${index}`, port);
      });
    });
    p.outputs.forEach((n, i) => {
      const id = `out-${i}`;
      comps.push({
        id,
        kind: "OUTPUT",
        label: `Output ${i}`,
        x: 2400,
        y: i * 80,
      });
      addWire(endpoint(n), id, 0);
    });
    const palette = [...registered, ...byId.values()];
    const context: Circuit = {
      version: 1,
      name: p.label,
      components: comps,
      wires,
      definitions: palette,
    };
    const columns = [0, 0, 0, 0];
    let sourceY = 0, outputY = 0, index = 0;
    for (const c of comps) {
      if (["INPUT", "POWER", "GROUND"].includes(c.kind)) {
        c.x = 0;
        c.y = sourceY;
        sourceY += 90;
      } else if (c.kind === "OUTPUT") {
        c.x = 2200;
        c.y = outputY;
        outputY += 90;
      } else {
        const column = index++ % columns.length;
        const height = Math.max(
          80,
          Math.max(componentInputs(c, context), componentOutputs(c, context)) *
              24 + 40,
        );
        c.x = 400 + column * 440;
        c.y = columns[column] + height / 2;
        columns[column] += height + 120;
      }
    }
    return def;
  };
  const collect = (def: Definition) => {
    if (registered.some((d) => d.id === def.id)) return;
    registered.push(def);
    for (const c of def.components) {
      if (c.definition) {
        const nested = byId.get(c.definition);
        if (nested) collect(nested);
      }
    }
  };
  const def = make(projection);
  const unique = [...new Map(registered.map((d) => [d.id, d])).values()];
  const circuit: Circuit = {
    version: 1,
    name: label,
    components: def.components,
    wires: def.wires,
    definitions: unique,
  };
  const values: Simulation["values"] = {},
    inputs: Simulation["inputs"] = {},
    outputValues: Simulation["outputValues"] = {},
    gates: Record<string, GateState> = {};
  const currentProjection = projections.get(def)!;
  for (const c of circuit.components) {
    if (c.id.startsWith("gate-")) {
      const id = Number(c.id.slice(5)), node = model.nodes[id];
      values[c.id] = signal(state, id);
      inputs[c.id] = node.inputs.map((n) => signal(state, n));
      outputValues[c.id] = [values[c.id]];
    } else if (c.id.startsWith("input-")) {
      values[c.id] = signal(state, Number(c.id.slice(6)));
      inputs[c.id] = [];
      outputValues[c.id] = [values[c.id]];
    } else if (c.id.startsWith("group-")) {
      const child = unique.find((d) => d.id === c.definition)!,
        p = projections.get(child)!;
      gates[c.id] = state;
      outputValues[c.id] = p.outputs.map((n) => signal(state, n));
      values[c.id] = outputValues[c.id][0];
      inputs[c.id] = child.components.filter((n) => n.kind === "INPUT").map(
        (n) =>
          signal(
            state,
            Number(n.id.replace("input-", "").replace("gate-", "")),
          ),
      );
    } else if (c.id.startsWith("instance-")) {
      const id = Number(c.id.slice(9)),
        spec = model.instances![id],
        child = state.children?.[id] ??
          preview(spec.model, spec.inputs.map((i) => signal(state, i)));
      gates[c.id] = child;
      outputValues[c.id] = engineFor(spec.model).outputs(child);
      values[c.id] = outputValues[c.id][0];
      inputs[c.id] = spec.inputs.map((n) => signal(state, n));
    } else {
      const id = currentProjection.outputs[Number(c.id.slice(4))];
      values[c.id] = signal(state, id);
      inputs[c.id] = [values[c.id]];
      outputValues[c.id] = [];
    }
  }
  return {
    circuit,
    simulation: {
      values,
      inputs,
      outputValues,
      memory: { q: {}, clock: {}, gates },
      warnings: [],
    },
  };
}
export function inspectHardware(
  component: Component,
  parent: Circuit,
  simulation: Simulation,
) {
  const def = parent.definitions?.find((d) => d.id === component.definition),
    projection = def ? projections.get(def) : undefined;
  if (projection) {
    const state = simulation.memory.gates?.[component.id];
    if (state) return view(projection, state);
  }
  if (!gateComputationalKinds.includes(component.kind)) return null;
  const model = gateDevice(component)!;
  const state = simulation.memory.gates?.[component.id] ??
    preview(
      model,
      model.inputs.map((_, i) => simulation.inputs[component.id]?.[i] ?? 0),
    );
  return view({
    model,
    scope: model.nodes.map((_, i) => i),
    outputs: model.outputs,
    label: component.label,
  }, state);
}
