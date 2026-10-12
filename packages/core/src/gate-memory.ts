import { GateBuilder, type GateModel } from "./gate-netlist.ts";
const banks = new Map<string, GateModel>();
export function gateMemory(addressBits: number, width = 8): GateModel {
  const key = `${addressBits}:${width}`;
  if (banks.has(key)) return banks.get(key)!;
  const b = new GateBuilder(
    addressBits
      ? `RAM · ${2 ** addressBits} words × ${width} bits`
      : `${width}-bit storage cell`,
  );
  const address = b.bus("A", addressBits),
    data = b.bus("D", width),
    clock = b.input("Write clock", true),
    reset = b.input("Clear");
  b.model.storageShape = { addressBits, width };
  b.model.resetInputs = [addressBits + width + 1];
  b.model.coldOutputs = Array(width).fill(0);
  if (!addressBits) b.output(b.register(data, clock, b.high, reset), "Q");
  else {
    const select = address.at(-1)!;
    const leftEnable = b.latch(
      b.not(select),
      b.not(clock),
      reset,
      0,
      "Left clock enable",
    );
    const rightEnable = b.latch(
      select,
      b.not(clock),
      reset,
      0,
      "Right clock enable",
    );
    const leftClock = b.and(clock, leftEnable),
      rightClock = b.and(clock, rightEnable);
    const child = gateMemory(addressBits - 1, width);
    const left = b.instance(
      child,
      address.slice(0, -1).concat(data, [leftClock, reset]),
      "Lower addresses",
    );
    const right = b.instance(
      child,
      address.slice(0, -1).concat(data, [rightClock, reset]),
      "Upper addresses",
    );
    b.output(left.map((n, i) => b.switch(n, right[i], select)), "Q");
  }
  if (addressBits) {
    b.model.instances![0].offset = 0;
    b.model.instances![1].offset = 2 ** (addressBits - 1);
  }
  banks.set(key, b.model);
  return b.model;
}
export function gateROM(
  contents: number[],
  addressBits: number,
  width = 8,
): GateModel {
  const b = new GateBuilder(`ROM · ${2 ** addressBits} words × ${width} bits`),
    address = b.bus("A", addressBits);
  const select = (nodes: number[], bit: number): number => {
    if (nodes.every((n) => n === nodes[0])) return nodes[0];
    const middle = nodes.length / 2;
    return b.switch(
      select(nodes.slice(0, middle), bit - 1),
      select(nodes.slice(middle), bit - 1),
      address[bit],
    );
  };
  b.output(
    Array.from({ length: width }, (_, bit) =>
      select(
        Array.from(
          { length: 2 ** addressBits },
          (_, i) => (contents[i] ?? 0) >> bit & 1 ? b.high : b.low,
        ),
        addressBits - 1,
      )),
    "Q",
  );
  return b.model;
}
