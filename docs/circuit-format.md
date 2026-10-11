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
| OUTPUT, NOT, BUFFER           | Port 0                             |
| AND, OR, NAND, NOR, XOR, XNOR | Ports 0 and 1                      |
| MUX                           | 0: data 0; 1: data 1; 2: select    |
| DFF                           | 0: data; 1: clock                  |

OUTPUT has no output pin. All other kinds have one output. Each input accepts
one connection. A MUX chooses data 0 when select is 0 and data 1 when select
is 1. With unknown select, equal data inputs still produce their common signal.

D flip-flops start at 0 and sample on a known 0→1 clock transition. All
flip-flops sample the settled values before any flip-flop updates. Simulation
memory is separate from the circuit document.

## Validation

`parseCircuit` validates documents and removes extra fields. Limits are 500
components, 2,000 wires, and 2 MB of text. IDs must be unique across components
and wires, use letters, digits, underscores, or hyphens, and have 1–80
characters. `__proto__`, `constructor`, and `prototype` are reserved. Names are
at most 100 characters and labels at most 80. Coordinates must be finite and
within ±100,000.

Connections must reference existing components, an output-capable source, and a
valid target port. Multiply driven inputs are rejected. Combinational feedback
is accepted as a document but produces a simulation diagnostic. Truth tables
require combinational circuits, at least one output, and no more than eight
inputs.
