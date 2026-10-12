# Circuit format

Literal files contain JSON. The filename extension is `.literal`; `.json` is
also accepted. The current schema version is `1`.

```json
{
  "version": 1,
  "name": "Switch",
  "components": [
    {
      "id": "input",
      "kind": "INPUT",
      "x": 160,
      "y": 160,
      "label": "A",
      "value": 1
    },
    { "id": "output", "kind": "OUTPUT", "x": 400, "y": 160, "label": "Result" }
  ],
  "wires": [{ "id": "wire", "from": "input", "to": "output", "port": 0 }]
}
```

Coordinates are component centers in canvas units. The editor snaps to 20 units.
A wire starts at the source's output and ends at the target's zero-based input
port. Routes are computed by the renderer rather than stored.

## Components and input ports

| Kind                          | Inputs                             |
| ----------------------------- | ---------------------------------- |
| INPUT, CLOCK                  | None; `value` is 0 or 1, default 0 |
| OUTPUT, LED, NOT, BUFFER      | Port 0                             |
| AND, OR, NAND, NOR, XOR, XNOR | Ports 0 and 1                      |
| MUX                           | 0: data 0; 1: data 1; 2: select    |
| DFF                           | 0: data; 1: clock                  |
| SEVEN_SEG                     | 0–7: a, b, c, d, e, f, g, dp       |
| HEX_DISPLAY                   | 0–3: bits with weights 1, 2, 4, 8  |
| CUSTOM                        | Input blocks in definition order   |

OUTPUT, LED, SEVEN_SEG, and HEX_DISPLAY have no output pins. CUSTOM has one
output per Output block in its definition; other kinds have one output. Each
input accepts one connection. A MUX chooses data 0 when select is 0 and data 1
when select is 1. With unknown select, equal data inputs still produce their
common signal.

D flip-flops start at 0 and sample on a known 0→1 clock transition. All
flip-flops sample the settled values before any flip-flop updates. Simulation
memory is separate from the circuit document.

## Validation

`parseCircuit` validates documents and removes extra fields. Limits are 20,000
components per scope, 50,000 wires per scope, and 20 MB of text. IDs must be
unique across components and wires, use letters, digits, underscores, or
hyphens, and have 1–80 characters. `__proto__`, `constructor`, and `prototype`
are reserved. Names are at most 100 characters and labels at most 80.
Coordinates must be finite and within ±100,000.

Connections must reference existing components, an output-capable source, and a
valid target port. Multiply driven inputs are rejected. Combinational feedback
is accepted as a document but produces a simulation diagnostic. Truth tables
require combinational circuits, at least one output, and no more than eight
inputs.

## Custom definitions

A circuit can include a `definitions` array. Each definition contains `id`,
`name`, `color` (six-digit CSS hex), `shape` (`rectangle`, `rounded`, or
`diamond`), `components`, and `wires`. A CUSTOM instance references it through
`definition`. Definition Input blocks form the instance inputs; Output blocks
form its outputs. The Input/Output array order determines pin order.

Wires can have `fromPort` for a zero-based source output index; omission means
zero. `port` remains the target input index. Definitions may reference other
definitions in the same circuit. Recursive definitions and more than 48 levels
of nesting are rejected. Storage components can be included; physical clocks,
keyboards, and displays stay outside the selection. Circuit files allow 2,000
definitions, 100 million declared expanded parts per definition, and 200 million
per circuit. Large memory banks elaborate only active branches. The editor's
library allows 100 user components; internal hardware definitions are hidden.
Input blocks can mark a timing pin with `clockInput: true`; gate feedback
buffers preserve their initial value. Internal definitions carry
`internal: true`. Simulation exposes additional custom outputs in
`outputValues`; `values` holds the first output for compatibility.

## Byte devices and peripherals

All gate-canvas wires remain single-bit; byte devices expose separate bit pins.
Bit zero is the least significant bit.

| Kind      | Inputs                                       | Outputs        |
| --------- | -------------------------------------------- | -------------- |
| REGISTER8 | D0–D7, Clock, Enable, Clear                  | D0–D7          |
| COUNTER8  | Clock, Enable, Clear                         | D0–D7          |
| ADDER8    | A0–A7, B0–B7, Carry in                       | S0–S7, Carry   |
| RAM       | A0–A7, D0–D7, Write, Clock                   | D0–D7          |
| ROM       | A0–A7                                        | D0–D7          |
| KEYBOARD  | None                                         | D0–D7, Pressed |
| VGA       | X0–X4, Y0–Y4, Red, Green, Blue, Write, Clear | None           |

Registers and counters update on a known 0→1 clock transition when enabled.
Clear has priority and is asynchronous. RAM has 256 bytes, asynchronous read,
and writes on a known rising Clock when Write is high. Unknown stored bits are
preserved. ROM accepts a `contents` array of up to 256 integers in 0–255;
missing bytes read zero. Unknown addresses produce unknown data.

Keyboard `keyMap` maps physical browser `KeyboardEvent.code` strings to virtual
key names (A–Z, 0–9, Space, Enter, Backspace, Tab, ↑, ↓, ←, →). Its output is
uppercase ASCII plus the arrow codes defined in [computer.md](computer.md). The
most recently held key takes priority. After release, the code remains latched
and Pressed goes low. Capture is opt-in and Escape releases it.

VGA stores a 32 × 24 framebuffer. A known rising Write stores the RGB pixel at
little-endian coordinates; Y 24–31 is ignored. Clear has priority. Unknown
coordinates or RGB cancel the write and produce a diagnostic.

Simulation memory stores gate state in `gates`. `bytes`, `ram`, `screens`,
`terminals`, and `processors` are projections for inspectors and rendering.
Keyboard state is passed as the fourth argument to `simulate`; it is not stored
in circuit files. Reset, reload, and file import reset memory. Registers,
counters, and RAM can be saved in custom definitions. Clocked or interactive
circuits cannot generate combinational truth tables.
