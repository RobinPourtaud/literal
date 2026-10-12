# Discover courses

Start in Discover. Place a component once, then the editor returns to Select.
Click an output pin and an input pin to connect them. Click a component to see
its controls on the right. **Info** explains its purpose and pins in a popup.

The full tutorial is above the canvas. **Hint** explains the current step;
**Example** in later labs shows reference wiring or source. **Next step** lets
those labs be read in order without requiring a complete circuit before the
instructions are visible. **Check circuit** verifies the complete exercise.
**Next course** appears after completion. **Courses** revisits earlier canvases.

| Course      | What you build or do                           | Completion check                                               |
| ----------- | ---------------------------------------------- | -------------------------------------------------------------- |
| NOT         | Complement an input with PMOS and NMOS         | Both input states and a saved working gate                     |
| NAND        | Parallel PMOS, series NMOS                     | All four states and a saved gate                               |
| AND         | NAND followed by NOT                           | All four states and a saved gate                               |
| OR          | Two inverted inputs into NAND                  | All four states and a saved gate                               |
| XOR         | Combine the two exclusive input cases          | All four states and a saved gate                               |
| Half adder  | Sum and carry from two bits                    | All four input pairs, both outputs                             |
| Full adder  | Include an incoming carry                      | All eight cases, sum and carry                                 |
| Byte adder  | Chain eight full adders                        | Individual bits, carry chains, overflow, mixed values          |
| Multiplexer | Select one of two signals                      | All eight data/control cases                                   |
| SR latch    | Complete visible CMOS feedback                 | Set, hold, reset, hold, set again                              |
| Register    | Eight flip-flops sharing a clock               | Capture bytes and each individual bit; hold while data changes |
| RAM         | Connect address, data, write, clock and output | Independent addresses/data bits; write protection              |
| ROM         | Load the three bytes of an instruction         | Addressed reads through the output wires                       |
| ALU         | Select between one-bit AND and XOR             | All eight data/control cases                                   |
| CPU         | Restore four wires in the practice machine     | Fetch, add, store 12, halt                                     |
| Opcodes     | Assemble an addition program                   | R0 and RAM contain 42; CPU halts                               |
| BIOS        | Test RAM, report success, transfer control     | Normal boot and a disabled-write failure path                  |
| Pixels      | Draw red, green, blue pixels                   | Exact framebuffer and halt                                     |
| Triangle    | Fill an expanding shape with nested loops      | Exact 32 × 24 framebuffer and halt                             |
| Keyboard    | Wait for a key and store its code              | Wait without input; correctly read two different keys          |
| Animation   | Move a pixel along a row                       | All 32 positions, wrap, no trail, no halt                      |
| Game        | Move a player to a target                      | Right/Left, unrelated key, redraw, win flag and message        |
| Projection  | Compute and draw a depth-sheared cube          | Exact wireframe framebuffer and halt                           |

## Saving and checking

The first five courses unlock through the behavior of your saved custom
components, regardless of their names. Keep external input controls outside the
selection when saving a network. In later gate labs, saving a reusable component
is optional; **Create component** remains in the library.

Each course has separate circuit and step storage. Gate input observations,
custom components, and lab completion also persist in this browser. Simulation
state is reset after reload: stored registers, RAM contents written during a
run, and the live screen are not saved. ROM contents and assembly source are
saved inside the circuit. Export with **Save** to keep a portable copy.

Lab checks simulate a separate memory state and leave the circuit, live RAM,
clock playback, and live screen alone. Program checks have bounded instruction
budgets. Incorrect or nonterminating programs fail with a concrete diagnostic.
The animation and game checks intentionally require continuing loops until the
specified transition or win condition.

Course completion is an achievement. Changing an already completed circuit does
not relock the following lessons. Check it again to validate your new version.

## What the model represents

The initial gates and the SR latch are ideal digital CMOS switches. They model
0, 1, disconnected Z, and conflict X, rather than analog voltages or transistor
current. The latch starter contains two transistor NAND networks with feedback
connections left open. Keeping them in one electrical network allows state to
hold; feedback between separate custom gate instances is not supported.

D flip-flops, memory arrays, CPU instruction control/registers, and peripherals
are modeled devices. The byte-adder exercise uses learned gate networks. The
practice computer provides a complete gate ALU so the course can focus on the
visible bus, clock, device connections, and code. Use **See inside** to follow
its combinational gates down to transistors. No transistor implementation is
claimed for behavioral devices.

The 3D exercise computes an orthographic depth shear using integer CPU
instructions and draws twelve edges with pixel writes. It is a wireframe
projection, with no perspective, filled polygons, hidden-surface removal, or
GPU.
