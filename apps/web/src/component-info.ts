import type { Kind } from "@literal/core";
export const descriptions: Record<Kind, string> = {
  NMOS:
    "Conducts source to drain when Gate is 1; otherwise high impedance (Z).",
  PMOS:
    "Conducts source to drain when Gate is 0; otherwise high impedance (Z).",
  POWER: "Ideal logic supply (1).",
  GROUND: "Ideal ground (0).",
  JUNCTION:
    "Merge two electrical drivers. Z floats; conflicting drivers give X.",
  BUS_CPU:
    "Literal 8 instruction controller and registers. Uses the wired data bus and external ALU.",
  BUS_ROM: "8 KiB boot ROM. 16-bit address bus. Edit assembly or hex bytes.",
  BUS_RAM:
    "52 KiB RAM. Address, data and write pins; non-selected addresses output zero.",
  BUS_SCREEN:
    "32 × 24 RGB framebuffer on F000–F2FF. Visible on the circuit; pin for a larger view.",
  BUS_KEYBOARD:
    "Addressed keyboard interface at FF00 / FF01. Pin to capture keys.",
  BUS_TERMINAL: "ASCII output at FF03. Pin to read boot and program output.",
  INPUT: "Toggle a logic signal.",
  OUTPUT: "Show a signal value.",
  LED: "Light when the input is high. Amber means unknown.",
  SEVEN_SEG:
    "Drive segments a–g and the decimal point separately. 1 lights a segment; X is shown in amber.",
  HEX_DISPLAY:
    "Show hexadecimal 0–F from four bits. Bit 0 has weight 1; bit 3 has weight 8. All four inputs must be connected.",
  VGA:
    "32 × 24 RGB pixel screen. Write on a rising edge; Clear resets the framebuffer.",
  KEYBOARD:
    "Mapped physical and virtual keys. Eight ASCII bits and a Pressed output.",
  REGISTER8:
    "Eight-bit register. Rising Clock captures data when Enable is high. Clear resets immediately.",
  COUNTER8:
    "Eight-bit counter. Rising Clock increments when Enable is high. Clear resets immediately.",
  ADDER8: "Eight-bit addition with carry in and carry out.",
  RAM:
    "256-byte RAM. Write on a rising Clock when Write is high. Read is asynchronous.",
  ROM:
    "256-byte ROM. Edit hex bytes in the inspector. Missing bytes read as zero.",
  AND: "High when both inputs are high.",
  OR: "High when either input is high.",
  NOT: "Invert an input.",
  NAND: "AND followed by inversion.",
  NOR: "OR followed by inversion.",
  XOR: "High when inputs differ.",
  XNOR: "High when inputs match.",
  BUFFER: "Pass a signal through.",
  MUX: "Select data 0 or data 1.",
  CLOCK: "A clock you can step or run.",
  DFF: "Store data on the rising clock edge.",
  CUSTOM:
    "A reusable gate or switch network. Pin names come from its Input and Output blocks.",
};
export const explanations: Record<Kind, string> = {
  POWER:
    "A logic-level supply, initially 1. Click to toggle between 0 and 1. Use one as VDD and a separate switchable one as an input while building transistor circuits.",
  GROUND:
    "A fixed 0. Connect it to an NMOS Source to pull a node low when that transistor conducts. This simulator models digital levels, rather than voltage or current.",
  NMOS:
    "Connect a control signal to Gate and the signal to be switched to Source. Drain follows Source while Gate is 1. When Gate is 0, Drain is Z (floating). Combine it with a PMOS pull-up to build a NOT gate.",
  PMOS:
    "Connect a control signal to Gate and the signal to be switched to Source. Drain follows Source while Gate is 0. When Gate is 1, Drain is Z. A PMOS connected to VDD pulls a node high.",
  JUNCTION:
    "Connect two transistor Drains to its inputs. A driven 0 or 1 wins over Z. Two agreeing drivers preserve the level; opposite driven levels produce X. Do not connect VDD directly to Ground.",
  INPUT:
    "Click or press Enter to toggle 0 and 1. Its output can fan out to several gates. In a reusable component, its label becomes an external input pin.",
  OUTPUT:
    "Connect a signal to observe its current value. In a reusable component, this block exposes an output pin; its label names that pin.",
  LED:
    "Connect one signal. High lights it, low turns it off, and an unknown signal is amber. It is an indicator, rather than an electrical diode model.",
  CLOCK:
    "Connect its output to clocked components. Step toggles all clocks once. Run clock toggles continuously at the frequency in the toolbar. Registers capture on rising edges, so two steps make a full cycle.",
  NOT:
    "One input, one output. 0 → 1 and 1 → 0. See inside reveals a PMOS pull-up and NMOS pull-down joined at the output.",
  AND:
    "Two inputs. Only 1 AND 1 gives 1; all other known input combinations give 0. Use it when both conditions must be true.",
  OR:
    "Two inputs. 0 OR 0 gives 0; either input at 1 gives 1. Use it when either condition can activate an output.",
  NAND:
    "Two inputs. Only 1 NAND 1 gives 0. It is the inverse of AND, and combinations of NAND gates can implement every Boolean function.",
  NOR:
    "Two inputs. Only 0 NOR 0 gives 1. It is the inverse of OR. Two NOR networks with feedback can form a set/reset latch.",
  XOR:
    "Two inputs. Equal bits produce 0; different bits produce 1. Useful for the sum bit in a half adder and for detecting differences.",
  XNOR:
    "Two inputs. Equal bits produce 1; different bits produce 0. Use it for a one-bit equality comparison.",
  BUFFER:
    "Copies the input to the output. Useful for naming or routing a signal. It has no modeled analog gain or propagation delay.",
  MUX:
    "Connect data to D0 and D1 and a control bit to Select. Select 0 routes D0; Select 1 routes D1. Use multiplexers to choose which value reaches a register or bus.",
  DFF:
    "Connect Data and Clock. A known 0-to-1 Clock transition captures Data; the output holds that bit between edges. Reset simulation clears its stored state.",
  REGISTER8:
    "Connect D0–D7, Clock, Enable, and Clear. With Enable at 1, each rising edge captures eight bits. Clear resets immediately. Bit 0 is the least significant bit.",
  COUNTER8:
    "Connect Clock, Enable, and Clear. With Enable at 1, rising edges increment its eight-bit value, wrapping after 255. Clear resets immediately. It can drive a memory address or a hexadecimal readout.",
  ADDER8:
    "Connect A0–A7, B0–B7, and Carry in. Result0–7 contain the low eight sum bits; Carry out reports overflow. Addition updates immediately as inputs change.",
  RAM:
    "Use A0–A7 to select one of 256 bytes. Connect D0–D7, Write, and Clock; a rising edge with Write high stores a byte. The output shows the addressed byte asynchronously. Reset simulation clears memory.",
  ROM:
    "Use A0–A7 to choose one of 256 fixed bytes. Edit space-separated hex bytes in the inspector. Outputs update immediately with the address. Unspecified bytes read as zero.",
  SEVEN_SEG:
    "Connect a–g to drive the seven bars and dp for the decimal point. Each 1 lights one segment. To display a number, build a decoder that converts input bits into these eight signals.",
  HEX_DISPLAY:
    "Connect four bits, bit 0 through bit 3, to display 0–F. Bit weights are 1, 2, 4, and 8. Unknown or floating input bits prevent decoding.",
  VGA:
    "Connect five X bits, five Y bits, and one bit each for Red, Green, and Blue. A rising Write pulse stores the color at that pixel. Clear empties the screen. This is a 32 × 24 framebuffer interface, not analog VGA timing.",
  KEYBOARD:
    "Capture the physical keyboard or use the inspector's virtual keys. Map physical keys to virtual values. D0–D7 contain the key's uppercase ASCII code; Pressed is 1 while held. The code stays latched after release.",
  BUS_CPU:
    "Each rising clock edge executes one Literal 8 instruction. Connect address, read/write, and data pins to the memory bus and arithmetic pins to the external gate ALU. Instruction sequencing and registers are behavioral models.",
  BUS_ROM:
    "The boot program lives at 0000–1FFF. Connect address pins to the CPU and data outputs to the shared read bus. Edit assembly and assemble into ROM, or load hex bytes. Assembling resets the circuit.",
  BUS_RAM:
    "The wired computer stores working data at 2000–EFFF. Connect address, data, and Write to the CPU bus. The inspector reads contents and writes hex bytes while paused. Addresses outside this range return zero.",
  BUS_SCREEN:
    "The CPU writes three-bit RGB colors to F000–F2FF, one byte per pixel in a 32 × 24 screen. A nonzero write to FF02 clears it. View the framebuffer on the circuit, in the inspector, or pinned on the right.",
  BUS_KEYBOARD:
    "The CPU reads the key code at FF00 and whether it is pressed at FF01. Connect address pins and data outputs to the shared read bus. Capture, virtual keys, and mapping are in the inspector. Hold keys long enough for a slow program to poll them.",
  BUS_TERMINAL:
    "A CPU write to FF03 appends one ASCII character. Connect address, data, and Write pins. Pin the terminal to read the BIOS log or your program's output. Reset simulation clears the log.",
  CUSTOM:
    "A saved circuit with named input and output pins. Connect those pins like any other component. See inside opens its actual circuit and nested components. Edit its name, description, color, and shape from the library.",
};
