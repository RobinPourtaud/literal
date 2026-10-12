import { checkLabAsync } from "./lab-check.ts";
import { insideBounds, inspectCircuit } from "./inside.ts";
import { componentHelp, descriptions } from "./component-info.ts";
import { courses, courseState } from "./discover.ts";
import {
  checkLab,
  labGateMembers,
  type LabReport,
  labStarter,
  solutions,
  targetImage,
} from "./curriculum.ts";
import {
  assemble,
  type Circuit,
  type Component,
  componentInputLabel,
  componentInputs,
  componentOutputLabel,
  componentOutputs,
  computerCircuit,
  connect,
  createDefinition,
  type Definition,
  definitionOf,
  hasOutput,
  hexValue,
  inputCount,
  inputLabel,
  keyboardCode,
  type KeyboardState,
  type Kind,
  type Memory,
  parseCircuit,
  programGateMemory,
  screenColors,
  screenWidth,
  simulate,
  type Simulation,
  stepGateInstruction,
  transistorCircuit,
  truthTable,
  virtualKeys,
} from "@literal/core";
import {
  ArrowUpRight,
  ChevronRight,
  Copy,
  createElement,
  Download,
  FilePlus,
  FolderOpen,
  Github,
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
import { dimensions, draw, esc, path, pin, type Point } from "./drawing.ts";
import "./style.css";

import { createAgentAPI } from "./agent-api.ts";
import { openKarnaugh } from "./karnaugh-ui.ts";
const $ = <T extends Element = HTMLElement>(selector: string): T =>
  document.querySelector<T>(selector)!;
const icons = {
  ArrowUpRight,
  ChevronRight,
  Copy,
  Download,
  FilePlus,
  FolderOpen,
  Github,
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
let mode: "discover" | "playground" =
  localStorage.getItem("literal.mode") === "discover"
    ? "discover"
    : "playground";
const discovered = new Set<string>();
try {
  const saved = JSON.parse(localStorage.getItem("literal.discovered") ?? "[]");
  if (Array.isArray(saved)) {
    saved.filter((id) => typeof id === "string").forEach((id) =>
      discovered.add(id)
    );
  }
} catch {}
let courseIndex = Math.max(
  0,
  courses.findIndex((c) => c.id === localStorage.getItem("literal.course")),
);
let freeBuild = localStorage.getItem("literal.course") === "free";
let lessonStep = Math.max(
  0,
  Math.min(
    courses[courseIndex].steps.length - 1,
    Math.floor(
      Number(
        localStorage.getItem(`literal.lessonStep.${courses[courseIndex].id}`) ??
          localStorage.getItem("literal.lessonStep"),
      ) || 0,
    ),
  ),
);
const completedCourses = new Set<string>();
try {
  const ids = JSON.parse(
    localStorage.getItem("literal.completedCourses") ?? "[]",
  );
  if (Array.isArray(ids)) {
    ids.filter((id) => courses.some((c) => c.id === id && c.lab)).forEach((
      id,
    ) => completedCourses.add(id));
  }
} catch {}
let labReport: LabReport | undefined;
let labReportCircuit = "";
let checkingLab = false;
const testedGateInputs = new Set<string>();
function restoreCourseTests() {
  testedGateInputs.clear();
  if (freeBuild) return;
  try {
    const saved = JSON.parse(
      localStorage.getItem(`literal.courseTests.${courses[courseIndex].id}`) ??
        "[]",
    );
    if (Array.isArray(saved)) {
      saved.slice(-128).forEach((value) => {
        if (typeof value === "string" && value.length < 20000) {
          testedGateInputs.add(value);
        }
      });
    }
  } catch {}
}
restoreCourseTests();
let pins = new Set<string>();
let memory: Memory = { q: {}, clock: {} };
let keyboards: Record<string, KeyboardState> = {};
let capturedKeyboard: string | null = null;
let mappingKeyboard: string | null = null;
let mappingValue = "A";
const heldKeys = new Map<string, number>();
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
let clockHz = Math.max(
  0.1,
  Math.min(10000, Number(localStorage.getItem("literal.clockHz")) || 500),
);
const activeClocks = new Map<
  string,
  {
    last: number;
    measuredAt: number;
    credit: number;
    edges: number;
    actual: number;
  }
>();
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
let placementDefinition: string | null = null;
let library: Definition[] = [];
try {
  const saved = localStorage.getItem("literal.library");
  if (saved) {
    library = parseCircuit(
      JSON.stringify({
        version: 1,
        name: "Library",
        components: [],
        wires: [],
        definitions: JSON.parse(saved),
      }),
    ).definitions ?? [];
  }
} catch {
  storageWarning = "The custom component library could not be loaded.";
}
function retainDefinitions() {
  for (const def of circuit.definitions ?? []) {
    if (!library.some((d) => d.id === def.id)) library.push(clone(def));
  }
  try {
    localStorage.setItem("literal.library", JSON.stringify(library));
  } catch {
    notify(
      "Component library could not be saved. Download your circuit to keep its definitions.",
    );
  }
}
const groups: { name: string; kinds: Kind[] }[] = [
  {
    name: "ELECTRICITY",
    kinds: ["POWER", "GROUND", "NMOS", "PMOS", "JUNCTION"],
  },
  {
    name: "COMPUTER DEVICES",
    kinds: [
      "BUS_CPU",
      "BUS_ROM",
      "BUS_RAM",
      "BUS_SCREEN",
      "BUS_KEYBOARD",
      "BUS_TERMINAL",
    ],
  },
  {
    name: "INPUT / OUTPUT",
    kinds: ["INPUT", "CLOCK", "KEYBOARD"],
  },
  {
    name: "OUTPUTS",
    kinds: ["OUTPUT", "LED", "SEVEN_SEG", "HEX_DISPLAY", "VGA"],
  },
  {
    name: "GATES",
    kinds: ["AND", "OR", "NOT", "NAND", "NOR", "XOR", "XNOR", "BUFFER"],
  },
  {
    name: "STATE / ROUTING",
    kinds: ["DFF", "MUX", "REGISTER8", "COUNTER8", "ADDER8", "RAM", "ROM"],
  },
];
$("#app").innerHTML =
  `<header class="topbar"><a class="brand" href="#" aria-label="Literal home"><img src="/mark.svg" width="36" height="36" alt=""><strong>Literal</strong><span>logic circuits</span></a><nav><button id="library-toggle">${
    icon("PanelLeft")
  }<span>Components</span></button><button id="mode-button">Playground</button><button id="karnaugh-tool">Karnaugh</button><button id="help">Reference</button></nav><a class="source-link" href="https://github.com/RobinPourtaud/literal" target="_blank" rel="noopener" aria-label="Literal on GitHub" title="GitHub">${
    icon("Github")
  }</a></header>
<div class="shell"><aside class="library"><div class="library-scroll"><div class="sidebar-title">COMPONENTS</div><section class="custom-library"><h2>CUSTOM</h2><button id="create-custom">+ Create component</button><div id="custom-items"></div></section>${
    groups.map((g) =>
      `<section class="palette-group"><h2>${g.name}</h2>${
        g.kinds.map((k) =>
          `<div class="palette-entry"><button class="palette-item" data-place="${k}" title="${
            descriptions[k]
          }"><span class="gate-symbol">${
            ({
              NMOS: "n",
              PMOS: "p",
              POWER: "+",
              GROUND: "−",
              JUNCTION: "⊙",
              BUS_CPU: "C",
              BUS_ROM: "R",
              BUS_RAM: "M",
              BUS_SCREEN: "▣",
              BUS_KEYBOARD: "⌨",
              BUS_TERMINAL: "T",
              INPUT: "↗",
              OUTPUT: "◉",
              LED: "●",
              SEVEN_SEG: "8",
              HEX_DISPLAY: "F",
              VGA: "▣",
              KEYBOARD: "⌨",
              REGISTER8: "R",
              COUNTER8: "+",
              ADDER8: "Σ",
              RAM: "M",
              ROM: "◆",
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
            k === "REGISTER8"
              ? "Register (8-bit)"
              : k === "COUNTER8"
              ? "Counter (8-bit)"
              : k === "ADDER8"
              ? "Adder (8-bit)"
              : k === "KEYBOARD"
              ? "Keyboard"
              : k === "VGA"
              ? "VGA screen"
              : k === "SEVEN_SEG"
              ? "7-segment"
              : k === "HEX_DISPLAY"
              ? "Hex display"
              : k === "LED"
              ? "LED"
              : k === "DFF"
              ? "D flip-flop"
              : k === "INPUT"
              ? "Input"
              : k === "OUTPUT"
              ? "Output"
              : k === "CLOCK"
              ? "Clock"
              : k === "BUFFER"
              ? "Buffer"
              : k.startsWith("BUS_")
              ? k.slice(4)
              : k
          }<span class="place-plus">+</span></button></div>`
        ).join("")
      }</section>`
    ).join("")
  }</div><a class="maker-credit" href="https://pourtaud.dev" target="_blank" rel="noopener">${robin}<span>Made by Robin Pourtaud</span></a></aside>
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
  }</button></div></div>
<div class="editor"><section class="board-panel" aria-label="Circuit editor"><section id="discover-guide" aria-label="Discover tutorial" hidden></section><div class="board-header"><div class="board-tools"><button id="place-center" hidden>Place at center</button><button id="select-tool" class="active" title="Select (V)">${
    icon("MousePointer2")
  }Select</button><button id="pan-tool" title="Pan (H)">${
    icon("Hand")
  }Pan</button><button id="delete" class="icon-button" aria-label="Delete selection" title="Delete selection (Backspace)">${
    icon("Trash2")
  }</button><button id="create-custom-tool" title="Save selection as a reusable component">Create component</button><button id="duplicate" class="icon-button" aria-label="Duplicate selection" title="Duplicate (⌘/Ctrl+D)">${
    icon("Copy")
  }</button></div><div class="zoom-tools"><button id="zoom-out" class="icon-button" aria-label="Zoom out">${
    icon("Minus")
  }</button><span id="zoom-label">100%</span><button id="zoom-in" class="icon-button" aria-label="Zoom in">${
    icon("Plus")
  }</button><button id="fit" class="icon-button" aria-label="Fit circuit" title="Fit circuit (F)">${
    icon("Scan")
  }</button><button id="details-toggle" class="icon-button" aria-label="Show or hide inspector" title="Show or hide inspector">${
    icon("PanelRight")
  }</button></div></div>
<div class="board-wrap"><svg id="board" tabindex="0" aria-label="Circuit canvas. Click components to select, input blocks to toggle, and pins to connect. Space and drag to pan." xmlns="http://www.w3.org/2000/svg"><defs><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r="1" fill="#d9dfd0"/></pattern></defs><rect id="grid-background" fill="url(#grid)"/><g id="drawing"></g><g id="preview" aria-hidden="true"></g></svg><div id="empty" hidden><h2>Empty circuit</h2><p>Choose a component, then click the canvas.</p><button class="text-button" data-example="half-adder">Open half adder ${
    icon("ArrowUpRight")
  }</button></div><div id="hint" class="canvas-hint" role="status" hidden></div></div></section>
<aside class="inspector"><div id="pinned-devices"></div><div class="tabs" role="tablist" aria-label="Circuit details"><button id="inspect-tab" role="tab" aria-selected="true" aria-controls="details">Selection</button><button id="truth-tab" role="tab" aria-selected="false" aria-controls="details">Truth table</button></div><div id="details" role="tabpanel"></div></aside></div></main></div>
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
    localStorage.setItem(
      mode === "discover" ? "literal.discover.circuit" : "literal.circuit",
      JSON.stringify(circuit),
    );
    if (mode === "discover") {
      localStorage.setItem(
        `literal.discover.course.${
          freeBuild ? "free" : courses[courseIndex].id
        }`,
        JSON.stringify(circuit),
      );
    }
  } catch {
    notify("Autosave unavailable · download to keep your circuit");
  }
}
function evaluate() {
  sim = simulate(circuit, memory, {}, keyboards);
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
function startClock(id: string) {
  const now = performance.now();
  activeClocks.set(id, {
    last: now,
    measuredAt: now,
    credit: 0,
    edges: 0,
    actual: 0,
  });
  if (running) return;
  running = setInterval(() => {
    const now = performance.now(), deadline = now + 12;
    for (const [id, state] of activeClocks) {
      const clock = circuit.components.find((c) =>
        c.id === id && c.kind === "CLOCK"
      );
      if (!clock) {
        activeClocks.delete(id);
        continue;
      }
      const hz = clock.frequency ?? clockHz;
      state.credit = Math.min(
        state.credit + (now - state.last) * hz * 2 / 1000,
        hz * 2,
      );
      state.last = now;
    }
    let changed = false, pending = true;
    while (pending && performance.now() < deadline) {
      pending = false;
      for (const [id, state] of activeClocks) {
        if (state.credit < 1) continue;
        const clock = circuit.components.find((c) => c.id === id)!;
        clock.value = clock.value === 1 ? 0 : 1;
        evaluate();
        state.credit--;
        state.edges++;
        changed = pending = true;
        if (Object.values(memory.processors ?? {}).some((cpu) => cpu.halted)) {
          stop();
          break;
        }
        if (performance.now() >= deadline) break;
      }
    }
    for (const state of activeClocks.values()) {
      if (now - state.measuredAt >= 1000) {
        state.actual = state.edges * 500 / (now - state.measuredAt);
        state.measuredAt = now;
        state.edges = 0;
      }
    }
    if (!activeClocks.size) stop();
    if (changed) render();
    updateClockReadout();
  }, 16);
}
function updateClockReadout() {
  const control = document.querySelector<HTMLElement>("#clock-measured");
  if (control) {
    control.textContent = `${
      (activeClocks.get(control.dataset.clock!)?.actual ?? 0).toFixed(1)
    } Hz actual`;
  }
  const button = document.querySelector<HTMLElement>("#run");
  if (button) {
    button.innerHTML = activeClocks.has(button.dataset.clock!)
      ? `${icon("Pause")}Pause clock`
      : `${icon("Play")}Run clock`;
  }
}
$("#details").addEventListener("change", (event) => {
  const input = event.target as HTMLInputElement;
  if (!input.matches("[data-clock-frequency]")) return;
  const clock = circuit.components.find((c) =>
    c.id === input.dataset.clockFrequency && c.kind === "CLOCK"
  );
  if (!clock) return;
  const hz = Math.max(.1, Math.min(10000, Number(input.value) || .1));
  input.value = String(hz);
  const state = activeClocks.get(clock.id);
  if (state) state.credit = 0;
  mutate(() => clock.frequency = hz);
});
function stop() {
  if (running) clearInterval(running);
  running = null;
  activeClocks.clear();
}
function load(next: Circuit) {
  stop();
  releaseKeyboard();
  capturedKeyboard = null;
  mappingKeyboard = null;
  keyboards = {};
  pins = new Set(
    next.components.filter((c) =>
      ["BUS_SCREEN", "BUS_KEYBOARD", "BUS_TERMINAL"].includes(c.kind)
    ).map((c) => c.id),
  );
  const before = clone(circuit);
  circuit = clone(next);
  retainDefinitions();
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
  const left = Math.min(
    ...circuit.components.map((c) => c.x - dimensions(c, circuit).width / 2),
  ) -
    40;
  const top = Math.min(
    ...circuit.components.map((c) => c.y - dimensions(c, circuit).height / 2),
  ) -
    40;
  const w = Math.max(
    ...circuit.components.map((c) => c.x + dimensions(c, circuit).width / 2),
  ) +
    40 - left;
  const h = Math.max(
    ...circuit.components.map((c) => c.y + dimensions(c, circuit).height / 2),
  ) +
    40 - top;
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
      const from = pin(c, wiring.port, circuit);
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
  $("#custom-items").innerHTML = library.filter((
    d,
  ) =>
    !d.internal && (mode !== "discover" || discovered.has(d.id) ||
      (d.id === "literal-alu8" &&
        ((!freeBuild &&
          courseIndex >= courses.findIndex((c) => c.id === "cpu")) ||
          completedCourses.has("cpu"))))
  ).map((d) =>
    `<div class="custom-library-row"><button class="palette-item ${
      placementDefinition === d.id && placement === "CUSTOM" ? "active" : ""
    }" data-custom="${d.id}" title="Place ${
      esc(d.name)
    }"><span class="custom-swatch" style="background:${d.color}"></span>${
      esc(d.name)
    }<span class="place-plus">+</span></button><button class="icon-button" data-edit-custom="${d.id}" aria-label="Edit ${
      esc(d.name)
    }">${icon("Pencil")}</button></div>`
  ).join("");

  renderDiscover();
  $("#mode-button").textContent = mode === "discover"
    ? "Discover"
    : "Playground";
  for (const button of document.querySelectorAll<HTMLElement>("[data-place]")) {
    const learnedKinds = new Set<string>([
      "POWER",
      "GROUND",
      "NMOS",
      "PMOS",
      "JUNCTION",
    ]);
    for (const [index, course] of courses.entries()) {
      if (
        completedCourses.has(course.id) || (!freeBuild && index <= courseIndex)
      ) course.unlock?.forEach((kind) => learnedKinds.add(kind));
    }
    button.hidden = mode === "discover" &&
      !learnedKinds.has(button.dataset.place!);
    button.closest<HTMLElement>(".palette-entry")!.hidden = button.hidden;
  }
  for (
    const group of document.querySelectorAll<HTMLElement>(".palette-group")
  ) {
    group.hidden = ![...group.querySelectorAll<HTMLElement>("[data-place]")]
      .some((button) => !button.hidden);
  }
  $("#examples-button").hidden = mode === "discover";
  document.querySelectorAll<HTMLElement>("[data-example]").forEach((button) =>
    button.hidden = mode === "discover"
  );
  $("#karnaugh-tool").hidden = mode === "discover" && !freeBuild &&
    courseIndex < courses.findIndex((c) => c.id === "xor");
  $("#pinned-devices").classList.toggle("has-selection", selected.size > 0);
  renderPins();
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
  $("#hint").textContent = wiring
    ? "Click the other pin to connect. Esc cancels."
    : placement
    ? `Click the canvas to place ${placement}. Esc returns to selection.`
    : panMode
    ? "Drag the canvas to pan. V returns to selection."
    : "Click inputs to toggle. Click two pins to wire. Space + drag to pan.";
  $("#hint").hidden = !wiring && !placement && !panMode;
  for (const b of document.querySelectorAll<HTMLElement>("[data-place]")) {
    b.classList.toggle("active", b.dataset.place === placement);
  }
  $("#select-tool").classList.toggle("active", !panMode && !placement);
  $("#pan-tool").classList.toggle("active", panMode);
  board.classList.toggle("placing", !!placement);
  board.classList.toggle("panning", panMode || space);
  renderBoard();
  renderDetails();
  updateClockReadout();
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
  const selectionKey = `${tab}:${[...selected].sort().join(",")}`;
  if (
    $("#details").dataset.selection === selectionKey &&
    $("#details").contains(document.activeElement) &&
    document.activeElement?.matches("input,textarea,select")
  ) return;
  $("#details").dataset.selection = selectionKey;
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
      c.kind === "CUSTOM"
        ? esc(definitionOf(c, circuit)?.name ?? "Custom")
        : c.kind === "DFF"
        ? "D flip-flop"
        : c.kind.startsWith("BUS_")
        ? c.kind.slice(4)
        : c.kind
    }</h2><div class="component-heading-actions"><button id="component-info" data-component-info="${c.id}" aria-label="About ${
      esc(c.label || c.kind)
    }">Info</button><span class="signal-badge ${
      sim.values[c.id] === 1 ? "on" : ""
    }">${
      c.kind === "HEX_DISPLAY"
        ? hexValue(sim.inputs[c.id])?.toString(16).toUpperCase() ?? "X"
        : c.kind === "SEVEN_SEG"
        ? "a–g · dp"
        : sim.values[c.id]
    }</span></div></div><p class="muted">${
      esc(
        c.kind === "CUSTOM"
          ? definitionOf(c, circuit)?.description || descriptions.CUSTOM
          : descriptions[c.kind],
      )
    }</p>${
      c.kind === "CLOCK" ? clockControls(c) : ""
    }<label class="field">Label<input id="component-label" value="${
      esc(c.label)
    }" maxlength="80"></label><div class="position-fields"><label class="field">X<input id="component-x" type="number" step="20" value="${c.x}" min="-100000" max="100000"></label><label class="field">Y<input id="component-y" type="number" step="20" value="${c.y}" min="-100000" max="100000"></label></div>${
      c.kind === "INPUT" || c.kind === "POWER"
        ? `<button id="toggle-value" class="wide-button">Toggle ${
          c.label ? esc(c.label) : "input"
        } · ${sim.values[c.id]} ${icon("ToggleRight")}</button>`
        : ""
    }${
      ["KEYBOARD", "BUS_KEYBOARD"].includes(c.kind)
        ? keyboardControls(c)
        : ["VGA", "BUS_SCREEN"].includes(c.kind)
        ? `${
          screenPreview(c)
        }<p class="muted">X0–4 / Y0–4 are little-endian coordinates. RGB is one bit per channel. Pulse Write from 0 to 1. Y 24–31 is ignored; Clear has priority.</p>`
        : ""
    }${
      ["ROM", "BUS_ROM"].includes(c.kind)
        ? `<label class="field">ROM bytes (hex)<textarea id="rom-bytes" rows="5">${
          (c.contents ?? []).map((b) => b.toString(16).padStart(2, "0")).join(
            " ",
          )
        }</textarea></label><button id="save-rom" class="wide-button">Load ROM bytes</button><p id="rom-error" role="alert"></p>`
        : ""
    }${
      c.kind === "BUS_ROM"
        ? `<label class="field">Assembly<textarea id="rom-source" rows="12" spellcheck="false">${
          esc(c.source ?? "HALT")
        }</textarea></label><button id="assemble-rom" class="wide-button">Assemble into ROM & reset circuit</button><p id="rom-assembly-error" role="alert"></p>`
        : ""
    }${
      c.kind === "BUS_RAM"
        ? '<label class="field">RAM address (hex)<input id="ram-address" value="2000" maxlength="4"></label><label class="field">Hex bytes<textarea id="ram-write" rows="2" placeholder="2A 00 FF"></textarea></label><button id="write-ram">Write RAM</button><p id="ram-error" role="alert"></p>'
        : ""
    }${
      c.kind === "BUS_CPU"
        ? `<h3>Registers</h3><pre class="memory-preview">PC ${
          memory.processors?.[c.id]?.pc.toString(16).padStart(4, "0")
        }\n${
          memory.processors?.[c.id]?.registers.map((v, i) =>
            `R${i} ${v.toString(16).padStart(2, "0")}`
          ).join("  ")
        }\nPhase ${(memory.processors?.[c.id]?.phase ?? 0) + 1}/8 · ${
          memory.processors?.[c.id]?.cycles ?? 0
        } instructions\n${esc(memory.processors?.[c.id]?.error ?? "")}</pre>`
        : ""
    }${
      c.kind === "BUS_RAM" || c.kind === "RAM"
        ? `<h3>Contents</h3><pre class="memory-preview">${
          esc(JSON.stringify(
            c.kind === "BUS_RAM"
              ? memory.busRAM?.[c.id] ?? {}
              : memory.ram?.[c.id] ?? [],
            null,
            2,
          ))
        }</pre>`
        : ""
    }<button id="see-inside" class="wide-button">See inside</button><button id="pin-component" class="wide-button">${
      pins.has(c.id) ? "Unpin" : "Pin"
    } to right panel</button><h3>Pins</h3><ul class="pin-list">${
      Array.from({ length: componentInputs(c, circuit) }, (_, i) => {
        const wire = circuit.wires.find((w) => w.to === c.id && w.port === i);
        const from = circuit.components.find((n) => n.id === wire?.from);
        return `<li><span>${
          esc(componentInputLabel(c, i, circuit))
        }</span><span>${sim.inputs[c.id]?.[i] ?? "X"} · ${
          from ? esc(from.label) : "unconnected"
        }</span></li>`;
      }).join("")
    }${
      Array.from({ length: componentOutputs(c, circuit) }, (_, port) =>
        `<li><span>${esc(componentOutputLabel(c, port, circuit))}</span><span>${
          sim.outputValues[c.id]?.[port] ?? sim.values[c.id]
        } · ${
          circuit.wires.filter((w) =>
            w.from === c.id && (w.fromPort ?? 0) === port
          ).length
        } connections</span></li>`).join("")
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
function showComponentInfo(c: Component) {
  const help = componentHelp[c.kind], definition = definitionOf(c, circuit);
  const name = definition?.name ?? c.kind.replace("BUS_", "");
  const what = definition?.description || help.what;
  const switchDiagram = ["NMOS", "PMOS"].includes(c.kind)
    ? `<div class="switch-explanation" aria-label="Source passes through the switch to Drain when Gate turns it on"><div>Gate <small>controls the switch</small></div><span>Source</span><span>→ switch →</span><span>Drain</span></div>`
    : "";
  dialog(
    `${name} · Info`,
    `<article class="component-help"><section><h3>What it is</h3><p>${
      esc(what)
    }</p>${switchDiagram}</section><section><h3>Why use it</h3><p>${
      esc(help.why)
    }</p></section><section><h3>How to connect it</h3><p>${
      esc(help.how)
    }</p></section><section><h3>Try it</h3><p>${
      esc(help.example)
    }</p></section>${
      help.note ? `<p class="component-help-note">${esc(help.note)}</p>` : ""
    }</article>`,
  );
}
function clockControls(c: Component) {
  return `<section class="clock-controls"><h3>Clock controls</h3><label class="field">Frequency (Hz)<input id="clock-frequency" data-clock-frequency="${c.id}" type="number" min="0.1" max="10000" step="0.1" value="${
    c.frequency ?? clockHz
  }"></label><output id="clock-measured" data-clock="${c.id}"></output><div class="clock-actions"><button id="run" data-clock="${c.id}" class="primary"></button><button id="step" data-clock="${c.id}" title="Toggle this clock once">${
    icon("StepForward")
  }Step</button></div><button id="reset" class="wide-button">${
    icon("RotateCcw")
  }Reset simulation</button></section>`;
}
function screenPreview(c: Component) {
  const pixels = memory.screens?.[c.id] ?? [];
  return `<svg class="screen-preview" viewBox="0 0 32 24" role="img" aria-label="Screen framebuffer"><rect width="32" height="24" fill="${
    screenColors[0]
  }"/>${
    pixels.map((color, i) =>
      color
        ? `<rect x="${i % 32}" y="${
          Math.floor(i / 32)
        }" width="1" height="1" fill="${screenColors[color]}"/>`
        : ""
    ).join("")
  }</svg>`;
}
function keyboardControls(c: Component) {
  const rows = ["1234567890", "QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
  return `<button id="capture-keyboard" class="wide-button" aria-pressed="${
    capturedKeyboard === c.id
  }">${
    capturedKeyboard === c.id
      ? "Stop keyboard capture · Esc"
      : "Capture physical keyboard"
  }</button><p class="muted">ASCII uppercase. D0 is the least significant bit. Code stays latched after release; Pressed goes low. Arrow codes: ↑ 80, ↓ 81, ← 82, → 83 (hex).</p><div class="virtual-keyboard">${
    rows.map((row) =>
      `<div class="key-row">${
        [...row].map((key) =>
          `<button data-virtual-key="${key}" data-keyboard="${c.id}" aria-label="Virtual ${key}">${key}</button>`
        ).join("")
      }</div>`
    ).join("")
  }<div class="key-row">${
    ["Space", "Enter", "Backspace", "↑", "↓", "←", "→"].map((key) =>
      `<button data-virtual-key="${key}" data-keyboard="${c.id}">${key}</button>`
    ).join("")
  }</div></div><label class="field">Map physical key to<select id="map-virtual">${
    virtualKeys.map((k) => `<option>${k.key}</option>`).join("")
  }</select></label><button id="map-key" class="wide-button">${
    mappingKeyboard === c.id
      ? "Press a physical key · Esc cancels"
      : "Assign physical key"
  }</button>${
    Object.entries(c.keyMap ?? {}).map(([physical, key]) =>
      `<div class="key-mapping">${esc(physical)} → ${
        esc(key)
      }<button data-remove-map="${esc(physical)}" aria-label="Remove ${
        esc(physical)
      } mapping">×</button></div>`
    ).join("")
  }`;
}
function pressKey(id: string, physical: string, code: number) {
  heldKeys.set(physical, code);
  keyboards[id] = { code, pressed: true };
  evaluate();
  render();
}
function releaseKey(id: string, physical: string) {
  heldKeys.delete(physical);
  const remaining = [...heldKeys.values()].at(-1);
  keyboards[id] = {
    code: remaining ?? keyboards[id]?.code ?? 0,
    pressed: remaining !== undefined,
  };
  evaluate();
  render();
}
function releaseKeyboard() {
  heldKeys.clear();
  for (const state of Object.values(keyboards)) state.pressed = false;
}
$("#details").addEventListener("click", (e) => {
  const target = e.target as Element;
  if (target.closest("#save-rom")) {
    const rom = circuit.components.find((c) =>
      selected.has(c.id) && ["ROM", "BUS_ROM"].includes(c.kind)
    );
    if (!rom) return;
    const tokens = $<HTMLTextAreaElement>("#rom-bytes").value.trim().split(
      /\s+/,
    ).filter(Boolean);
    if (
      tokens.length > (rom.kind === "BUS_ROM" ? 8192 : 256) ||
      tokens.some((t) => !/^[0-9a-f]{1,2}$/i.test(t))
    ) {
      $("#rom-error").textContent =
        "Use up to 256 hex bytes, separated by spaces.";
      return;
    }
    mutate(() => {
      rom.contents = tokens.map((t) => parseInt(t, 16));
      delete rom.source;
    });
    return;
  }
  const c = circuit.components.find((c) =>
    selected.has(c.id) && ["KEYBOARD", "BUS_KEYBOARD"].includes(c.kind)
  );
  if (!c) return;
  if (target.closest("#capture-keyboard")) {
    releaseKeyboard();
    capturedKeyboard = capturedKeyboard === c.id ? null : c.id;
    evaluate();
    render();
  }
  if (target.closest("#map-key")) {
    capturedKeyboard = null;
    releaseKeyboard();
    mappingValue = $<HTMLSelectElement>("#map-virtual").value;
    mappingKeyboard = c.id;
    renderDetails();
    $("#map-key").textContent = "Press a physical key · Esc cancels";
  }
  const remove = target.closest<HTMLElement>("[data-remove-map]");
  if (remove) {
    mutate(() => {
      delete c.keyMap?.[remove.dataset.removeMap!];
    });
  }
});
$(".inspector").addEventListener("keydown", (e) => {
  const button = (e.target as Element).closest<HTMLElement>(
    "[data-virtual-key]",
  );
  if (!button || !["Enter", " "].includes(e.key)) return;
  e.preventDefault();
  e.stopPropagation();
  if (!e.repeat) {
    pressKey(
      button.dataset.keyboard!,
      "virtual",
      virtualKeys.find((k) => k.key === button.dataset.virtualKey)!.code,
    );
  }
});
$(".inspector").addEventListener("pointerdown", (e) => {
  const button = (e.target as Element).closest<HTMLElement>(
    "[data-virtual-key]",
  );
  if (!button) return;
  e.preventDefault();
  const key = virtualKeys.find((k) => k.key === button.dataset.virtualKey)!;
  pressKey(button.dataset.keyboard!, "virtual", key.code);
});
document.addEventListener("pointerup", () => {
  if (heldKeys.has("virtual")) {
    for (const c of circuit.components) {
      if (
        ["KEYBOARD", "BUS_KEYBOARD"].includes(c.kind) &&
        keyboards[c.id]?.pressed
      ) {
        releaseKey(c.id, "virtual");
      }
    }
  }
});
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
    definitions: circuit.definitions,
    components: nodes,
    wires: circuit.wires.filter((w) => ids.has(w.from) && ids.has(w.to)),
  });
  pasted = 0;
}
function pasteSelection() {
  if (!clipboard) return;
  if (
    circuit.components.length + clipboard.components.length > 20_000 ||
    circuit.wires.length + clipboard.wires.length > 50_000
  ) {
    notify("Limit: 20,000 components and 50,000 wires.");
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
    circuit.definitions = clone(
      clipboard!.definitions ?? circuit.definitions ?? [],
    );
    circuit.components.push(...nodes);
    circuit.wires.push(...wires);
    selected = new Set(nodes.map((c) => c.id));
  });
}
function duplicateSelection() {
  copySelection();
  pasteSelection();
}
function tick(update = true) {
  for (const c of circuit.components) {
    if (c.kind === "CLOCK") c.value = c.value === 1 ? 0 : 1;
  }
  evaluate();
  if (update) {
    persist();
    render();
  }
}
function toggle(c: Component) {
  mutate(() => c.value = sim.values[c.id] === 1 ? 0 : 1);
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
      circuit = connect(
        circuit,
        from,
        to,
        input,
        uid(),
        -(port < 0 ? port : wiring!.port) - 1,
      );
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
  $("#dialog").classList.remove("inside-dialog");
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
  if (b.dataset.clock && (b.id === "run" || b.id === "step")) {
    const clock = circuit.components.find((c) =>
      c.id === b.dataset.clock && c.kind === "CLOCK"
    );
    if (!clock) return;
    if (b.id === "run") {
      if (activeClocks.has(clock.id)) {
        activeClocks.delete(clock.id);
        if (!activeClocks.size) stop();
      } else startClock(clock.id);
    } else {
      activeClocks.delete(clock.id);
      if (!activeClocks.size) stop();
      clock.value = clock.value === 1 ? 0 : 1;
      evaluate();
      persist();
    }
    render();
    return;
  }
  if (b.dataset.componentInfo) {
    const component = circuit.components.find((c) =>
      c.id === b.dataset.componentInfo
    );
    if (component) showComponentInfo(component);
    return;
  }
  if (b.dataset.lesson) {
    if (b.dataset.lesson === "focus") {
      const node = circuit.components.find((n) => n.id === b.dataset.focusNode);
      if (node) {
        selected = new Set([node.id]);
        tab = "inspect";
        const size = bounds();
        camera = {
          x: node.x - size.width / 2,
          y: node.y - size.height / 2,
          zoom: 1,
        };
        render();
        view();
      }
      return;
    }
    if (b.dataset.lesson === "save-lab") {
      const course = courses[courseIndex],
        report = checkLab(course.id, circuit);
      if (!report.passed) {
        labReport = report;
        labReportCircuit = JSON.stringify(circuit);
        renderDiscover();
        return;
      }
      selected = labGateMembers(course.id, circuit);
      render();
      customDialog();
      $<HTMLInputElement>("#custom-name").value = course.name.split(" · ").at(
        -1,
      )!;
      return;
    }
    if (b.dataset.lesson === "check") {
      if (checkingLab) return;
      checkingLab = true;
      renderDiscover();
      const course = courses[courseIndex];
      const snapshot = clone(circuit);
      checkLabAsync(course.id, snapshot).then((report) => {
        checkingLab = false;
        if (
          courses[courseIndex].id !== course.id ||
          JSON.stringify(circuit) !== JSON.stringify(snapshot)
        ) {
          renderDiscover();
          return;
        }
        labReport = report;
        labReportCircuit = JSON.stringify(snapshot);
        if (report.passed) {
          completedCourses.add(course.id);
          localStorage.setItem(
            "literal.completedCourses",
            JSON.stringify([...completedCourses]),
          );
        }
        render();
      });
      return;
    }
    if (b.dataset.lesson === "example") {
      const course = courses[courseIndex];
      const source = solutions[course.id];
      const image = ["pixels", "triangle", "projection"].includes(course.id)
        ? targetImage(course.id)
        : undefined;
      dialog(
        `Example · ${course.name}`,
        `<p class="muted">A reference to compare with your work. Your circuit stays as it is.</p>${
          image
            ? `<svg class="lesson-target" viewBox="0 0 32 24" role="img" aria-label="Target image"><rect width="32" height="24" fill="#101810"/>${
              image.map((color, i) =>
                color
                  ? `<rect x="${i % 32}" y="${
                    Math.floor(i / 32)
                  }" width="1" height="1" fill="${screenColors[color]}"/>`
                  : ""
              ).join("")
            }</svg>`
            : ""
        }${
          source
            ? `<pre class="lesson-source">${esc(source)}</pre>`
            : `<p>${esc(course.steps[1].text)}</p><p>${
              esc(course.steps[1].hint)
            }</p>`
        }`,
      );
      return;
    }
    if (b.dataset.lesson === "hint") {
      const lesson = courses[courseIndex].steps[lessonStep];
      dialog(
        `Hint · Step ${lessonStep + 1}`,
        `<div class="lesson-hint-panel"><h3>${esc(lesson.title)}</h3><p>${
          esc(lesson.hint)
        }</p></div>`,
      );
      return;
    }
    if (b.dataset.lesson === "courses") {
      chooseCourse();
      return;
    }
    if (b.dataset.lesson === "next-course") {
      selectCourse(courseIndex + 1);
      return;
    }
    if (b.dataset.lesson === "free") {
      selectCourse(-1);
      return;
    }
    if (b.dataset.lesson === "next") {
      lessonStep = Math.min(
        courses[courseIndex].steps.length - 1,
        lessonStep + 1,
      );
    }
    if (b.dataset.lesson === "previous") {
      lessonStep = Math.max(0, lessonStep - 1);
    }
    if (b.dataset.lesson === "save") {
      const course = courses[courseIndex];
      const gate =
        courseState(course, circuit, sim, testedGateInputs, library, discovered)
          .gate;
      if (gate) {
        selected = new Set(gate.members.map((c) => c.id));
        render();
        customDialog();
        $<HTMLInputElement>("#custom-name").value = course.id.toUpperCase();
        $<HTMLTextAreaElement>("#custom-description").value =
          descriptions[course.id.toUpperCase() as Kind];
      }
    }
    localStorage.setItem("literal.lessonStep", String(lessonStep));
    localStorage.setItem(
      `literal.lessonStep.${courses[courseIndex].id}`,
      String(lessonStep),
    );
    renderDiscover();
    return;
  }
  if (b.dataset.editCustom) {
    const def = library.find((d) => d.id === b.dataset.editCustom);
    if (def) appearanceDialog(def);
    return;
  }
  if (b.dataset.custom) {
    placement = "CUSTOM";
    placementDefinition = b.dataset.custom;
    wiring = null;
    panMode = false;
    if (matchMedia("(max-width: 650px)").matches) {
      $(".shell").classList.remove("hide-library");
    }
    render();
    return;
  }
  if (b.dataset.place) {
    placementDefinition = null;
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
    "create-custom": customDialog,
    "create-custom-tool": customDialog,
    "examples-button": () =>
      dialog(
        "Example circuits",
        `<div class="example-dialog">${
          examples.map((e) =>
            `<button aria-label="Load example ${e.name}" data-example="${e.id}"><strong>${e.name}</strong><span>${e.description}</span></button>`
          ).join("")
        }</div>`,
      ),
    "mode-button": chooseMode,
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
    "karnaugh-tool": () => {
      stop();
      releaseKeyboard();
      capturedKeyboard = null;
      evaluate();
      render();
      openKarnaugh(circuit);
    },
    reset: () => {
      stop();
      releaseKeyboard();
      keyboards = {};
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
        `<h3>Draw a circuit</h3><p>Pick a component from the library, then click the canvas. Esc returns to selection. Components snap to the 20 px grid.</p><p>Click two pins to connect them: one output and one input. Outputs can drive several inputs. Each input accepts one wire. A wire crossing is visual; it does not join the wires.</p><h3>Simulate</h3><p>Click an input block to switch between 0 and 1. Signals propagate immediately. Select a Clock to step it, run it, or change its frequency. Each clock runs independently. D flip-flops sample on a rising edge and start at 0. Reset clears stored state, RAM, and screens and resets clocks to 0.</p><p>X means an unconnected or unknown signal. Feedback between ideal logic gates is reported. CMOS transistor networks can hold latch state; flip-flops capture data on clock edges. Wires carry single bits; byte devices have individual bit pins. Logisim .circ files are not supported.</p><h3>Displays</h3><p>LED lights on 1. The 7-segment display has eight independent pins: a at the top, b upper right, c lower right, d bottom, e lower left, f upper left, g middle, and dp for the decimal point. The hex display decodes four bits, with weights 1, 2, 4, 8 from top to bottom. Amber segments mean unknown inputs. Truth tables export each display input as a separate column.</p><h3>Byte devices</h3><p>Registers capture eight data bits on a rising Clock when Enable is high. Counters increment on that edge. Clear resets either immediately. RAM stores 256 bytes: eight address bits, eight data bits, Write, and Clock. Read is asynchronous; write needs Write high on a rising Clock. ROM bytes are edited as hex in the inspector. ADDER8 accepts two bytes and carry, and produces a sum and carry.</p><h3>Screen and keyboard</h3><p>VGA stores 32 × 24 RGB pixels. Connect X0–4, Y0–4 and RGB, then pulse Write. Clear resets the screen. Select Keyboard for physical-key capture, remapping, or virtual keys. It exposes eight uppercase ASCII bits and Pressed. Escape releases capture.</p><h3>Tools</h3><p>The wired computer examples run Literal 8 assembly on the circuit canvas. ROM, RAM, keyboard, screen, and a gate ALU connect to the CPU controller through bit wires. Discover guides you from transistors to this machine, programs, a game, and 3D projection. Karnaugh simplifies 1–4 variable combinational outputs using editable Gray-order maps and don't-care cells.</p><h3>Custom components</h3><p>Select logic and choose Create component. Input/Output labels name pins; boundary connections become pins. Choose a name, color and shape. The pencil in the library edits appearance. Registers and RAM can be saved. Physical clocks, keyboards, and displays stay outside custom components.</p><h3>Files and keyboard</h3><p>The current circuit is saved in this browser. Save downloads a .literal JSON file. Open imports a saved circuit. Simulation memory is reset when opening, undoing, or reloading.</p><p>⌘/Ctrl+Z undo · Shift+⌘/Ctrl+Z redo · ⌘/Ctrl+C/V copy/paste · ⌘/Ctrl+D duplicate · ⌘/Ctrl+S save · ⌘/Ctrl+O open · Delete removes selection · V select · H pan · F fit · Esc cancel. Arrow keys move selected components by one grid step; Shift moves five steps.</p><p>Keyboard users can select components and pins with Tab, then press Enter. To place without a pointer, use the Place at center button after choosing a component.</p>`,
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
    if (file.size > 20_000_000) throw Error("Circuit file exceeds 20 MB.");
    load(parseCircuit(await file.text()));
    notify(`Opened ${circuit.name}`);
  } catch (error) {
    notify((error as Error).message);
  }
  input.value = "";
});
function appearanceDialog(def: Definition) {
  dialog(
    "Component appearance",
    `<form id="appearance-form" data-definition="${def.id}"><label class="field">Component name<input id="appearance-name" value="${
      esc(def.name)
    }" maxlength="80" required></label><label class="field">Description<textarea id="appearance-description" maxlength="600" rows="3">${
      esc(def.description ?? "")
    }</textarea></label><label class="field">Color<input id="appearance-color" type="color" value="${def.color}"></label><label class="field">Shape<select id="appearance-shape">${
      ["rounded", "rectangle", "diamond"].map((shape) =>
        `<option value="${shape}" ${
          shape === def.shape ? "selected" : ""
        }>${shape}</option>`
      ).join("")
    }</select></label><p class="muted">Updates this component in the library and every instance in the current circuit.</p><button class="primary" type="submit">Save appearance</button></form>`,
  );
}
$("#dialog-body").addEventListener("submit", (e) => {
  const form = e.target as HTMLFormElement;
  if (form.id !== "appearance-form") return;
  e.preventDefault();
  const original = library.find((d) => d.id === form.dataset.definition);
  if (!original) return;
  const name = $<HTMLInputElement>("#appearance-name").value.trim();
  if (!name) return;
  const def = {
    ...original,
    name,
    description: $<HTMLTextAreaElement>("#appearance-description").value.trim(),
    color: $<HTMLInputElement>("#appearance-color").value,
    shape: $<HTMLSelectElement>("#appearance-shape")
      .value as Definition["shape"],
  };
  library = library.map((d) => d.id === def.id ? def : d);
  mutate(() => {
    circuit.definitions = clone(library);
  });
  retainDefinitions();
  $<HTMLDialogElement>("#dialog").close();
  render();
});
function customDialog() {
  if (library.filter((d) => !d.internal).length >= 100) {
    notify("Library limit: 100 custom components.");
    return;
  }
  if (!circuit.components.some((c) => selected.has(c.id))) {
    notify(
      "Select the components to save. Use ⌘/Ctrl+A to select the whole circuit.",
    );
    return;
  }
  let preview = "", previewError = "";
  try {
    const def = createDefinition(circuit, selected, {
      id: "pin-preview",
      name: "Preview",
      color: "#527d3c",
      shape: "rounded",
    });
    const inputs = def.components.filter((n) => n.kind === "INPUT"),
      outputs = def.components.filter((n) => n.kind === "OUTPUT");
    preview =
      `<div id="custom-preview"><strong>${selected.size} selected components</strong><p>Inputs (${inputs.length}): ${
        inputs.map((n) => esc(n.label)).join(", ") || "none"
      }</p><p>Outputs (${outputs.length}): ${
        outputs.map((n) => esc(n.label)).join(", ")
      }</p>${
        !inputs.length
          ? '<p class="pin-warning">No input pins. Selected Power blocks remain fixed inside the component. Keep A and B outside your selection to make them inputs.</p>'
          : ""
      }</div>`;
  } catch (error) {
    previewError = (error as Error).message;
  }
  dialog(
    "Create component",
    `<form id="custom-form">${preview}<p class="muted">Save the selected circuit to your library. Input and Output labels become pin names. Unconnected pins and connections crossing the selection become pins automatically.</p><label class="field">Component name<input id="custom-name" maxlength="80" required value="${
      esc(circuit.name.slice(0, 80))
    }"></label><label class="field">Description<textarea id="custom-description" maxlength="600" rows="3" placeholder="What this component does and how to use its pins"></textarea></label><label class="field">Color<input id="custom-color" type="color" value="#527d3c"></label><label class="field">Shape<select id="custom-shape"><option value="rounded">Rounded rectangle</option><option value="rectangle">Rectangle</option><option value="diamond">Diamond</option></select></label><p class="muted">Save gate and transistor networks. Registers and RAM can be saved too. Keep physical clocks, keyboards, and displays outside the selection.</p><p id="custom-error" role="alert">${
      esc(previewError)
    }</p><button class="primary" type="submit" ${
      previewError ? "disabled" : ""
    }>Save component</button></form>`,
  );
}
$("#dialog-body").addEventListener("submit", (e) => {
  if ((e.target as Element).id !== "custom-form") return;
  e.preventDefault();
  try {
    const def = createDefinition(circuit, selected, {
      id: uid(),
      name: $<HTMLInputElement>("#custom-name").value.trim(),
      description: $<HTMLTextAreaElement>("#custom-description").value.trim(),
      color: $<HTMLInputElement>("#custom-color").value,
      shape: $<HTMLSelectElement>("#custom-shape").value as Definition["shape"],
    });
    mutate(() => {
      circuit.definitions = [...(circuit.definitions ?? []), def];
    });
    if (mode === "discover") {
      discovered.add(def.id);
      localStorage.setItem(
        "literal.discovered",
        JSON.stringify([...discovered]),
      );
    }
    retainDefinitions();
    $<HTMLDialogElement>("#dialog").close();
    placement = "CUSTOM";
    placementDefinition = def.id;
    selected.clear();
    render();
    notify(`Saved ${def.name}. Click the canvas to place it.`);
  } catch (error) {
    $("#custom-error").textContent = (error as Error).message;
  }
});
function place(p: Point) {
  if (!placement) return;
  if (circuit.components.length >= 20_000) {
    notify("Limit: 20,000 components.");
    return;
  }
  mutate(() => {
    if (placement === "CUSTOM") circuit.definitions = clone(library);
    const c: Component = {
      id: uid(),
      kind: placement!,
      x: snap(p.x),
      y: snap(p.y),
      label: placement === "CUSTOM"
        ? library.find((d) => d.id === placementDefinition)?.name ?? "Custom"
        : placement!,
      ...(placement === "CUSTOM" ? { definition: placementDefinition! } : {}),
      ...(["INPUT", "CLOCK"].includes(placement!) ? { value: 0 as const } : {}),
    };
    circuit.components.push(c);
    selected = new Set([c.id]);
    placement = null;
    placementDefinition = null;
    wiring = null;
    panMode = false;
    tab = "inspect";
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
    tab = "inspect";
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
      if (
        c && (c.kind === "INPUT" || c.kind === "POWER")
      ) {
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
    tab = "inspect";
    const c = circuit.components.find((c) => c.id === id)!;
    if (c.kind === "INPUT" || c.kind === "POWER") {
      toggle(c);
    } else render();
  }
});
document.addEventListener("keydown", (e) => {
  if (document.querySelector(".tool-workspace:not([hidden])")) return;
  if (mappingKeyboard) {
    e.preventDefault();
    const c = circuit.components.find((c) => c.id === mappingKeyboard);
    const virtual = mappingValue;
    mappingKeyboard = null;
    if (e.key !== "Escape" && e.code && c) {
      mutate(() => c.keyMap = { ...c.keyMap, [e.code]: virtual });
    } else renderDetails();
    return;
  }
  if (capturedKeyboard) {
    if (e.key === "Escape") {
      releaseKeyboard();
      capturedKeyboard = null;
      render();
      return;
    }
    if (
      e.target instanceof Element &&
      e.target.closest("input,textarea,select,dialog")
    ) return;
    const c = circuit.components.find((c) => c.id === capturedKeyboard);
    if (!c) {
      capturedKeyboard = null;
      return;
    }
    const code = keyboardCode(e.code, c.keyMap);
    if (code !== null) {
      e.preventDefault();
      if (!e.repeat) pressKey(c.id, e.code, code);
    }
    return;
  }
  const target = e.target instanceof Element ? e.target : document.body;
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
  if (heldKeys.has("virtual") && ["Enter", " "].includes(e.key)) {
    for (const c of circuit.components) {
      if (
        ["KEYBOARD", "BUS_KEYBOARD"].includes(c.kind) &&
        keyboards[c.id]?.pressed
      ) {
        releaseKey(c.id, "virtual");
      }
    }
  }
  if (capturedKeyboard && heldKeys.has(e.code)) {
    e.preventDefault();
    releaseKey(capturedKeyboard, e.code);
    return;
  }
  if (e.key === " ") {
    space = false;
    board.classList.toggle("panning", panMode);
  }
});
window.addEventListener("blur", () => {
  releaseKeyboard();
  evaluate();
  render();
  space = false;
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    releaseKeyboard();
    evaluate();
    stop();
    render();
  }
});
retainDefinitions();
pins = new Set(
  circuit.components.filter((c) =>
    ["BUS_SCREEN", "BUS_KEYBOARD", "BUS_TERMINAL"].includes(c.kind)
  ).map((c) => c.id),
);
new ResizeObserver(view).observe(board);
if (mode === "playground") persist();
render();
requestAnimationFrame(fit);
if (storageWarning) notify(storageWarning);

