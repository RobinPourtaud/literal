export const instructionSet = [
  { name: "NOP", code: 0x00, args: "" },
  { name: "HALT", code: 0x01, args: "" },
  { name: "LDI", code: 0x10, args: "rb" },
  { name: "LD", code: 0x11, args: "ra" },
  { name: "ST", code: 0x12, args: "ra" },
  { name: "MOV", code: 0x13, args: "rr" },
  { name: "ADD", code: 0x20, args: "rr" },
  { name: "SUB", code: 0x21, args: "rr" },
  { name: "AND", code: 0x22, args: "rr" },
  { name: "OR", code: 0x23, args: "rr" },
  { name: "XOR", code: 0x24, args: "rr" },
  { name: "ADDI", code: 0x25, args: "rb" },
  { name: "SUBI", code: 0x26, args: "rb" },
  { name: "ANDI", code: 0x27, args: "rb" },
  { name: "SHL", code: 0x28, args: "r" },
  { name: "SHR", code: 0x29, args: "r" },
  { name: "CMP", code: 0x30, args: "rr" },
  { name: "CMPI", code: 0x31, args: "rb" },
  { name: "JMP", code: 0x40, args: "a" },
  { name: "JZ", code: 0x41, args: "a" },
  { name: "JNZ", code: 0x42, args: "a" },
  { name: "JC", code: 0x43, args: "a" },
  { name: "CALL", code: 0x44, args: "a" },
  { name: "RET", code: 0x45, args: "" },
  { name: "PUSH", code: 0x50, args: "r" },
  { name: "POP", code: 0x51, args: "r" },
  { name: "LDX", code: 0x60, args: "rar" },
  { name: "STX", code: 0x61, args: "rar" },
  { name: "PIXEL", code: 0x70, args: "rrr" },
  { name: "CLS", code: 0x71, args: "" },
] as const;
export interface Assembly {
  rom: Uint8Array;
  labels: Record<string, number>;
  listing: { address: number; bytes: number[]; line: number; source: string }[];
}
const sizeOf = (args: string) =>
  1 + [...args].reduce((n, a) => n + (a === "a" ? 2 : 1), 0);
