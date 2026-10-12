import {
  assemble,
  type Circuit,
  type Component,
  computerCircuit,
  type Definition,
  type Kind,
  type Memory,
  type Signal,
  simulate,
  transistorCircuit,
} from "@literal/core";
import type { Course, Lesson } from "./discover.ts";

const step = (title: string, text: string, hint: string): Lesson => ({
  title,
  text,
  hint,
});
const lab = (
  id: string,
  name: string,
  unlock: Kind[],
  steps: Lesson[],
): Course => ({ id, name, lab: id, pattern: [], unlock, steps });
export const advancedCourses: Course[] = [
  lab("half-adder", "Add two bits · Half adder", ["OUTPUT"], [
    step(
      "Two outputs for one addition",
      "A half adder adds A and B. Sum is the low bit; Carry is the next bit. The practice canvas provides A, B, Sum, and Carry. Add your saved XOR and AND.",
      "Outputs are labelled probes: they show a value but do not supply electricity. 1 + 1 is binary 10, so Sum = 0 and Carry = 1.",
    ),
    step(
      "Wire sum and carry",
      "Connect A and B to XOR, then XOR to Sum. Connect A and B to AND, then AND to Carry.",
      "Both gates receive the same inputs. Check circuit tests 00 → 00, 01 → 10, 10 → 10, and 11 → 01, with outputs written Sum then Carry.",
    ),
    step(
      "Check the complete addition",
      "Use Check circuit. It tests all four inputs on a copy of your circuit. Toggle A and B yourself to see the same results.",
      "A failed check names the input and expected output. Select a component to inspect its pins. Tests never change the state of your canvas.",
    ),
    step(
      "Keep the half adder",
      "Select the gates and output probes, keeping A and B outside. Create component can save this as Half adder. Pass the check to continue.",
      "Saving is optional for these labs. Your course canvas is kept automatically; saved components are useful for the next addition.",
    ),
  ]),
  lab("full-adder", "Include a carry · Full adder", [], [
    step(
      "Add three bits",
      "A full adder adds A, B, and Cin, the carry from a previous column. Place two half adders and one saved OR, or use two XOR, two AND, and one OR.",
      "The canvas provides inputs A, B, Cin and outputs Sum, Carry. All eight input combinations will be checked.",
    ),
    step(
      "Connect the carry chain",
      "First: T = A XOR B, C1 = A AND B. Then Sum = T XOR Cin, C2 = T AND Cin. Carry = C1 OR C2.",
      "With saved half adders, connect the first Sum to the second A and Cin to the second B. OR the two Carry outputs together.",
    ),
    step(
      "Check all eight cases",
      "Use Check circuit. Sum is (A + B + Cin) modulo 2; Carry is 1 when the total is at least 2.",
      "For 111, the total is 3, binary 11. Both Sum and Carry must be 1.",
    ),
    step(
      "Prepare for wider numbers",
      "Save the gate network as Full adder if you want to reuse it. Carry can feed Cin in the next column. Complete the check to continue.",
      "Bit 0 has weight 1, bit 1 weight 2, bit 2 weight 4. A chain of full adders adds multi-bit numbers.",
    ),
  ]),
  lab("byte-adder", "Carry across columns · Byte adder", [], [
    step(
      "Add two eight-bit numbers",
      "Place eight full-adder networks, one for each bit. The practice canvas provides A0–A7, B0–B7, Cin, S0–S7, and Cout.",
      "A0 and B0 have weight 1. Bit 7 has weight 128. Eight bits represent numbers from 0 to 255.",
    ),
    step(
      "Link the carries",
      "Connect A0/B0/Cin to the first full adder. Its Sum goes to S0, and Carry feeds the next adder Cin. Repeat through bit 7, then connect the last Carry to Cout.",
      "Each column adds two bits and the carry arriving from its neighbour. Carry ripples from the least significant column to the most significant.",
    ),
    step(
      "Check arithmetic and overflow",
      "Check circuit tests zero, individual bit columns, long carry chains, and overflow. The result is A + B + Cin; S holds its low eight bits and Cout its ninth bit.",
      "255 + 1 is 256: S = 0 and Cout = 1. If one carry wire is missing, long carry-chain checks will fail.",
    ),
    step(
      "Reuse a wider adder",
      "Optionally save the connected gate networks and probes as Byte adder. Pass the check to continue to selection.",
      "This adder is made from your learned gates. The later computer supplies a wider ALU to keep its wiring exercise manageable.",
    ),
  ]),
  lab("mux", "Choose a signal · Multiplexer", [], [
    step(
      "Choose between A and B",
      "A multiplexer selects A when S = 0 and B when S = 1. Place NOT, two AND, and OR from your library. The canvas supplies A, B, S, and Y.",
      "The select bit S is a control signal. It chooses which data input reaches Y.",
    ),
    step(
      "Wire the selection",
      "Build A AND NOT S and B AND S. OR the two results into Y.",
      "Only one branch is enabled at a time. This pattern is how a processor chooses between two possible values.",
    ),
    step(
      "Check all choices",
      "Use Check circuit to test all eight combinations of A, B, and S.",
      "When S = 0, Y must match A even if B changes. When S = 1, Y must match B.",
    ),
    step(
      "Save your selector",
      "Optionally save the network as Mux, with A, B, and S outside the selection. Pass the check to continue to memory.",
      "You will use a selector to choose an ALU operation later.",
    ),
  ]),
  lab("latch", "Remember one bit · SR latch", [], [
    step(
      "Feed an output back",
      "The practice canvas contains two NAND transistor networks, with their feedback wires left open. The inputs S and R are active low: 0 requests a change; 1 leaves that request inactive. Q is the stored bit.",
      "Unlike the previous gates, a latch remembers earlier inputs. Keep S = R = 1 to hold a value. Do not set both to 0.",
    ),
    step(
      "Cross-connect the gates",
      "Connect NAND Qbar to the two Gate pins labelled Feedback Qbar. Connect NAND Q to the two Gate pins labelled Feedback Q. Connect NAND Q to Q and NAND Qbar to Qbar.",
      "Each feedback output controls one PMOS and one NMOS, so four feedback wires are needed. Set S = 0, R = 1 to store Q = 1. Set S = 1, R = 0 to store Q = 0.",
    ),
    step(
      "Test set, hold, and reset",
      "Check circuit applies set → hold → reset → hold, then sets again. Q must keep its value after the request returns to 1.",
      "The visible transistor networks store the state electrically. Separate custom gates with feedback between them are not supported yet; keep both networks visible for this exercise.",
    ),
    step(
      "Keep the memory cell",
      "Optionally select the transistor networks, supplies, and output probes and save them as SR latch, keeping S and R outside. The simulator preserves transistor feedback inside custom components.",
      "A latch is level controlled. Next we use clocked storage, where a change happens at a specific transition.",
    ),
  ]),
  lab("register", "Store a byte · Register", ["DFF", "CLOCK", "HEX_DISPLAY"], [
    step(
      "Eight bits in parallel",
      "The practice canvas supplies D0–D7, Clock, and Q0–Q7. Add eight D flip-flops. A flip-flop copies Data only when Clock changes from 0 to 1.",
      "DFF is a modeled clocked device. Your previous latch explains memory; this lesson focuses on how a shared clock coordinates several cells.",
    ),
    step(
      "Share the clock",
      "Connect each D input to its matching flip-flop Data. Connect Clock to all eight Clock pins. Connect each flip-flop output to its matching Q probe.",
      "Select Clock and use Step to change its level. Two steps make a full low/high cycle. A register is eight cells that capture together.",
    ),
    step(
      "Capture and hold",
      "Check circuit captures 0xA5, 0x3C, and individual bits. It checks that changing Data while Clock is low does not change Q.",
      "Hex A5 is binary 10100101. D0 is the least significant bit, on the right in a written binary number.",
    ),
    step(
      "Use stored values",
      "Pass the capture-and-hold check to continue. You can add two Hex displays: Q0–Q3 to one and Q4–Q7 to the other.",
      "Behavioral flip-flops cannot be saved inside custom gate networks yet. Keep this register in its course canvas or export the circuit.",
    ),
  ]),
  lab("ram", "Address stored bytes · RAM", ["RAM"], [
    step(
      "Give every byte an address",
      "RAM stores many bytes. The canvas has a 256-byte RAM, A0–A7 address inputs, D0–D7 data inputs, Write, Clock, and Q0–Q7 probes.",
      "An address selects a storage slot. Eight address bits choose 256 slots. Eight data bits form the byte stored in one slot.",
    ),
    step(
      "Connect the memory pins",
      "Connect A0–A7 to matching address pins and D0–D7 to matching data pins. Connect Write and Clock, then the eight RAM outputs to Q0–Q7.",
      "Write = 1 allows a rising Clock edge to store Data at Address. Write = 0 reads without changing memory.",
    ),
    step(
      "Write two separate addresses",
      "Check circuit stores A5 at address 3 and 3C at address 7, then checks individual address/data bits and reads every test cell back. It verifies that Write = 0 prevents overwriting.",
      "Data must remain stable across the rising edge. Use the RAM inspector to see stored bytes; tests use separate memory.",
    ),
    step(
      "Understand working memory",
      "Pass the check to continue to ROM. RAM holds changing program data such as variables, a stack, or a game position.",
      "This RAM is a behavioral device. Its storage array is modeled directly; it is not a transistor-level SRAM implementation.",
    ),
  ]),
  lab("rom", "Store a program · ROM", ["ROM"], [
    step(
      "Memory that keeps instructions",
      "ROM supplies preloaded bytes at an address. Connect A0–A7 to ROM and ROM outputs to Q0–Q7 on the practice canvas.",
      "ROM has no Write or Clock pin. Changing Address selects a different stored byte.",
    ),
    step(
      "Load three bytes",
      "Select ROM and enter hex bytes 10 00 2A at the beginning of its contents. These encode LDI R0, 42 in the Literal instruction set.",
      "10 is the opcode, 00 chooses R0, and 2A is hexadecimal 42. The later CPU course will execute these bytes.",
    ),
    step(
      "Read the instruction bytes",
      "Check circuit reads addresses 0, 1, and 2 through your wires. Expect 10, 00, and 2A.",
      "The Q probes show bits least significant first. The ROM inspector lets you edit the contents directly.",
    ),
    step(
      "Separate program and data",
      "Pass the check to continue. ROM will hold instructions; RAM will hold data those instructions change.",
      "Literal's computer uses a larger bus ROM at addresses 0000–1FFF. This smaller ROM teaches the same address-to-byte relation.",
    ),
  ]),
  lab("alu", "Choose an operation · ALU", [], [
    step(
      "Combine logic and selection",
      "Build a one-bit ALU: when S = 0, Y = A AND B; when S = 1, Y = A XOR B. Use your saved AND, XOR, and Mux networks.",
      "An ALU is the arithmetic and logic unit. A control code chooses an operation; data inputs carry the values.",
    ),
    step(
      "Connect both results to a selector",
      "Send A and B to both AND and XOR. Send AND to Mux Data 0, XOR to Data 1, and S to Select. Connect Mux output to Y.",
      "If you did not save Mux, build (AND-result AND NOT S) OR (XOR-result AND S) from learned gates.",
    ),
    step(
      "Check data and control",
      "Check circuit tests all eight combinations of A, B, and S. Changing S must choose the other result.",
      "For A = B = 1, AND gives 1 but XOR gives 0. That case reveals whether the selector is reversed.",
    ),
    step(
      "Inspect a wider ALU next",
      "Pass this check to open the computer wiring course. Its supplied eight-bit ALU expands into gates with See inside.",
      "Your one-bit ALU explains the structure. The supplied eight-bit ALU also adds, subtracts, shifts, and produces Carry and Zero flags.",
    ),
  ]),
  lab("cpu", "Connect the machine · CPU", [
    "INPUT",
    "BUS_CPU",
    "BUS_ROM",
    "BUS_RAM",
    "BUS_SCREEN",
    "BUS_KEYBOARD",
    "BUS_TERMINAL",
    "OR",
  ], [
    step(
      "Find the connected parts",
      "The practice machine has a clock, controller, gate ALU, ROM, RAM, keyboard, screen, and terminal. Four wires are missing. Select each device and use its inspector or See inside.",
      "The controller executes Literal instructions behaviorally. The ALU uses gates. This is a wired teaching computer, not a complete transistor CPU.",
    ),
    step(
      "Restore the four wires",
      "Connect Clock → CPU Clock; ROM Data 0 → Data 0 OR gate Input 1; CPU A0 → ROM A0; ALU Result 0 → CPU Result 0.",
      "The Data 0 OR gate nearest ROM is labelled ROM data 0. The missing edges carry timing, instruction address, instruction data, and arithmetic feedback.",
    ),
    step(
      "Run a small program",
      "Check circuit runs LDI R0, 7; LDI R1, 5; ADD R0, R1; ST R0, 0x2000; HALT. RAM must contain 12.",
      "Select Clock to run or step the real canvas. The functional check uses a fresh copy and catches broken bus connections.",
    ),
    step(
      "Follow the instruction path",
      "Pass the execution check to continue. The CPU fetches ROM bytes, sends operands to the ALU, then writes a result through the RAM bus.",
      "A rising clock edge executes one instruction in this model. Real CPUs usually split fetching and execution into multiple cycles.",
    ),
  ]),
  lab("opcode", "Write instructions · Opcodes", [], [
    step(
      "Edit the boot ROM",
      "Select Boot ROM, open its assembly editor, and replace the starter program. Load 19 into R0 and 23 into R1, add them, store 42 at RAM address 0x2000, then halt.",
      "Use LDI R0, 19; LDI R1, 23; ADD R0, R1; ST R0, 0x2000; HALT. Assemble applies the new bytes and resets execution.",
    ),
    step(
      "Inspect the encoded bytes",
      "Each mnemonic becomes an opcode and operands. LDI uses three bytes; ST uses four. View the assembled ROM bytes in the inspector.",
      "The opcode tells the CPU what to do. A register operand selects storage inside the CPU; an address operand selects memory.",
    ),
    step(
      "Execute your program",
      "Check circuit starts at address 0, follows your wired bus, and requires a halted CPU with R0 = 42 and RAM[0x2000] = 42.",
      "A missing HALT keeps the program running. A store to ROM cannot change RAM. Check the destination address and the register you store.",
    ),
    step(
      "Keep the source",
      "Pass the check to continue to BIOS. Your assembly source is saved in the ROM component and included in exported circuit files.",
      "This is the custom Literal 8 instruction set, not x86 or ARM. Reference lists the supported commands and operands.",
    ),
  ]),
  lab("bios", "Boot and verify memory · BIOS", [], [
    step(
      "Start before the application",
      "A BIOS initializes the machine before running an application. Edit the practice ROM to write 85 to RAM[0x2000], read it back, and compare it with 85.",
      "LDI R0, 85; ST R0, 0x2000; LD R1, 0x2000; CMP R0, R1. JNZ failed branches when the comparison differs.",
    ),
    step(
      "Report success and transfer control",
      "On success, write character O (79) then K (75) to terminal address 0xFF03. Jump to your application, which stores 42 at 0x2001 and halts. The failed path should halt without printing OK.",
      "The terminal appends a character for each store to FF03. Give the application and failed path labels. A BIOS hands control to program code after initialization.",
    ),
    step(
      "Test boot success and failure",
      "Check circuit runs a normal boot, then repeats it with the RAM Write wire disconnected. The good machine must print OK and reach the app; the broken machine must not print OK.",
      "This checks the failure path too. Printing OK without actually checking RAM does not pass.",
    ),
    step(
      "Use a visible boot result",
      "Pass the check to continue to pixels. Select Terminal or pin it to the right to read the boot output in your own run.",
      "The bundled Snake example has a longer BIOS with a 256-byte memory test. This course uses one byte to make each instruction easy to follow.",
    ),
  ]),
  lab("pixels", "Write to a screen · Pixels", [], [
    step(
      "Treat a pixel as output memory",
      "Edit the practice ROM to draw three pixels: (4,4) red, (5,4) green, and (6,4) blue. Then HALT. The screen is connected on the canvas.",
      "PIXEL Rx, Ry, Rc writes at the coordinates in Rx/Ry with the color in Rc. Colors 4, 2, and 1 are red, green, and blue; 0 is black.",
    ),
    step(
      "Load coordinates and colors",
      "Use CLS, then LDI to load x, y, and color before each PIXEL instruction. The screen is 32 × 24; coordinates start at 0.",
      "For the first pixel: LDI R0, 4; LDI R1, 4; LDI R2, 4; PIXEL R0, R1, R2. Increment R0 for the next pixel and change R2.",
    ),
    step(
      "Check the image through the bus",
      "Check circuit runs your ROM and reads the actual connected screen framebuffer. It checks the three pixels and rejects stray nonblack pixels.",
      "PIXEL expands a coordinate into a memory-mapped screen write. Disconnecting the screen Write pin prevents drawing.",
    ),
    step(
      "Keep the screen in view",
      "Pass the check to continue to a triangle. Click the screen to pin a larger view on the right while you work on ROM.",
      "Screen memory starts at F000. The framebuffer stores row after row, with 32 pixels in each row.",
    ),
  ]),
  lab("triangle", "Draw with loops · Triangle", [], [
    step(
      "Use a repeated drawing rule",
      "Draw a filled triangle with apex (16,3). Row y = 3 has one pixel; each following row widens by one pixel on each side. Finish at row 17. Use color 3.",
      "At row y, draw x from 16 − (y − 3) through 16 + (y − 3), inclusive. Color 3 is cyan.",
    ),
    step(
      "Write inner and outer loops",
      "Use a pixel loop for one row, then increase y, decrease the left boundary, and increase the right boundary. Stop after row 17 and HALT.",
      "Initialize R1 = 3 (y), R2 = 3 (color), R3 = R4 = 16 (left/right). For each row MOV R0, R3, then PIXEL; CMP R0, R4; JZ next_row; ADDI R0, 1; JMP pixel.",
    ),
    step(
      "Check every triangle pixel",
      "Check circuit compares the entire 32 × 24 framebuffer against the triangle. A single colored dot cannot pass this course.",
      "At next_row: ADDI R1, 1; CMPI R1, 18; JZ done; SUBI R3, 1; ADDI R4, 1; JMP row. At done: HALT.",
    ),
    step(
      "Turn repetition into graphics",
      "Pass the check to continue to keyboard input. Loops let a small ROM program generate hundreds of pixel writes.",
      "The checker expects the triangle on a black background. Start with CLS and do not leave a test pixel outside it.",
    ),
  ]),
  lab("keyboard", "Read a physical input · Keyboard", [], [
    step(
      "Read the connected keyboard",
      "Write a program that waits until keyboard Pressed at 0xFF01 is 1, then reads Code at 0xFF00. Store that code to RAM[0x2000] and HALT.",
      "LD R1, 0xFF01; CMPI R1, 0; JZ wait. At wait use a label. The input remains available through the wired read bus.",
    ),
    step(
      "Read after the press",
      "After the wait loop, use LD R0, 0xFF00; ST R0, 0x2000; HALT. Select Keyboard to see the mappings and capture your physical keyboard.",
      "Arrow codes are Up 128, Down 129, Left 130, Right 131. Release capture with Escape. At a slow clock, hold the key until the program polls it.",
    ),
    step(
      "Check two distinct keys",
      "Check circuit runs fresh copies for Left and Right. Each must wait with no key and store the actual code once pressed.",
      "Hardcoding one key code does not pass. Disconnecting keyboard data also causes the check to fail.",
    ),
    step(
      "Connect input to a program",
      "Pass the check to continue to animation. Programs can now combine stored state, input, and pixels.",
      "The keyboard peripheral is behavioral. Its signals and addresses are visible in the circuit; the browser supplies real key events.",
    ),
  ]),
  lab("animation", "Update frames · Animation", [], [
    step(
      "Move one pixel over time",
      "Write a repeating program that draws one cyan pixel along row 12. Begin at x = 0, advance to x = 31, then wrap to 0.",
      "Keep x in R0, y = 12 in R1, color = 3 in R2. This is a frame loop rather than a program ending with HALT.",
    ),
    step(
      "Clear, draw, advance",
      "For each frame use CLS; PIXEL R0, R1, R2; ADDI R0, 1; ANDI R0, 31; JMP frame.",
      "ANDI 31 keeps the low five bits, wrapping 32 back to 0. CLS erases the previous position before the next draw.",
    ),
    step(
      "Check successive frames",
      "Check circuit watches pixel positions through multiple frames, including the 31 → 0 wrap. It rejects a static pixel or a accumulating trail.",
      "The clock controls instructions, not frames. Several instructions produce one frame. Select Clock to adjust the observed animation speed.",
    ),
    step(
      "Keep state between frames",
      "Pass the check to continue to a small game. A game loop adds input and rules to this repeated update pattern.",
      "At high frequency, the browser may display only some frames. Circuit simulation still computes the instructions it executes.",
    ),
  ]),
  lab("game", "Input, state, rendering · Game", [], [
    step(
      "Make a tiny move-to-target game",
      "Keep player x at RAM[0x2000], initially 4. Show a cyan player at (x,12) and a green target at (7,12). Right moves one cell; Left moves back. Other keys do nothing.",
      "Use keyboard Pressed and Code. After one movement, wait for release so a held key does not repeat accidentally.",
    ),
    step(
      "Update and redraw",
      "Poll input, load the stored x, add or subtract 1, clamp x to 0–31, store it, then clear and redraw the player and target.",
      "Compare the code to 131 for Right and 130 for Left. Ignore other codes. Read RAM each update; the game check observes the stored position.",
    ),
    step(
      "Add a win condition",
      "When x reaches 7, store 1 at RAM[0x2001], print W (87) to the terminal, and HALT. Check circuit tries Right, Left, an unrelated key, then enough Right presses to win.",
      "Initialize RAM[2001] to 0. Three Right presses from the start reach the target. Draw the player last if it overlaps the target.",
    ),
    step(
      "Finish a playable loop",
      "Pass the check to continue to projection. Run your canvas with Clock and use the Keyboard controls to play.",
      "This is a small game on your connected computer. The bundled Snake circuit demonstrates longer rules, a body stored in RAM, collision detection, and restart.",
    ),
  ]),
  lab("projection", "Project depth · 3D wireframe", [], [
    step(
      "Flatten a point with depth",
      "Use an orthographic projection: screen x = 8 + world x + (world z >> 1); screen y = 6 + world y − (world z >> 1). Project a cube of side 10 with z = 0 or 8.",
      "SHR divides a nonnegative integer by 2. This is a simple depth shear: parallel edges remain parallel. It is not perspective projection or a GPU.",
    ),
    step(
      "Calculate and draw the corners",
      "For each of eight world corners, compute its projected x/y in registers, then PIXEL in color 7 (white). Front corners are (8,6), (18,6), (8,16), (18,16); back corners are (12,2), (22,2), (12,12), (22,12).",
      "Load world coordinates, copy z into a temporary register, SHR it, ADD to x, SUB from y, then add the screen offsets. All coordinates fit the screen.",
    ),
    step(
      "Join the twelve edges",
      "Draw the two 10 × 10 square outlines and four diagonal connectors. Include endpoints and HALT. Check circuit compares the whole white wireframe on a black screen.",
      "Horizontal/vertical loops change one coordinate. The depth connectors change x by +1 and y by −1 for four steps. Use the Hint wiring guide for the full target image.",
    ),
    step(
      "Continue experimenting",
      "Pass the check to finish the guided path. Change the cube size, depth, or projection; inspect the gate ALU doing the arithmetic. Your circuits and source remain saved per course.",
      "This course ends at a small 3D wireframe. Rotation, filled polygons, a GPU, and a fully transistor-built CPU are further projects, not simulated by this lesson.",
    ),
  ]),
];