const state = () =>
  clone({
    circuit,
    selected: [...selected],
    library,
    simulation: {
      values: sim.values,
      inputs: sim.inputs,
      outputValues: sim.outputValues,
      warnings: sim.warnings,
    },
    clockRunning: running !== null,
  });

window.literal = createAgentAPI({
  state,
  examples: examples.map(({ id, name, description }) => ({
    id,
    name,
    description,
  })),
  loadExample: (id) => {
    load(examples.find((e) => e.id === id)!.circuit);
    return state();
  },
  replaceCircuit: (json) => {
    const next = parseCircuit(json);
    load(next);
    return state();
  },
  setInputs: (values) => {
    const nodes = values.map(({ id }) =>
      circuit.components.find((c) => c.id === id)
    );
    if (
      nodes.some((c) => !c || !["INPUT", "CLOCK", "POWER"].includes(c.kind))
    ) throw Error("Each id must identify an Input or Clock component.");
    if (
      new Set(values.map((v) => v.id)).size !== values.length
    ) throw Error("Duplicate input id.");
    stop();
    mutate(() => values.forEach((v, i) => nodes[i]!.value = v.value));
    return state();
  },
  clock: (steps, reset) => {
    stop();
    if (reset) {
      releaseKeyboard();
      keyboards = {};
      memory = { q: {}, clock: {} };
      for (const c of circuit.components) {
        if (c.kind === "CLOCK") c.value = 0;
      }
      evaluate();
    }
    for (let i = 0; i < steps; i++) tick();
    persist();
    render();
    return state();
  },
  truthTable: () => truthTable(circuit),
  createComponent: (ids, options) => {
    if (library.filter((d) => !d.internal).length >= 100) {
      throw Error("Library limit: 100 custom components.");
    }
    if (
      new Set(ids).size !== ids.length ||
      ids.some((id) => !circuit.components.some((c) => c.id === id))
    ) throw Error("Choose existing component ids without duplicates.");
    const def = createDefinition(circuit, new Set(ids), {
      id: uid(),
      name: options.name,
      description: options.description,
      color: options.color,
      shape: options.shape,
    });
    mutate(() => circuit.definitions = [...(circuit.definitions ?? []), def]);
    if (mode === "discover") {
      discovered.add(def.id);
      localStorage.setItem(
        "literal.discovered",
        JSON.stringify([...discovered]),
      );
    }
    retainDefinitions();
    render();
    return clone(def);
  },
  history: (direction) => {
    history(direction);
    return state();
  },
  computer: circuitComputerAPI,
});

