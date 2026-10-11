import {
  type Circuit,
  type Component,
  connect,
  hasOutput,
  inputCount,
  type Kind,
  type Memory,
  parseCircuit,
  simulate,
  truthTable,
} from "@literal/core";
import {
  ArrowUpRight,
  ChevronRight,
  Copy,
  createElement,
  Download,
  FilePlus,
  FolderOpen,
  Hand,
  Minus,
  MousePointer2,
  PanelLeft,
  PanelRight,
  Pause,
  Pencil,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Scan,
  StepForward,
  ToggleRight,
  Trash2,
  Undo2,
  X,
} from "lucide";
import robin from "./robin.svg?raw";
import { blank, clone, examples } from "./examples.ts";
import { draw, esc, path, pin, type Point } from "./drawing.ts";
import "./style.css";
const $ = <T extends Element = HTMLElement>(selector: string): T =>
  document.querySelector<T>(selector)!;
const icons = {
  ArrowUpRight,
  ChevronRight,
  Copy,
  Download,
  FilePlus,
  FolderOpen,
  Hand,
  Minus,
  MousePointer2,
  PanelLeft,
  PanelRight,
  Pause,
  Pencil,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Scan,
  StepForward,
  ToggleRight,
  Trash2,
  Undo2,
  X,
};
const icon = (name: keyof typeof icons) =>
  createElement([icons[name][0], {
    ...icons[name][1],
    width: 16,
    height: 16,
    "aria-hidden": "true",
  }, icons[name][2]]).outerHTML;
const uid = () => crypto.randomUUID();
let circuit = clone(examples[0].circuit);
let storageWarning = "";
try {
  const saved = localStorage.getItem("literal.circuit");
  if (saved) circuit = parseCircuit(saved);
} catch {
  storageWarning =
    "Saved circuit could not be loaded. You can open a circuit file instead.";
}
let memory: Memory = { q: {}, clock: {} };
let sim = simulate(circuit, memory);
memory = sim.memory;
let selected = new Set<string>(),
  placement: Kind | null = null,
  wiring: { id: string; port: number } | null = null;
let undo: Circuit[] = [],
  redo: Circuit[] = [],
  clipboard: Circuit | null = null;