export const cpuProgram =
  "LDI R0, 7\nLDI R1, 5\nADD R0, R1\nST R0, 0x2000\nHALT";
export const solutions: Record<string, string> = {
  cpu: cpuProgram,
  opcode: "LDI R0, 19\nLDI R1, 23\nADD R0, R1\nST R0, 0x2000\nHALT",
  bios: `LDI R0, 85
ST R0, 0x2000
LD R1, 0x2000
CMP R0, R1
JNZ failed
LDI R0, 79
ST R0, 0xFF03
LDI R0, 75
ST R0, 0xFF03
JMP app
failed:
HALT
app:
LDI R0, 42
ST R0, 0x2001
HALT`,
  pixels: `CLS
LDI R0, 4
LDI R1, 4
LDI R2, 4
PIXEL R0, R1, R2
ADDI R0, 1
LDI R2, 2
PIXEL R0, R1, R2
ADDI R0, 1
LDI R2, 1
PIXEL R0, R1, R2
HALT`,
  triangle: `CLS
LDI R1, 3
LDI R2, 3
LDI R3, 16
LDI R4, 16
row:
MOV R0, R3
pixel:
PIXEL R0, R1, R2
CMP R0, R4
JZ next_row
ADDI R0, 1
JMP pixel
next_row:
ADDI R1, 1
CMPI R1, 18
JZ done
SUBI R3, 1
ADDI R4, 1
JMP row
done:
HALT`,
  keyboard: `wait:
LD R1, 0xFF01
CMPI R1, 0
JZ wait
LD R0, 0xFF00
ST R0, 0x2000
HALT`,
  animation: `LDI R0, 0
LDI R1, 12
LDI R2, 3
frame:
CLS
PIXEL R0, R1, R2
ADDI R0, 1
ANDI R0, 31
JMP frame`,
  game: `LDI R0, 4
ST R0, 0x2000
LDI R3, 0
ST R3, 0x2001
CALL draw
wait:
LD R3, 0xFF01
CMPI R3, 0
JZ wait
LD R3, 0xFF00
LD R0, 0x2000
CMPI R3, 131
JZ right
CMPI R3, 130
JZ left
JMP release
right:
CMPI R0, 31
JZ release
ADDI R0, 1
JMP moved
left:
CMPI R0, 0
JZ release
SUBI R0, 1
moved:
ST R0, 0x2000
CALL draw
CMPI R0, 7
JZ won
release:
LD R3, 0xFF01
CMPI R3, 0
JNZ release
JMP wait
won:
LDI R3, 1
ST R3, 0x2001
LDI R3, 87
ST R3, 0xFF03
HALT
draw:
CLS
LDI R4, 7
LDI R1, 12
LDI R2, 2
PIXEL R4, R1, R2
LDI R2, 3
PIXEL R0, R1, R2
RET`,
};
export function targetImage(id: string): number[] {
  const image = Array<number>(768).fill(0);
  const dot = (x: number, y: number, color: number) => {
    image[y * 32 + x] = color;
  };
  if (id === "pixels") {
    dot(4, 4, 4);
    dot(5, 4, 2);
    dot(6, 4, 1);
  }
  if (id === "triangle") {
    for (let y = 3; y <= 17; y++) {
      for (let x = 19 - y; x <= 13 + y; x++) dot(x, y, 3);
    }
  }
  if (id === "projection") {
    for (const [x, y] of [[8, 6], [12, 2]]) {
      for (let n = 0; n <= 10; n++) {
        dot(x + n, y, 7);
        dot(x + n, y + 10, 7);
        dot(x, y + n, 7);
        dot(x + 10, y + n, 7);
      }
    }
    for (const [x, y] of [[8, 6], [18, 6], [8, 16], [18, 16]]) {
      for (let n = 0; n <= 4; n++) {
        dot(x + n, y - n, 7);
      }
    }
  }
  return image;
}
const corners = [
  [0, 0, 0],
  [10, 0, 0],
  [0, 10, 0],
  [10, 10, 0],
  [0, 0, 8],
  [10, 0, 8],
  [0, 10, 8],
  [10, 10, 8],
];
const edges = [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 3],
  [4, 5],
  [4, 6],
  [5, 7],
  [6, 7],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
];
const projectSource = ([x, y, z]: number[]) =>
  `LDI R0, ${x}\nLDI R1, ${y}\nLDI R7, ${z}\nCALL project`;
