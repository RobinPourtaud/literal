# Literal 8 computer

The **Computer** workspace runs a small custom instruction set. It is a
byte-level interpreter, independent of the gate canvas. It makes boot routines
and opcode games testable while you build circuit components. It is not an x86,
6502, or PC BIOS emulator, and does not translate a drawn circuit into a CPU.

## Run the included game

1. Open **Computer**.
2. Choose **BIOS + pixel game**, then **Assemble & reset**.
3. Choose **Run**, then **Capture keyboard** or click the screen.
4. Use arrow keys to move the white player and collect green targets. On-screen
   arrow buttons also work. The score is stored at RAM address `2000`.
5. Press Escape to release the keyboard. Pause, Step, or set a hex breakpoint to
   inspect execution. `0200` stops at the game's entry point after boot.

A key moves once per press. Release it before moving again. The boot ROM prints
`LIT`, calls the game at `0200`, and provides a return address on the stack. The
game reads the keyboard through memory-mapped addresses and draws with
instructions; the UI does not implement its movement or scoring logic.

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
program. **Save source** downloads `.asm`; **Export ROM** downloads 8 KB of
assembled bytes. The last successfully assembled source is saved in this
browser.

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