async function advanceComputer(steps: number) {
  const active = circuit;
  let yielded = performance.now(), painted = yielded;
  for (let i = 0; i < steps; i++) {
    sim = stepGateInstruction(circuit, memory, keyboards);
    memory = sim.memory;
    const cpu = circuit.components.find((c) => c.kind === "BUS_CPU");
    const clock = circuit.wires.find((w) => w.to === cpu?.id && w.port === 18)
      ?.from;
    const source = circuit.components.find((c) => c.id === clock);
    if (source) source.value = 1;
    if (Object.values(memory.processors ?? {}).some((cpu) => cpu.halted)) {
      stop();
      break;
    }
    if (performance.now() - yielded > 12) {
      if (performance.now() - painted > 100) {
        render();
        painted = performance.now();
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (active !== circuit) return;
      yielded = performance.now();
    }
  }
  render();
}
async function circuitComputerAPI(
  input: import("./agent-api.ts").ComputerInput,
) {
  if (input.action !== "state") stop();
  if (input.action === "assemble") load(computerCircuit(input.source!));
  let cpu = circuit.components.find((c) => c.kind === "BUS_CPU");
  if (!cpu && input.action === "state") return { initialized: false };
  if (!cpu) {
    load(computerCircuit());
    cpu = circuit.components.find((c) => c.kind === "BUS_CPU")!;
  }
  if (input.action === "reset") {
    memory = { q: {}, clock: {} };
    for (const c of circuit.components) if (c.kind === "CLOCK") c.value = 0;
    evaluate();
  }
  if (input.action === "step") await advanceComputer(input.steps ?? 1);
  if (input.action === "key") {
    const keyboard = circuit.components.find((c) => c.kind === "BUS_KEYBOARD");
    if (keyboard) {
      keyboards[keyboard.id] = { code: input.code!, pressed: input.pressed! };
    }
    evaluate();
  }
  render();
  const state = memory.processors![cpu.id],
    address = input.address ?? 0x2000,
    length = input.length ?? 64;
  const ram = circuit.components.find((c) => c.kind === "BUS_RAM"),
    rom = circuit.components.find((c) => c.kind === "BUS_ROM"),
    screen = circuit.components.find((c) => c.kind === "BUS_SCREEN"),
    keyboard = circuit.components.find((c) => c.kind === "BUS_KEYBOARD");
  return {
    initialized: true,
    source: rom?.source ?? "",
    ...state,
    running: running !== null,
    keyboard: keyboard
      ? keyboards[keyboard.id] ?? { code: 0, pressed: false }
      : null,
    terminal: Object.values(memory.terminals ?? {}).join(""),
    framebuffer: screen ? memory.screens?.[screen.id] ?? [] : [],
    memory: {
      address,
      bytes: Array.from(
        { length: Math.min(length, 65536 - address) },
        (_, i) =>
          address + i < 0x2000
            ? rom?.contents?.[address + i] ?? 0
            : address + i < 0xf000
            ? ram ? memory.busRAM?.[ram.id]?.[address + i] ?? 0 : 0
            : screen
            ? memory.screens?.[screen.id]?.[address + i - 0xf000] ?? 0
            : 0,
      ),
    },
  };
}
function renderPins() {
  const target = $("#pinned-devices");
  if (
    target.contains(document.activeElement) &&
    document.activeElement?.matches("input,textarea")
  ) return;
  const keyboard = circuit.components.find((c) => c.kind === "BUS_KEYBOARD");
  target.innerHTML = [...pins].flatMap((id) => {
    const c = circuit.components.find((c) => c.id === id);
    if (!c) {
      pins.delete(id);
      return [];
    }
    const heading = `<div class="pinned-heading"><button data-inspect="${id}">${
      esc(c.label)
    }</button><button data-unpin="${id}" aria-label="Unpin ${
      esc(c.label)
    }">×</button></div>`;
    if (c.kind === "BUS_SCREEN" || c.kind === "VGA") {
      return `<section class="pinned-card">${heading}<canvas data-pinned-screen="${id}" width="32" height="24" aria-label="${
        esc(c.label)
      } framebuffer"></canvas>${
        keyboard
          ? `<div class="key-row">${
            ["↑", "←", "↓", "→", "R"].map((key) =>
              `<button data-virtual-key="${key}" data-keyboard="${keyboard.id}">${key}</button>`
            ).join("")
          }</div>`
          : ""
      }</section>`;
    }
    if (["KEYBOARD", "BUS_KEYBOARD"].includes(c.kind)) {
      return `<section class="pinned-card">${heading}<button data-capture-keyboard="${id}" aria-pressed="${
        capturedKeyboard === id
      }">${
        capturedKeyboard === id
          ? "Keyboard captured · Esc releases"
          : "Capture keyboard"
      }</button><p class="muted">Key ${keyboards[id]?.code ?? 0} · ${
        keyboards[id]?.pressed ? "pressed" : "released"
      }</p></section>`;
    }
    if (c.kind === "BUS_TERMINAL") {
      return `<section class="pinned-card">${heading}<pre>${
        esc(memory.terminals?.[id] ?? "Terminal · waiting for output")
      }</pre></section>`;
    }
    if (c.kind === "BUS_CPU") {
      const cpu = memory.processors?.[id];
      return `<section class="pinned-card">${heading}<pre>PC ${
        cpu?.pc.toString(16).padStart(4, "0")
      } · ${cpu?.halted ? "Halted" : "Running"}\n${
        cpu?.registers.map((v, i) => `R${i} ${v.toString(16).padStart(2, "0")}`)
          .join("  ")
      }\n${esc(cpu?.error ?? "")}</pre></section>`;
    }
    if (["ROM", "BUS_ROM", "RAM", "BUS_RAM"].includes(c.kind)) {
      return `<section class="pinned-card">${heading}<pre>${
        c.kind.includes("ROM")
          ? (c.contents ?? []).slice(0, 32).map((v) =>
            v.toString(16).padStart(2, "0")
          ).join(" ")
          : Object.entries(memory.busRAM?.[id] ?? {}).slice(0, 24).map((
            [at, v],
          ) => `${Number(at).toString(16)}: ${v.toString(16).padStart(2, "0")}`)
            .join("\n") || "RAM · all bytes zero"
      }</pre><button data-inspect="${id}">Inspect / edit memory</button></section>`;
    }
    return `<section class="pinned-card">${heading}<p>${esc(c.kind)} · ${
      sim.values[id]
    }</p></section>`;
  }).join("");
  for (
    const canvas of target.querySelectorAll<HTMLCanvasElement>(
      "[data-pinned-screen]",
    )
  ) {
    const ctx = canvas.getContext("2d")!;
    (memory.screens?.[canvas.dataset.pinnedScreen!] ?? Array(768).fill(0))
      .forEach((color, i) => {
        ctx.fillStyle = screenColors[color];
        ctx.fillRect(i % screenWidth, Math.floor(i / screenWidth), 1, 1);
      });
  }
}
$(".inspector").addEventListener("click", (event) => {
  const target = (event.target as Element).closest<HTMLElement>("button");
  if (!target) return;
  const c = circuit.components.find((c) => selected.has(c.id));
  if (target.id === "pin-component" && c) {
    if (pins.has(c.id)) pins.delete(c.id);
    else pins.add(c.id);
    render();
  }
  if (target.dataset.unpin) {
    pins.delete(target.dataset.unpin);
    render();
  }
  if (target.dataset.inspect) {
    selected = new Set([target.dataset.inspect]);
    tab = "inspect";
    render();
  }
  if (target.dataset.captureKeyboard) {
    releaseKeyboard();
    capturedKeyboard = capturedKeyboard === target.dataset.captureKeyboard
      ? null
      : target.dataset.captureKeyboard;
    render();
  }
  if (target.id === "see-inside" && c) openInside(c);
  if (target.id === "write-ram" && c) {
    const address = parseInt($<HTMLInputElement>("#ram-address").value, 16),
      text = $<HTMLTextAreaElement>("#ram-write").value.trim(),
      bytes = text.split(/\s+/);
    if (
      !text || !Number.isInteger(address) || address < 0x2000 ||
      address + bytes.length > 0xf000 || bytes.length > 256 || bytes.some((v) =>
        !/^[0-9a-f]{2}$/i.test(v)
      )
    ) {
      $("#ram-error").textContent =
        "Use two-digit hex bytes and an address in 2000–EFFF.";
      return;
    }
    stop();
    for (
      const clock of circuit.components.filter((c) => c.kind === "CLOCK")
    ) clock.value = 0;
    evaluate();
    memory = programGateMemory(
      circuit,
      memory,
      c.id,
      address,
      bytes.map((v) => parseInt(v, 16)),
    );
    evaluate();
    render();
  }
  if (target.id === "assemble-rom" && c) {
    try {
      const text = $<HTMLTextAreaElement>("#rom-source").value;
      const result = assemble(text);
      stop();
      mutate(() => {
        c.contents = [...result.rom];
        c.source = text;
        memory = { q: {}, clock: {} };
        for (const node of circuit.components) {
          if (node.kind === "CLOCK") node.value = 0;
        }
      });
    } catch (error) {
      $("#rom-assembly-error").textContent = (error as Error).message;
    }
  }
});

type InsidePage = {
  circuit?: Circuit;
  simulation: ReturnType<typeof simulate>;
  label: string;
  component?: Component;
  view?: { x: number; y: number; zoom: number };
};
let insidePages: InsidePage[] = [];
function openInside(c: Component) {
  stop();
  $("#dialog").classList.add("inside-dialog");
  insidePages = [];
  navigateInside(c, circuit, sim);
  $<HTMLDialogElement>("#dialog").showModal();
  fitInside();
}
function navigateInside(
  c: Component,
  parent: Circuit,
  simulation: ReturnType<typeof simulate>,
) {
  const inspected = inspectCircuit(c, parent, simulation);
  const next = inspected?.circuit;
  $("#dialog-title").textContent = `Inside ${c.label}`;
  if (!next) {
    insidePages.push({ label: c.label, simulation, component: c });
    paintInside();
    return;
  }
  insidePages.push({ ...inspected!, label: c.label });
  paintInside();
}
function paintInsideLeaf(c: Component, simulation: Simulation) {
  const mos = ["NMOS", "PMOS"].includes(c.kind);
  const ports = simulation.inputs[c.id] ?? [];
  const structural = mos
    ? `<svg class="transistor-section" viewBox="0 0 440 220" role="img" aria-label="${c.kind} source, insulated gate, drain and substrate"><rect x="20" y="100" width="400" height="90" rx="8" fill="#e9eee1" stroke="#809473"/><rect x="45" y="100" width="85" height="55" fill="#c5d6b8"/><rect x="310" y="100" width="85" height="55" fill="#c5d6b8"/><rect x="145" y="80" width="150" height="12" fill="#d7d2bf"/><rect x="145" y="48" width="150" height="30" rx="4" fill="#809473"/><path d="M88 100V35 M352 100V35 M220 48V20" fill="none" stroke="#527d3c" stroke-width="3"/><text x="35" y="25">Source: ${
      ports[1] ?? "X"
    }</text><text x="170" y="15">Gate: ${
      ports[0] ?? "X"
    }</text><text x="310" y="25">Drain: ${
      simulation.values[c.id] ?? "X"
    }</text><text x="155" y="180">${
      c.kind === "NMOS" ? "p substrate · n+ contacts" : "n well · p+ contacts"
    }</text><text x="155" y="215">Insulated gate / oxide</text></svg>`
    : "";
  $("#dialog-body").innerHTML = `<h3>${esc(c.kind)}</h3>${structural}<p>${
    esc(descriptions[c.kind])
  }</p><p class="muted">${
    ["NMOS", "PMOS"].includes(c.kind)
      ? "Gate controls the conductive channel between source and drain. This is a logic switch model: Z means high impedance. It does not model analog voltage, current, capacitance, or transistor physics."
      : ["POWER", "GROUND", "INPUT", "OUTPUT", "JUNCTION"].includes(c.kind)
      ? "Electrical primitive. There is no lower component definition."
      : "This is a physical input or output boundary. Its connected signals are shown above."
  }</p>`;
}
function paintInside() {
  const page = insidePages.at(-1);
  if (!page) return;
  if (!page.circuit) {
    paintInsideLeaf(page.component!, page.simulation);
    $("#dialog-body").insertAdjacentHTML("afterbegin", insideBreadcrumbs());
    return;
  }
  $("#dialog-title").textContent = `Inside ${page.label}`;
  $("#dialog-body").innerHTML =
    `${insideBreadcrumbs()}<p class="muted">Signal snapshot · click a component or press Enter to inspect it. Drag the background to pan; scroll to zoom.</p><div class="inside-tools"><button id="inside-zoom-out" aria-label="Zoom out internals">−</button><span id="inside-zoom"></span><button id="inside-zoom-in" aria-label="Zoom in internals">+</button><button id="inside-fit">Fit all</button><select id="inside-find" aria-label="Find an internal component"><option value="">Find a component…</option>${
      page.circuit.components.map((c) =>
        `<option value="${esc(c.id)}">${esc(c.label)} · ${c.kind} · ${
          esc(c.id)
        }</option>`
      ).join("")
    }</select></div><div class="inside-scroll"><svg id="inside-circuit" role="img" aria-label="Internal circuit of ${
      esc(page.label)
    }">${
      draw(page.circuit, page.simulation, new Set(), null)
    }</svg></div><button id="inside-open-circuit">Edit a copy in Playground</button>`;
  if (page.view) viewInside();
  else if ($<HTMLDialogElement>("#dialog").open) fitInside();
}
function insideBreadcrumbs() {
  return `<div class="inside-breadcrumbs">${
    insidePages.length > 1 ? '<button id="inside-back">← Back</button>' : ""
  }${
    insidePages.map((p, i) =>
      `<button data-inside-level="${i}" ${
        i === insidePages.length - 1 ? 'aria-current="page"' : ""
      }>${esc(p.label)}</button>`
    ).join(" → ")
  }</div>`;
}
function viewInside() {
  const page = insidePages.at(-1), svg = $("#inside-circuit");
  if (!page?.view || !svg) return;
  const r = $(".inside-scroll").getBoundingClientRect();
  svg.setAttribute(
    "viewBox",
    `${page.view.x} ${page.view.y} ${r.width / page.view.zoom} ${
      r.height / page.view.zoom
    }`,
  );
  $("#inside-zoom").textContent = `${Math.round(page.view.zoom * 100)}%`;
}
function fitInside() {
  const page = insidePages.at(-1);
  if (!page?.circuit) return;
  const r = $(".inside-scroll").getBoundingClientRect(),
    box = insideBounds(page.circuit);
  const zoom = Math.min(1, r.width / box.width, r.height / box.height);
  page.view = {
    x: box.x - (r.width / zoom - box.width) / 2,
    y: box.y - (r.height / zoom - box.height) / 2,
    zoom,
  };
  viewInside();
}
function zoomInside(factor: number, clientX?: number, clientY?: number) {
  const page = insidePages.at(-1);
  if (!page?.view) return;
  const r = $(".inside-scroll").getBoundingClientRect(), v = page.view;
  const px = clientX === undefined ? r.width / 2 : clientX - r.left;
  const py = clientY === undefined ? r.height / 2 : clientY - r.top;
  const zoom = Math.max(.015, Math.min(3, v.zoom * factor));
  v.x += px / v.zoom - px / zoom;
  v.y += py / v.zoom - py / zoom;
  v.zoom = zoom;
  viewInside();
}
let insideDrag: { x: number; y: number; pointer: number } | undefined;
$("#dialog-body").addEventListener("wheel", (event) => {
  if (!(event.target as Element).closest(".inside-scroll")) return;
  event.preventDefault();
  zoomInside(event.deltaY < 0 ? 1.15 : 1 / 1.15, event.clientX, event.clientY);
}, { passive: false });
$("#dialog-body").addEventListener("pointerdown", (event) => {
  const surface = (event.target as Element).closest<HTMLElement>(
    ".inside-scroll",
  );
  if (
    !surface || (event.target as Element).closest(".component-body,.pin") ||
    event.button !== 0
  ) return;
  insideDrag = { x: event.clientX, y: event.clientY, pointer: event.pointerId };
  surface.setPointerCapture(event.pointerId);
});
$("#dialog-body").addEventListener("pointermove", (event) => {
  const v = insidePages.at(-1)?.view;
  if (!insideDrag || !v || event.pointerId !== insideDrag.pointer) return;
  v.x -= (event.clientX - insideDrag.x) / v.zoom;
  v.y -= (event.clientY - insideDrag.y) / v.zoom;
  insideDrag.x = event.clientX;
  insideDrag.y = event.clientY;
  viewInside();
});
$("#dialog-body").addEventListener("pointerup", () => insideDrag = undefined);
$("#dialog-body").addEventListener(
  "pointercancel",
  () => insideDrag = undefined,
);
$("#dialog-body").addEventListener("keydown", (event) => {
  const body = (event.target as Element).closest<HTMLElement>(
    "#inside-circuit .component-body",
  );
  if (body && ["Enter", " "].includes(event.key)) {
    event.preventDefault();
    event.stopPropagation();
    body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }
});
$("#dialog-body").addEventListener("change", (event) => {
  if ((event.target as Element).id !== "inside-find") return;
  const page = insidePages.at(-1),
    c = page?.circuit?.components.find((n) =>
      n.id === (event.target as HTMLSelectElement).value
    );
  if (!c || !page) return;
  const r = $(".inside-scroll").getBoundingClientRect();
  page.view = { x: c.x - r.width / 2, y: c.y - r.height / 2, zoom: 1 };
  viewInside();
  $("#inside-circuit").querySelector<HTMLElement>(
    `[data-node="${CSS.escape(c.id)}"] .component-body`,
  )?.focus({ preventScroll: true });
});
$("#dialog-body").addEventListener("click", (event) => {
  const target = (event.target as Element).closest<HTMLElement>(
    "[data-inside-level],#inside-circuit .component-body,#inside-back,#inside-open-circuit,#inside-fit,#inside-zoom-in,#inside-zoom-out",
  );
  if (!target) return;
  if (target.dataset.insideLevel !== undefined) {
    insidePages = insidePages.slice(0, Number(target.dataset.insideLevel) + 1);
    paintInside();
    return;
  }
  if (target.id === "inside-fit") {
    fitInside();
    return;
  }
  if (target.id === "inside-zoom-in" || target.id === "inside-zoom-out") {
    zoomInside(target.id === "inside-zoom-in" ? 1.25 : .8);
    return;
  }
  if (target.id === "inside-back") {
    insidePages.pop();
    paintInside();
    return;
  }
  if (target.id === "inside-open-circuit") {
    const page = insidePages.at(-1);
    if (page?.circuit) {
      persist();
      mode = "playground";
      localStorage.setItem("literal.mode", mode);
      $<HTMLDialogElement>("#dialog").close();
      load(clone(page.circuit));
    }
    return;
  }
  const page = insidePages.at(-1),
    c = page?.circuit?.components.find((c) =>
      c.id === target.closest<HTMLElement>("[data-node]")?.dataset.node
    );
  if (page?.circuit && c) navigateInside(c, page.circuit, page.simulation);
});
function selectCourse(index: number) {
  persist();
  if (!freeBuild) {
    localStorage.setItem(
      `literal.lessonStep.${courses[courseIndex].id}`,
      String(lessonStep),
    );
  }
  freeBuild = index < 0;
  if (!freeBuild) courseIndex = Math.min(index, courses.length - 1);
  localStorage.setItem(
    "literal.course",
    freeBuild ? "free" : courses[courseIndex].id,
  );
  lessonStep = freeBuild ? 0 : Math.max(
    0,
    Math.min(
      courses[courseIndex].steps.length - 1,
      Number(
        localStorage.getItem(`literal.lessonStep.${courses[courseIndex].id}`),
      ) || 0,
    ),
  );
  localStorage.setItem("literal.lessonStep", String(lessonStep));
  const saved = localStorage.getItem(
    `literal.discover.course.${freeBuild ? "free" : courses[courseIndex].id}`,
  );
  labReport = undefined;
  let next = !freeBuild && courses[courseIndex].lab
    ? labStarter(courses[courseIndex].id, clone(library))
    : blank();
  next.name = freeBuild ? "Discover workspace" : courses[courseIndex].name;
  if (saved) {
    try {
      next = parseCircuit(saved);
    } catch {}
  }
  restoreCourseTests();
  load(next);
  $<HTMLDialogElement>("#dialog").close();
}
function chooseCourse() {
  dialog(
    "Discover courses",
    `<div class="example-dialog">${
      courses.map((course, index) => {
        const unlocked = index === 0 || completedCourses.has(course.id) ||
          completedCourses.has(courses[index - 1].id) ||
          courseState(
            courses[index - 1],
            circuit,
            sim,
            new Set(),
            library,
            discovered,
          ).saved;
        return `<button data-course="${index}" ${
          unlocked ? "" : "disabled"
        }><strong>${index + 1}. ${esc(course.name)}</strong><span>${
          unlocked
            ? completedCourses.has(course.id)
              ? "✓ Completed · revisit workspace"
              : "Open course workspace"
            : "Complete the previous course to unlock"
        }</span></button>`;
      }).join("")
    }<button data-course="free"><strong>Continue building</strong><span>Use your discovered components on a free canvas</span></button></div>`,
  );
}
$("#dialog-body").addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>(
    "[data-course]",
  );
  if (button && !button.disabled) {
    selectCourse(
      button.dataset.course === "free" ? -1 : Number(button.dataset.course),
    );
  }
});
function renderDiscover() {
  const target = $("#discover-guide");
  target.hidden = mode !== "discover";
  if (mode !== "discover") return;
  if (freeBuild) {
    target.innerHTML =
      '<div class="lesson-heading"><span class="lesson-progress">DISCOVER · FREE BUILD</span><button data-lesson="courses">Courses</button></div>';
    return;
  }
  const previousTests = testedGateInputs.size;
  const course = courses[courseIndex],
    { checks, gate, saved } = courseState(
      course,
      circuit,
      sim,
      testedGateInputs,
      library,
      discovered,
    );
  if (testedGateInputs.size !== previousTests) {
    try {
      localStorage.setItem(
        `literal.courseTests.${course.id}`,
        JSON.stringify([...testedGateInputs].slice(-128)),
      );
    } catch {}
  }
  if (course.lab) {
    if (labReport && labReportCircuit !== JSON.stringify(circuit)) {
      labReport = undefined;
    }
    const completed = completedCourses.has(course.id);
    const lesson = course.steps[lessonStep];
    const deviceLinks = circuit.components.filter((n) =>
      [
        "BUS_CPU",
        "BUS_ROM",
        "BUS_RAM",
        "BUS_SCREEN",
        "BUS_KEYBOARD",
        "BUS_TERMINAL",
      ].includes(n.kind) || n.id === "alu" || n.id === "clock"
    ).map((n) =>
      `<button data-lesson="focus" data-focus-node="${esc(n.id)}">${
        esc(
          n.id === "alu"
            ? "ALU"
            : n.kind === "BUS_CPU"
            ? "CPU"
            : n.kind === "BUS_ROM"
            ? "ROM"
            : n.label,
        )
      }</button>`
    ).join("");
    target.innerHTML =
      `<div class="lesson-heading"><span class="lesson-progress">${
        esc(course.name.toUpperCase())
      } · ${
        lessonStep + 1
      } / ${course.steps.length}</span><div class="lesson-course-tools"><button data-lesson="courses">Courses</button><button data-lesson="hint">Hint</button><button data-lesson="example">Example</button></div></div><h2>${
        esc(lesson.title)
      }</h2><div class="lesson-content"><p>${
        esc(lesson.text)
      }</p><p class="lesson-check" role="status">${
        checkingLab
          ? "Testing a copy of your circuit…"
          : labReport
          ? esc(labReport.message)
          : completed
          ? "✓ Course completed · you can revisit and recheck your work"
          : "Build on the canvas, then use Check circuit. Hint and Example explain the wiring or program."
      }</p>${
        deviceLinks
          ? `<div class="lesson-devices" aria-label="Find a device">${deviceLinks}<span>F to see all</span></div>`
          : ""
      }</div><div class="lesson-actions"><button data-lesson="previous" ${
        lessonStep === 0 ? "disabled" : ""
      }>Back</button>${
        lessonStep < course.steps.length - 1
          ? '<button data-lesson="next">Next step</button>'
          : ""
      }${
        ["half-adder", "full-adder", "byte-adder", "mux", "latch", "alu"]
            .includes(course.id)
          ? '<button data-lesson="save-lab">Save this gate</button>'
          : ""
      }<button data-lesson="check" ${
        checkingLab ? "disabled" : ""
      }>Check circuit</button>${
        completed
          ? `<button class="primary" data-lesson="${
            courseIndex < courses.length - 1 ? "next-course" : "free"
          }">${
            courseIndex < courses.length - 1
              ? "Next course →"
              : "Continue building"
          }</button>`
          : ""
      }</div>`;
    return;
  }
  const lesson = course.steps[lessonStep],
    last = lessonStep === course.steps.length - 1;
  const live = gate
    ? `<div class="lesson-signals">${
      gate.inputs.map((c, i) =>
        `${esc(c.label || String.fromCharCode(65 + i))} <strong>${
          sim.values[c.id]
        }</strong>`
      ).join(" · ")
    } → Output <strong>${sim.values[gate.output.id]}</strong></div>`
    : "";
  target.innerHTML =
    `<div class="lesson-heading"><div class="lesson-progress">${
      courseIndex === 0 ? "FIRST GATE" : esc(course.name.toUpperCase())
    } · ${
      lessonStep + 1
    } / ${course.steps.length}</div><div class="lesson-course-tools"><button data-lesson="courses">Courses</button><button data-lesson="hint" class="lesson-hint-button" aria-label="Show hint for step ${
      lessonStep + 1
    }">Hint</button></div></div><h2>${
      esc(lesson.title)
    }</h2><div class="lesson-content"><p>${
      esc(lesson.text)
    }</p>${live}<p class="lesson-check" role="status">${
      saved
        ? `✓ ${course.id.toUpperCase()} saved · Course complete`
        : last
        ? "Save the gate to finish this course"
        : checks[lessonStep]
        ? "✓ Step complete"
        : lessonStep === course.steps.length - 2
        ? "Test every input combination"
        : "Build this step on the canvas"
    }</p></div><div class="lesson-actions"><button data-lesson="previous" ${
      lessonStep === 0 ? "disabled" : ""
    }>Back</button>${
      last
        ? `<button data-lesson="save" ${!gate ? "disabled" : ""}>${
          saved ? "Save again" : "Save gate"
        }</button>`
        : `<button data-lesson="next" ${
          checks[lessonStep] ? "" : "disabled"
        }>Next</button>`
    }${
      saved
        ? `<button class="primary" data-lesson="${
          courseIndex < courses.length - 1 ? "next-course" : "free"
        }">${
          courseIndex < courses.length - 1
            ? "Next course →"
            : "Continue building"
        }</button>`
        : ""
    }</div>`;
}
function chooseMode() {
  dialog(
    "Choose a mode",
    `<div class="mode-choices"><button data-mode="discover"><strong>Discover</strong><span>Start with transistors and electricity. Build and save your own components.</span></button><button data-mode="playground"><strong>Playground</strong><span>All components, examples, and wired computers available.</span></button></div>`,
  );
}
$("#dialog-body").addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLElement>("[data-mode]");
  if (!button) return;
  persist();
  mode = button.dataset.mode as typeof mode;
  localStorage.setItem("literal.mode", mode);
  const saved = localStorage.getItem(
    mode === "discover" ? "literal.discover.circuit" : "literal.circuit",
  );
  let next = blank();
  if (saved) {
    try {
      next = parseCircuit(saved);
    } catch {}
  }
  load(next);
  $<HTMLDialogElement>("#dialog").close();
});
if (mode === "discover") {
  const saved = localStorage.getItem("literal.discover.circuit");
  let next = blank();
  if (saved) {
    try {
      next = parseCircuit(saved);
    } catch {}
  }
  load(next);
}
if (!localStorage.getItem("literal.mode")) chooseMode();