let camera = { x: 0, y: 0, zoom: 1 }, pointer: Point | null = null;
let running: ReturnType<typeof setInterval> | null = null;
let space = false, pasted = 0, tab: "inspect" | "truth" = "inspect";
let drag: {
  type: "nodes" | "pan" | "box";
  start: Point;
  screen: Point;
  before: Circuit;
  positions: Map<string, Point>;
  moved: boolean;
  additive: boolean;
} | null = null;
const descriptions: Record<Kind, string> = {
  INPUT: "Toggle a logic signal.",
  OUTPUT: "Show a signal value.",
  AND: "High when both inputs are high.",
  OR: "High when either input is high.",
  NOT: "Invert an input.",
  NAND: "AND followed by inversion.",
  NOR: "OR followed by inversion.",
  XOR: "High when inputs differ.",
  XNOR: "High when inputs match.",
  BUFFER: "Pass a signal through.",
  MUX: "Select data 0 or data 1.",
  CLOCK: "A clock you can step or run.",
  DFF: "Store data on the rising clock edge.",
};
const groups: { name: string; kinds: Kind[] }[] = [{
  name: "INPUT / OUTPUT",
  kinds: ["INPUT", "OUTPUT", "CLOCK"],
}, {
  name: "GATES",
  kinds: ["AND", "OR", "NOT", "NAND", "NOR", "XOR", "XNOR", "BUFFER"],
}, { name: "STATE / ROUTING", kinds: ["DFF", "MUX"] }];
$("#app").innerHTML =
  `<header class="topbar"><a class="brand" href="#" aria-label="Literal home"><img src="/mark.svg" width="36" height="36" alt=""><strong>Literal</strong><span>logic circuits</span></a><nav><button id="library-toggle">${
    icon("PanelLeft")
  }<span>Components</span></button><button id="help">Reference</button></nav><a class="source-link" href="https://github.com/RobinPourtaud/literal" target="_blank" rel="noopener">Source ${
    icon("ArrowUpRight")
  }</a></header>
<div class="shell"><aside class="library"><div class="library-scroll"><div class="sidebar-title">COMPONENTS <kbd>click to place</kbd></div>${
    groups.map((g) =>
      `<section class="palette-group"><h2>${g.name}</h2>${
        g.kinds.map((k) =>
          `<button class="palette-item" data-place="${k}" title="${
            descriptions[k]
          }"><span class="gate-symbol">${
            ({
              INPUT: "↗",
              OUTPUT: "◉",
              CLOCK: "⌁",
              NOT: "¬",
              AND: "∧",
              OR: "∨",
              XOR: "⊕",
              XNOR: "⊙",
              NAND: "⊼",
              NOR: "⊽",
              BUFFER: "▷",
              DFF: "D",
              MUX: "⇉",
            } as Record<Kind, string>)[k]
          }</span>${
            k === "DFF"
              ? "D flip-flop"
              : k === "INPUT"
              ? "Input"
              : k === "OUTPUT"
              ? "Output"
              : k === "CLOCK"
              ? "Clock"
              : k === "BUFFER"
              ? "Buffer"
              : k
          }<span class="place-plus">+</span></button>`
        ).join("")
      }</section>`
    ).join("")
  }<section class="examples"><h2>EXAMPLES</h2>${
    examples.map((e) =>
      `<button data-example="${e.id}" title="${e.description}">${e.name}${
        icon("ChevronRight")
      }</button>`
    ).join("")
  }</section></div><a class="maker-credit" href="https://pourtaud.dev" target="_blank" rel="noopener">${robin}<span>Made by Robin Pourtaud</span></a></aside>
<main class="workspace"><div class="toolbar"><button id="name-button" title="Rename circuit"><span id="circuit-name"></span>${
    icon("Pencil")
  }</button><div class="toolbar-actions"><button id="examples-button" title="Example circuits">Examples</button><button id="new" title="New circuit">${
    icon("FilePlus")
  }<span>New</span></button><button id="open" title="Open circuit (⌘/Ctrl+O)">${
    icon("FolderOpen")
  }<span>Open</span></button><button id="save" title="Download circuit (⌘/Ctrl+S)">${
    icon("Download")
  }<span>Save</span></button><span class="divider"></span><button id="undo" class="icon-button" aria-label="Undo" title="Undo (⌘/Ctrl+Z)">${
    icon("Undo2")
  }</button><button id="redo" class="icon-button" aria-label="Redo" title="Redo (⌘/Ctrl+Shift+Z)">${
    icon("Redo2")
  }</button><span class="divider"></span><button id="step" title="Toggle all clocks once">${
    icon("StepForward")
  }<span>Step</span></button><button id="run" class="primary">${
    icon("Play")
  }Run clock</button><button id="reset" class="icon-button" aria-label="Reset simulation" title="Reset clock and flip-flop state">${
    icon("RotateCcw")
  }</button></div></div>
<div class="editor"><section class="board-panel" aria-label="Circuit editor"><div class="board-header"><div class="board-tools"><button id="place-center" hidden>Place at center</button><button id="select-tool" class="active" title="Select (V)">${
    icon("MousePointer2")
  }Select</button><button id="pan-tool" title="Pan (H)">${
    icon("Hand")
  }Pan</button><button id="delete" class="icon-button" aria-label="Delete selection" title="Delete selection (Backspace)">${
    icon("Trash2")
  }</button><button id="duplicate" class="icon-button" aria-label="Duplicate selection" title="Duplicate (⌘/Ctrl+D)">${
    icon("Copy")
  }</button></div><div class="zoom-tools"><button id="zoom-out" class="icon-button" aria-label="Zoom out">${
    icon("Minus")
  }</button><span id="zoom-label">100%</span><button id="zoom-in" class="icon-button" aria-label="Zoom in">${
    icon("Plus")
  }</button><button id="fit" class="icon-button" aria-label="Fit circuit" title="Fit circuit (F)">${
    icon("Scan")
  }</button></div></div>
<div class="board-wrap"><svg id="board" tabindex="0" aria-label="Circuit canvas. Click components to select, input blocks to toggle, and pins to connect. Space and drag to pan." xmlns="http://www.w3.org/2000/svg"><defs><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r="1" fill="#d9dfd0"/></pattern></defs><rect id="grid-background" fill="url(#grid)"/><g id="drawing"></g><g id="preview" aria-hidden="true"></g></svg><div id="empty" hidden><h2>Empty circuit</h2><p>Choose a component, then click the canvas.</p><button class="text-button" data-example="half-adder">Open half adder ${
    icon("ArrowUpRight")
  }</button></div></div><div class="canvas-footer"><span id="hint">Click an input to toggle it. Connect an output pin to an input pin.</span><span>20 px grid</span></div></section>
<aside class="inspector"><div class="tabs" role="tablist" aria-label="Circuit details"><button id="inspect-tab" role="tab" aria-selected="true" aria-controls="details">Selection</button><button id="truth-tab" role="tab" aria-selected="false" aria-controls="details">Truth table</button></div><div id="details" role="tabpanel"></div></aside></div><footer class="statusbar"><span id="save-state"></span><span id="counts"></span><span id="simulation-state"></span><button id="details-toggle" title="Show or hide inspector">${
    icon("PanelRight")
  }</button></footer></main></div>
<input id="file-input" type="file" accept=".literal,.json,application/json" hidden><dialog id="dialog"><div class="dialog-heading"><h2 id="dialog-title"></h2><button id="close-dialog" class="icon-button" aria-label="Close dialog">${
    icon("X")
  }</button></div><div id="dialog-body"></div></dialog><div id="toast" role="status" aria-live="polite"></div>`;
