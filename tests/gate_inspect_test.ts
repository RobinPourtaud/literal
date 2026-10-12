import assert from "node:assert/strict";
import { type Circuit, type Kind, parseCircuit, simulate } from "@literal/core";
import {
  gateComputationalKinds,
  gateDevice,
} from "../packages/core/src/gate-devices.ts";
import { inspectHardware } from "../packages/core/src/gate-inspect.ts";
import { engineFor } from "../packages/core/src/gate-netlist.ts";
const parent = (kind: Kind): Circuit => ({
  version: 1,
  name: kind,
  components: [{ id: "device", kind, label: kind, x: 0, y: 0 }],
  wires: [],
});
Deno.test("every computational component has executable NAND internals and a portable inspection circuit", () => {
  for (const kind of gateComputationalKinds) {
    const c = parent(kind),
      model = gateDevice(c.components[0])!,
      state = engineFor(model).evaluate(model.inputs.map(() => 0));
    assert.ok(
      model.nodes.every((n) =>
        ["INPUT", "LOW", "HIGH", "NAND", "WIRE", "INSTANCE"].includes(n.op)
      ),
      kind,
    );
    const sim = {
      values: {},
      inputs: { device: model.inputs.map(() => 0 as const) },
      outputValues: {},
      memory: { q: {}, clock: {}, gates: { device: state } },
      warnings: [],
    };
    const inside = inspectHardware(c.components[0], c, sim)!;
    assert.ok(inside.circuit.components.length > 0, kind);
    assert.ok(inside.circuit.definitions!.length > 0, kind);
    try {
      parseCircuit(JSON.stringify(inside.circuit));
    } catch (e) {
      throw Error(`${kind}: ${(e as Error).message}`);
    }
  }
});
Deno.test("register internals descend through bit cells and actual feedback gates", () => {
  const c = parent("REGISTER8"),
    model = gateDevice(c.components[0])!,
    state = engineFor(model).evaluate(model.inputs.map(() => 0));
  const sim = {
    values: {},
    inputs: { device: model.inputs.map(() => 0 as const) },
    outputValues: {},
    memory: { q: {}, clock: {}, gates: { device: state } },
    warnings: [],
  };
  let current = inspectHardware(c.components[0], c, sim)!;
  for (let depth = 0; depth < 3; depth++) {
    const child = current.circuit.components.find((n) => n.kind === "CUSTOM");
    assert.ok(child, `Depth ${depth}`);
    current = inspectHardware(child, current.circuit, current.simulation)!;
    assert.ok(current);
  }
  assert.ok(current.circuit.components.some((n) => n.kind === "NAND"));
});
Deno.test("exported gate circuits preserve register, counter, RAM and ROM behavior", () => {
  for (
    const kind of [
      "DFF",
      "REGISTER8",
      "COUNTER8",
      "RAM",
      "ROM",
      "HEX_DISPLAY",
    ] as const
  ) {
    const parentCircuit = parent(kind);
    parentCircuit.components[0].contents = [0xa5, 0x3c];
    const model = gateDevice(parentCircuit.components[0])!,
      engine = engineFor(model);
    let original = engine.evaluate(model.inputs.map(() => 0));
    const native = {
      values: {},
      inputs: {},
      outputValues: {},
      memory: { q: {}, clock: {}, gates: { device: original } },
      warnings: [],
    };
    const copy = parseCircuit(
      JSON.stringify(
        inspectHardware(parentCircuit.components[0], parentCircuit, native)!
          .circuit,
      ),
    );
    const inputs = copy.components.filter((c) => c.kind === "INPUT");
    const outputs = copy.components.filter((c) => c.kind === "OUTPUT");
    let projected = simulate(copy);
    const sample = (pins: (0 | 1)[]) => {
      original = engine.evaluate(pins, original);
      projected = simulate(
        copy,
        projected.memory,
        Object.fromEntries(inputs.map((c, i) => [c.id, pins[i]])),
      );
      assert.deepEqual(
        outputs.map((c) => projected.values[c.id]),
        engine.outputs(original),
        `${kind}: ${pins}`,
      );
    };
    for (const word of [0xa5, 0x3c, 0xff, 0]) {
      const pins = model.inputs.map((_, i) => ((word >> i % 8) & 1) as 0 | 1);
      if (kind === "REGISTER8") {
        pins[9] = 1;
        pins[10] = 0;
      }
      if (kind === "COUNTER8") {
        pins[1] = 1;
        pins[2] = 0;
      }
      if (kind === "RAM") pins[16] = 1;
      for (const clock of model.clockInputs) pins[clock] = 0;
      sample(pins);
      for (const clock of model.clockInputs) pins[clock] = 1;
      sample(pins);
      for (const clock of model.clockInputs) pins[clock] = 0;
      sample(pins);
    }
  }
});
Deno.test("exported CPU internals execute the same fetch and control gates", () => {
  const c = parent("BUS_CPU"),
    model = gateDevice(c.components[0])!,
    engine = engineFor(model);
  const pins = model.inputs.map(() => 0 as 0 | 1);
  let original = engine.evaluate(pins);
  const native = {
    values: {},
    inputs: {},
    outputValues: {},
    memory: { q: {}, clock: {}, gates: { device: original } },
    warnings: [],
  };
  const copy = parseCircuit(
    JSON.stringify(inspectHardware(c.components[0], c, native)!.circuit),
  );
  const inputs = copy.components.filter((c) => c.kind === "INPUT"),
    outputs = copy.components.filter((c) => c.kind === "OUTPUT");
  let projected = simulate(copy);
  for (let cycle = 0; cycle < 24; cycle++) {
    for (const level of [0, 1] as const) {
      pins[18] = level;
      original = engine.evaluate(pins, original);
      projected = simulate(
        copy,
        projected.memory,
        Object.fromEntries(inputs.map((c, i) => [c.id, pins[i]])),
      );
      assert.deepEqual(projected.warnings, []);
      assert.deepEqual(
        outputs.map((c) => projected.values[c.id]),
        engine.outputs(original),
        `cycle ${cycle}, clock ${level}`,
      );
    }
  }
});
Deno.test("nested saved storage inspection preserves live captured bits", async () => {
  const { createDefinition, inspectCustomCircuit } = await import(
    "@literal/core"
  );
  const inner: Circuit = {
    version: 1,
    name: "Bit",
    components: [
      { id: "d", kind: "INPUT", label: "Data", x: 0, y: 0, value: 1 },
      { id: "clk", kind: "INPUT", label: "Clock", x: 0, y: 90, value: 0 },
      { id: "ff", kind: "DFF", label: "Storage", x: 200, y: 0 },
      { id: "out", kind: "OUTPUT", label: "Q", x: 400, y: 0 },
    ],
    wires: [{ id: "wire-d", from: "d", to: "ff", port: 0 }, {
      id: "wire-clk",
      from: "clk",
      to: "ff",
      port: 1,
    }, { id: "q", from: "ff", to: "out", port: 0 }],
  };
  const def = createDefinition(inner, new Set(["ff"]), {
    id: "bit",
    name: "Bit",
    color: "#527d3c",
    shape: "rounded",
  });
  const outer: Circuit = {
    ...inner,
    definitions: [def],
    components: inner.components.map((c) =>
      c.id === "ff" ? { ...c, kind: "CUSTOM", definition: def.id } : c
    ),
  };
  let s = simulate(outer);
  s = simulate(outer, s.memory, { clk: 1 });
  assert.equal(s.values.out, 1);
  s = simulate(outer, s.memory, { clk: 0, d: 0 });
  const inside = inspectCustomCircuit(outer.components[2], outer, s)!;
  const ff = inside.circuit.components.find((c) => c.kind === "DFF")!;
  assert.equal(inside.simulation.values[ff.id], 1);
  const lower = inspectHardware(ff, inside.circuit, inside.simulation)!;
  assert.equal(lower.simulation.values["out-0"], 1);
  assert.equal(s.values.out, 1);
});
Deno.test("editing nested gate wiring invalidates compiled custom circuits", async () => {
  const { createDefinition } = await import("@literal/core");
  const source: Circuit = {
    version: 1,
    name: "Invert",
    components: [
      { id: "input", kind: "INPUT", label: "A", x: 0, y: 0, value: 1 },
      { id: "not", kind: "NOT", label: "Invert", x: 200, y: 0 },
      { id: "out", kind: "OUTPUT", label: "Y", x: 400, y: 0 },
    ],
    wires: [{ id: "in-wire", from: "input", to: "not", port: 0 }, {
      id: "out-wire",
      from: "not",
      to: "out",
      port: 0,
    }],
  };
  const def = createDefinition(source, new Set(["not"]), {
    id: "invert",
    name: "Invert",
    color: "#527d3c",
    shape: "rounded",
  });
  const c: Circuit = {
    ...source,
    definitions: [def],
    components: source.components.map((n) =>
      n.id === "not" ? { ...n, kind: "CUSTOM", definition: def.id } : n
    ),
  };
  assert.equal(simulate(c).values.out, 0);
  const output = def.components.find((n) => n.kind === "OUTPUT")!;
  def.wires.find((w) => w.to === output.id)!.from =
    def.components.find((n) => n.kind === "INPUT")!.id;
  assert.equal(simulate(c).values.out, 1);
});
