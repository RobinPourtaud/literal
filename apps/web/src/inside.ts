import {
  type Circuit,
  type Component,
  definitionOf,
  inspectCustomCircuit,
  inspectHardware,
  simulate,
  type Simulation,
  transistorCircuit,
} from "@literal/core";
import { dimensions } from "./drawing.ts";
export function inspectCircuit(
  node: Component,
  parent: Circuit,
  state: Simulation,
) {
  const hardware = inspectHardware(node, parent, state);
  if (hardware) return hardware;
  const custom = inspectCustomCircuit(node, parent, state);
  if (custom) return custom;
  const definition = definitionOf(node, parent);
  const circuit = definition
    ? {
      version: 1 as const,
      name: definition.name,
      components: structuredClone(definition.components),
      wires: structuredClone(definition.wires),
      definitions: parent.definitions,
    }
    : transistorCircuit(node.kind);
  if (!circuit) return null;
  const inputs = circuit.components.filter((n) => n.kind === "INPUT");
  const overrides = Object.fromEntries(
    inputs.map((n, i) => [n.id, state.inputs[node.id]?.[i] ?? "X"]),
  );
  inputs.forEach((n) => n.value = overrides[n.id] === 1 ? 1 : 0);
  return {
    circuit,
    simulation: simulate(circuit, state.memory.nested?.[node.id], overrides),
  };
}
export function insideBounds(circuit: Circuit) {
  if (!circuit.components.length) {
    return { x: 0, y: 0, width: 320, height: 240 };
  }
  const boxes = circuit.components.map((c) => ({
    c,
    size: dimensions(c, circuit),
  }));
  const x = Math.min(...boxes.map(({ c, size }) => c.x - size.width / 2)) - 100;
  const y = Math.min(...boxes.map(({ c, size }) => c.y - size.height / 2)) -
    100;
  return {
    x,
    y,
    width: Math.max(...boxes.map(({ c, size }) => c.x + size.width / 2)) - x +
      100,
    height: Math.max(...boxes.map(({ c, size }) => c.y + size.height / 2)) - y +
      100,
  };
}