const board = $<SVGSVGElement>("#board"), drawing = $("#drawing");
let panMode = false;
function notify(message: string) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  setTimeout(() => $("#toast").classList.remove("visible"), 3500);
}
function persist() {
  try {
    localStorage.setItem("literal.circuit", JSON.stringify(circuit));
    $("#save-state").textContent = "✓ Saved in this browser";
  } catch {
    $("#save-state").textContent =
      "Autosave unavailable · download to keep your circuit";
  }
}
function evaluate() {
  sim = simulate(circuit, memory);
  memory = sim.memory;
}
function remember(before: Circuit) {
  if (JSON.stringify(before) === JSON.stringify(circuit)) return;
  undo.push(before);
  if (undo.length > 100) undo.shift();
  redo = [];
}
function mutate(action: () => void) {
  const before = clone(circuit);
  action();
  remember(before);
  evaluate();
  persist();
  render();
}
function stop() {
  if (running) clearInterval(running);
  running = null;
}
function load(next: Circuit) {
  stop();
  const before = clone(circuit);
  circuit = clone(next);
  remember(before);
  memory = { q: {}, clock: {} };
  selected.clear();
  placement = null;
  wiring = null;
  evaluate();
  persist();
  render();
  fit();
}
function bounds() {
  const r = board.getBoundingClientRect();
  return { width: r.width, height: r.height };
}
function world(e: { clientX: number; clientY: number }): Point {
  const r = board.getBoundingClientRect();
  return {
    x: camera.x + (e.clientX - r.left) / camera.zoom,
    y: camera.y + (e.clientY - r.top) / camera.zoom,
  };
}
const snap = (v: number) =>
  Math.max(-100000, Math.min(100000, Math.round(v / 20) * 20));
