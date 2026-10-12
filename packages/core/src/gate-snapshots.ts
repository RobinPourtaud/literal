import { engineFor, type GateModel, type GateState } from "./gate-netlist.ts";
import type { ProcessorState } from "./wired-computer.ts";
import type { Signal } from "./index.ts";
export const gateNumber = (bits: Signal[]): number | null =>
  bits.some((b) => b !== 0 && b !== 1)
    ? null
    : bits.reduce<number>((n, b, i) => n + Number(b) * 2 ** i, 0);
export function storedWords(
  model: GateModel,
  state: GateState,
): Map<number, Signal[]> {
  const words = new Map<number, Signal[]>();
  const visit = (model: GateModel, state: GateState, offset: number) => {
    if (model.storageShape?.addressBits === 0) {
      words.set(offset, engineFor(model).outputs(state));
      return;
    }
    for (const [index, child] of Object.entries(state.children ?? {})) {
      const spec = model.instances![Number(index)];
      visit(spec.model, child, offset + (spec.offset ?? 0));
    }
  };
  visit(model, state, 0);
  return words;
}
export function processorSnapshot(
  model: GateModel,
  state: GateState,
): ProcessorState {
  const e = engineFor(model),
    n = (name: string) => gateNumber(e.probe(state, name));
  const fault = n("Fault") ?? 0,
    unknown = [
      "PC",
      "SP",
      "IR",
      "Phase",
      ...Array.from({ length: 8 }, (_, i) => `R${i}`),
    ].find((name) => n(name) === null);
  const errors = [
    "",
    `Unknown opcode ${(n("IR") ?? 0).toString(16)}.`,
    "Invalid register.",
    "Execution left ROM.",
    "Stack overflow.",
    "Stack underflow.",
  ];
  const flags = e.probe(state, "Flags");
  return {
    registers: Array.from({ length: 8 }, (_, i) => n(`R${i}`) ?? 0),
    pc: n("PC") ?? 0,
    phase: n("Phase") ?? 0,
    sp: n("SP") ?? 0,
    carry: flags[0] === 1,
    zero: flags[1] === 1,
    halted: n("Halted") === 1 || !!unknown,
    error: unknown
      ? `CPU ${unknown} has floating or conflicting gate signals.`
      : errors[fault] ?? "Hardware fault.",
    cycles: n("Retired") ?? 0,
    signals: e.outputs(state),
  };
}
