import {
  type Circuit,
  type Component,
  type Definition,
  simulate,
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
  const saved = savedTruth(library, discovered, [1, 0]);
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

type Lesson = { title: string; text: string; hint: string };
export type Course = {
  id: string;
  name: string;
  pattern: number[];
  steps: readonly Lesson[];
};
export const courses: Course[] = [
  { id: "not", name: "First gate · NOT", pattern: [1, 0], steps: lessons },
  {
    id: "nand",
    name: "Two inputs · NAND",
    pattern: [1, 1, 1, 0],
    steps: [
      {
        title: "Build a gate with two inputs",
        text:
          "NAND gives 0 only when A and B are both 1. Start with three Power blocks and one Ground. Name two Power blocks A and B; keep the third at 1 as VDD.",
        hint:
          "Keep your saved NOT gate in the library. This course has its own canvas, so your first circuit is kept. A and B are independent inputs; VDD is the fixed supply.",
      },
      {
        title: "Add four transistor switches",
        text:
          "Place two PMOS and two NMOS transistors. One of each type will respond to A, and the other pair will respond to B.",
        hint:
          "We need two ways to reach VDD and a path through two switches to reach Ground. Select each transistor and use Info to review its pins.",
      },
      {
        title: "Connect A and B to the Gate pins",
        text:
          "Connect A to one PMOS Gate and one NMOS Gate. Connect B to the other PMOS Gate and the other NMOS Gate.",
        hint:
          "Give the pairs names such as P-A, N-A, P-B, and N-B. Each input controls one switch of each type. The Source connections come next.",
      },
      {
        title: "Build the two output paths",
        text:
          "Connect both PMOS Sources to VDD and join their Drains with a Junction. For the NMOS path, connect Ground → N-A Source, N-A Drain → N-B Source. Join N-B Drain with the PMOS Junction using a second Junction.",
        hint:
          "The PMOS switches are in parallel: either can supply 1. The NMOS switches are in series: both must be on to supply 0. The last Junction is the output. If wiring is correct, only A = 1 and B = 1 produce 0.",
      },
      {
        title: "Test all four combinations",
        text:
          "Try A/B = 00, 01, 10, and 11. The outputs should be 1, 1, 1, and 0. Check the live values below as you toggle A and B.",
        hint:
          "With either input at 0, a PMOS is on and at least one NMOS is off. With both inputs at 1, both PMOS switches are off and both NMOS switches are on.",
      },
      {
        title: "Save your NAND gate",
        text:
          "Save the supply, Ground, transistors, and Junctions as NAND. Keep A and B outside the selection so they become input pins.",
        hint:
          "Save gate selects the parts that produce the output for you. After saving, Next course will show how to reuse NAND and NOT to make AND.",
      },
    ],
  },
  {
    id: "and",
    name: "Reuse your gates · AND",
    pattern: [0, 0, 0, 1],
    steps: [
      {
        title: "Use your saved gates",
        text:
          "Place two Power blocks as A and B, one saved NAND, and one saved NOT. AND should give 1 only when both inputs are 1.",
        hint:
          "Use the custom component library on the left. You do not need to draw the transistors again: NAND and NOT contain the circuits you saved.",
      },
      {
        title: "Reverse the NAND result",
        text:
          "Connect A and B to the NAND inputs. Connect the NAND output to the NOT input. The NOT output is your AND result.",
        hint:
          "NAND already gives the opposite of AND. Putting NOT after NAND reverses it once more.",
      },
      {
        title: "Check every input pair",
        text: "Test 00, 01, 10, and 11. AND should produce 0, 0, 0, and 1.",
        hint:
          "The live output should be 1 only for A = 1 and B = 1. Toggle the two inputs independently to visit all four cases.",
      },
      {
        title: "Save AND as a component",
        text:
          "Save the connected NAND and NOT together as AND. Keep A and B outside the selection.",
        hint:
          "This component contains other components. See inside can follow AND → NAND/NOT → transistors. Next course will use the same two gate types to build OR.",
      },
    ],
  },
  {
    id: "or",
    name: "Combine conditions · OR",
    pattern: [0, 1, 1, 1],
    steps: [
      {
        title: "Choose either input",
        text:
          "OR gives 1 when A or B is 1, including when both are 1. Place two Power inputs, two saved NOT gates, and one saved NAND.",
        hint:
          "We will reverse each input before sending it into NAND. The same gates can produce different functions depending on their connections.",
      },
      {
        title: "Invert both inputs",
        text:
          "Connect A to one NOT and B to the other. Connect the two NOT outputs to the NAND inputs. The NAND output is your OR result.",
        hint:
          "Only A = 0 and B = 0 become two 1s after the NOT gates. NAND then returns 0. Every other combination gives 1.",
      },
      {
        title: "Test either or both",
        text: "Try 00, 01, 10, and 11. The outputs should be 0, 1, 1, and 1.",
        hint:
          "OR means at least one input is 1. It also gives 1 when both inputs are 1.",
      },
      {
        title: "Save OR and keep building",
        text:
          "Save the two NOT gates and NAND as OR. You now have NOT, NAND, AND, and OR in your library.",
        hint:
          "Keep A and B outside the selection. Continue building opens a free canvas with your learned components. Courses lets you revisit any of these lessons.",
      },
    ],
  },
];
export type LearnGate = {
  inputs: Component[];
  output: Component;
  members: Component[];
  signature: string;
};
const truthCache = new Map<string, boolean>();
export function savedTruth(
  library: Definition[],
  discovered: Set<string>,
  pattern: number[],
) {
  const count = Math.log2(pattern.length);
  return library.some((def) => {
    if (!discovered.has(def.id)) return false;
    const inputs = def.components.filter((c) => c.kind === "INPUT"),
      outputs = def.components.filter((c) => c.kind === "OUTPUT");
    if (inputs.length !== count || outputs.length !== 1) return false;
    const key = JSON.stringify([
      def,
      library.filter((d) => d.id !== def.id),
      pattern,
    ]);
    if (truthCache.has(key)) return truthCache.get(key)!;
    const circuit: Circuit = {
      version: 1,
      name: def.name,
      components: def.components,
      wires: def.wires,
      definitions: library,
    };
    const correct = pattern.every((value, row) => {
      const state = simulate(
        circuit,
        undefined,
        Object.fromEntries(
          inputs.map((c, i) => [c.id, (row >> (count - i - 1) & 1) as 0 | 1]),
        ),
      );
      return !state.warnings.length && state.values[outputs[0].id] === value;
    });
    if (truthCache.size > 100) truthCache.clear();
    truthCache.set(key, correct);
    return correct;
  });
}
const networkCache = new Map<string, LearnGate | undefined>();
export function truthGate(
  circuit: Circuit,
  pattern: number[],
): LearnGate | undefined {
  const key = JSON.stringify([circuit, pattern]);
  const nodes = new Map(circuit.components.map((c) => [c.id, c]));
  if (networkCache.has(key)) {
    const cached = networkCache.get(key);
    return cached
      ? {
        ...cached,
        inputs: cached.inputs.map((c) => nodes.get(c.id)!),
        output: nodes.get(cached.output.id)!,
        members: cached.members.map((c) => nodes.get(c.id)!),
      }
      : undefined;
  }
  const edges = new Map<string, string[]>();
  for (const wire of circuit.wires) {
    edges.set(wire.to, [...(edges.get(wire.to) ?? []), wire.from]);
  }
  const count = Math.log2(pattern.length);
  let found: LearnGate | undefined;
  for (
    const output of circuit.components.filter((c) =>
      ["JUNCTION", "CUSTOM", "OUTPUT"].includes(c.kind) &&
      !circuit.wires.some((w) => w.from === c.id)
    )
  ) {
    const members = new Set<string>(), visiting = new Set<string>();
    let cyclic = false;
    const visit = (id: string) => {
      if (visiting.has(id)) {
        cyclic = true;
        return;
      }
      if (members.has(id)) return;
      visiting.add(id);
      for (const from of edges.get(id) ?? []) visit(from);
      visiting.delete(id);
      members.add(id);
    };
    visit(output.id);
    if (cyclic) continue;
    const powers = [...members].map((id) => nodes.get(id)!).filter((c) =>
      c.kind === "POWER"
    );
    const pairs = count === 1
      ? powers.map((c) => [c])
      : powers.flatMap((c, i) =>
        powers.slice(i + 1).map((other) => [c, other])
      );
    for (const inputs of pairs) {
      if (
        pattern.every((value, row) => {
          const state = simulate(
            circuit,
            undefined,
            Object.fromEntries(
              inputs.map((
                c,
                i,
              ) => [c.id, (row >> (count - i - 1) & 1) as 0 | 1]),
            ),
          );
          return !state.warnings.length && state.values[output.id] === value;
        })
      ) {
        const inside = [...members].map((id) => nodes.get(id)!).filter((c) =>
          !inputs.includes(c)
        );
        const signature = JSON.stringify([
          pattern,
          inputs.map((c) => c.id),
          inside.map((c) => [c.id, c.kind, c.definition]),
          circuit.wires.filter((w) => members.has(w.to)).map(
            (w) => [w.from, w.to, w.port, w.fromPort ?? 0],
          ),
        ]);
        found = { inputs, output, members: inside, signature };
        break;
      }
    }
    if (found) break;
  }
  if (networkCache.size > 30) networkCache.clear();
  networkCache.set(key, found);
  return found;
}
export function courseState(
  course: Course,
  circuit: Circuit,
  simulation: Simulation,
  tested: Set<string>,
  library: Definition[],
  discovered: Set<string>,
) {
  const saved = savedTruth(library, discovered, course.pattern);
  if (course.id === "not") {
    const first = firstGate(circuit);
    return {
      checks: lessonChecks(circuit, simulation, tested, library, discovered),
      saved,
      gate: first
        ? {
          inputs: [first.input],
          output: first.output,
          members: first.members,
          signature: "not",
        }
        : undefined,
    };
  }
  const gate = truthGate(circuit, course.pattern);
  if (gate) {
    const values = gate.inputs.map((c) => simulation.values[c.id]);
    if (values.every((v) => v === 0 || v === 1)) {
      const row = values.reduce<number>((n, v) => n * 2 + (v === 1 ? 1 : 0), 0);
      if (simulation.values[gate.output.id] === course.pattern[row]) {
        tested.add(`${gate.signature}:${row}`);
      }
    }
  }
  const testedAll = !!gate &&
    course.pattern.every((_, row) => tested.has(`${gate.signature}:${row}`));
  const controls = circuit.components.filter((c) => c.kind === "POWER");
  const source = (node: Component, port: number) =>
    circuit.components.find((c) =>
      c.id ===
        circuit.wires.find((w) => w.to === node.id && w.port === port)?.from
    );
  const gated = controls.filter((a) =>
    circuit.components.some((c) =>
      c.kind === "NMOS" && source(c, 0)?.id === a.id
    ) && circuit.components.some((c) =>
      c.kind === "PMOS" && source(c, 0)?.id === a.id
    )
  );
  const checks = course.id === "nand"
    ? [
      controls.length >= 3 &&
      circuit.components.some((c) => c.kind === "GROUND"),
      circuit.components.filter((c) => c.kind === "NMOS").length >= 2 &&
      circuit.components.filter((c) => c.kind === "PMOS").length >= 2,
      gated.length >= 2,
      !!gate,
      testedAll,
      saved,
    ]
    : [
      controls.length >= 2 &&
      circuit.components.filter((c) => c.kind === "CUSTOM").length >=
        (course.id === "and" ? 2 : 3),
      !!gate,
      testedAll,
      saved,
    ];
  return { checks, saved, gate };
}
