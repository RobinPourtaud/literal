import {
  type Circuit,
  type Component,
  componentInputLabel,
  componentInputs,
  componentOutputLabel,
  componentOutputs,
  definitionOf,
  displaySegments,
  hexValue,
  inputLabel,
  screenColors,
  screenWidth,
  type Signal,
  type Simulation,
} from "@literal/core";
export const esc = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
export type Point = { x: number; y: number };
export function pin(
  c: Component,
  port: number,
  circuit: Circuit = { version: 1, name: "", components: [], wires: [] },
): Point {
  const count = port < 0
    ? componentOutputs(c, circuit)
    : componentInputs(c, circuit);
  return {
    x: c.x +
      (c.kind.startsWith("BUS_")
        ? c.kind === "BUS_SCREEN" ? port < 0 ? 180 : -180 : port < 0 ? 80 : -80
        : port < 0
        ? c.kind === "KEYBOARD" ? 110 : 50
        : c.kind === "VGA"
        ? -180
        : ["SEVEN_SEG", "HEX_DISPLAY"].includes(c.kind)
        ? -70
        : -50),
    y: c.y +
      (port < 0
        ? (-port - 1 - (count - 1) / 2) * 24
        : (port - (count - 1) / 2) * 24),
  };
}
export const signalClass = (s: Signal) =>
  s === 1 ? "high" : s === 0 ? "low" : s === "Z" ? "floating" : "unknown";
export function path(a: Point, b: Point, offset = 0): string {
  const middle = a.x <= b.x - 30
    ? Math.max(a.x + 20, Math.min(b.x - 20, (a.x + b.x) / 2 + offset))
    : Math.max(a.x, b.x) + 40;
  if (a.x > b.x - 30) {
    return `M${a.x},${a.y} H${middle} V${Math.min(a.y, b.y) - 70} H${
      b.x - 30
    } V${b.y} H${b.x}`;
  }
  return `M${a.x},${a.y} H${middle} V${b.y} H${b.x}`;
}
export const dimensions = (
  c: Component,
  circuit: Circuit = { version: 1, name: "", components: [], wires: [] },
) =>
  c.kind === "BUS_SCREEN"
    ? { width: 400, height: 650, labelY: 327 }
    : (c.kind.startsWith("BUS_") ||
        ["REGISTER8", "COUNTER8", "ADDER8", "RAM", "ROM"].includes(c.kind))
    ? {
      width: 210,
      height:
        Math.max(componentInputs(c, circuit), componentOutputs(c, circuit)) *
          24 + 50,
      labelY:
        Math.max(componentInputs(c, circuit), componentOutputs(c, circuit)) *
          12 + 25,
    }
    : c.kind === "VGA"
    ? { width: 400, height: 396, labelY: 200 }
    : c.kind === "KEYBOARD"
    ? { width: 290, height: 280, labelY: 142 }
    : c.kind === "CUSTOM"
    ? {
      width: 156,
      height: Math.max(
        108,
        Math.max(componentInputs(c, circuit), componentOutputs(c, circuit)) *
            24 + 50,
      ),
      labelY: Math.max(
        54,
        Math.max(componentInputs(c, circuit), componentOutputs(c, circuit)) *
            12 + 25,
      ),
    }
    : c.kind === "SEVEN_SEG"
    ? { width: 156, height: 242, labelY: 122 }
    : c.kind === "HEX_DISPLAY"
    ? { width: 156, height: 182, labelY: 92 }
    : { width: 122, height: 108, labelY: 57 };
