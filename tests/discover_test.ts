import assert from "node:assert/strict";
import {
  type Circuit,
  createDefinition,
  kinds,
  parseCircuit,
  simulate,
} from "@literal/core";
import { firstGate, lessonChecks } from "../apps/web/src/discover.ts";
import { descriptions, explanations } from "../apps/web/src/component-info.ts";
const inverter = (): Circuit => ({
  version: 1,
  name: "First NOT",
  components: [
    { id: "a", kind: "POWER", label: "A", x: 0, y: 0, value: 0 },
    { id: "vdd", kind: "POWER", label: "VDD", x: 0, y: 120 },
    { id: "gnd", kind: "GROUND", label: "Ground", x: 0, y: 240 },
    { id: "p", kind: "PMOS", label: "PMOS", x: 200, y: 0 },
    { id: "n", kind: "NMOS", label: "NMOS", x: 200, y: 240 },
    { id: "out", kind: "JUNCTION", label: "Output", x: 400, y: 120 },
  ],
  wires: [
    { id: "ap", from: "a", to: "p", port: 0 },
    { id: "an", from: "a", to: "n", port: 0 },
    { id: "vp", from: "vdd", to: "p", port: 1 },
    { id: "gn", from: "gnd", to: "n", port: 1 },
    { id: "po", from: "p", to: "out", port: 0 },
    { id: "no", from: "n", to: "out", port: 1 },
  ],
});
Deno.test("Discover requires working wiring, both input cases, and the saved gate", () => {
  const circuit = inverter(), tested = new Set<string>();
  const check = () =>
    lessonChecks(circuit, simulate(circuit), tested, [], new Set());
  assert.deepEqual(check(), [true, true, true, true, false, false]);
  circuit.components[0].value = 1;
  assert.deepEqual(check(), [true, true, true, true, true, false]);
  const gate = firstGate(circuit)!;
  const definition = createDefinition(
    circuit,
    new Set(gate.members.map((c) => c.id)),
    {
      id: "not",
      name: "NOT",
      description: "Inverts a bit.",
      color: "#527d3c",
      shape: "rounded",
    },
  );
  assert.deepEqual(
    lessonChecks(
      circuit,
      simulate(circuit),
      tested,
      [definition],
      new Set(["not"]),
    ),
    Array(6).fill(true),
  );
  assert.equal(definition.description, "Inverts a bit.");
  const custom: Circuit = {
    version: 1,
    name: "Saved NOT",
    definitions: [definition],
    components: [{ id: "input", kind: "INPUT", label: "A", x: 0, y: 0 }, {
      id: "not-cell",
      kind: "CUSTOM",
      definition: "not",
      label: "NOT",
      x: 200,
      y: 0,
    }],
    wires: [{ id: "w", from: "input", to: "not-cell", port: 0 }],
  };
  assert.equal(simulate(custom, undefined, { input: 0 }).values["not-cell"], 1);
  assert.equal(simulate(custom, undefined, { input: 1 }).values["not-cell"], 0);
  circuit.wires.pop();
  assert.equal(check()[3], false);
  assert.equal(check()[4], false);
  circuit.wires.push({ id: "wrong", from: "vdd", to: "out", port: 1 });
  assert.equal(firstGate(circuit), undefined);
});
Deno.test("Component descriptions cover every kind and custom descriptions validate", () => {
  for (const kind of kinds) {
    assert.ok(descriptions[kind].length > 10);
    assert.ok(explanations[kind].length > 30);
  }
  const document = inverter();
  const definition = createDefinition(
    document,
    new Set(document.components.map((c) => c.id)),
    {
      id: "test",
      name: "Test",
      description: "Description",
      color: "#527d3c",
      shape: "rounded",
    },
  );
  document.definitions = [definition];
  assert.equal(
    parseCircuit(JSON.stringify(document)).definitions![0].description,
    "Description",
  );
  definition.description = "x".repeat(601);
  assert.throws(() => parseCircuit(JSON.stringify(document)), /definition/);
});
