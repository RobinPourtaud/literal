import {
  type Circuit,
  type Component,
  type Definition,
  type Simulation,
} from "@literal/core";

export const lessons = [
  {
    title: "First of all, let's create our first gate.",
    text:
      "We will build NOT: when input A is 0, the output is 1; when A is 1, the output is 0. Start with two Power components and one Ground.",
    hint:
      "Keep one Power block at 1: this is our supply, called VDD. Name the other Power block A and click it to choose 0 or 1. A will be the input we test. Ground gives us a constant 0.",
  },
  {
    title: "Add two transistors",
    text:
      "Place one PMOS and one NMOS. They will connect our output to the supply or to ground.",
    hint:
      "Think of each transistor as a switch. Gate is the pin that controls it. PMOS turns on for Gate 0; NMOS turns on for Gate 1. When off, the switch is disconnected, shown as Z. Select a transistor and click Info to learn what its pins do.",
  },
  {
    title: "Connect the input and supplies",
    text:
      "Connect A to both Gate pins. Connect VDD to the PMOS Source, and Ground to the NMOS Source.",
    hint:
      "Click a source's output pin, then a transistor's input pin. Gate is the upper input; Source is the lower input. Connect the same A output to both Gate pins. Keep VDD at 1.",
  },
  {
    title: "Join the two drains",
    text:
      "Add a Junction. Connect the PMOS Drain to one input and the NMOS Drain to the other. The Junction output is our NOT result.",
    hint:
      "The junction joins the two transistor outputs. One switch is on and supplies 0 or 1; the other is off and supplies nothing (Z). The junction keeps the value from the switch that is on. If two paths try to supply opposite values, the result is X: a conflict.",
  },
  {
    title: "Test both input values",
    text:
      "Click A to toggle it. Check the Junction output for A = 0 and A = 1. Both cases must invert the input.",
    hint:
      "A = 0: PMOS connects VDD to the output, giving 1. A = 1: NMOS connects Ground to the output, giving 0. Click or select the Junction to see its signal.",
  },
  {
    title: "Save your NOT gate",
    text:
      "Save the supply, ground, transistors, and junction as a reusable component. Keep A outside the selection so it becomes an input pin.",
    hint:
      "Use Select gate below, then save it as NOT. The disconnected external input becomes a pin automatically. Your new gate appears in the Discover library. You can place it and use See inside to inspect it.",
  },
] as const;
export type FirstGate = {
  input: Component;
  output: Component;
  members: Component[];
};
export function firstGate(circuit: Circuit): FirstGate | undefined {
  const source = (node: Component, port: number) =>
    circuit.components.find((c) =>
      c.id ===
        circuit.wires.find((w) =>
          w.to === node.id && w.port === port && (w.fromPort ?? 0) === 0
        )?.from
    );
  for (
    const output of circuit.components.filter((c) => c.kind === "JUNCTION")
  ) {
    const branches = [source(output, 0), source(output, 1)];
    const p = branches.find((c) => c?.kind === "PMOS"),
      n = branches.find((c) => c?.kind === "NMOS");
    if (!p || !n) continue;
    const input = source(p, 0),
      other = source(n, 0),
      supply = source(p, 1),
      ground = source(n, 1);
    if (
      input?.kind === "POWER" && other?.id === input.id &&
      supply?.kind === "POWER" && supply.id !== input.id &&
      (supply.value ?? 1) === 1 && ground?.kind === "GROUND"
    ) {
      return { input, output, members: [supply, ground, p, n, output] };
    }
  }
}
export function lessonChecks(
  circuit: Circuit,
  simulation: Simulation,
  tested: Set<string>,
  library: Definition[],
  discovered: Set<string>,
) {
  const powers = circuit.components.filter((c) => c.kind === "POWER"),
    ground = circuit.components.find((c) => c.kind === "GROUND");
  const source = (node: Component, port: number) =>
    circuit.components.find((c) =>
      c.id ===
        circuit.wires.find((w) => w.to === node.id && w.port === port)?.from
    );
  const connected = circuit.components.some((p) => {
    if (p.kind !== "PMOS") return false;
    const a = source(p, 0), supply = source(p, 1);
    return a?.kind === "POWER" && supply?.kind === "POWER" &&
      supply.id !== a.id && (supply.value ?? 1) === 1 &&
      circuit.components.some((n) =>
        n.kind === "NMOS" && source(n, 0)?.id === a.id &&
        source(n, 1)?.kind === "GROUND"
      );
  });
  const gate = firstGate(circuit);
  const signature = gate
    ? [gate.input.id, ...gate.members.map((c) => c.id)].join(":")
    : "";
  if (gate) {
    const input = simulation.values[gate.input.id],
      output = simulation.values[gate.output.id];
    if ((input === 0 || input === 1) && output === 1 - input) {
      tested.add(`${signature}:${input}`);
    }
  }
  const saved = library.some((d) =>
    discovered.has(d.id) && gate?.members.every((member) =>
      d.components.some((node) =>
        node.id === member.id
      )
    ) && d.components.some((c) => c.kind === "PMOS") &&
    d.components.some((c) => c.kind === "NMOS") &&
    d.components.some((c) => c.kind === "JUNCTION") &&
    d.components.filter((c) => c.kind === "INPUT").length === 1 &&
    d.components.filter((c) => c.kind === "OUTPUT").length === 1
  );
  return [
    powers.length >= 2 && !!ground,
    circuit.components.some((c) => c.kind === "PMOS") &&
    circuit.components.some((c) => c.kind === "NMOS"),
    connected,
    !!gate,
    !!gate && tested.has(`${signature}:0`) && tested.has(`${signature}:1`),
    saved,
  ];
}
