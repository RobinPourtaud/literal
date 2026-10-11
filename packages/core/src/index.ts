export type Signal = 0 | 1 | 'X';
export const kinds = ['INPUT', 'OUTPUT', 'AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR', 'BUFFER', 'MUX', 'CLOCK', 'DFF'] as const;
export type Kind = typeof kinds[number];
export interface Component { id: string; kind: Kind; x: number; y: number; label: string; value?: 0 | 1 }
export interface Wire { id: string; from: string; to: string; port: number }
export interface Circuit { version: 1; name: string; components: Component[]; wires: Wire[] }
export interface Memory { q: Record<string, Signal>; clock: Record<string, Signal> }
export interface Simulation { values: Record<string, Signal>; inputs: Record<string, Signal[]>; memory: Memory; warnings: string[] }
export const inputCount = (kind: Kind): number => ({ INPUT: 0, CLOCK: 0, OUTPUT: 1, NOT: 1, BUFFER: 1, MUX: 3, DFF: 2 } as Partial<Record<Kind, number>>)[kind] ?? 2;
export const hasOutput = (kind: Kind) => kind !== 'OUTPUT';
export const invert = (value: Signal): Signal => value === 'X' ? 'X' : value === 0 ? 1 : 0;
export function gate(kind: Kind, values: Signal[]): Signal {
  const [a = 'X', b = 'X', select = 'X'] = values;
  const and = (): Signal => a === 0 || b === 0 ? 0 : a === 'X' || b === 'X' ? 'X' : 1;
  const or = (): Signal => a === 1 || b === 1 ? 1 : a === 'X' || b === 'X' ? 'X' : 0;
  const xor = (): Signal => a === 'X' || b === 'X' ? 'X' : a === b ? 0 : 1;
  switch (kind) {
    case 'AND': return and(); case 'NAND': return invert(and());
    case 'OR': return or(); case 'NOR': return invert(or());
    case 'XOR': return xor(); case 'XNOR': return invert(xor());
    case 'NOT': return invert(a); case 'MUX': return select === 'X' ? a === b ? a : 'X' : select === 0 ? a : b;
    default: return a;
  }
}
export function simulate(circuit: Circuit, previous: Memory = { q: {}, clock: {} }): Simulation {
  const components = new Map(circuit.components.map(c => [c.id, c]));
  const incoming = new Map(circuit.wires.map(w => [`${w.to}:${w.port}`, w.from]));
  const memory: Memory = { q: {}, clock: {} };
  for (const c of circuit.components) if (c.kind === 'DFF') memory.q[c.id] = previous.q[c.id] ?? 0;
  const warnings = new Set<string>();
  function settle(): Pick<Simulation, 'values' | 'inputs'> {
    const values: Record<string, Signal> = Object.create(null);
    const inputs: Record<string, Signal[]> = Object.create(null);
    const visiting = new Set<string>();
    function read(id: string): Signal {
      if (id in values) return values[id];
      const component = components.get(id);
      if (!component) return 'X';
      if (component.kind === 'INPUT' || component.kind === 'CLOCK') return values[id] = component.value ?? 0;
      if (component.kind === 'DFF') return values[id] = memory.q[id];
      if (visiting.has(id)) { warnings.add('Combinational feedback detected. Use a D flip-flop to store state.'); return 'X'; }
      visiting.add(id);
      const ports = Array.from({ length: inputCount(component.kind) }, (_, port) => {
        const from = incoming.get(`${id}:${port}`); return from ? read(from) : 'X';
      });
      inputs[id] = ports;
      const value = gate(component.kind, ports);
      visiting.delete(id);
      return values[id] = value;
    }
    for (const c of circuit.components) read(c.id);
    for (const c of circuit.components) inputs[c.id] = Array.from({ length: inputCount(c.kind) }, (_, port) => values[incoming.get(`${c.id}:${port}`) ?? ''] ?? 'X');
    return { values, inputs };
  }
  const before = settle();
  for (const c of circuit.components) if (c.kind === 'DFF') {
    const [data, clock] = before.inputs[c.id];
    if (previous.clock[c.id] === 0 && clock === 1) memory.q[c.id] = data;
    memory.clock[c.id] = clock;
  }
  const after = settle();
  return { ...after, memory, warnings: [...warnings] };
}
export function connect(circuit: Circuit, from: string, to: string, port: number, id: string): Circuit {
  const source = circuit.components.find(c => c.id === from), target = circuit.components.find(c => c.id === to);
  if (!source || !target || !hasOutput(source.kind) || !Number.isInteger(port) || port < 0 || port >= inputCount(target.kind)) throw Error('Choose an output pin and an input pin.');
  if (circuit.wires.some(w => w.to === to && w.port === port)) throw Error('This input is already connected. Delete its wire first.');
  return { ...circuit, wires: [...circuit.wires, { id, from, to, port }] };
}
export function parseCircuit(text: string): Circuit {
  if (text.length > 2_000_000) throw Error('Circuit file is too large (2 MB maximum).');
  const c = JSON.parse(text);
  if (c?.version !== 1 || typeof c.name !== 'string' || c.name.length > 100 || !Array.isArray(c.components) || !Array.isArray(c.wires)) throw Error('Not a supported circuit file.');
  if (c.components.length > 500 || c.wires.length > 2000) throw Error('Limit: 500 components and 2,000 wires.');
  const ids = new Set<string>();
  const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(id) && !['__proto__', 'constructor', 'prototype'].includes(id);
  for (const node of c.components) {
    if (!validId(node.id) || ids.has(node.id) || !kinds.includes(node.kind) || !Number.isFinite(node.x) || !Number.isFinite(node.y) || Math.abs(node.x) > 100_000 || Math.abs(node.y) > 100_000 || typeof node.label !== 'string' || node.label.length > 80 || (node.value !== undefined && node.value !== 0 && node.value !== 1)) throw Error('Invalid component in circuit file.');
    ids.add(node.id);
  }
  const targets = new Set<string>();
  for (const wire of c.wires) {
    const source = c.components.find((n: Component) => n.id === wire.from), target = c.components.find((n: Component) => n.id === wire.to);
    const pin = `${wire.to}:${wire.port}`;
    if (!validId(wire.id) || ids.has(wire.id) || !source || !target || !hasOutput(source.kind) || !Number.isInteger(wire.port) || wire.port < 0 || wire.port >= inputCount(target.kind) || targets.has(pin)) throw Error('Invalid or multiply driven connection.');
    ids.add(wire.id); targets.add(pin);
  }
  return { version: 1, name: c.name, components: c.components.map((n: Component) => ({ id: n.id, kind: n.kind, x: n.x, y: n.y, label: n.label, ...(n.value === undefined ? {} : { value: n.value }) })), wires: c.wires.map((w: Wire) => ({ id: w.id, from: w.from, to: w.to, port: w.port })) };
}
export function truthTable(circuit: Circuit) {
  const inputs = circuit.components.filter(c => c.kind === 'INPUT');
  const outputs = circuit.components.filter(c => c.kind === 'OUTPUT');
  if (circuit.components.some(c => c.kind === 'CLOCK' || c.kind === 'DFF')) throw Error('Truth tables are available for combinational circuits. Remove clocks and flip-flops first.');
  if (inputs.length > 8) throw Error('Truth tables support up to 8 inputs.');
  if (!outputs.length) throw Error('Add an output to generate a truth table.');
  const rows = Array.from({ length: 2 ** inputs.length }, (_, n) => {
    const bits = inputs.map((_, i) => (n >> (inputs.length - i - 1) & 1) as 0 | 1);
    const copy = { ...circuit, components: circuit.components.map(c => { const i = inputs.findIndex(input => input.id === c.id); return i < 0 ? c : { ...c, value: bits[i] }; }) };
    const result = simulate(copy);
    if (result.warnings.length) throw Error('Remove combinational feedback before generating a truth table.');
    return { inputs: bits, outputs: outputs.map(c => result.values[c.id]) };
  });
  return { inputs, outputs, rows };
}
