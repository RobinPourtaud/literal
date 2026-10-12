import { type Circuit, simulate, type Simulation } from "./index.ts";
import { stepGateInstruction } from "./gate-control.ts";
import { computerCircuit, type ProcessorState } from "./wired-computer.ts";
import type { KeyboardState } from "./peripherals.ts";
export class GateComputer {
  readonly circuit: Circuit;
  simulation: Simulation;
  keyboard: KeyboardState = { code: 0, pressed: false };
  constructor(source: string | Circuit) {
    this.circuit = typeof source === "string"
      ? computerCircuit(source)
      : source;
    this.simulation = simulate(this.circuit);
  }
  get processor(): ProcessorState {
    const id = this.circuit.components.find((c) => c.kind === "BUS_CPU")?.id;
    const cpu = id && this.simulation.memory.processors?.[id];
    if (!cpu) throw Error("Connect a CPU circuit first.");
    return cpu;
  }
  step(instructions = 1): Simulation {
    if (
      !Number.isInteger(instructions) || instructions < 1 ||
      instructions > 100_000
    ) {
      throw Error("Instruction count must be between 1 and 100000.");
    }
    const keyboard = this.circuit.components.find((c) =>
      c.kind === "BUS_KEYBOARD"
    );
    const keys = keyboard ? { [keyboard.id]: this.keyboard } : {};
    for (let i = 0; i < instructions && !this.processor.halted; i++) {
      this.simulation = stepGateInstruction(
        this.circuit,
        this.simulation.memory,
        keys,
      );
      const cpu = this.circuit.components.find((c) => c.kind === "BUS_CPU")!;
      const wire = this.circuit.wires.find((w) =>
        w.to === cpu.id && w.port === 18
      );
      const clock = this.circuit.components.find((c) => c.id === wire?.from);
      if (clock) clock.value = 1;
    }
    return this.simulation;
  }
  reset(): Simulation {
    for (const c of this.circuit.components) {
      if (c.kind === "CLOCK") c.value = 0;
    }
    this.simulation = simulate(this.circuit);
    return this.simulation;
  }
}
