import assert from "node:assert/strict";
import {
  type Circuit,
  createDefinition,
  kinds,
  parseCircuit,
  simulate,
  transistorCircuit,
} from "@literal/core";
import {
  courses,
  courseState,
  firstGate,
  lessonChecks,
  savedTruth,
  truthGate,
} from "../apps/web/src/discover.ts";
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

function switchGate(kind: "NOT" | "NAND") {
  const source = transistorCircuit(kind)!;
  return {
    ...source,
    components: source.components.filter((c) => c.kind !== "OUTPUT").map((c) =>
      c.kind === "INPUT" ? { ...c, kind: "POWER" as const } : c
    ),
    wires: source.wires.filter((w) =>
      source.components.find((c) => c.id === w.to)?.kind !== "OUTPUT"
    ),
  };
}
function learned(kind: "NOT" | "NAND") {
  const circuit = switchGate(kind),
    pattern = kind === "NOT" ? [1, 0] : [1, 1, 1, 0];
  const gate = truthGate(circuit, pattern)!;
  return createDefinition(circuit, new Set(gate.members.map((c) => c.id)), {
    id: `learned-${kind}`,
    name: kind,
    color: "#527d3c",
    shape: "rounded",
  });
}
Deno.test("NAND course checks all input combinations and saves only the gate network", () => {
  const circuit = switchGate("NAND"),
    course = courses[1],
    tested = new Set<string>();
  const gate = truthGate(circuit, course.pattern)!;
  assert.ok(gate);
  assert.equal(gate.inputs.length, 2);
  for (let row = 0; row < 4; row++) {
    gate.inputs.forEach((input, i) =>
      input.value = (row >> (1 - i) & 1) as 0 | 1
    );
    const state = courseState(
      course,
      circuit,
      simulate(circuit),
      tested,
      [],
      new Set(),
    );
    assert.equal(state.checks[4], row === 3);
  }
  const def = createDefinition(
    circuit,
    new Set(gate.members.map((c) => c.id)),
    { id: "NAND", name: "My gate", color: "#527d3c", shape: "rounded" },
  );
  assert.equal(def.components.filter((c) => c.kind === "INPUT").length, 2);
  assert.equal(def.components.filter((c) => c.kind === "OUTPUT").length, 1);
  assert.equal(
    courseState(
      course,
      circuit,
      simulate(circuit),
      tested,
      [def],
      new Set([def.id]),
    ).saved,
    true,
  );
  const broken = {
    ...circuit,
    wires: circuit.wires.filter((w) => w.to !== gate.output.id),
  };
  assert.equal(truthGate(broken, course.pattern), undefined);
});
Deno.test("AND and OR courses work through reusable transistor-built gates", () => {
  const not = learned("NOT"), nand = learned("NAND"), definitions = [not, nand];
  for (const course of courses.slice(2)) {
    const circuit: Circuit = {
      version: 1,
      name: course.name,
      definitions,
      components: [
        { id: "a", kind: "POWER", label: "A", x: 0, y: 0, value: 0 },
        { id: "b", kind: "POWER", label: "B", x: 0, y: 120, value: 0 },
        {
          id: "nand",
          kind: "CUSTOM",
          definition: nand.id,
          label: "NAND",
          x: 300,
          y: 0,
        },
        {
          id: "not-a",
          kind: "CUSTOM",
          definition: not.id,
          label: "NOT",
          x: 150,
          y: 0,
        },
      ],
      wires: course.id === "and"
        ? [
          { id: "a-nand", from: "a", to: "nand", port: 0 },
          { id: "b-nand", from: "b", to: "nand", port: 1 },
          { id: "invert", from: "nand", to: "not-a", port: 0 },
        ]
        : [
          { id: "a-not", from: "a", to: "not-a", port: 0 },
          { id: "b-not", from: "b", to: "not-b", port: 0 },
          { id: "a-nand", from: "not-a", to: "nand", port: 0 },
          { id: "b-nand", from: "not-b", to: "nand", port: 1 },
        ],
    };
    if (course.id === "or") {
      circuit.components.push({
        id: "not-b",
        kind: "CUSTOM",
        definition: not.id,
        label: "NOT",
        x: 150,
        y: 120,
      });
    }
    const gate = truthGate(circuit, course.pattern)!;
    assert.ok(gate, course.id);
    const tested = new Set<string>();
    for (let row = 0; row < 4; row++) {
      gate.inputs.forEach((c, i) => c.value = (row >> (1 - i) & 1) as 0 | 1);
      courseState(
        course,
        circuit,
        simulate(circuit),
        tested,
        definitions,
        new Set(),
      );
    }
    assert.equal(
      courseState(
        course,
        circuit,
        simulate(circuit),
        tested,
        definitions,
        new Set(),
      ).checks[2],
      true,
    );
  }
});
Deno.test("course completion uses saved behavior rather than names or current node IDs", () => {
  const not = learned("NOT");
  not.name = "A different name";
  assert.equal(savedTruth([not], new Set([not.id]), [1, 0]), true);
  assert.equal(savedTruth([not], new Set(), [1, 0]), false);
  assert.equal(savedTruth([not], new Set([not.id]), [1, 1, 1, 0]), false);
});

Deno.test("cached course networks return nodes from the current circuit", () => {
  const original = switchGate("NAND"), pattern = [1, 1, 1, 0];
  truthGate(original, pattern);
  const copy = structuredClone(original), gate = truthGate(copy, pattern)!;
  assert.equal(
    gate.inputs[0],
    copy.components.find((c) => c.id === gate.inputs[0].id),
  );
  gate.inputs[0].value = 1;
  assert.equal(
    original.components.find((c) => c.id === gate.inputs[0].id)!.value,
    0,
  );
});
