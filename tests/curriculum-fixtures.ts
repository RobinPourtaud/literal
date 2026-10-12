import { type Circuit, type Kind, transistorCircuit } from "@literal/core";
import { labStarter, programCircuit } from "../apps/web/src/curriculum.ts";
export function labSolution(id: string): Circuit {
  if (
    [
      "cpu",
      "opcode",
      "bios",
      "pixels",
      "triangle",
      "keyboard",
      "animation",
      "game",
      "projection",
    ].includes(id)
  ) return programCircuit(id);
  const c = labStarter(id, []);
  let count = 0;
  const wire = (from: string, to: string, port: number, fromPort = 0) =>
    c.wires.push({ id: `w${c.wires.length}`, from, to, port, fromPort });
  const gate = (kind: Kind, ...inputs: string[]) => {
    const node = `g${count++}`;
    const network = transistorCircuit(kind);
    if (network) {
      const def = `learned-${kind}`;
      if (!c.definitions!.some((d) => d.id === def)) {
        c.definitions!.push({
          id: def,
          name: kind,
          shape: "rounded",
          color: "#527d3c",
          components: network.components,
          wires: network.wires,
        });
      }
      c.components.push({
        id: node,
        kind: "CUSTOM",
        definition: def,
        label: kind,
        x: 240 + count % 3 * 160,
        y: Math.floor(count / 3) * 130,
      });
    } else {c.components.push({
        id: node,
        kind,
        label: kind,
        x: 340,
        y: count * 90,
      });}
    inputs.forEach((from, port) => wire(from, node, port));
    return node;
  };
  const half = (a: string, b: string) => [gate("XOR", a, b), gate("AND", a, b)];
  const full = (a: string, b: string, cin: string) => {
    const [t, c1] = half(a, b), [sum, c2] = half(t, cin);
    return [sum, gate("OR", c1, c2)];
  };
  const mux = (a: string, b: string, select: string) =>
    gate("OR", gate("AND", a, gate("NOT", select)), gate("AND", b, select));
  if (id === "half-adder" || id === "full-adder") {
    const [sum, carry] = id === "half-adder"
      ? half("A", "B")
      : full("A", "B", "Cin");
    wire(sum, "Sum", 0);
    wire(carry, "Carry", 0);
  } else if (id === "byte-adder") {
    let carry = "Cin";
    for (let i = 0; i < 8; i++) {
      const [sum, next] = full(`A${i}`, `B${i}`, carry);
      wire(sum, `S${i}`, 0);
      carry = next;
    }
    wire(carry, "Cout", 0);
  } else if (id === "mux" || id === "alu") {
    const out = id === "mux"
      ? mux("A", "B", "S")
      : mux(gate("AND", "A", "B"), gate("XOR", "A", "B"), "S");
    wire(out, "Y", 0);
  } else if (id === "latch") {
    const q = c.components.find((n) => n.label === "NAND Q")!.id;
    const qb = c.components.find((n) => n.label === "NAND Qbar")!.id;
    for (
      const n of c.components.filter((n) => n.label.startsWith("Feedback Qbar"))
    ) wire(qb, n.id, 0);
    for (
      const n of c.components.filter((n) => n.label.startsWith("Feedback Q ·"))
    ) wire(q, n.id, 0);
    wire(q, "Q", 0);
    wire(qb, "Qbar", 0);
  } else if (id === "register") {
    for (let i = 0; i < 8; i++) {
      const d = gate("DFF", `D${i}`, "Clock");
      wire(d, `Q${i}`, 0);
    }
  } else {
    for (let i = 0; i < 8; i++) {
      wire(`A${i}`, "Memory", i);
      wire("Memory", `Q${i}`, 0, i);
    }
    if (id === "ram") {
      for (let i = 0; i < 8; i++) wire(`D${i}`, "Memory", i + 8);
      wire("Write", "Memory", 16);
      wire("Clock", "Memory", 17);
    } else c.components.find((n) => n.id === "Memory")!.contents = [16, 0, 42];
  }
  return c;
}
