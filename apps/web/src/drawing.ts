import {
  type Circuit,
  type Component,
  hasOutput,
  inputCount,
  type Signal,
  type Simulation,
} from "@literal/core";
export const esc = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
export type Point = { x: number; y: number };
export function pin(c: Component, port: number): Point {
  const count = inputCount(c.kind);
  return {
    x: c.x + (port < 0 ? 50 : -50),
    y: c.y + (port < 0 ? 0 : (port - (count - 1) / 2) * 24),
  };
}
export const signalClass = (s: Signal) =>
  s === 1 ? "high" : s === 0 ? "low" : "unknown";
export function path(a: Point, b: Point): string {
  const middle = a.x <= b.x - 30 ? (a.x + b.x) / 2 : Math.max(a.x, b.x) + 40;
  if (a.x > b.x - 30) {
    return `M${a.x},${a.y} H${middle} V${Math.min(a.y, b.y) - 70} H${
      b.x - 30
    } V${b.y} H${b.x}`;
  }
  return `M${a.x},${a.y} H${middle} V${b.y} H${b.x}`;
}
function shape(c: Component, signal: Signal) {
  const kind = c.kind;
  if (kind === "INPUT" || kind === "CLOCK") {
    return `<rect class="gate-shape source ${
      signalClass(signal)
    }" x="-28" y="-23" width="56" height="46" rx="7"/><text class="signal-number" y="6">${signal}</text>${
      kind === "CLOCK"
        ? '<path class="clock-glyph" d="M-15 15v-6h8v6h8v-6h8"/>'
        : ""
    }`;
  }
  if (kind === "OUTPUT") {
    return `<circle class="gate-shape lamp ${
      signalClass(signal)
    }" r="25"/><text class="signal-number" y="6">${signal}</text>`;
  }
  let body = "";
  if (["AND", "NAND"].includes(kind)) {
    body = '<path class="gate-shape" d="M-32-28 H0 A28 28 0 0 1 0 28 H-32Z"/>';
  } else if (["OR", "NOR", "XOR", "XNOR"].includes(kind)) {
    body =
      '<path class="gate-shape" d="M-32-28 Q7-28 34 0 Q7 28-32 28 Q-12 0-32-28Z"/>' +
      (kind.includes("X")
        ? '<path class="gate-line" d="M-40-28 Q-20 0-40 28"/>'
        : "");
  } else if (kind === "NOT" || kind === "BUFFER") {
    body = '<path class="gate-shape" d="M-30-28 L28 0 L-30 28Z"/>';
  } else if (kind === "MUX") {
    body =
      '<path class="gate-shape" d="M-32-40 L30-25 V25 L-32 40Z"/><text class="gate-type" y="4">MUX</text>';
  } else {body =
      '<rect class="gate-shape" x="-32" y="-34" width="64" height="68" rx="4"/><text class="port-name" x="-19" y="-8">D</text><path class="gate-line" d="M-32 4l8 8-8 8"/><text class="port-name" x="19" y="4">Q</text>';}
  if (["NOT", "NAND", "NOR", "XNOR"].includes(kind)) {
    body += '<circle class="gate-shape" cx="39" r="5"/>';
  }
  return body;
}
export function draw(
  circuit: Circuit,
  sim: Simulation,
  selected: Set<string>,
  wiring: { id: string; port: number } | null,
) {
  const nodes = new Map(circuit.components.map((c) => [c.id, c]));
  const wires = circuit.wires.map((w) => {
    const a = nodes.get(w.from), b = nodes.get(w.to);
    if (!a || !b) return "";
    const d = path(pin(a, -1), pin(b, w.port));
    return `<g class="wire ${signalClass(sim.values[w.from])} ${
      selected.has(w.id) ? "selected" : ""
    }" data-wire="${w.id}"><path class="wire-hit" d="${d}"/><path class="wire-line" d="${d}"/><title>Wire ${
      esc(a.label)
    } → ${esc(b.label)} input ${w.port + 1}</title></g>`;
  }).join("");
  const components = circuit.components.map((c) => {
    const ports = Array.from({ length: inputCount(c.kind) }, (_, i) => i);
    if (hasOutput(c.kind)) ports.push(-1);
    const p = ports.map((i) => {
      const pos = pin(c, i),
        signal = i < 0 ? sim.values[c.id] : sim.inputs[c.id]?.[i] ?? "X";
      return `<line class="pin-line ${signalClass(signal)}" x1="${
        i < 0
          ? (["NOT", "NAND", "NOR", "XNOR"].includes(c.kind) ? 44 : 28)
          : -30
      }" y1="${pos.y - c.y}" x2="${pos.x - c.x}" y2="${
        pos.y - c.y
      }"/><g class="pin ${
        wiring?.id === c.id && wiring.port === i ? "pending" : ""
      } ${
        signalClass(signal)
      }" data-pin="${i}" data-node="${c.id}" transform="translate(${
        pos.x - c.x
      } ${pos.y - c.y})" tabindex="0" role="button" aria-label="${
        esc(c.label)
      } ${
        i < 0 ? "output" : `input ${i + 1}`
      } pin"><rect class="pin-target" x="-12" y="-10" width="24" height="20"/><circle class="pin-dot" r="6"/></g>`;
    }).join("");
    return `<g class="component ${signalClass(sim.values[c.id])} ${
      selected.has(c.id) ? "selected" : ""
    }" data-node="${c.id}" transform="translate(${c.x} ${c.y})"><rect class="selection-box" x="-61" y="-48" width="122" height="108" rx="8"/><g class="component-body" tabindex="0" role="button" aria-label="${
      esc(c.label)
    } ${c.kind}${
      c.kind === "INPUT" || c.kind === "CLOCK"
        ? ` ${sim.values[c.id]}. Enter to toggle.`
        : ""
    }">${
      shape(c, sim.values[c.id])
    }</g>${p}<text class="component-label" y="57">${esc(c.label)}</text></g>`;
  }).join("");
  return wires + components;
}