const screenPoint = (
  [x, y, z]: number[],
) => [8 + x + (z >> 1), 6 + y - (z >> 1)];
solutions.projection = `CLS
LDI R2, 7
${
  edges.map(([a, b]) => {
    const start = screenPoint(corners[a]), end = screenPoint(corners[b]);
    return `${projectSource(corners[b])}\nMOV R3, R0\nMOV R4, R1\n${
      projectSource(corners[a])
    }\nLDI R5, ${(Math.sign(end[0] - start[0]) + 256) % 256}\nLDI R6, ${
      (Math.sign(end[1] - start[1]) + 256) % 256
    }\nCALL line`;
  }).join("\n")
}
HALT
project:
SHR R7
ADD R0, R7
SUB R1, R7
ADDI R0, 8
ADDI R1, 6
RET
line:
PIXEL R0, R1, R2
CMP R0, R3
JNZ advance
CMP R1, R4
JZ line_done
advance:
ADD R0, R5
ADD R1, R6
JMP line
line_done:
RET`;

export function labStarter(id: string, library: Definition[]): Circuit {
  if (
    [
      "cpu",
      "opcode",
      "bios",
      "pixels",
      "triangle",
      "keyboard",
      "animation",
      "game",
      "projection",
    ].includes(id)
  ) {
    const c = computerCircuit(id === "cpu" ? cpuProgram : "HALT");
    c.name = advancedCourses.find((course) => course.id === id)!.name;
    const provided = c.definitions!;
    c.definitions = [
      ...library.filter((d) => !provided.some((p) => p.id === d.id)),
      ...provided,
    ];
    c.components.filter((n) => n.id.startsWith("read-0-")).forEach((n, i) => {
      n.label = ["ROM data 0", "RAM data 0", "Keyboard data 0"][i];
    });
    if (id === "cpu") {
      c.wires = c.wires.filter((w) =>
        !((w.from === "clock" && w.to === "cpu") ||
          (w.from === "rom" && w.to === "read-0-0" &&
            (w.fromPort ?? 0) === 0) ||
          (w.from === "cpu" && w.to === "rom" && w.port === 0) ||
          (w.from === "alu" && w.to === "cpu" && w.port === 8))
      );
    }
    return c;
  }
  const c: Circuit = {
    version: 1,
    name: id,
    components: [],
    wires: [],
    definitions: library,
  };
  const node = (
    label: string,
    kind: Kind,
    x: number,
    y: number,
    value?: 0 | 1,
  ) =>
    c.components.push({
      id: label,
      kind,
      label,
      x,
      y,
      ...(value !== undefined ? { value } : {}),
    });
  const inputs = id === "byte-adder"
    ? Array.from({ length: 8 }, (_, i) => `A${i}`).concat(
      Array.from({ length: 8 }, (_, i) => `B${i}`),
      "Cin",
    )
    : id === "half-adder"
    ? ["A", "B"]
    : id === "full-adder"
    ? ["A", "B", "Cin"]
    : ["mux", "alu"].includes(id)
    ? ["A", "B", "S"]
    : id === "latch"
    ? ["S", "R"]
    : id === "register"
    ? Array.from({ length: 8 }, (_, i) => `D${i}`).concat("Clock")
    : Array.from({ length: 8 }, (_, i) => `A${i}`).concat(
      id === "ram"
        ? Array.from({ length: 8 }, (_, i) => `D${i}`).concat("Write", "Clock")
        : [],
    );
  inputs.forEach((name, i) => {
    const paired = id === "ram" || id === "byte-adder";
    const second = paired && /^[BD]\d$/.test(name);
    const bit = paired && /^[ABD]\d$/.test(name)
      ? Number(name.slice(1))
      : paired
      ? 8
      : i;
    const x = second || (paired && name === "Clock") ? 160 : 0;
    node(
      name,
      name === "Clock" ? "CLOCK" : "POWER",
      x,
      bit * 90,
      id === "latch" ? 1 : 0,
    );
  });
  const outputs = id === "byte-adder"
    ? Array.from({ length: 8 }, (_, i) => `S${i}`).concat("Cout")
    : ["half-adder", "full-adder"].includes(id)
    ? ["Sum", "Carry"]
    : ["mux", "alu"].includes(id)
    ? ["Y"]
    : id === "latch"
    ? ["Q", "Qbar"]
    : Array.from({ length: 8 }, (_, i) => `Q${i}`);
  outputs.forEach((name, i) =>
    node(
      name,
      "OUTPUT",
      id === "ram" || id === "byte-adder" ? 940 : 680,
      i * 90,
    )
  );
  if (id === "latch") {
    for (
      const [index, control, feedback, label] of [[
        0,
        "S",
        "Feedback Qbar",
        "NAND Q",
      ], [1, "R", "Feedback Q", "NAND Qbar"]] as const
    ) {
      const network = transistorCircuit("NAND")!;
      const inputs = network.components.filter((n) => n.kind === "INPUT");
      const output = network.components.find((n) => n.kind === "OUTPUT")!;
      const outputWire = network.wires.find((w) => w.to === output.id)!;
      const prefix = `nand-${index}-`;
      c.components.push(
        ...network.components.filter((n) =>
          n.kind !== "INPUT" && n.kind !== "OUTPUT"
        ).map((n) => ({
          ...n,
          id: prefix + n.id,
          x: n.x + 200,
          y: n.y + index * 650,
          label: n.id === outputWire.from ? label : n.label,
        })),
      );
      for (const w of network.wires) {
        if (w.to === output.id) continue;
        if (w.from === inputs[1].id) {
          c.components.find((n) => n.id === prefix + w.to)!.label =
            `${feedback} · ${
              network.components.find((n) => n.id === w.to)!.kind
            }`;
          continue;
        }
        c.wires.push({
          ...w,
          id: prefix + w.id,
          from: w.from === inputs[0].id ? control : prefix + w.from,
          to: prefix + w.to,
        });
      }
    }
    c.components.find((n) => n.id === "Q")!.x = 1500;
    c.components.find((n) => n.id === "Qbar")!.x = 1500;
    c.components.find((n) => n.id === "Qbar")!.y = 650;
  }
  if (id === "ram" || id === "rom") {
    node("Memory", id === "ram" ? "RAM" : "ROM", id === "ram" ? 520 : 340, 320);
  }
  return c;
}