function view() {
  const { width, height } = bounds();
  board.setAttribute(
    "viewBox",
    `${camera.x} ${camera.y} ${width / camera.zoom} ${height / camera.zoom}`,
  );
  const bg = $("#grid-background");
  for (
    const [k, v] of Object.entries({
      x: camera.x,
      y: camera.y,
      width: width / camera.zoom,
      height: height / camera.zoom,
    })
  ) bg.setAttribute(k, String(v));
  for (const target of board.querySelectorAll(".pin-target")) {
    const halfHeight = Math.min(11, 12 / camera.zoom);
    target.setAttribute("x", String(-12 / camera.zoom));
    target.setAttribute("y", String(-halfHeight));
    target.setAttribute("width", String(24 / camera.zoom));
    target.setAttribute("height", String(halfHeight * 2));
  }
  $("#zoom-label").textContent = `${Math.round(camera.zoom * 100)}%`;
}
function fit() {
  const { width, height } = bounds();
  if (!width || !height) return;
  if (!circuit.components.length) {
    camera = { x: 0, y: 0, zoom: 1 };
    view();
    return;
  }
  const xs = circuit.components.map((c) => c.x),
    ys = circuit.components.map((c) => c.y);
  const left = Math.min(...xs) - 100,
    top = Math.min(...ys) - 100,
    w = Math.max(...xs) - left + 100,
    h = Math.max(...ys) - top + 100;
  camera.zoom = Math.max(.25, Math.min(1.3, width / w, height / h));
  camera.x = left - (width / camera.zoom - w) / 2;
  camera.y = top - (height / camera.zoom - h) / 2;
  view();
}
function zoom(factor: number, at?: Point) {
  const { width, height } = bounds();
  const center = at ??
    {
      x: camera.x + width / camera.zoom / 2,
      y: camera.y + height / camera.zoom / 2,
    };
  const old = camera.zoom;
  camera.zoom = Math.max(.25, Math.min(2.5, old * factor));
  camera.x = center.x - (center.x - camera.x) * old / camera.zoom;
  camera.y = center.y - (center.y - camera.y) * old / camera.zoom;
  view();
}
function renderBoard() {
  drawing.innerHTML = draw(circuit, sim, selected, wiring);
  $("#empty").hidden = circuit.components.length > 0;
  view();
  renderPreview();
}
function renderPreview() {
  const group = $("#preview");
  group.innerHTML = "";
  if (!pointer) return;
  if (wiring) {
    const c = circuit.components.find((c) => c.id === wiring!.id);
    if (c) {
      const from = pin(c, wiring.port);
      group.innerHTML = `<path class="wire-preview" d="${
        path(from, pointer)
      }"/>`;
    }
  } else if (placement) {
    group.innerHTML = `<rect class="placement-preview" x="${
      snap(pointer.x) - 36
    }" y="${
      snap(pointer.y) - 30
    }" width="72" height="60" rx="6"/><text class="placement-label" x="${
      snap(pointer.x)
    }" y="${snap(pointer.y) + 5}">${placement}</text>`;
  }
}
function render() {
  const active = document.activeElement as HTMLElement | null;
  const node = active?.closest<HTMLElement>(".component")?.dataset.node;
  const focusPin = active?.dataset.pin;
  const row = active?.dataset.row;
  $("#place-center").hidden = !placement;
  $("#circuit-name").textContent = circuit.name;
  $("#undo").toggleAttribute("disabled", !undo.length);
  $("#redo").toggleAttribute("disabled", !redo.length);
  $("#delete").toggleAttribute("disabled", !selected.size);
  $("#duplicate").toggleAttribute(
    "disabled",
    !circuit.components.some((c) => selected.has(c.id)),
  );
  const clocks = circuit.components.some((c) => c.kind === "CLOCK");
  $("#step").toggleAttribute("disabled", !clocks);
  $("#run").toggleAttribute("disabled", !clocks);
  $("#run").innerHTML = running
    ? `${icon("Pause")}Pause clock`
    : `${icon("Play")}Run clock`;
  $("#counts").textContent =
    `${circuit.components.length} components · ${circuit.wires.length} wires`;
  $("#simulation-state").textContent = sim.warnings.length
    ? "Feedback detected"
    : running
    ? "Clock running · 2 Hz"
    : "Simulation live";
  $("#simulation-state").classList.toggle("warning", !!sim.warnings.length);
  $("#hint").textContent = wiring
    ? "Click the other pin to connect. Esc cancels."
    : placement
    ? `Click the canvas to place ${placement}. Esc returns to selection.`
    : panMode
    ? "Drag the canvas to pan. V returns to selection."
    : "Click inputs to toggle. Click two pins to wire. Space + drag to pan.";
  for (const b of document.querySelectorAll<HTMLElement>("[data-place]")) {
    b.classList.toggle("active", b.dataset.place === placement);
  }
  $("#select-tool").classList.toggle("active", !panMode && !placement);
  $("#pan-tool").classList.toggle("active", panMode);
  board.classList.toggle("placing", !!placement);
  board.classList.toggle("panning", panMode || space);
  renderBoard();
  renderDetails();
  if (node) {
    const group = document.querySelector(
      `[data-node="${CSS.escape(node)}"].component`,
    );
    (focusPin !== undefined
      ? group?.querySelector<HTMLElement>(`[data-pin="${focusPin}"]`)
      : group?.querySelector<HTMLElement>(".component-body"))?.focus({
        preventScroll: true,
      });
  }
  if (row) {
    document.querySelector<HTMLElement>(`[data-row="${row}"]`)?.focus({
      preventScroll: true,
    });
  }
}
function renderDetails() {
  if (
    $("#details").contains(document.activeElement) &&
    document.activeElement?.matches("input")
  ) return;
  $("#inspect-tab").setAttribute("aria-selected", String(tab === "inspect"));
  $("#truth-tab").setAttribute("aria-selected", String(tab === "truth"));
  if (tab === "truth") {
    try {
      const table = truthTable(circuit);
      const heads = [...table.inputs, ...table.outputs];
      $("#details").innerHTML =
        `<div class="detail-heading"><h2>Truth table</h2><button id="csv" class="icon-button" aria-label="Download truth table CSV">${
          icon("Download")
        }</button></div><p class="muted">${table.rows.length} combinations · click a row to apply inputs</p><div class="table-scroll"><table><thead><tr>${
          heads.map((c) => `<th>${esc(c.label)}</th>`).join("")
        }</tr></thead><tbody>${
          table.rows.map((row, i) =>
            `<tr tabindex="0" data-row="${i}" class="${
              row.inputs.every((v, j) => table.inputs[j].value === v)
                ? "current"
                : ""
            }" aria-label="Apply inputs ${row.inputs.join(", ")}">${
              [...row.inputs, ...row.outputs].map((v) =>
                `<td class="${
                  v === 1 ? "high-cell" : v === "X" ? "unknown-cell" : ""
                }">${v}</td>`
              ).join("")
            }</tr>`
          ).join("")
        }</tbody></table></div>`;
    } catch (e) {
      $("#details").innerHTML = `<h2>Truth table</h2><p class="muted">${
        esc((e as Error).message)
      }</p>`;
    }
    return;
  }
  const nodes = circuit.components.filter((c) => selected.has(c.id));
  const wires = circuit.wires.filter((w) => selected.has(w.id));
  if (nodes.length === 1 && wires.length === 0) {
    const c = nodes[0];
    $("#details").innerHTML = `<div class="detail-heading"><h2>${
      c.kind === "DFF" ? "D flip-flop" : c.kind
    }</h2><span class="signal-badge ${sim.values[c.id] === 1 ? "on" : ""}">${
      sim.values[c.id]
    }</span></div><p class="muted">${
      descriptions[c.kind]
    }</p><label class="field">Label<input id="component-label" value="${
      esc(c.label)
    }" maxlength="80"></label><div class="position-fields"><label class="field">X<input id="component-x" type="number" step="20" value="${c.x}" min="-100000" max="100000"></label><label class="field">Y<input id="component-y" type="number" step="20" value="${c.y}" min="-100000" max="100000"></label></div>${
      c.kind === "INPUT" || c.kind === "CLOCK"
        ? `<button id="toggle-value" class="wide-button">Toggle ${
          c.label ? esc(c.label) : "input"
        } · ${sim.values[c.id]} ${icon("ToggleRight")}</button>`
        : ""
    }<h3>Pins</h3><ul class="pin-list">${
      Array.from({ length: inputCount(c.kind) }, (_, i) => {
        const wire = circuit.wires.find((w) => w.to === c.id && w.port === i);
        const from = circuit.components.find((n) => n.id === wire?.from);
        return `<li><span>${
          c.kind === "DFF"
            ? i === 0 ? "Data" : "Clock"
            : c.kind === "MUX"
            ? ["Data 0", "Data 1", "Select"][i]
            : `Input ${i + 1}`
        }</span><span>${sim.inputs[c.id]?.[i] ?? "X"} · ${
          from ? esc(from.label) : "unconnected"
        }</span></li>`;
      }).join("")
    }${
      hasOutput(c.kind)
        ? `<li><span>Output</span><span>${sim.values[c.id]} · ${
          circuit.wires.filter((w) => w.from === c.id).length
        } connections</span></li>`
        : ""
    }</ul><button id="delete-detail" class="danger text-button">Delete component ${
      icon("Trash2")
    }</button>`;
  } else if (wires.length === 1 && !nodes.length) {
    const wire = wires[0],
      from = circuit.components.find((c) => c.id === wire.from)!,
      to = circuit.components.find((c) => c.id === wire.to)!;
    $("#details").innerHTML = `<h2>Connection</h2><p>${esc(from.label)} → ${
      esc(to.label)
    } input ${wire.port + 1}</p><p class="muted">Signal: ${
      sim.values[wire.from]
    }</p><button id="delete-detail" class="danger text-button">Delete wire ${
      icon("Trash2")
    }</button>`;
  } else if (selected.size) {
    $("#details").innerHTML =
      `<h2>${selected.size} selected</h2><p class="muted">${nodes.length} components · ${wires.length} wires</p><button id="duplicate-detail" class="wide-button">Duplicate ${
        icon("Copy")
      }</button><button id="delete-detail" class="danger text-button">Delete selection ${
        icon("Trash2")
      }</button>`;
  } else {$("#details").innerHTML = `<h2>${
      esc(circuit.name)
    }</h2><p class="muted">Select a component or wire to inspect it.</p><h3>Signals</h3><div class="legend"><span><i class="high-dot"></i>1 · High</span><span><i class="low-dot"></i>0 · Low</span><span><i class="unknown-dot"></i>X · Unconnected / unknown</span></div><h3>Controls</h3><ul class="instructions"><li>Choose a component and click the canvas.</li><li>Drag components to move them.</li><li>Click an output pin, then an input pin.</li><li>Click input blocks to toggle signals.</li><li>Shift-click or drag a box to select more.</li><li>Wheel to zoom. Space + drag to pan.</li></ul>`;}
  if (sim.warnings.length) {
    $("#details").insertAdjacentHTML(
      "beforeend",
      `<p class="diagnostic">${sim.warnings.map(esc).join("<br>")}</p>`,
    );
  }
}
function deleteSelection() {
  if (!selected.size) return;
  mutate(() => {
    circuit.components = circuit.components.filter((c) => !selected.has(c.id));
    circuit.wires = circuit.wires.filter((w) =>
      !selected.has(w.id) && !selected.has(w.from) && !selected.has(w.to)
    );
    selected.clear();
    wiring = null;
  });
}
function copySelection() {
  const nodes = circuit.components.filter((c) => selected.has(c.id));
  if (!nodes.length) return;
  const ids = new Set(nodes.map((n) => n.id));
  clipboard = clone({
    version: 1,
    name: "Clipboard",
    components: nodes,
    wires: circuit.wires.filter((w) => ids.has(w.from) && ids.has(w.to)),
  });
  pasted = 0;
}
function pasteSelection() {
  if (!clipboard) return;
  if (
    circuit.components.length + clipboard.components.length > 500 ||
    circuit.wires.length + clipboard.wires.length > 2000
  ) {
    notify("Limit: 500 components and 2,000 wires.");
    return;
  }
  mutate(() => {
    pasted++;
    const ids = new Map(clipboard!.components.map((c) => [c.id, uid()]));
    const nodes = clipboard!.components.map((c) => ({
      ...c,
      id: ids.get(c.id)!,
      x: snap(c.x + 40 * pasted),
      y: snap(c.y + 40 * pasted),
    }));
    const wires = clipboard!.wires.map((w) => ({
      ...w,
      id: uid(),
      from: ids.get(w.from)!,
      to: ids.get(w.to)!,
    }));
    circuit.components.push(...nodes);
    circuit.wires.push(...wires);
    selected = new Set(nodes.map((c) => c.id));
  });
}
function duplicateSelection() {
  copySelection();
  pasteSelection();
}
function tick() {
  for (const c of circuit.components) {
    if (c.kind === "CLOCK") c.value = c.value === 1 ? 0 : 1;
  }
  evaluate();
  persist();
  render();
}
function toggle(c: Component) {
  mutate(() => c.value = c.value === 1 ? 0 : 1);
}
function connectPin(id: string, port: number) {
  placement = null;
  panMode = false;
  if (!wiring) {
    wiring = { id, port };
    render();
    return;
  }
  if (wiring.id === id && wiring.port === port) {
    wiring = null;
    render();
    return;
  }
  if ((wiring.port < 0) === (port < 0)) {
    notify("Connect one output pin to one input pin.");
    return;
  }
  const from = port < 0 ? id : wiring.id,
    to = port < 0 ? wiring.id : id,
    input = port < 0 ? wiring.port : port;
  try {
    mutate(() => {
      circuit = connect(circuit, from, to, input, uid());
      wiring = null;
    });
    board.focus();
  } catch (e) {
    notify((e as Error).message);
  }
}
function download(name: string, data: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function dialog(title: string, content: string) {
  $("#dialog-title").textContent = title;
  $("#dialog-body").innerHTML = content;
  $<HTMLDialogElement>("#dialog").showModal();
}
function rename() {
  dialog(
    "Rename circuit",
    `<form id="rename-form"><label class="field">Name<input id="new-name" maxlength="100" value="${
      esc(circuit.name)
    }" required></label><button class="primary" type="submit">Save name</button></form>`,
  );
  $("#new-name").focus();
}
function history(direction: "undo" | "redo") {
  stop();
  const source = direction === "undo" ? undo : redo,
    target = direction === "undo" ? redo : undo;
  const next = source.pop();
  if (!next) return;
  target.push(clone(circuit));
  circuit = next;
  selected.clear();
  wiring = null;
  memory = { q: {}, clock: {} };
  evaluate();
  persist();
  render();
}
function selectTool() {
  placement = null;
  wiring = null;
  panMode = false;
  render();
}
$("#app").addEventListener("click", (e) => {
  const target = e.target as Element,
    b = target.closest<HTMLElement>("button,[data-example],.pin,.wire");
  if (!b) return;
  if (b.dataset.place) {
    placement = b.dataset.place as Kind;
    if (matchMedia("(max-width: 650px)").matches) {
      $(".shell").classList.remove("hide-library");
    }
    wiring = null;
    panMode = false;
    render();
    return;
  }
  if (b.dataset.example) {
    $<HTMLDialogElement>("#dialog").close();
    load(examples.find((x) => x.id === b.dataset.example)!.circuit);
    return;
  }
  if (b.classList.contains("pin")) {
    connectPin(b.dataset.node!, Number(b.dataset.pin));
    return;
  }
  if (b.classList.contains("wire")) {
    if (!e.shiftKey) selected.clear();
    selected.add(b.dataset.wire!);
    render();
    return;
  }
  const actions: Record<string, () => void> = {
    "examples-button": () =>
      dialog(
        "Example circuits",
        `<div class="example-dialog">${
          examples.map((e) =>
            `<button aria-label="Load example ${e.name}" data-example="${e.id}"><strong>${e.name}</strong><span>${e.description}</span></button>`
          ).join("")
        }</div>`,
      ),
    new: () => load(blank()),
    open: () => $<HTMLInputElement>("#file-input").click(),
    save: () =>
      download(
        `${circuit.name.replace(/[^a-z0-9_-]/gi, "-") || "circuit"}.literal`,
        JSON.stringify(circuit, null, 2),
      ),
    undo: () => history("undo"),
    redo: () => history("redo"),
    "place-center": () => {
      const { width, height } = bounds();
      place({
        x: camera.x + width / camera.zoom / 2,
        y: camera.y + height / camera.zoom / 2,
      });
    },
    "name-button": rename,
    step: tick,
    run: () => {
      if (running) stop();
      else running = setInterval(tick, 250);
      render();
    },
    reset: () => {
      stop();
      memory = { q: {}, clock: {} };
      for (const c of circuit.components) if (c.kind === "CLOCK") c.value = 0;
      evaluate();
      persist();
      render();
    },
    delete: deleteSelection,
    "delete-detail": deleteSelection,
    duplicate: duplicateSelection,
    "duplicate-detail": duplicateSelection,
    "select-tool": selectTool,
    "pan-tool": () => {
      placement = null;
      wiring = null;
      panMode = true;
      render();
    },
    "toggle-value": () => {
      const c = circuit.components.find((c) => selected.has(c.id));
      if (c) toggle(c);
    },
    "zoom-in": () => zoom(1.2),
    "zoom-out": () => zoom(1 / 1.2),
    fit,
    "inspect-tab": () => {
      tab = "inspect";
      renderDetails();
    },
    "truth-tab": () => {
      tab = "truth";
      renderDetails();
    },
    "details-toggle": () => {
      $(".shell").classList.toggle("hide-inspector");
      view();
    },
    "library-toggle": () => {
      $(".shell").classList.toggle("hide-library");
      view();
    },
    "close-dialog": () => $<HTMLDialogElement>("#dialog").close(),
    csv: () => {
      const t = truthTable(circuit);
      const quote = (s: string) => `"${s.replaceAll('"', '""')}"`;
      download(
        "truth-table.csv",
        [
          [...t.inputs, ...t.outputs].map((c) => quote(c.label)).join(","),
          ...t.rows.map((r) => [...r.inputs, ...r.outputs].join(",")),
        ].join("\n"),
        "text/csv",
      );
    },
    help: () =>
      dialog(
        "Reference",
        `<h3>Draw a circuit</h3><p>Pick a component from the library, then click the canvas. Esc returns to selection. Components snap to the 20 px grid.</p><p>Click two pins to connect them: one output and one input. Outputs can drive several inputs. Each input accepts one wire. A wire crossing is visual; it does not join the wires.</p><h3>Simulate</h3><p>Click an input block to switch between 0 and 1. Signals propagate immediately. Step toggles each clock; Run clock alternates the clock at 2 Hz. D flip-flops sample on a rising edge and start at 0. Reset clears flip-flop state and resets clocks to 0.</p><p>X means an unconnected or unknown signal. Combinational feedback is reported. Use flip-flops for stored state. These circuits are single-bit; buses and Logisim .circ files are not supported.</p><h3>Files and keyboard</h3><p>The current circuit is saved in this browser. Save downloads a .literal JSON file. Open imports a saved circuit. Simulation memory is reset when opening, undoing, or reloading.</p><p>⌘/Ctrl+Z undo · Shift+⌘/Ctrl+Z redo · ⌘/Ctrl+C/V copy/paste · ⌘/Ctrl+D duplicate · ⌘/Ctrl+S save · ⌘/Ctrl+O open · Delete removes selection · V select · H pan · F fit · Esc cancel. Arrow keys move selected components by one grid step; Shift moves five steps.</p><p>Keyboard users can select components and pins with Tab, then press Enter. To place without a pointer, use the Place at center button after choosing a component.</p>`,
      ),
  };
  actions[b.id]?.();
});
$("#details").addEventListener("change", (e) => {
  const field = e.target as HTMLInputElement,
    c = circuit.components.find((c) => selected.has(c.id));
  if (!c) return;
  if (field.id === "component-label") {
    mutate(() => c.label = field.value.slice(0, 80));
  } else if (field.id === "component-x" || field.id === "component-y") {
    const value = Number(field.value);
    if (!Number.isFinite(value) || Math.abs(value) > 100000) {
      renderDetails();
      return;
    }
    mutate(() => c[field.id === "component-x" ? "x" : "y"] = snap(value));
  }
});
function applyRow(row: HTMLElement) {
  try {
    const t = truthTable(circuit), r = t.rows[Number(row.dataset.row)];
    mutate(() => t.inputs.forEach((c, i) => c.value = r.inputs[i]));
  } catch (e) {
    notify((e as Error).message);
  }
}
$("#details").addEventListener("click", (e) => {
  const row = (e.target as Element).closest<HTMLElement>("[data-row]");
  if (row) applyRow(row);
});
$("#details").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const row = (e.target as Element).closest<HTMLElement>("[data-row]");
    if (row) applyRow(row);
  }
});
$("#close-dialog").addEventListener(
  "click",
  () => $<HTMLDialogElement>("#dialog").close(),
);
$("#dialog-body").addEventListener("click", (e) => {
  const button = (e.target as Element).closest<HTMLElement>("[data-example]");
  if (button) {
    $<HTMLDialogElement>("#dialog").close();
    load(examples.find((x) => x.id === button.dataset.example)!.circuit);
  }
});
$("#dialog-body").addEventListener("submit", (e) => {
  e.preventDefault();
  if ((e.target as Element).id === "rename-form") {
    const name = $<HTMLInputElement>("#new-name").value.trim();
    if (name) {
      mutate(() => circuit.name = name);
      $<HTMLDialogElement>("#dialog").close();
    }
  }
});
$("#file-input").addEventListener("change", async (e) => {
  const input = e.target as HTMLInputElement, file = input.files?.[0];
  if (!file) return;
  try {
    if (file.size > 2_000_000) throw Error("Circuit file exceeds 2 MB.");
    load(parseCircuit(await file.text()));
    notify(`Opened ${circuit.name}`);
  } catch (error) {
    notify((error as Error).message);
  }
  input.value = "";
});
function place(p: Point) {
  if (!placement) return;
  if (circuit.components.length >= 500) {
    notify("Limit: 500 components.");
    return;
  }
  mutate(() => {
    const c: Component = {
      id: uid(),
      kind: placement!,
      x: snap(p.x),
      y: snap(p.y),
      label: placement!,
      ...(["INPUT", "CLOCK"].includes(placement!) ? { value: 0 as const } : {}),
    };
    circuit.components.push(c);
    selected = new Set([c.id]);
  });
}
board.addEventListener("pointerdown", (e) => {
  if (e.button !== 0 && e.button !== 1) return;
  const target = e.target as Element;
  if (target.closest(".pin,.wire")) return;
  const p = world(e);
  pointer = p;
  if (placement) {
    place(p);
    return;
  }
  const c = target.closest<SVGGElement>(".component");
  const id = c?.dataset.node;
  const type = panMode || space || e.button === 1
    ? "pan"
    : id
    ? "nodes"
    : "box";
  if (type === "nodes" && id) {
    if (e.shiftKey) {
      if (selected.has(id)) selected.delete(id);
      else selected.add(id);
    } else if (!selected.has(id)) selected = new Set([id]);
  }
  if (type === "box" && !e.shiftKey) selected.clear();
  drag = {
    type,
    start: p,
    screen: { x: e.clientX, y: e.clientY },
    before: clone(circuit),
    positions: new Map(
      circuit.components.filter((c) => selected.has(c.id)).map(
        (c) => [c.id, { x: c.x, y: c.y }],
      ),
    ),
    moved: false,
    additive: e.shiftKey,
  };
  board.setPointerCapture(e.pointerId);
  e.preventDefault();
  render();
});
board.addEventListener("pointermove", (e) => {
  pointer = world(e);
  if (!drag) {
    renderPreview();
    return;
  }
  const dx = e.clientX - drag.screen.x, dy = e.clientY - drag.screen.y;
  if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
  if (drag.type === "pan") {
    camera.x -= (e.clientX - drag.screen.x) / camera.zoom;
    camera.y -= (e.clientY - drag.screen.y) / camera.zoom;
    drag.screen = { x: e.clientX, y: e.clientY };
    view();
  } else if (drag.type === "nodes") {
    for (const c of circuit.components) {
      const start = drag.positions.get(c.id);
      if (start) {
        c.x = snap(start.x + dx / camera.zoom);
        c.y = snap(start.y + dy / camera.zoom);
      }
    }
    renderBoard();
  } else {
    const x = Math.min(pointer.x, drag.start.x),
      y = Math.min(pointer.y, drag.start.y);
    $("#preview").innerHTML = `<rect class="marquee" x="${x}" y="${y}" width="${
      Math.abs(pointer.x - drag.start.x)
    }" height="${Math.abs(pointer.y - drag.start.y)}"/>`;
  }
});
function endDrag(e: PointerEvent, cancel = false) {
  if (!drag) return;
  const d = drag;
  drag = null;
  if (board.hasPointerCapture(e.pointerId)) {
    board.releasePointerCapture(e.pointerId);
  }
  if (cancel) {
    circuit = d.before;
    evaluate();
  } else if (d.type === "nodes") {
    if (d.moved) {
      remember(d.before);
      persist();
    } else if (!d.additive && d.positions.size === 1) {
      const c = circuit.components.find((c) => d.positions.has(c.id));
      if (c && (c.kind === "INPUT" || c.kind === "CLOCK")) {
        toggle(c);
        return;
      }
    }
  } else if (d.type === "box" && d.moved) {
    const p = world(e);
    for (const c of circuit.components) {
      if (
        c.x >= Math.min(p.x, d.start.x) && c.x <= Math.max(p.x, d.start.x) &&
        c.y >= Math.min(p.y, d.start.y) && c.y <= Math.max(p.y, d.start.y)
      ) selected.add(c.id);
    }
  }
  render();
}
board.addEventListener("pointerup", (e) => endDrag(e));
board.addEventListener("pointercancel", (e) => endDrag(e, true));
board.addEventListener("pointerleave", () => {
  if (!drag) {
    pointer = null;
    renderPreview();
  }
});
board.addEventListener("wheel", (e) => {
  e.preventDefault();
  if (e.shiftKey) {
    camera.x += e.deltaY / camera.zoom;
    camera.y += e.deltaX / camera.zoom;
    view();
  } else zoom(Math.exp(-e.deltaY * .0015), world(e));
}, { passive: false });
board.addEventListener("keydown", (e) => {
  const target = e.target as Element;
  if (e.key === "Enter" && target.classList.contains("pin")) {
    e.preventDefault();
    connectPin(
      (target as HTMLElement).dataset.node!,
      Number((target as HTMLElement).dataset.pin),
    );
  } else if (e.key === "Enter" && target.classList.contains("component-body")) {
    const id = (target.closest(".component") as HTMLElement).dataset.node!;
    selected = new Set([id]);
    const c = circuit.components.find((c) => c.id === id)!;
    if (c.kind === "INPUT" || c.kind === "CLOCK") toggle(c);
    else render();
  }
});
document.addEventListener("keydown", (e) => {
  const target = e.target as Element;
  if (target.closest("input,textarea,select,dialog")) return;
  const mod = e.metaKey || e.ctrlKey, key = e.key.toLowerCase();
  if (mod && ["z", "y", "s", "o", "a", "c", "v", "d"].includes(key)) {
    e.preventDefault();
    if (key === "z") history(e.shiftKey ? "redo" : "undo");
    else if (key === "y") history("redo");
    else if (key === "s") $("#save").click();
    else if (key === "o") $("#open").click();
    else if (key === "a") {
      selected = new Set(circuit.components.map((c) => c.id));
      render();
    } else if (key === "c") copySelection();
    else if (key === "v") pasteSelection();
    else duplicateSelection();
    return;
  }
  if (e.key === "Escape") {
    selectTool();
    return;
  }
  if (e.key === " " && !target.closest("button,a,[role=tab]")) {
    e.preventDefault();
    space = true;
    board.classList.add("panning");
  } else if (key === "v") selectTool();
  else if (key === "h") {
    panMode = true;
    render();
  } else if (key === "f") fit();
  else if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    deleteSelection();
  } else if (e.key.startsWith("Arrow") && selected.size) {
    e.preventDefault();
    const step = e.shiftKey ? 100 : 20;
    mutate(() => {
      for (const c of circuit.components) {
        if (selected.has(c.id)) {
          if (e.key === "ArrowLeft") c.x = snap(c.x - step);
          if (e.key === "ArrowRight") c.x = snap(c.x + step);
          if (e.key === "ArrowUp") c.y = snap(c.y - step);
          if (e.key === "ArrowDown") c.y = snap(c.y + step);
        }
      }
    });
  }
});
document.addEventListener("keyup", (e) => {
  if (e.key === " ") {
    space = false;
    board.classList.toggle("panning", panMode);
  }
});
window.addEventListener("blur", () => {
  space = false;
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stop();
    render();
  }
});
new ResizeObserver(view).observe(board);
persist();
render();
requestAnimationFrame(fit);
if (storageWarning) notify(storageWarning);
