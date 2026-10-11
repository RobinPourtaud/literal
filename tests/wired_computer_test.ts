import assert from "node:assert/strict";
import {
  computerCircuit,
  gate,
  type Memory,
  parseCircuit,
  simulate,
  transistorCircuit,
  truthTable,
} from "@literal/core";

function runner(source: string) {
  const circuit = parseCircuit(JSON.stringify(computerCircuit(source)));
  let memory: Memory = { q: {}, clock: {} };
  const advance = (steps: number, keyboard = { code: 0, pressed: false }) => {
    for (let i = 0; i < steps; i++) {
      for (const value of [0, 1] as const) {
        circuit.components[0].value = value;
        memory = simulate(circuit, memory, {}, { keyboard }).memory;
      }
    }
    return memory;
  };
  return { circuit, advance };
}
Deno.test("wired CPU fetches ROM, stores RAM, uses the gate ALU and writes the connected screen", () => {
  const app = runner(
    "LDI R0, 42\nST R0, 0x2000\nLD R1, 0x2000\nADDI R1, 1\nST R1, 0xF000\nLD R2, 0xFF00\nHALT",
  );
  const state = app.advance(10, { code: 131, pressed: true });
  assert.equal(state.processors!.cpu.registers[1], 43);
  assert.equal(state.processors!.cpu.registers[2], 131);
  assert.equal(state.busRAM!.ram[0x2000], 42);
  assert.equal(state.screens!.screen[0], 3);
  assert.equal(state.processors!.cpu.error, "");
  assert.equal(state.processors!.cpu.halted, true);
});
Deno.test("removing a ROM wire faults the CPU instead of using hidden memory", () => {
  const app = runner("LDI R0, 42\nHALT");
  app.circuit.wires = app.circuit.wires.filter((w) =>
    !(w.from === "rom" && w.fromPort === undefined)
  );
  assert.match(app.advance(1).processors!.cpu.error, /data bus is floating/);
});
Deno.test("changing the ALU output wire changes the CPU result", () => {
  const app = runner("LDI R0, 1\nADDI R0, 2\nHALT");
  const wire = app.circuit.wires.find((w) => w.to === "cpu" && w.port === 8)!;
  wire.from = "reset";
  delete wire.fromPort;
  const state = app.advance(5);
  assert.equal(state.processors!.cpu.registers[0], 2);
  assert.equal(state.processors!.cpu.error, "");
});
Deno.test("screen wiring controls whether pixel writes reach the framebuffer", () => {
  const app = runner("LDI R0, 7\nST R0, 0xF000\nHALT");
  const wire = app.circuit.wires.find((w) =>
    w.to === "screen" && w.port === 24
  )!;
  wire.from = "reset";
  delete wire.fromPort;
  assert.equal(app.advance(4).screens!.screen[0], 0);
});
Deno.test("CMOS transistor networks implement every Boolean gate truth table", () => {
  for (
    const kind of [
      "AND",
      "OR",
      "NOT",
      "NAND",
      "NOR",
      "XOR",
      "XNOR",
      "BUFFER",
      "MUX",
    ] as const
  ) {
    const circuit = transistorCircuit(kind)!;
    assert.ok(
      circuit.components.every((n) =>
        ["INPUT", "OUTPUT", "POWER", "GROUND", "NMOS", "PMOS", "JUNCTION"]
          .includes(n.kind)
      ),
    );
    const table = truthTable(circuit);
    for (const row of table.rows) {
      assert.equal(
        row.outputs[0],
        gate(kind, row.inputs),
        `${kind} ${row.inputs}`,
      );
    }
  }
  assert.equal(gate("NMOS", [0, 1]), "Z");
  assert.equal(gate("PMOS", [1, 0]), "Z");
  assert.equal(gate("JUNCTION", ["Z", 1]), 1);
  assert.equal(gate("JUNCTION", [0, 1]), "X");
});

Deno.test("CMOS cross-coupled NOR latch holds state after set/reset release", () => {
  const halves = [transistorCircuit("NOR")!, transistorCircuit("NOR")!];
  const circuit = {
    version: 1 as const,
    name: "CMOS latch",
    components: [{
      id: "s",
      kind: "INPUT" as const,
      x: 0,
      y: 0,
      label: "Set",
      value: 0 as 0 | 1,
    }, {
      id: "r",
      kind: "INPUT" as const,
      x: 0,
      y: 100,
      label: "Reset",
      value: 0 as 0 | 1,
    }],
    wires: [] as import("@literal/core").Wire[],
  };
  const outputs = halves.map((half, i) =>
    `${i}-${half.components.find((n) => n.kind === "OUTPUT")!.id}`
  );
  halves.forEach((half, i) => {
    const inputs = half.components.filter((n) => n.kind === "INPUT");
    circuit.components.push(
      ...half.components.filter((n) => n.kind !== "INPUT").map((n) => ({
        ...n,
        id: `${i}-${n.id}`,
      })) as typeof circuit.components,
    );
    circuit.wires.push(
      ...half.wires.map((w) => ({
        ...w,
        id: `${i}-${w.id}`,
        to: `${i}-${w.to}`,
        from: w.from === inputs[0].id
          ? i === 0 ? "r" : "s"
          : w.from === inputs[1].id
          ? outputs[1 - i]
          : `${i}-${w.from}`,
      })),
    );
  });
  let memory: Memory = { q: {}, clock: {} };
  const apply = (set: 0 | 1, reset: 0 | 1) => {
    circuit.components[0].value = set;
    circuit.components[1].value = reset;
    const state = simulate(circuit, memory);
    memory = state.memory;
    assert.deepEqual(state.warnings, []);
    return outputs.map((id) => state.values[id]);
  };
  assert.deepEqual(apply(1, 0), [1, 0]);
  assert.deepEqual(apply(0, 0), [1, 0]);
  assert.deepEqual(apply(0, 1), [0, 1]);
  assert.deepEqual(apply(0, 0), [0, 1]);
  const nested: import("@literal/core").Circuit = {
    version: 1,
    name: "Reusable latch",
    definitions: [{
      id: "latch",
      name: "Latch",
      color: "#668855",
      shape: "rounded",
      components: circuit.components,
      wires: circuit.wires,
    }],
    components: [
      { id: "set", kind: "INPUT", label: "Set", x: 0, y: 0, value: 0 },
      { id: "reset", kind: "INPUT", label: "Reset", x: 0, y: 100, value: 0 },
      {
        id: "cell",
        kind: "CUSTOM",
        definition: "latch",
        label: "Cell",
        x: 200,
        y: 0,
      },
    ],
    wires: [{ id: "set-wire", from: "set", to: "cell", port: 0 }, {
      id: "reset-wire",
      from: "reset",
      to: "cell",
      port: 1,
    }],
  };
  let nestedMemory: Memory = { q: {}, clock: {} };
  for (
    const [set, reset, expected] of [[1, 0, [1, 0]], [0, 0, [1, 0]], [0, 1, [
      0,
      1,
    ]], [0, 0, [0, 1]]] as const
  ) {
    const state = simulate(nested, nestedMemory, { set, reset });
    nestedMemory = state.memory;
    assert.deepEqual(state.outputValues.cell, [...expected]);
  }
});