export function assemble(source: string): Assembly {
  if (source.length > 200_000) throw Error("Assembly source exceeds 200 KB.");
  const labels: Record<string, number> = Object.create(null);
  const records: {
    line: number;
    source: string;
    address: number;
    command: string;
    args: string[];
  }[] = [];
  let address = 0;
  const value = (token: string, line: number): number => {
    if (token in labels) return labels[token];
    if (/^'.'$/.test(token)) return token.charCodeAt(1);
    if (!/^(?:0x[\da-f]+|0b[01]+|\d+)$/i.test(token)) {
      throw Error(`Line ${line}: unknown value ${token}.`);
    }
    const n = Number(token);
    if (!Number.isSafeInteger(n)) throw Error(`Line ${line}: invalid value.`);
    return n;
  };
  for (const [i, original] of source.split("\n").entries()) {
    let text = original.replace(/;.*$/, "").trim();
    if (!text) continue;
    const label = text.match(/^([A-Za-z_][\w]*):/);
    if (label) {
      if (label[1] in labels) throw Error(`Line ${i + 1}: duplicate label.`);
      labels[label[1]] = address;
      text = text.slice(label[0].length).trim();
      if (!text) continue;
    }
    const match = text.match(/^(\S+)(?:\s+(.*))?$/)!;
    const command = match[1].toUpperCase(),
      args = (match[2] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (command === ".ORG") {
      if (args.length !== 1) {
        throw Error(`Line ${i + 1}: .org needs one address.`);
      }
      address = value(args[0], i + 1);
      if (address < 0 || address >= 0x2000) {
        throw Error(`Line ${i + 1}: ROM addresses are 0000–1FFF.`);
      }
      continue;
    }
    const op = instructionSet.find((o) => o.name === command);
    if (!op && command !== ".BYTE") {
      throw Error(`Line ${i + 1}: unknown instruction ${command}.`);
    }
    if (op && args.length !== op.args.length) {
      throw Error(
        `Line ${i + 1}: ${command} needs ${op.args.length} operands.`,
      );
    }
    if (command === ".BYTE" && !args.length) {
      throw Error(`Line ${i + 1}: .byte needs data.`);
    }
    records.push({
      line: i + 1,
      source: original.trim(),
      address,
      command,
      args,
    });
    address += op ? sizeOf(op.args) : args.length;
    if (address > 0x2000) {
      throw Error(`Line ${i + 1}: program exceeds 8 KB ROM.`);
    }
  }
  const rom = new Uint8Array(0x2000), occupied = new Set<number>();
  const listing = records.map((record) => {
    const op = instructionSet.find((o) => o.name === record.command);
    const bytes: number[] = op ? [op.code] : [];
    for (const [i, arg] of record.args.entries()) {
      const type = op?.args[i] ?? "b";
      if (type === "r") {
        if (!/^R[0-7]$/i.test(arg)) {
          throw Error(`Line ${record.line}: expected R0–R7.`);
        }
        bytes.push(Number(arg[1]));
      } else {
        const n = value(arg, record.line), max = type === "a" ? 65535 : 255;
        if (n < 0 || n > max) {
          throw Error(`Line ${record.line}: operand out of range.`);
        }
        bytes.push(n & 255);
        if (type === "a") bytes.push(n >> 8);
      }
    }
    bytes.forEach((byte, i) => {
      const at = record.address + i;
      if (occupied.has(at)) {
        throw Error(`Line ${record.line}: overlapping ROM data.`);
      }
      occupied.add(at);
      rom[at] = byte;
    });
    return {
      address: record.address,
      bytes,
      line: record.line,
      source: record.source,
    };
  });
  return { rom, labels, listing };
}
export function bootProgram(game: string, title: string, instructions: string) {
  const messages = {
    boot: "Literal 8 BIOS\nROM: 8 KiB | Screen: 32 x 24\n",
    ready: `RAM: 256-byte self-test OK\n${title}\n${instructions}\n`,
    failed: "RAM self-test failed. Boot stopped.\n",
  };
  const printers = Object.keys(messages).map((name) =>
    `${name}_print:
LDI R0, 0
${name}_next:
LDX R1, ${name}_text, R0
CMPI R1, 0
JZ ${name}_return
ST R1, 0xFF03
ADDI R0, 1
JMP ${name}_next
${name}_return:
RET`
  ).join("\n");
  const data = Object.entries(messages).map(([name, value]) =>
    `${name}_text:\n.byte ${
      [...value].map((c) => c.charCodeAt(0)).concat(0).join(", ")
    }`
  ).join("\n");
  return `.org 0
CALL boot_print
LDI R0, 0
ram_test:
LDI R1, 85
STX R1, 0x2000, R0
LDX R2, 0x2000, R0
CMP R1, R2
JNZ boot_failed
LDI R1, 170
STX R1, 0x2000, R0
LDX R2, 0x2000, R0
CMP R1, R2
JNZ boot_failed
LDI R1, 0
STX R1, 0x2000, R0
ADDI R0, 1
JNZ ram_test
CALL ready_print
CALL game
HALT
boot_failed:
CALL failed_print
HALT
${game}
.org 0x1000
${printers}
.org 0x1400
${data}
`;
}

export const biosGame = bootProgram(
  `.org 0x0200
game:
CLS
LDI R0, 16
LDI R1, 12
LDI R5, 17
LDI R6, 12
LDI R7, 0
LDI R2, 2
PIXEL R5, R6, R2
LDI R2, 7
PIXEL R0, R1, R2
wait:
LD R3, 0xFF01
CMPI R3, 0
JZ wait
LD R4, 0xFF00
LDI R2, 0
PIXEL R0, R1, R2
CMPI R4, 128
JZ up
CMPI R4, 129
JZ down
CMPI R4, 130
JZ left
CMPI R4, 131
JZ right
JMP draw
up:
CMPI R1, 0
JZ draw
SUBI R1, 1
JMP draw
down:
CMPI R1, 23
JZ draw
ADDI R1, 1
JMP draw
left:
SUBI R0, 1
ANDI R0, 31
JMP draw
right:
ADDI R0, 1
ANDI R0, 31
draw:
CMP R0, R5
JNZ show
CMP R1, R6
JNZ show
ADDI R7, 1
ST R7, 0x2000
ADDI R5, 7
ANDI R5, 31
ADDI R6, 5
CMPI R6, 24
JC show
SUBI R6, 24
show:
LDI R2, 2
PIXEL R5, R6, R2
LDI R2, 7
PIXEL R0, R1, R2
released:
LD R3, 0xFF01
CMPI R3, 0
JNZ released
JMP wait
`,
  "Pixel collector",
  "Arrows: move | White: player | Green: food",
);
