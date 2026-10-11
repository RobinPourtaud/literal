# Literal

A digital logic circuit editor and simulator for the browser, inspired by
Logisim. Draw gates, connect their pins, and inspect signals as the circuit
runs. All circuit execution and storage happen locally in the browser.

![Literal circuit editor and truth table](docs/editor.png)

## Features

- Full-height SVG canvas with grid snapping, selection boxes, group movement,
  zoom, and pan.
- Input switches, output indicators, clocks, AND, OR, NOT, NAND, NOR, XOR, XNOR,
  buffers, multiplexers, and D flip-flops.
- Live `0`, `1`, and unknown `X` signals, with feedback diagnostics.
- Clock stepping, automatic clocks, and simulation reset.
- Component labels and positions, undo/redo, copy/paste, duplication, and
  deletion.
- Truth tables with clickable input combinations and CSV export.
- Browser autosave and validated `.literal` JSON import/export.
- Half adder, full adder, multiplexer, register, and toggle flip-flop examples.
- Keyboard controls and reduced-motion support. The compact sage interface
  follows ISETL Web.

Literal currently uses single-bit signals. Buses, subcircuits, asynchronous
latch simulation, and Logisim `.circ` import are not implemented.

## Run locally

Install Deno 2, then:

```sh
deno task dev
```

Open the local URL printed by Vite. No application server or account is
required.

```sh
deno task test
deno task build
deno task preview
```

The production build is a static site in `dist/`. Vite runs through Deno's npm
compatibility layer; Node and npm commands are not required.

## Drawing and simulation

Choose a component, then click the canvas. Press Esc to return to selection.
Click an output pin and an input pin to connect them. Each input accepts one
driver; outputs can drive multiple inputs. Crossing wires do not create a
junction.

Click an input block to toggle it. Drag components to move them. Shift-click or
drag a selection box to select several. Wheel to zoom, Space + drag to pan, and
F to fit the circuit. The Reference button lists all keyboard controls. Keyboard
placement is available through Place at center.

Clocks alternate at 2 Hz when running. Step changes the clock level once. D
flip-flops capture on a known rising edge, start at zero, and hold their value
between edges. Opening a file, reloading, undoing, and resetting clear flip-flop
memory. The circuit document stores input and clock levels, not simulation
memory.

Autosave keeps the current circuit in this browser's local storage. Download a
`.literal` file to keep a portable copy. Opening a file replaces the current
circuit; Undo restores it during the session.

## Reusable simulation core

`packages/core` has no DOM dependencies. It can be imported by a Deno program or
bundled into another frontend:

```ts
import {
  parseCircuit,
  simulate,
  truthTable,
} from "./packages/core/src/index.ts";

const circuit = parseCircuit(await Deno.readTextFile("adder.literal"));
const result = simulate(circuit);
console.log(result.values, result.warnings);
console.log(truthTable(circuit).rows);
```

Pass `result.memory` to the next `simulate` call to preserve flip-flop state.
Use `parseCircuit` to validate external documents. See
[the circuit format](docs/circuit-format.md).

## Development

- `packages/core/`: gate evaluation, state, document validation, and truth
  tables.
- `apps/web/`: editor, SVG renderer, examples, and styles.
- `tests/`: Deno simulation and validation tests.
- `scripts/browser_check.ts`: interaction checks using Orca's embedded browser.

To repeat the browser checks, start `deno task dev --port 5176`, open an Orca
browser tab for this worktree, and run `deno task browser-check`. This replaces
the preview's current circuit while testing and finishes on the half adder
example. The checks dispatch DOM pointer and keyboard events through Orca's
browser evaluation API; they do not certify native mouse or touch input.

See [CONTRIBUTING.md](CONTRIBUTING.md). Original code is MIT licensed. Logisim
is an inspiration; no Logisim source is included.
