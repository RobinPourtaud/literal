import type { Circuit } from "./index.ts";
export type ALUOperation = "ADD" | "SUB" | "AND" | "OR" | "XOR" | "SHL" | "SHR";
export interface LogicNode {
  id: number;
  kind: "INPUT" | "AND" | "OR" | "NOT";
  label: string;
  inputs: number[];
}
export interface ALUNetlist {
  nodes: LogicNode[];
  outputs: number[];
  carry: number;
  zero: number;
}
function build(operation: ALUOperation): ALUNetlist {
  const nodes: LogicNode[] = [];
  const node = (
    kind: LogicNode["kind"],
    label: string,
    ...inputs: number[]
  ) => {
    const id = nodes.length;
    nodes.push({ id, kind, label, inputs });
    return id;
  };
  const a = Array.from({ length: 8 }, (_, i) => node("INPUT", `A${i}`));
  const b = Array.from({ length: 8 }, (_, i) => node("INPUT", `B${i}`));
  const low = node("INPUT", "0"), high = node("NOT", "1", low);
  const and = (x: number, y: number) => node("AND", "AND", x, y);
  const or = (x: number, y: number) => node("OR", "OR", x, y);
  const not = (x: number) => node("NOT", "NOT", x);
  const xor = (x: number, y: number) => or(and(x, not(y)), and(not(x), y));
  let carry = operation === "SUB" ? high : low;
  const outputs = a.map((bit, i) => {
    if (operation === "SHL") return i ? a[i - 1] : low;
    if (operation === "SHR") return i < 7 ? a[i + 1] : low;
    if (operation === "AND") return and(bit, b[i]);
    if (operation === "OR") return or(bit, b[i]);
    if (operation === "XOR") return xor(bit, b[i]);
    const other = operation === "SUB" ? not(b[i]) : b[i];
    const propagate = xor(bit, other);
    const sum = xor(propagate, carry);
    carry = or(and(bit, other), and(propagate, carry));
    return sum;
  });
  if (operation === "SUB") carry = not(carry);
  if (operation === "SHL") carry = a[7];
  if (operation === "SHR") carry = a[0];
  const zero = not(outputs.reduce(or));
  return { nodes, outputs, carry, zero };
}
const netlists = new Map<ALUOperation, ALUNetlist>();
export function aluNetlist(operation: ALUOperation) {
  if (!netlists.has(operation)) netlists.set(operation, build(operation));
  return netlists.get(operation)!;
}
export function evaluateALU(operation: ALUOperation, a: number, b: number) {
  const netlist = aluNetlist(operation);
  const values = new Uint8Array(netlist.nodes.length);
  for (const node of netlist.nodes) {
    const [x, y] = node.inputs;
    values[node.id] = node.kind === "INPUT"
      ? node.label === "0"
        ? 0
        : ((node.label[0] === "A" ? a : b) >> Number(node.label.slice(1))) & 1
      : node.kind === "NOT"
      ? 1 - values[x]
      : node.kind === "AND"
      ? values[x] & values[y]
      : values[x] | values[y];
  }
  return {
    value: netlist.outputs.reduce((v, id, bit) => v | (values[id] << bit), 0),
    carry: !!values[netlist.carry],
    zero: !!values[netlist.zero],
    values,
  };
}

