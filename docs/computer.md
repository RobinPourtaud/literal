# Literal 8 computer

Load **Examples → Snake computer** in Playground. The machine is an editable
circuit with CPU, gate ALU, ROM, RAM, keyboard, screen, and terminal connected
through a 16-bit address / 8-bit data bus.

## Controls

- Select the Clock component. Its right panel has **Run clock**, **Step**, and
  **Frequency (Hz)**; frequency can change while running. The actual measured
  rate depends on browser and circuit performance.
- **Step** toggles clocks once; an instruction runs on each rising edge.
- Click keyboard for virtual keys, physical capture, and key remapping.
- Click screen for a preview; the framebuffer is also visible on the circuit.
- Click ROM to edit assembly or hex bytes and assemble/reset the machine.
- Click RAM to inspect contents and write hex bytes at a chosen address.
- **Pin to right panel** keeps a device visible while inspecting another.
- **See inside** traverses custom circuits, logic gates, and transistor
  structure.

## Implementation

The CPU drives real address/data/control pins. ROM, RAM, keyboard, and screen
respond through their connections. The ALU is a programmable AND/OR/NOT circuit;
its wired results feed the CPU. Disconnecting or changing wires changes
behavior. Instruction sequencing, registers, memory, and peripherals are
behavioral models. Gate inspection exposes digital CMOS switch networks, not
analog physics.

## Run the included game

Run the clock and wait for the BIOS RAM self-test. Use arrow keys or the virtual
buttons to move one cell per press. Hold a key long enough for the program to
poll it, especially at low clock rates. Collect green food, avoid walls and your
body, and press R after game over. Escape releases physical keyboard capture.

The boot ROM prints its device configuration, writes and checks both `55` and
`AA` patterns across the first 256 bytes of RAM, clears those bytes, and calls
into the game. A failed memory check halts boot. The displayed log comes from
instructions writing to the terminal device.

Snake uses the existing instruction set: indexed RAM stores the body, branches
check collisions, and `PIXEL` draws the board. The UI supplies key state and
renders output; movement, food placement, growth, winning, and restarting all
run as assembled opcodes. [The source](../packages/core/src/snake.ts) can be
edited in the ROM inspector and saved with the circuit.

Snake stores length at `2000`, score at `2001`, state at `2004` (0 playing, 1
game over, 2 won), and body X/Y coordinates at `2100`/`2200`. Food placement
checks occupied cells.

## Machine

- Eight byte registers: `R0`–`R7`.
- Sixteen-bit program counter and stack pointer; stack starts at `EFFF` and
  grows downward.
- Zero and carry flags. Subtraction/comparison set carry for a borrow.
- Arithmetic wraps at 8 bits. Loads and moves preserve flags.
- Reset starts at `0000`, clears RAM, screen, registers, flags, and terminal.
- Execution is bounded per frame. Speed counts instructions, not hardware
  cycles.
- Each instruction has a one-byte opcode followed by operands. Register and
  immediate operands are one byte; addresses are two bytes, little-endian.

| Addresses   | Device                                                      |
| ----------- | ----------------------------------------------------------- |
| `0000–1FFF` | 8 KB read-only boot/program ROM                             |
| `2000–EFFF` | 52 KB RAM, including stack                                  |
| `F000–F2FF` | 32 × 24 framebuffer, one byte per pixel, low three bits RGB |
| `FF00`      | Last keyboard code                                          |
| `FF01`      | Key pressed: 0 or 1                                         |
| `FF02`      | Write a nonzero byte to clear the screen                    |
| `FF03`      | Write an ASCII byte to append to terminal output            |

Other device addresses read zero; writes have no effect. ROM writes, invalid
opcodes/registers, stack errors, and execution outside ROM stop the machine with
an error. Keyboard codes are uppercase ASCII, with arrow codes `80` up, `81`
down, `82` left, and `83` right in hex. This is a parallel byte interface, not a
PS/2 serial protocol. The VGA-style screen is a framebuffer, not a VGA
sync/timing model.

## Assembly

The editor supports labels, `;` comments, `.org address`, `.byte byte, ...`,
decimal, `0x` hexadecimal, `0b` binary, and single ASCII character literals.
**Assemble & reset** validates a complete ROM before replacing the running
program. **Run** and **Step** also assemble changed source before execution, and
refuse invalid source. **Restart** resets a halted program. **Save source**
downloads `.asm`; **Export ROM** downloads 8 KB of assembled bytes. The last
successfully assembled source is saved in this browser.

| Instructions                       | Operands / behavior                                        |
| ---------------------------------- | ---------------------------------------------------------- |
| `NOP`, `HALT`                      | No operands                                                |
| `LDI Rn, byte`                     | Load an immediate                                          |
| `LD Rn, address`, `ST Rn, address` | Read/write memory or a device                              |
| `MOV Rd, Rs`                       | Copy a register                                            |
| `ADD`, `SUB`, `AND`, `OR`, `XOR`   | `Rd, Rs`; update destination and flags                     |
| `ADDI`, `SUBI`, `ANDI`             | `Rn, byte`; update destination and flags                   |
| `SHL`, `SHR`                       | `Rn`; shift one bit, set carry to shifted-out bit          |
| `CMP`, `CMPI`                      | `Rn, Rs` or `Rn, byte`; update flags only                  |
| `JMP`, `JZ`, `JNZ`, `JC`           | `address`; unconditional or flag-based branch              |
| `CALL`, `RET`                      | Call an address / return using stack                       |
| `PUSH`, `POP`                      | `Rn`; store/load a byte on the stack                       |
| `LDX`, `STX`                       | `Rn, address, Ri`; access address plus index register      |
| `PIXEL Rx, Ry, Rcolor`             | Draw at register coordinates; out-of-bounds pixels ignored |
| `CLS`                              | Clear screen                                               |

```asm
.org 0
LDI R0, 'A'
ST R0, 0xFF03
LDI R1, 16
LDI R2, 12
LDI R3, 7
PIXEL R1, R2, R3
HALT
```

## Reuse from Deno or another app

```ts
import { assemble, biosGame, Computer } from "@literal/core";

const program = assemble(biosGame);
const computer = new Computer(program.rom);
computer.run(1000);
computer.keyboard = { code: 131, pressed: true };
computer.run(1000);
console.log(computer.registers, computer.read(0x2000));
```

The assembler returns ROM bytes, labels, and an address/source listing. The
machine exposes registers, memory access, framebuffer, flags, terminal, and
instruction count. `run` accepts at most 100,000 instructions per call.