function shape(
  c: Component,
  signal: Signal,
  inputs: Signal[],
  circuit: Circuit,
  sim: Simulation,
) {
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
  if (["NMOS", "PMOS"].includes(kind)) {
    const on = inputs[0] === (kind === "NMOS" ? 1 : 0);
    return `<rect class="gate-shape" x="-42" y="-36" width="84" height="72" rx="8"/><path class="transistor-channel ${
      on ? "conducting" : ""
    }" d="M-28 0H-12 M-12-22V22 M-4-22V22 M-4-18H22V-28 M-4 18H22V28"/>${
      kind === "PMOS"
        ? '<circle cx="-18" cy="0" r="4" fill="white" stroke="currentColor"/>'
        : ""
    }<text class="display-pin-label" y="48">${kind} · ${
      on ? "on" : "off"
    }</text>`;
  }
  if (kind === "POWER" || kind === "GROUND") {
    return `<rect class="gate-shape" x="-30" y="-25" width="60" height="50" rx="8"/><text class="signal-number" y="6">${
      kind === "POWER" ? signal === 1 ? "VDD" : "0" : "GND"
    }</text>`;
  }
  if (kind === "JUNCTION") {
    return `<circle class="gate-shape ${
      signalClass(signal)
    }" r="20"/><text class="signal-number" y="6">${signal}</text>`;
  }
  if (kind.startsWith("BUS_") && kind !== "BUS_SCREEN") {
    const height = dimensions(c, circuit).height - 32;
    const cpu = sim.memory.processors?.[c.id];
    return `<rect class="gate-shape" x="-70" y="${
      -height / 2
    }" width="140" height="${height}" rx="12"/><text class="custom-title" y="-12">${
      kind.slice(4)
    }</text><text class="display-pin-label" y="14">${
      cpu
        ? `PC ${cpu.pc.toString(16).padStart(4, "0")}`
        : kind === "BUS_ROM"
        ? "8 KiB"
        : kind === "BUS_RAM"
        ? "52 KiB"
        : "Memory bus"
    }</text>`;
  }
  if (["REGISTER8", "COUNTER8", "ADDER8", "RAM", "ROM"].includes(kind)) {
    const height = dimensions(c, circuit).height - 32;
    const bits = sim.outputValues[c.id] ?? [],
      value = bits.slice(0, 8).some((bit) => bit === "X" || bit === "Z")
        ? "XX"
        : bits.slice(0, 8).reduce<number>(
          (n, b, i) => n + (b === 1 ? 2 ** i : 0),
          0,
        ).toString(16).toUpperCase().padStart(2, "0");
    return `<rect class="gate-shape" x="-40" y="${
      -height / 2
    }" width="80" height="${height}" rx="8"/><text class="custom-title" y="-10">${
      kind.replace("8", " 8")
    }</text><text class="signal-number" y="22">${value}</text>`;
  }
  if (kind === "VGA" || kind === "BUS_SCREEN") {
    const pixels = sim.memory.screens?.[c.id] ?? [];
    return `<rect class="display-case" x="-136" y="-108" width="272" height="216" rx="10"/><rect fill="${
      screenColors[0]
    }" x="-128" y="-96" width="256" height="192"/>${
      pixels.map((color, i) =>
        color
          ? `<rect class="vga-pixel" x="${(i % screenWidth) * 8 - 128}" y="${
            Math.floor(i / screenWidth) * 8 - 96
          }" width="8" height="8" fill="${screenColors[color]}"/>`
          : ""
      ).join("")
    }<text class="display-pin-label" x="-125" y="125">32 × 24 · RGB</text>`;
  }
  if (kind === "KEYBOARD") {
    const bits = sim.outputValues[c.id] ?? [],
      code = bits.slice(0, 8).reduce<number>(
        (n, b, i) => n + (b === 1 ? 2 ** i : 0),
        0,
      );
    return `<rect class="gate-shape" x="-80" y="-116" width="160" height="232" rx="12"/><text class="custom-title" y="-88">Keyboard</text><text class="signal-number" y="-53">${
      code.toString(16).toUpperCase().padStart(2, "0")
    }</text>${
      ["QWERTY", "ASDFGH", "ZXCVBN"].map((row, y) =>
        [...row].map((key, x) =>
          `<rect class="keyboard-key ${
            bits[8] === 1 && code === key.charCodeAt(0) ? "active" : ""
          }" x="${x * 23 - 68}" y="${
            y * 29 - 23
          }" width="20" height="24" rx="3"/><text class="keyboard-letter" x="${
            x * 23 - 58
          }" y="${y * 29 - 7}">${key}</text>`
        ).join("")
      ).join("")
    }<text class="display-pin-label" x="-68" y="94">${
      bits[8] === 1 ? "PRESSED" : "RELEASED"
    }</text>`;
  }
  if (kind === "CUSTOM") {
    const def = definitionOf(c, circuit),
      h = dimensions(c, circuit).height - 32,
      color = def?.color ?? "#527d3c";
    const body = def?.shape === "diamond"
      ? `<path d="M0 ${-h / 2} L48 0 L0 ${h / 2} L-48 0Z"/>`
      : `<rect x="-40" y="${-h / 2}" width="80" height="${h}" rx="${
        def?.shape === "rounded" ? 12 : 2
      }"/>`;
    return `<g class="custom-case" style="--custom-color:${color}">${body}</g><text class="custom-title" y="4">${
      esc((def?.name ?? "Custom").slice(0, 11))
    }</text>`;
  }
  if (kind === "SEVEN_SEG" || kind === "HEX_DISPLAY") {
    const segments = displaySegments(kind, inputs),
      height = kind === "SEVEN_SEG" ? 200 : 140;
    const strokes = [
      "M-20-58H20",
      "M26-48V-8",
      "M26 8V48",
      "M20 58H-20",
      "M-26 48V8",
      "M-26-8V-48",
      "M-20 0H20",
    ];
    return `<rect class="display-case" x="-48" y="${
      -height / 2
    }" width="96" height="${height}" rx="9"/>${
      strokes.map((d, i) =>
        `<path class="display-segment ${
          signalClass(segments[i])
        }" data-segment="${i}" d="${d}"/>`
      ).join("")
    }<circle class="display-point ${
      signalClass(segments[7])
    }" data-segment="7" cx="36" cy="58" r="4"/>`;
  }
  if (kind === "LED") {
    return `<circle class="gate-shape" r="25"/><circle class="led-light ${
      signalClass(signal)
    }" r="17"/><text class="led-state" y="5">${signal}</text>`;
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
    const d = path(
      pin(a, -(w.fromPort ?? 0) - 1, circuit),
      pin(b, w.port, circuit),
      (w.port - (componentInputs(b, circuit) - 1) / 2) * 18,
    );
    return `<g class="wire ${
      signalClass(
        sim.outputValues[w.from]?.[w.fromPort ?? 0] ?? sim.values[w.from],
      )
    } ${
      selected.has(w.id) ? "selected" : ""
    }" data-wire="${w.id}"><path class="wire-hit" d="${d}"/><path class="wire-line" d="${d}"/><title>Wire ${
      esc(a.label)
    } → ${esc(b.label)} input ${w.port + 1}</title></g>`;
  }).join("");
  const components = circuit.components.map((c) => {
    const size = dimensions(c, circuit);
    const ports = Array.from(
      { length: componentInputs(c, circuit) },
      (_, i) => i,
    );
    ports.push(
      ...Array.from({ length: componentOutputs(c, circuit) }, (_, i) => -i - 1),
    );
    const p = ports.map((i) => {
      const pos = pin(c, i, circuit),
        signal = i < 0
          ? sim.outputValues[c.id]?.[-i - 1] ?? sim.values[c.id]
          : sim.inputs[c.id]?.[i] ?? "X";
      return `<line class="pin-line ${signalClass(signal)}" x1="${
        i < 0
          ? c.kind === "BUS_SCREEN"
            ? 136
            : c.kind === "KEYBOARD"
            ? 80
            : (["NOT", "NAND", "NOR", "XNOR"].includes(c.kind)
              ? 44
              : ["CUSTOM", "REGISTER8", "COUNTER8", "ADDER8", "RAM", "ROM"]
                  .includes(c.kind)
              ? 40
              : 28)
          : c.kind === "VGA" || c.kind === "BUS_SCREEN"
          ? -136
          : (["SEVEN_SEG", "HEX_DISPLAY"].includes(c.kind)
            ? -48
            : ["CUSTOM", "REGISTER8", "COUNTER8", "ADDER8", "RAM", "ROM"]
                .includes(c.kind)
            ? -40
            : -30)
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
        i < 0
          ? c.kind === "CUSTOM" || componentOutputs(c, circuit) > 1
            ? esc(componentOutputLabel(c, -i - 1, circuit))
            : "output"
          : esc(componentInputLabel(c, i, circuit).replace(/^Input /, "input "))
      } pin"><rect class="pin-target" x="-12" y="-10" width="24" height="20"/><circle class="pin-dot" r="6"/></g>${
        [
            "SEVEN_SEG",
            "HEX_DISPLAY",
            "CUSTOM",
            "VGA",
            "KEYBOARD",
            "REGISTER8",
            "COUNTER8",
            "ADDER8",
            "RAM",
            "ROM",
          ].includes(
            c.kind,
          ) || c.kind.startsWith("BUS_")
          ? `<text class="display-pin-label" x="${
            c.kind === "BUS_SCREEN"
              ? i < 0 ? 158 : -165
              : c.kind === "VGA"
              ? -165
              : c.kind === "KEYBOARD"
              ? 118
              : i < 0
              ? 58
              : -55
          }" y="${pos.y - c.y + 3}">${
            [
                "CUSTOM",
                "VGA",
                "KEYBOARD",
                "REGISTER8",
                "COUNTER8",
                "ADDER8",
                "RAM",
                "ROM",
              ].includes(c.kind) || c.kind.startsWith("BUS_")
              ? esc((i < 0
                ? componentOutputLabel(c, -i - 1, circuit)
                : componentInputLabel(c, i, circuit)).slice(0, 9))
              : c.kind === "SEVEN_SEG"
              ? inputLabel(c.kind, i)
              : 2 ** i
          }</text>`
          : ""
      }`;
    }).join("");
    return `<g class="component ${signalClass(sim.values[c.id])} ${
      selected.has(c.id) ? "selected" : ""
    }" data-node="${c.id}" transform="translate(${c.x} ${c.y})"><rect class="selection-box" x="${
      -size.width / 2
    }" y="${
      -size.height / 2 + 6
    }" width="${size.width}" height="${size.height}" rx="8"/><g class="component-body" tabindex="0" role="button" aria-label="${
      esc(c.label)
    } ${c.kind}${
      c.kind === "HEX_DISPLAY"
        ? ` ${hexValue(sim.inputs[c.id])?.toString(16).toUpperCase() ?? "X"}`
        : ""
    }${
      c.kind === "INPUT"
        ? ` ${sim.values[c.id]}. Enter to toggle.`
        : c.kind === "CLOCK"
        ? ". Enter for clock controls."
        : ""
    }">${
      shape(c, sim.values[c.id], sim.inputs[c.id], circuit, sim)
    }</g>${p}<text class="component-label" y="${size.labelY}">${
      esc(c.label)
    }</text></g>`;
  }).join("");
  return wires + components;
}