export function aluCircuit(
  operation: ALUOperation,
  a: number,
  b: number,
): Circuit {
  const netlist = aluNetlist(operation), depth: number[] = [];
  const rows = new Map<number, number>();
  const components: Circuit["components"] = netlist.nodes.map((node) => {
    const d = node.inputs.length
      ? Math.max(...node.inputs.map((id) => depth[id])) + 1
      : 0;
    depth[node.id] = d;
    const row = rows.get(d) ?? 0;
    rows.set(d, row + 1);
    return {
      id: `gate-${node.id}`,
      kind: node.kind,
      label: node.kind === "INPUT" ? node.label : `${node.kind} ${node.id}`,
      x: d * 160,
      y: row * 100,
      ...(node.kind === "INPUT"
        ? {
          value: (node.label === "0"
            ? 0
            : ((node.label[0] === "A" ? a : b) >> Number(node.label.slice(1))) &
              1) as 0 | 1,
        }
        : {}),
    };
  });
  const wires: Circuit["wires"] = netlist.nodes.flatMap((node) =>
    node.inputs.map((id, port) => ({
      id: `wire-${node.id}-${port}`,
      from: `gate-${id}`,
      to: `gate-${node.id}`,
      port,
    }))
  );
  [...netlist.outputs, netlist.carry, netlist.zero].forEach((id, bit) => {
    const output = `out-${bit}`;
    components.push({
      id: output,
      kind: "OUTPUT",
      label: bit < 8 ? `Result ${bit}` : bit === 8 ? "Carry" : "Zero",
      x: (Math.max(...depth) + 1) * 160,
      y: bit * 100,
    });
    wires.push({
      id: `wire-${output}`,
      from: `gate-${id}`,
      to: output,
      port: 0,
    });
  });
  return {
    version: 1,
    name: `Literal 8 ALU · ${operation}`,
    components,
    wires,
  };
}

export function completeALUCircuit(): Circuit {
  const circuit: Circuit = {
    version: 1,
    name: "ALU 8",
    components: [],
    wires: [],
  };
  const lookup = new Map<string, string>();
  const input = (label: string) => {
    const id = `in-${label}`;
    circuit.components.push({
      id,
      kind: "INPUT",
      label,
      x: 0,
      y: circuit.components.length * 80,
      value: 0,
    });
    return id;
  };
  const a = Array.from({ length: 8 }, (_, i) => input(`A${i}`));
  const b = Array.from({ length: 8 }, (_, i) => input(`B${i}`));
  const select = Array.from({ length: 3 }, (_, i) => input(`S${i}`));
  const low = input("Zero");
  const depths = new Map<string, number>(
    circuit.components.map((n) => [n.id, 0]),
  );
  const rows = new Map<number, number>();
  const gate = (kind: "AND" | "OR" | "NOT", ...inputs: string[]) => {
    const key = `${kind}:${inputs.join(":")}`;
    if (lookup.has(key)) return lookup.get(key)!;
    const id = `g-${lookup.size}`,
      depth = Math.max(...inputs.map((id) => depths.get(id)!)) + 1;
    const row = rows.get(depth) ?? 0;
    rows.set(depth, row + 1);
    depths.set(id, depth);
    circuit.components.push({
      id,
      kind,
      label: `${kind} ${lookup.size}`,
      x: depth * 160,
      y: row * 80,
    });
    inputs.forEach((from, port) =>
      circuit.wires.push({ id: `w-${id}-${port}`, from, to: id, port })
    );
    lookup.set(key, id);
    return id;
  };
  const outputs: string[][] = [];
  for (
    const [code, operation]
      of (["ADD", "SUB", "AND", "OR", "XOR", "SHL", "SHR"] as const).entries()
  ) {
    const netlist = aluNetlist(operation), ids: string[] = [];
    for (const node of netlist.nodes) {
      ids[node.id] = node.kind === "INPUT"
        ? node.label === "0"
          ? low
          : (node.label[0] === "A" ? a : b)[Number(node.label.slice(1))]
        : gate(node.kind, ...node.inputs.map((id) => ids[id]));
    }
    const enable = select.map((id, bit) =>
      code >> bit & 1 ? id : gate("NOT", id)
    ).reduce((x, y) => gate("AND", x, y));
    outputs.push(
      [...netlist.outputs, netlist.carry, netlist.zero].map((id) =>
        gate("AND", ids[id], enable)
      ),
    );
  }
  for (let port = 0; port < 10; port++) {
    const from = outputs.map((ids) => ids[port]).reduce((x, y) =>
      gate("OR", x, y)
    );
    const id = `out-${port}`;
    circuit.components.push({
      id,
      kind: "OUTPUT",
      label: port < 8 ? `Result ${port}` : port === 8 ? "Carry" : "Zero",
      x: (Math.max(...depths.values()) + 1) * 160,
      y: port * 80,
    });
    circuit.wires.push({ id: `w-${id}`, from, to: id, port: 0 });
  }
  return circuit;
}
