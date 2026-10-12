import { type Circuit, type Memory, type Signal, simulate } from "./index.ts";
import type { KeyboardState } from "./peripherals.ts";
import { gateDevice } from "./gate-devices.ts";
import { compileCircuit } from "./gate-circuit.ts";
import { engineFor } from "./gate-netlist.ts";
export function stepGateInstruction(
  circuit: Circuit,
  memory: Memory,
  keyboards: Record<string, KeyboardState> = {},
) {
  const cpu = circuit.components.find((c) => c.kind === "BUS_CPU");
  if (!cpu) throw Error("Connect a CPU circuit first.");
  const clock = circuit.wires.find((w) => w.to === cpu.id && w.port === 18)
    ?.from;
  const source = circuit.components.find((c) =>
    c.id === clock && ["CLOCK", "INPUT", "POWER"].includes(c.kind)
  );
  if (!source) throw Error("Connect a clock source to CPU Clock.");
  const start = memory.processors?.[cpu.id]?.cycles ?? 0;
  let state = simulate(circuit, memory, {}, keyboards);
  if (state.memory.processors?.[cpu.id]?.halted) return state;
  for (let cycle = 0; cycle < 16; cycle++) {
    state = simulate(circuit, state.memory, { [source.id]: 0 }, keyboards);
    state = simulate(circuit, state.memory, { [source.id]: 1 }, keyboards);
    const next = state.memory.processors?.[cpu.id];
    if (next?.halted || (next?.cycles ?? 0) > start) return state;
  }
  throw Error(
    "The CPU did not retire an instruction. Check its clock and gate connections.",
  );
}
export function programGateMemory(
  circuit: Circuit,
  memory: Memory,
  id: string,
  address: number,
  bytes: number[],
): Memory {
  const c = circuit.components.find((c) => c.id === id);
  if (!c || !["RAM", "BUS_RAM"].includes(c.kind)) {
    throw Error("Choose a RAM component.");
  }
  if (
    !Number.isInteger(address) || address < 0 ||
    address + bytes.length > (c.kind === "RAM" ? 256 : 0xf000) ||
    c.kind === "BUS_RAM" && address < 0x2000 ||
    bytes.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
  ) throw Error("Invalid memory programmer address or bytes.");
  const model = gateDevice(c)!,
    engine = engineFor(model),
    compiled = compileCircuit(circuit),
    binding = compiled?.bindings.find((b) => b.component.id === id);
  let state = memory.gates?.[id];
  for (const [i, byte] of bytes.entries()) {
    const width = c.kind === "RAM" ? 8 : 16;
    const pins: Signal[] = Array.from(
      { length: width },
      (_, bit) => ((address + i) >> bit & 1) as Signal,
    ).concat(
      Array.from({ length: 8 }, (_, bit) => (byte >> bit & 1) as Signal),
      c.kind === "RAM" ? [1, 0] as Signal[] : [0] as Signal[],
    );
    const clock = c.kind === "RAM" ? 17 : 24;
    state = engine.evaluate(pins, state);
    pins[clock] = 1;
    state = engine.evaluate(pins, state);
    pins[clock] = 0;
    state = engine.evaluate(pins, state);
  }
  if (!state) return memory;
  const gates = { ...memory.gates, [id]: state };
  if (binding?.instance !== undefined && gates.$circuit) {
    gates.$circuit = {
      ...gates.$circuit,
      children: { ...gates.$circuit.children, [binding.instance]: state },
    };
  }
  return { ...memory, gates };
}