export type LabReport = { passed: boolean; message: string };
const fail = (message: string): never => {
  throw Error(message);
};
const same = (actual: unknown, expected: unknown, message: string) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(
      `${message}. Expected ${JSON.stringify(expected)}, got ${
        JSON.stringify(actual)
      }.`,
    );
  }
};
function named(c: Circuit, label: string): Component {
  const matches = c.components.filter((n) =>
    n.label.toLowerCase() === label.toLowerCase()
  );
  if (matches.length !== 1) {
    fail(`Keep exactly one component labelled ${label}.`);
  }
  return matches[0];
}
const bits = (n: number) =>
  Array.from({ length: 8 }, (_, i) => (n >> i & 1) as Signal);
function runner(c: Circuit) {
  let memory: Memory = { q: {}, clock: {} };
  return (overrides: Record<string, Signal> = {}) => {
    const state = simulate(c, memory, overrides);
    memory = state.memory;
    if (state.warnings.length) fail(state.warnings[0]);
    return state;
  };
}
function truthLab(id: string, c: Circuit) {
  const names = id === "half-adder"
    ? ["A", "B"]
    : id === "full-adder"
    ? ["A", "B", "Cin"]
    : ["A", "B", "S"];
  const inputs = names.map((name) => named(c, name));
  if (inputs.some((n) => !["POWER", "INPUT"].includes(n.kind))) {
    fail("Use Power or Input blocks for the labelled data inputs.");
  }
  const outputs =
    (["half-adder", "full-adder"].includes(id) ? ["Sum", "Carry"] : ["Y"]).map((
      name,
    ) => named(c, name));
  for (let row = 0; row < 2 ** inputs.length; row++) {
    const values = inputs.map((_, i) => row >> (inputs.length - 1 - i) & 1),
      [a, b, control] = values;
    const total = a + b + (id === "full-adder" ? control : 0);
    const expected = id.endsWith("adder")
      ? [total & 1, total >> 1]
      : [id === "mux" ? (control ? b : a) : (control ? a ^ b : a & b)];
    const state = simulate(
      c,
      undefined,
      Object.fromEntries(inputs.map((n, i) => [n.id, values[i] as Signal])),
    );
    if (state.warnings.length) fail(state.warnings[0]);
    same(
      outputs.map((n) => state.values[n.id]),
      expected,
      `Input ${names.map((n, i) => `${n}=${values[i]}`).join(", ")}`,
    );
  }
}
function storageLab(id: string, c: Circuit) {
  const run = runner(c);
  const override = (data: Record<string, Signal>) =>
    Object.fromEntries(
      Object.entries(data).map(([name, value]) => [named(c, name).id, value]),
    );
  const apply = (data: Record<string, Signal>) => run(override(data));
  const byte = (prefix: string, n: number) =>
    Object.fromEntries(bits(n).map((b, i) => [`${prefix}${i}`, b]));
  const read = (state: ReturnType<typeof simulate>) =>
    Array.from({ length: 8 }, (_, i) => state.values[named(c, `Q${i}`).id]);
  if (id === "latch") {
    for (
      const [s, r, q] of [
        [0, 1, 1],
        [1, 1, 1],
        [1, 0, 0],
        [1, 1, 0],
        [0, 1, 1],
        [1, 1, 1],
      ]
    ) {
      const state = apply({ S: s as Signal, R: r as Signal });
      same(
        [state.values[named(c, "Q").id], state.values[named(c, "Qbar").id]],
        [q, 1 - q],
        `S=${s}, R=${r}: set/reset and hold`,
      );
    }
  } else if (id === "register") {
    for (
      const n of [
        0xa5,
        0x3c,
        0,
        255,
        ...Array.from({ length: 8 }, (_, i) => 1 << i),
      ]
    ) {
      apply({ ...byte("D", n), Clock: 0 });
      same(read(apply({ ...byte("D", n), Clock: 1 })), bits(n), `Capture ${n}`);
      same(
        read(apply({ ...byte("D", n ^ 255), Clock: 0 })),
        bits(n),
        `Hold ${n} while data changes`,
      );
    }
  } else if (id === "ram") {
    const cells = [
      [3, 165],
      [7, 60],
      [0, 255],
      [255, 0],
      ...Array.from({ length: 8 }, (_, i) => [1 << i, 1 << i]),
    ];
    for (const [address, value] of cells) {
      apply({ ...byte("A", address), ...byte("D", value), Write: 1, Clock: 0 });
      apply({ ...byte("A", address), ...byte("D", value), Write: 1, Clock: 1 });
    }
    for (const [address, value] of cells) {
      same(
        read(
          apply({ ...byte("A", address), ...byte("D", 0), Write: 0, Clock: 0 }),
        ),
        bits(value),
        `Read address ${address}`,
      );
      same(
        read(
          apply({ ...byte("A", address), ...byte("D", 0), Write: 0, Clock: 1 }),
        ),
        bits(value),
        `Write disabled at address ${address}`,
      );
    }
  } else {
    for (
      const [address, value] of [
        [0, 16],
        [1, 0],
        [2, 42],
        ...Array.from({ length: 6 }, (_, i) => [1 << (i + 2), 0]),
      ]
    ) {
      same(
        read(apply(byte("A", address))),
        bits(value),
        `ROM address ${address}`,
      );
    }
  }
}
function machine(c: Circuit) {
  const cpu = c.components.find((n) => n.kind === "BUS_CPU") ??
    fail("Add a connected CPU controller.");
  const clockWire = c.wires.find((w) => w.to === cpu.id && w.port === 18);
  const clock =
    c.components.find((n) =>
      n.id === clockWire?.from && ["CLOCK", "POWER", "INPUT"].includes(n.kind)
    ) ?? fail("Connect Clock to the CPU Clock pin.");
  const reset = c.wires.find((w) => w.to === cpu.id && w.port === 19)?.from;
  const ram = c.components.find((n) => n.kind === "BUS_RAM");
  const screen = c.components.find((n) => n.kind === "BUS_SCREEN");
  const terminal = c.components.find((n) => n.kind === "BUS_TERMINAL");
  const keyboard = c.components.find((n) => n.kind === "BUS_KEYBOARD");
  let state = simulate(c), key = 0, pressed = false;
  let instructions = 0;
  const tick = () => {
    const input = {
      [clock.id]: 0 as Signal,
      ...(reset ? { [reset]: 0 as Signal } : {}),
    };
    const keys = keyboard ? { [keyboard.id]: { code: key, pressed } } : {};
    state = simulate(c, state.memory, input, keys);
    state = simulate(c, state.memory, { ...input, [clock.id]: 1 }, keys);
    instructions++;
    if (state.warnings.length) fail(state.warnings[0]);
    if (state.memory.processors?.[cpu.id]?.error) {
      fail(state.memory.processors[cpu.id].error);
    }
    return state;
  };
  const cycles = (n: number) => {
    for (let i = 0; i < n; i++) {
      tick();
      if (cpuState().halted) break;
    }
  };
  const cpuState = () =>
    state.memory.processors?.[cpu.id] ??
      fail("The CPU did not execute. Check Clock and ROM wires.");
  return {
    tick,
    cycles,
    cpuState,
    key: (code: number, down: boolean) => {
      key = code;
      pressed = down;
    },
    ram: (address: number) =>
      ram
        ? state.memory.busRAM?.[ram.id]?.[address] ?? 0
        : fail("Connect a RAM device."),
    image: () =>
      screen
        ? state.memory.screens?.[screen.id] ?? Array(768).fill(0)
        : fail("Connect a screen device."),
    terminal: () =>
      terminal
        ? state.memory.terminals?.[terminal.id] ?? ""
        : fail("Connect a terminal device."),
    count: () => instructions,
  };
}
function programLab(id: string, c: Circuit) {
  const m = machine(c);
  if (
    ["cpu", "opcode", "bios", "pixels", "triangle", "projection"].includes(id)
  ) {
    m.cycles(id === "triangle" ? 1800 : id === "projection" ? 1200 : 200);
    same(
      m.cpuState().halted,
      true,
      "Program must HALT within the lesson instruction budget",
    );
    if (id === "cpu" || id === "opcode") {
      const expected = id === "cpu" ? 12 : 42;
      same(m.ram(0x2000), expected, "Stored result at RAM[2000]");
      same(m.cpuState().registers[0], expected, "Register R0");
    } else if (id === "bios") {
      same(m.ram(0x2000), 85, "BIOS RAM test byte");
      same(m.ram(0x2001), 42, "Application result");
      same(m.terminal(), "OK", "Boot success output");
      const broken = structuredClone(c);
      const ramIDs = new Set(
        broken.components.filter((n) => n.kind === "BUS_RAM").map((n) => n.id),
      );
      broken.wires = broken.wires.filter((w) =>
        !(ramIDs.has(w.to) && w.port === 24)
      );
      const bad = machine(broken);
      bad.cycles(200);
      if (bad.terminal().includes("OK")) {
        fail(
          "BIOS printed OK with RAM writes disabled. Compare the read-back byte and branch to failure before reporting success.",
        );
      }
      same(bad.cpuState().halted, true, "Failed boot must halt");
    } else {
      const actual = m.image(), expected = targetImage(id);
      const mismatch = expected.findIndex((value, i) => actual[i] !== value);
      if (mismatch >= 0) {
        fail(
          `Pixel (${mismatch % 32},${
            Math.floor(mismatch / 32)
          }) should be color ${expected[mismatch]}, got ${actual[mismatch]}.`,
        );
      }
    }
  } else if (id === "keyboard") {
    for (const code of [130, 131]) {
      const test = machine(c);
      test.cycles(24);
      same(test.cpuState().halted, false, "Wait until a key is pressed");
      test.key(code, true);
      test.cycles(40);
      same(test.cpuState().halted, true, "Halt after storing the pressed key");
      same(test.ram(0x2000), code, `Store keyboard code ${code}`);
    }
  } else if (id === "animation") {
    const seen: number[] = [];
    for (let i = 0; i < 240; i++) {
      m.tick();
      if (m.cpuState().halted) fail("Animation must keep running.");
      const image = m.image(),
        lit = image.flatMap((color, p) => color ? [p] : []);
      if (lit.length > 1) {
        fail(
          "Clear the previous frame before drawing: more than one pixel is lit.",
        );
      }
      if (lit.length === 1) {
        const p = lit[0];
        same(image[p], 3, "Animation color");
        same(Math.floor(p / 32), 12, "Animation row");
        if (seen.at(-1) !== p % 32) seen.push(p % 32);
      }
      if (seen.length >= 34) break;
    }
    same(
      seen.slice(0, 34),
      Array.from({ length: 34 }, (_, i) => i % 32),
      "Animate x = 0 through 31 and wrap",
    );
  } else if (id === "game") {
    m.cycles(80);
    same(m.ram(0x2000), 4, "Initial player x");
    same(m.cpuState().halted, false, "Game must wait for input");
    const press = (code: number, expected: number) => {
      m.key(code, true);
      m.cycles(80);
      same(m.ram(0x2000), expected, `After key ${code}`);
      m.key(code, false);
      m.cycles(30);
      same(m.image()[12 * 32 + expected], 3, "Draw player at stored position");
    };
    press(131, 5);
    press(130, 4);
    press(65, 4);
    press(131, 5);
    press(131, 6);
    press(131, 7);
    same(m.ram(0x2001), 1, "Win flag at RAM[2001]");
    same(m.terminal(), "W", "Win message");
    same(m.cpuState().halted, true, "Halt after winning");
  }
}
export function checkLab(id: string, circuit: Circuit): LabReport {
  try {
    if (!advancedCourses.some((course) => course.id === id)) {
      fail("Unknown Discover lab.");
    }
    if (id === "byte-adder") {
      const inputs = Array.from(
        { length: 8 },
        (_, i) => named(circuit, `A${i}`),
      ).concat(
        Array.from({ length: 8 }, (_, i) => named(circuit, `B${i}`)),
        named(circuit, "Cin"),
      );
      const outputs = Array.from(
        { length: 8 },
        (_, i) => named(circuit, `S${i}`),
      ).concat(named(circuit, "Cout"));
      const cases = [[0, 0, 0], [255, 1, 0], [255, 255, 1], [0, 0, 1], [
        127,
        1,
        0,
      ], [128, 128, 0]];
      for (let i = 0; i < 8; i++) {
        cases.push([1 << i, 1 << i, 0], [(1 << i) - 1, 0, 1]);
      }
      for (let i = 0; i < 24; i++) {
        cases.push([(i * 37) & 255, (i * 71) & 255, i & 1]);
      }
      for (const [a, b, cin] of cases) {
        const values = bits(a).concat(bits(b), cin as Signal);
        const state = simulate(
          circuit,
          undefined,
          Object.fromEntries(inputs.map((n, i) => [n.id, values[i]])),
        );
        if (state.warnings.length) fail(state.warnings[0]);
        const total = a + b + cin;
        same(
          outputs.map((n) => state.values[n.id]),
          bits(total).concat((total >> 8) as Signal),
          `Addition ${a} + ${b} + ${cin}`,
        );
      }
    } else if (["half-adder", "full-adder", "mux", "alu"].includes(id)) {
      truthLab(id, circuit);
    } else if (["latch", "register", "ram", "rom"].includes(id)) {
      storageLab(id, circuit);
    } else programLab(id, circuit);
    return {
      passed: true,
      message:
        "All functional checks passed. Your course is complete; Next course is available.",
    };
  } catch (error) {
    return {
      passed: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
export function programCircuit(id: string): Circuit {
  return computerCircuit(solutions[id]);
}
export function applyProgram(circuit: Circuit, source: string) {
  const rom = circuit.components.find((n) => n.kind === "BUS_ROM") ??
    fail("No bus ROM.");
  rom.source = source;
  rom.contents = [...assemble(source).rom];
}
