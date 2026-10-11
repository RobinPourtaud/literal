import {
  type Circuit,
  grayOrder,
  type LogicCell,
  minimizeLogic,
  truthTable,
} from "@literal/core";
import { esc } from "./drawing.ts";
let root: HTMLElement,
  names = ["A", "B", "C", "D"],
  cells: LogicCell[] = Array<LogicCell>(16).fill(0),
  current: Circuit;
let selectedGroup = -1;
const colors = [
  "#b8cf9b",
  "#a7c9d1",
  "#d5b7d8",
  "#e1c48e",
  "#c7c0ec",
  "#b6d6c7",
  "#e0b2ac",
  "#c8d3a8",
];
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  root.querySelector<T>(`#${id}`)!;
function render() {
  const rowBits = Math.floor(names.length / 2),
    colBits = names.length - rowBits;
  const result = minimizeLogic(names, cells),
    rows = grayOrder(rowBits),
    cols = grayOrder(colBits);
  $("kmap-grid").innerHTML = `<table class="kmap-table"><thead><tr><th>${
    esc(names.slice(0, rowBits).join(""))
  } / ${esc(names.slice(rowBits).join(""))}</th>${
    cols.map((c) => `<th>${c.toString(2).padStart(colBits, "0")}</th>`).join("")
  }</tr></thead><tbody>${
    rows.map((row) =>
      `<tr><th>${rowBits ? row.toString(2).padStart(rowBits, "0") : "—"}</th>${
        cols.map((col) => {
          const index = (row << colBits) | col;
          const group = result.groups.findIndex((g, i) =>
            (selectedGroup < 0 || i === selectedGroup) &&
            g.cells.includes(index)
          );
          return `<td><button data-cell="${index}" style="${
            group >= 0 ? `background:${colors[group % colors.length]}` : ""
          }" aria-label="${index.toString(2).padStart(names.length, "0")}: ${
            cells[index]
          }">${cells[index]}<small>${index}</small></button></td>`;
        }).join("")
      }</tr>`
    ).join("")
  }</tbody></table>`;
  $("kmap-expression").textContent = result.expression;
  $("kmap-groups").innerHTML =
    result.groups.map((g, i) =>
      `<button data-group="${i}" style="border-color:${
        colors[i % colors.length]
      }" aria-pressed="${selectedGroup === i}">${esc(g.term)}<small>cells ${
        g.cells.join(", ")
      }</small></button>`
    ).join("") || "No groups.";
  try {
    localStorage.setItem("literal.kmap", JSON.stringify({ names, cells }));
  } catch {}
}
function loadCircuit() {
  try {
    const table = truthTable(current);
    if (!table.inputs.length || table.inputs.length > 4) {
      throw Error("Use a combinational circuit with 1–4 Input blocks.");
    }
    const output = Number($<HTMLSelectElement>("kmap-output").value);
    if (!table.outputs[output]) throw Error("Choose an output.");
    names = table.inputs.map((c, i) => c.label || `X${i}`);
    cells = table.rows.map((r) => r.outputs[output]);
    selectedGroup = -1;
    $<HTMLSelectElement>("kmap-variables").value = String(names.length);
    $("kmap-status").textContent = `Loaded ${table.outputs[output].label}.`;
    render();
  } catch (error) {
    $("kmap-status").textContent = (error as Error).message;
  }
}
export function openKarnaugh(circuit: Circuit) {
  document.querySelectorAll<HTMLElement>(".tool-workspace").forEach((panel) =>
    panel.hidden = true
  );
  current = circuit;
  if (!root) {
    root = document.createElement("section");
    root.id = "karnaugh-workspace";
    root.className = "tool-workspace";
    root.innerHTML =
      `<div class="workspace-toolbar"><strong>Karnaugh</strong><label>Variables<select id="kmap-variables"><option>1</option><option>2</option><option>3</option><option selected>4</option></select></label><select id="kmap-output" aria-label="Circuit output"></select><button id="kmap-load">Load circuit output</button><button id="kmap-clear">Clear</button><button id="kmap-copy">Copy expression</button><button id="kmap-close" class="workspace-close">Back to circuit</button></div><div class="kmap-layout"><div><h2>Map</h2><p class="muted">Click a cell to cycle 0 → 1 → X. X is a don't-care. Rows and columns use Gray order; adjacent edges wrap.</p><div id="kmap-grid"></div><p id="kmap-status" role="status"></p></div><div><h2>Minimal sum of products</h2><pre id="kmap-expression"></pre><p class="muted">¬ means NOT, · means AND, + means OR. Minimized by term count, then literal count. Select a term to highlight its group.</p><div id="kmap-groups"></div></div></div>`;
    document.body.append(root);
    try {
      const saved = JSON.parse(localStorage.getItem("literal.kmap") ?? "null");
      if (
        saved && Array.isArray(saved.names) &&
        saved.names.every((n: unknown) =>
          typeof n === "string" && n.length <= 80
        )
      ) {
        minimizeLogic(saved.names, saved.cells);
        names = saved.names;
        cells = saved.cells;
        $<HTMLSelectElement>("kmap-variables").value = String(names.length);
      }
    } catch {}
    root.addEventListener("click", async (e) => {
      const button = (e.target as Element).closest<HTMLElement>("button");
      if (!button) return;
      if (button.dataset.cell !== undefined) {
        const i = Number(button.dataset.cell);
        cells[i] = cells[i] === 0 ? 1 : cells[i] === 1 ? "X" : 0;
        selectedGroup = -1;
        render();
      }
      if (button.dataset.group !== undefined) {
        const i = Number(button.dataset.group);
        selectedGroup = selectedGroup === i ? -1 : i;
        render();
      }
      if (button.id === "kmap-clear") {
        cells.fill(0);
        selectedGroup = -1;
        render();
      }
      if (button.id === "kmap-load") loadCircuit();
      if (button.id === "kmap-close") root.hidden = true;
      if (button.id === "kmap-copy") {
        try {
          await navigator.clipboard.writeText(
            minimizeLogic(names, cells).expression,
          );
          $("kmap-status").textContent = "Expression copied.";
        } catch {
          $("kmap-status").textContent = "Copy the expression above.";
        }
      }
    });
    $("kmap-variables").addEventListener("change", () => {
      names = ["A", "B", "C", "D"].slice(
        0,
        Number($<HTMLSelectElement>("kmap-variables").value),
      );
      cells = Array<LogicCell>(2 ** names.length).fill(0);
      selectedGroup = -1;
      render();
    });
  }
  root.hidden = false;
  try {
    const table = truthTable(current);
    $("kmap-output").innerHTML = table.outputs.map((o, i) =>
      `<option value="${i}">${esc(o.label)}</option>`
    ).join("");
    $("kmap-status").textContent = "";
  } catch (error) {
    $("kmap-output").innerHTML = "";
    $("kmap-status").textContent = (error as Error).message;
  }
  render();
}
