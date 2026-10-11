import {
  assemble,
  biosGame,
  Computer,
  instructionSet,
  keyboardCode,
  screenColors,
  screenHeight,
  screenWidth,
} from "@literal/core";
import { esc } from "./drawing.ts";
const hex = (n: number, width = 2) =>
  n.toString(16).toUpperCase().padStart(width, "0");
let root: HTMLElement,
  machine: Computer,
  assembly = assemble(biosGame),
  timer: ReturnType<typeof setInterval> | null = null,
  capture = false;
let source = biosGame;
try {
  source = localStorage.getItem("literal.assembly") ?? biosGame;
} catch {}
let held = new Map<string, number>();
const stop = () => {
  if (timer) clearInterval(timer);
  timer = null;
};
const release = () => {
  held.clear();
  if (machine) machine.keyboard.pressed = false;
};
const active = () => root && !root.hidden;
const byId = <T extends HTMLElement = HTMLElement>(id: string) =>
  root.querySelector<T>(`#${id}`)!;
function paint() {
  const ctx = byId<HTMLCanvasElement>("computer-screen").getContext("2d")!;
  machine.framebuffer.forEach((color, i) => {
    ctx.fillStyle = screenColors[color];
    ctx.fillRect(i % screenWidth, Math.floor(i / screenWidth), 1, 1);
  });
  byId("cpu-state").innerHTML = `<div class="cpu-registers">${
    [...machine.registers].map((v, i) => `<span>R${i}<b>${hex(v)}</b></span>`)
      .join("")
  }<span>PC<b>${hex(machine.pc, 4)}</b></span><span>SP<b>${
    hex(machine.sp, 4)
  }</b></span><span>Z / C<b>${+machine.zero} / ${+machine
    .carry}</b></span></div>`;
  byId("computer-status").textContent = machine.error ||
    `${
      machine.halted ? "Halted" : timer ? "Running" : "Paused"
    } · ${machine.cycles.toLocaleString()} instructions`;
  byId("computer-run").textContent = timer ? "Pause" : "Run";
  byId("computer-capture").textContent = capture
    ? "Keyboard captured · Esc releases"
    : "Capture keyboard";
  byId("computer-capture").setAttribute("aria-pressed", String(capture));
  byId("computer-terminal").textContent = machine.terminal || "Boot output";
  const start = parseInt(byId<HTMLInputElement>("memory-address").value, 16);
  if (Number.isInteger(start) && start >= 0 && start <= 0xffff) {
    const aligned = start & 0xfff0;
    byId("memory-bytes").textContent = Array.from({ length: 8 }, (_, row) => {
      const address = (aligned + row * 16) & 0xffff;
      return `${hex(address, 4)}  ${
        Array.from({ length: 16 }, (_, i) =>
          hex(machine.read((address + i) & 0xffff))).join(" ")
      }`;
    }).join("\n");
  }
  root.querySelectorAll<HTMLElement>("[data-address]").forEach((row) =>
    row.classList.toggle("current", Number(row.dataset.address) === machine.pc)
  );
}
function listing() {
  byId("computer-listing").innerHTML = assembly.listing.map((l) =>
    `<div data-address="${l.address}"><span>${hex(l.address, 4)}</span><span>${
      l.bytes.map((b) => hex(b)).join(" ")
    }</span><span>${esc(l.source)}</span></div>`
  ).join("");
}
function reset() {
  stop();
  release();
  machine = new Computer(assembly.rom);
  paint();
}
function download(data: Blob, name: string) {
  const url = URL.createObjectURL(data), a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function runBatch() {
  const budget = Number(byId<HTMLSelectElement>("computer-speed").value);
  const text = byId<HTMLInputElement>("computer-breakpoint").value.trim();
  const breakpoint = /^[0-9a-f]{1,4}$/i.test(text) ? parseInt(text, 16) : -1;
  for (let i = 0; i < budget && !machine.halted; i++) {
    if (machine.pc === breakpoint) {
      stop();
      break;
    }
    machine.step();
  }
  if (machine.halted) stop();
  paint();
}
export function openComputer() {
  document.querySelectorAll<HTMLElement>(".tool-workspace").forEach((panel) =>
    panel.hidden = true
  );
  if (!root) {
    root = document.createElement("section");
    root.id = "computer-workspace";
    root.className = "tool-workspace";
    root.innerHTML =
      `<div class="workspace-toolbar"><strong>Computer · Literal 8</strong><button id="computer-assemble">Assemble & reset</button><button id="computer-step">Step</button><button id="computer-run">Run</button><button id="computer-reset">Reset</button><label>Instructions / frame <select id="computer-speed"><option>100</option><option selected>1000</option><option>10000</option></select></label><button id="computer-demo">BIOS + pixel game</button><button id="computer-save">Save source</button><button id="computer-rom">Export ROM</button><button id="computer-close" class="workspace-close">Back to circuit</button></div><div class="computer-layout"><div class="assembly-pane"><label for="assembly-source">Assembly</label><textarea id="assembly-source" spellcheck="false" aria-label="Assembly source">${
        esc(source)
      }</textarea><p id="assembly-error" role="alert"></p><details><summary>Instruction set & memory map</summary><p>8 registers · 8-bit values · 16-bit addresses · little-endian operands. ROM 0000–1FFF, RAM 2000–EFFF, framebuffer F000–F2FF, key code FF00, key pressed FF01, screen clear FF02, terminal FF03. Reset starts at 0000.</p><p>Labels, .org, .byte, decimal, 0x hex, 0b binary, and ASCII character literals are supported. Registers R0–R7. Branches use Z / carry (borrow for subtraction). LD and MOV preserve flags.</p>${
        instructionSet.map((op) =>
          `<code>${op.name} ${
            [...op.args].map((a, i) =>
              a === "r" ? `R${i}` : a === "a" ? "address" : "byte"
            ).join(", ")
          }</code>`
        ).join(" · ")
      }<p>PIXEL Rx, Ry, Rcolor draws one pixel. CLS clears the screen. Other devices use memory-mapped LD / ST. Stack grows down from EFFF. The runner executes instructions, independently of the gate canvas.</p></details><div id="computer-listing" class="assembly-listing"></div></div><div class="computer-monitor"><div class="screen-controls"><button id="computer-capture">Capture keyboard</button><label>Breakpoint (hex)<input id="computer-breakpoint" maxlength="4" placeholder="0200" aria-label="Breakpoint address"></label></div><div id="computer-status" role="status"></div><div id="cpu-state"></div><canvas id="computer-screen" width="${screenWidth}" height="${screenHeight}" tabindex="0" aria-label="Pixel screen. Click to capture keyboard."></canvas><div class="computer-keys">${
        ["↑", "←", "↓", "→"].map((key, i) =>
          `<button data-computer-key="${
            [128, 130, 129, 131][i]
          }" aria-label="Virtual ${key}">${key}</button>`
        ).join("")
      }</div><p class="muted">White: player · Green: collect · Arrow keys move · Score at RAM 2000</p><pre id="computer-terminal" class="computer-terminal"></pre><label>Memory address (hex)<input id="memory-address" value="2000" maxlength="4" aria-label="Memory address"></label><pre id="memory-bytes" class="memory-bytes"></pre></div></div>`;
    document.body.append(root);
    try {
      assembly = assemble(source);
    } catch (error) {
      byId("assembly-error").textContent = (error as Error).message;
    }
    machine = new Computer(assembly.rom);
    listing();
    root.addEventListener("click", (e) => {
      const target = (e.target as Element).closest<HTMLElement>(
        "button,canvas",
      );
      if (!target) return;
      switch (target.id) {
        case "computer-close":
          stop();
          release();
          capture = false;
          root.hidden = true;
          return;
        case "computer-assemble":
          try {
            const next = assemble(
              byId<HTMLTextAreaElement>("assembly-source").value,
            );
            assembly = next;
            source = byId<HTMLTextAreaElement>("assembly-source").value;
            localStorage.setItem("literal.assembly", source);
            byId("assembly-error").textContent = "";
            listing();
            reset();
          } catch (error) {
            byId("assembly-error").textContent = (error as Error).message;
          }
          break;
        case "computer-step":
          stop();
          machine.step();
          break;
        case "computer-run":
          if (timer) stop();
          else timer = setInterval(runBatch, 16);
          break;
        case "computer-reset":
          reset();
          break;
        case "computer-demo":
          byId<HTMLTextAreaElement>("assembly-source").value = biosGame;
          break;
        case "computer-save":
          download(
            new Blob([byId<HTMLTextAreaElement>("assembly-source").value], {
              type: "text/plain",
            }),
            "computer.asm",
          );
          break;
        case "computer-rom":
          download(
            new Blob([new Uint8Array(assembly.rom)], {
              type: "application/octet-stream",
            }),
            "computer.rom",
          );
          break;
        case "computer-screen":
          capture = true;
          break;
        case "computer-capture":
          capture = !capture;
          release();
          break;
      }
      paint();
    });
    byId("memory-address").addEventListener("input", paint);
    root.addEventListener("keydown", (e) => {
      const button = (e.target as Element).closest<HTMLElement>(
        "[data-computer-key]",
      );
      if (!button || !["Enter", " "].includes(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      held.set("virtual", Number(button.dataset.computerKey));
      machine.keyboard = {
        code: Number(button.dataset.computerKey),
        pressed: true,
      };
      paint();
    });
    root.addEventListener("pointerdown", (e) => {
      const button = (e.target as Element).closest<HTMLElement>(
        "[data-computer-key]",
      );
      if (button) {
        e.preventDefault();
        machine.keyboard = {
          code: Number(button.dataset.computerKey),
          pressed: true,
        };
        paint();
      }
    });
    document.addEventListener("pointerup", () => {
      if (active() && !held.size) {
        machine.keyboard.pressed = false;
        paint();
      }
    });
    document.addEventListener("keydown", (e) => {
      if (
        !active() || !capture ||
        (e.target instanceof Element &&
          e.target.closest("textarea,input,select"))
      ) return;
      if (e.key === "Escape") {
        capture = false;
        release();
        paint();
        return;
      }
      const code = keyboardCode(e.code);
      if (code !== null) {
        e.preventDefault();
        held.set(e.code, code);
        machine.keyboard = { code, pressed: true };
        paint();
      }
    });
    document.addEventListener("keyup", (e) => {
      if (active() && held.has("virtual") && ["Enter", " "].includes(e.key)) {
        held.delete("virtual");
        machine.keyboard.pressed = !!held.size;
        paint();
        return;
      }
      if (!active() || !held.has(e.code)) return;
      e.preventDefault();
      held.delete(e.code);
      machine.keyboard = {
        code: [...held.values()].at(-1) ?? machine.keyboard.code,
        pressed: !!held.size,
      };
      paint();
    });
    window.addEventListener("blur", () => {
      release();
      if (active()) paint();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        stop();
        release();
        if (active()) paint();
      }
    });
  }
  root.hidden = false;
  paint();
}
