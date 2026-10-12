import type { Kind } from "@literal/core";
export type ComponentHelp = {
  what: string;
  why: string;
  how: string;
  example: string;
  note?: string;
};
export const componentHelp: Record<Kind, ComponentHelp> = {
  NMOS: {
    what:
      "A transistor is an electrically controlled switch. An NMOS transistor is one type of transistor. In this simulator, a 1 at its Gate turns the switch on; a 0 turns it off.",
    why:
      "It lets one signal control another. Connect its Source to Ground and it can bring an output down to 0. Together with a PMOS transistor, it forms a NOT gate. Transistors are the building blocks of logic gates and memory.",
    how:
      "Gate is the control input. Source is the value being switched. Drain is the output. When on, Drain gets the Source value. When off, Drain is disconnected: we show Z, not 0.",
    example:
      "Connect Source to Ground (0). Set Gate to 1: Drain becomes 0. Set Gate to 0: Drain becomes Z. In a NOT gate, the PMOS supplies the missing 1 when the NMOS is off.",
    note:
      "We use a simplified switch model. Real transistors control electrical current; this app does not calculate voltages or currents.",
  },
  PMOS: {
    what:
      "A PMOS transistor is another electrically controlled switch. It responds to the opposite control value from NMOS: Gate 0 turns it on, and Gate 1 turns it off in this simulator.",
    why:
      "Connect its Source to Power and it can bring an output up to 1. Pair it with an NMOS connected to Ground to build a NOT gate: one provides 1 while the other provides 0.",
    how:
      "Gate controls the switch. Source is the value being switched; Drain is the output. When off, Drain is disconnected and shows Z.",
    example:
      "Connect Source to Power (1). Gate 0 gives Drain 1; Gate 1 gives Drain Z. Connect the same input to an NMOS Gate to make the two switches take turns.",
    note:
      "This is a simplified digital switch, rather than a calculation of the electrical behavior of a real transistor.",
  },
  POWER: {
    what:
      "Power is a source of the value 1. Think of it as the high level in a digital circuit.",
    why:
      "A circuit needs a source of 1 to produce high outputs. You can also use a separate Power block as a switchable input in Discover.",
    how:
      "Connect its output to an input pin. It starts at 1. Click the block to toggle it between 1 and 0.",
    example:
      "Use one Power block as the supply for a PMOS transistor. Use a second Power block, named A, to control its Gate.",
  },
  GROUND: {
    what: "Ground provides a constant 0, the low level in our digital circuit.",
    why:
      "It gives a circuit a way to produce a definite 0, instead of leaving an output disconnected.",
    how: "Connect its output to a component input. Ground always stays at 0.",
    example:
      "Connect Ground to an NMOS Source. When that transistor turns on, its Drain becomes 0.",
  },
  JUNCTION: {
    what: "A junction joins two signal paths into one output.",
    why:
      "A transistor can be off, leaving its output disconnected. A junction lets another transistor provide the output value instead.",
    how:
      "Connect the two paths to its inputs. A 0 or 1 takes priority over a disconnected Z. If both inputs drive opposite values, the result is X: a conflict.",
    example:
      "Join the PMOS and NMOS Drains in a NOT gate. If one gives 1 and the other is Z, the junction outputs 1.",
  },
  INPUT: {
    what:
      "An input is a value you choose: 0 or 1. A single such value is called a bit.",
    why:
      "Use inputs to test a gate or supply a control signal to a larger circuit.",
    how:
      "Connect its output to a component. Click it, or press Enter while it is focused, to change its value.",
    example:
      "Connect two inputs to an AND gate. Toggle them to check all four combinations: 00, 01, 10, and 11.",
  },
  OUTPUT: {
    what: "An output block shows the value arriving at its input.",
    why:
      "It helps you check a circuit. It also defines an output pin when you save a reusable component.",
    how:
      "Connect the signal you want to observe. Give the block a name that describes the result.",
    example:
      "Connect a NOT gate to an Output named Result. Changing the NOT input from 0 to 1 should change Result from 1 to 0.",
  },
  LED: {
    what:
      "An LED is a small indicator light. Here, it lights for 1 and turns off for 0.",
    why: "It makes a circuit's result easy to see without reading a number.",
    how: "Connect one signal to its input. Amber means the signal is unknown.",
    example:
      "Connect an AND output to an LED. The light turns on only when both AND inputs are 1.",
    note:
      "This is a visual indicator, not a model of a physical diode and its current.",
  },
  CLOCK: {
    what:
      "A clock repeatedly switches between 0 and 1. It gives a circuit a regular beat.",
    why:
      "Memory and processors need to agree on when to update. Many components update when the clock changes from 0 to 1, called a rising edge.",
    how:
      "Connect it to Clock inputs. Select it to run, pause, or step it from the right panel. Frequency is measured in Hz: complete cycles per second. Each clock has its own frequency.",
    example:
      "Set a clock to 1 Hz and connect it to a counter. With Enable at 1, the counter increases once per second. Step changes the clock once; two steps make a complete cycle.",
  },
  NOT: {
    what: "NOT reverses one bit: 0 becomes 1, and 1 becomes 0.",
    why:
      "Use it when you need the opposite of a condition, such as 'not enabled'.",
    how: "Connect one input signal and use the output as its opposite.",
    example:
      "Input 0 gives output 1. Input 1 gives output 0. See inside shows the two transistors that build this behavior.",
  },
  AND: {
    what: "AND outputs 1 only when both inputs are 1.",
    why: "Use it when two conditions must hold at the same time.",
    how: "Connect the two conditions to its two inputs.",
    example:
      "For 'button pressed AND system enabled', the output stays 0 unless both signals are 1.",
  },
  OR: {
    what: "OR outputs 1 when at least one input is 1. Both may also be 1.",
    why: "Use it when either of two conditions should activate something.",
    how: "Connect the two conditions to its inputs.",
    example:
      "For 'left button OR right button', pressing either button produces 1. The output is 0 only when neither is pressed.",
  },
  NAND: {
    what:
      "NAND is AND followed by NOT. Its output is 0 only when both inputs are 1.",
    why:
      "NAND is a useful building block: you can combine NAND gates to make every other Boolean logic function.",
    how: "Connect two bits to its inputs.",
    example:
      "Inputs 00, 01, and 10 give 1. Inputs 11 give 0. Connecting the same bit to both inputs makes it behave like NOT.",
  },
  NOR: {
    what:
      "NOR is OR followed by NOT. Its output is 1 only when both inputs are 0.",
    why:
      "It checks that neither condition is true. Two NOR circuits connected back to each other can also store a bit.",
    how: "Connect two bits to its inputs.",
    example: "Inputs 00 give 1. Inputs 01, 10, and 11 give 0.",
  },
  XOR: {
    what: "XOR outputs 1 when its two inputs are different.",
    why: "It detects differences and is part of binary addition.",
    how: "Connect the two bits you want to compare.",
    example:
      "0 XOR 1 gives 1, but 1 XOR 1 gives 0. In a half adder, XOR produces the sum bit.",
  },
  XNOR: {
    what: "XNOR outputs 1 when its two inputs are the same.",
    why: "Use it to check whether two bits are equal.",
    how: "Connect the bits you want to compare.",
    example: "Inputs 00 and 11 give 1. Inputs 01 and 10 give 0.",
  },
  BUFFER: {
    what: "A buffer copies its input to its output.",
    why: "It can make a signal path easier to label and follow in a diagram.",
    how: "Connect one signal to its input and use the identical output.",
    example: "Input 1 gives output 1. Input 0 gives output 0.",
    note:
      "Real buffers can strengthen electrical signals. This app does not model that electrical effect.",
  },
  MUX: {
    what:
      "A multiplexer, or MUX, chooses one of two values to send to its output.",
    why: "Use it when a circuit must choose between two sources of data.",
    how:
      "Connect the values to D0 and D1. Select 0 chooses D0; Select 1 chooses D1.",
    example:
      "Connect 0 to D0 and 1 to D1. Changing Select switches which value appears at the output.",
  },
  DFF: {
    what:
      "A D flip-flop stores one bit. Unlike a gate, it remembers a value after its input changes.",
    why: "It is a basic building block for registers and other memory.",
    how:
      "Connect the value to Data and a clock to Clock. On a rising edge (0 to 1), it saves Data. Between edges, its output keeps the saved bit.",
    example:
      "Set Data to 1 and pulse Clock from 0 to 1. The output stays 1 even if you then change Data to 0. The next rising edge saves the new 0.",
  },
  REGISTER8: {
    what:
      "An eight-bit register stores eight bits together: one byte, which can represent a number from 0 to 255.",
    why:
      "A processor uses registers to keep numbers it is currently working with.",
    how:
      "Connect the bits to D0–D7. Set Enable to 1 and pulse Clock from 0 to 1 to save them. Clear resets the value to 0. Bit 0 is the lowest-value bit.",
    example:
      "Set only D0 to 1 and the other bits to 0. A rising clock edge saves the number 1.",
  },
  COUNTER8: {
    what:
      "An eight-bit counter remembers a number and increases it by one on each clock pulse.",
    why:
      "Use it to count events, step through memory locations, or keep track of time.",
    how:
      "Connect a clock and set Enable to 1. Each rising edge adds one. Clear resets it to 0; after 255, it wraps back to 0.",
    example:
      "Connect a 1 Hz clock. Starting at 0, the counter shows 1, 2, 3, and so on at one-second intervals.",
  },
  ADDER8: {
    what: "An eight-bit adder adds two byte-sized numbers.",
    why:
      "It performs the arithmetic that larger circuits, including processors, need.",
    how:
      "Connect the two numbers to A0–A7 and B0–B7. Use Carry in as an extra 0 or 1. The result is eight bits; Carry out indicates a sum above 255.",
    example:
      "255 + 1 gives result 0 and Carry out 1: the full result, 256, needs a ninth bit.",
  },
  RAM: {
    what:
      "RAM is memory you can read and write. This component holds 256 bytes, each at a numbered location called an address.",
    why: "Use it to keep data that changes while a program or circuit runs.",
    how:
      "A0–A7 choose an address. D0–D7 provide a byte to write. With Write at 1, a rising Clock edge saves it. The output shows the byte at the chosen address.",
    example:
      "Write the number 42 at address 3, then choose address 3 again to read back 42. Reset simulation clears this memory.",
  },
  ROM: {
    what:
      "ROM holds bytes you prepare in advance. This component has 256 locations.",
    why:
      "Use it for a program, fixed data, or a table that translates inputs into outputs.",
    how:
      "Enter hex bytes in the inspector. A0–A7 select a location; the output shows the byte stored there. Locations you have not filled contain 0.",
    example:
      "Put 2A at address 0. Selecting address 0 returns 42, because hexadecimal 2A means decimal 42.",
  },
  SEVEN_SEG: {
    what:
      "A seven-segment display forms digits using seven small bars, plus a decimal point.",
    why: "It is a simple way to display a circuit's result as a visible digit.",
    how:
      "Each input, a–g, controls one bar: 1 lights it. The dp input controls the decimal point. You must choose which bars light for each digit.",
    example:
      "Lighting all seven bars displays 8. A decoder circuit can turn four input bits into the correct bars for a digit.",
  },
  HEX_DISPLAY: {
    what:
      "A hexadecimal display shows one digit from 0 to F. A–F represent the numbers 10–15.",
    why:
      "It lets you read four bits as one compact digit, useful for inspecting binary data.",
    how:
      "Connect four bits. Their values are 1, 2, 4, and 8, starting at bit 0. Add the values of the bits that are 1 to find the displayed number.",
    example: "Bits 0 and 3 at 1, with the others at 0, display 9: 1 + 8 = 9.",
  },
  VGA: {
    what:
      "This is a small 32 × 24 pixel screen. It remembers a color for each pixel.",
    why:
      "Use it to display patterns, pictures, or a game's output from a circuit.",
    how:
      "The X and Y bits choose a pixel. Red, Green, and Blue each turn one color channel on or off. A rising Write pulse draws that pixel. Clear empties the screen.",
    example:
      "Choose X = 5 and Y = 3, set Green to 1 and the other colors to 0, then pulse Write. A green pixel appears.",
    note:
      "Despite the name, this component does not simulate the timing signals of a real VGA cable.",
  },
  KEYBOARD: {
    what: "A keyboard turns a key press into a number that a circuit can read.",
    why:
      "It lets someone control a circuit or game with physical or on-screen keys.",
    how:
      "Capture your keyboard or use the virtual keys in the inspector. D0–D7 give the key's code; Pressed is 1 while held. The code stays after release, but Pressed returns to 0.",
    example:
      "Press A: the code is 65. Connect the bits to memory or a processor so it can decide what A should do.",
  },
  BUS_CPU: {
    what:
      "The CPU is the part of the computer that follows a program's instructions. This one works with eight-bit numbers.",
    why:
      "It lets your circuit execute a sequence of actions, rather than react only to the current inputs.",
    how:
      "Connect its Clock, memory connections, and ALU connections. Eight clock cycles fetch, decode, and execute one instruction. The ALU is the circuit that performs arithmetic and logic.",
    example:
      "A program can load 2 and 3 into registers, ask the ALU to add them, and store the result 5 in RAM.",
    note:
      "Instruction decoding, control, and registers use NAND gates. See inside follows the actual circuit down to feedback latches and CMOS switches.",
  },
  BUS_ROM: {
    what:
      "This ROM holds the wired computer's program. It has 8 KiB of space: 8,192 bytes.",
    why:
      "The CPU needs somewhere to read its first instructions when the computer starts.",
    how:
      "Connect the address pins to the CPU and the data outputs to its read-data connections. Edit assembly in the inspector, then assemble it into ROM. Addresses 0000–1FFF belong to this ROM.",
    example:
      "Put instructions in ROM to write a color to the screen. Reset, then run the computer's clock to execute them.",
  },
  BUS_RAM: {
    what:
      "This is the wired computer's working memory. It holds data the CPU can read and change.",
    why:
      "Programs need space for changing values, such as a game's score, player position, and saved intermediate results.",
    how:
      "Connect the address, data, and Write pins to the CPU. Addresses 2000–EFFF belong to RAM. You can also inspect or write bytes in the right panel.",
    example:
      "The Snake program stores its score at address 2001. Reading that byte tells you how much food the snake has collected.",
  },
  BUS_SCREEN: {
    what:
      "A small screen that the CPU controls by writing to memory addresses. It has 32 × 24 pixels.",
    why: "It gives programs a visible output, such as a drawing or game board.",
    how:
      "Connect it to the CPU's address, data, and Write pins. Each address from F000 to F2FF selects one pixel; its byte chooses a color. Writing a nonzero value to FF02 clears the screen.",
    example:
      "The CPU can draw a triangle by writing colors to several pixels. You can see the image on the component or pin a larger preview on the right.",
  },
  BUS_KEYBOARD: {
    what:
      "A keyboard connection that the CPU reads through two memory addresses.",
    why: "It lets a program react to keys, for example to move a player.",
    how:
      "Connect its address pins and data outputs to the CPU's memory connections. Address FF00 gives the key's code; FF01 is 1 while the key is pressed. Capture or map keys in the inspector.",
    example:
      "A game reads the key code and moves right when it sees the right-arrow code. At slow clock speeds, hold a key long enough for the program to read it.",
  },
  BUS_TERMINAL: {
    what:
      "A text output device. It displays characters that a program sends to it.",
    why:
      "Use it for messages, results, and debugging, without having to draw letters on the pixel screen.",
    how:
      "Connect address, data, and Write to the CPU. Each write to address FF03 adds one character. Pin it on the right to keep the text visible.",
    example:
      "The BIOS writes its RAM test result to the terminal. A successful boot prints that the self-test passed.",
  },
  CUSTOM: {
    what: "A custom component is a circuit you have saved and given a name.",
    why:
      "It lets you reuse a useful circuit without drawing its internal parts every time.",
    how:
      "Connect its named input and output pins. See inside opens the actual circuit. Edit its name, description, color, and shape from the library.",
    example:
      "Save your transistor-built NOT gate, then place several copies to use it in a larger circuit.",
  },
};
export const descriptions: Record<Kind, string> = {
  NMOS: "A transistor switch that turns on when its Gate is 1.",
  PMOS: "A transistor switch that turns on when its Gate is 0.",
  POWER: "Provides 1; click to switch between 1 and 0.",
  GROUND: "Provides a constant 0.",
  JUNCTION: "Joins two signal paths into one output.",
  INPUT: "A bit you can switch between 0 and 1.",
  OUTPUT: "Shows a circuit's result.",
  LED: "A light that turns on for 1 and off for 0.",
  CLOCK: "A regular beat that tells a circuit when to update.",
  NOT: "Reverses a bit: 0 becomes 1, and 1 becomes 0.",
  AND: "Outputs 1 only when both inputs are 1.",
  OR: "Outputs 1 when either or both inputs are 1.",
  NAND: "Outputs 0 only when both inputs are 1.",
  NOR: "Outputs 1 only when both inputs are 0.",
  XOR: "Outputs 1 when the two inputs are different.",
  XNOR: "Outputs 1 when the two inputs are the same.",
  BUFFER: "Copies its input to its output.",
  MUX: "Chooses which of two inputs reaches the output.",
  DFF: "Remembers one bit until the next clock pulse.",
  REGISTER8: "Stores eight bits together as one number.",
  COUNTER8: "Counts clock pulses, from 0 to 255.",
  ADDER8: "Adds two eight-bit numbers.",
  RAM: "Memory you can read and write: 256 bytes.",
  ROM: "Stores 256 bytes you prepare in advance.",
  SEVEN_SEG: "Seven bars that can form a digit.",
  HEX_DISPLAY: "Shows four bits as a digit from 0 to F.",
  VGA: "A pixel screen you can draw on with circuit signals.",
  KEYBOARD: "Turns key presses into numbers a circuit can read.",
  BUS_CPU: "Follows a program's instructions, one step at a time.",
  BUS_ROM: "Stores the wired computer's program.",
  BUS_RAM: "Stores the wired computer's changing data.",
  BUS_SCREEN: "A pixel screen controlled by the CPU.",
  BUS_KEYBOARD: "Lets the CPU read key presses.",
  BUS_TERMINAL: "Shows text sent by a program.",
  CUSTOM: "A saved circuit you can reuse as one component.",
};
export const explanations = Object.fromEntries(
  Object.entries(componentHelp).map((
    [kind, help],
  ) => [kind, [help.what, help.why, help.how, help.example].join(" ")]),
) as Record<Kind, string>;
