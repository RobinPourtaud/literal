import { type ALUOperation, evaluateALU } from "../packages/core/src/alu.ts";
import {
  type KeyboardState,
  screenHeight,
  screenWidth,
} from "../packages/core/src/peripherals.ts";
import { instructionSet } from "../packages/core/src/computer.ts";
export type ComputerDevice = "ROM" | "RAM" | "Screen" | "Keyboard" | "Terminal";
export interface BusTransfer {
  device: ComputerDevice;
  address: number;
  value: number;
  write: boolean;
}
const deviceAt = (address: number): ComputerDevice | null =>
  address < 0x2000
    ? "ROM"
    : address < 0xf000
    ? "RAM"
    : address < 0xf300 || address === 0xff02
    ? "Screen"
    : address === 0xff00 || address === 0xff01
    ? "Keyboard"
    : address === 0xff03
    ? "Terminal"
    : null;
export class Computer {
  readonly registers = new Uint8Array(8);
  readonly ram = new Uint8Array(0xd000);
  readonly framebuffer = new Uint8Array(screenWidth * screenHeight);
  readonly rom: Uint8Array;
  readonly connected = new Set<ComputerDevice>([
    "ROM",
    "RAM",
    "Screen",
    "Keyboard",
    "Terminal",
  ]);
  readonly transfers: BusTransfer[] = [];
  readonly activity = new Map<
    ComputerDevice,
    { reads: number; writes: number; last: BusTransfer }
  >();
  lastALU: {
    operation: ALUOperation;
    a: number;
    b: number;
    value: number;
    carry: boolean;
    zero: boolean;
    values: Uint8Array;
  } | null = null;
  evaluate = evaluateALU;
  pc = 0;
  sp = 0xefff;
  zero = false;
  carry = false;
  halted = false;
  cycles = 0;
  error = "";
  terminal = "";
  keyboard: KeyboardState = { code: 0, pressed: false };
  constructor(rom: Uint8Array) {
    if (rom.length > 0x2000) throw Error("ROM exceeds 8 KB.");
    this.rom = new Uint8Array(0x2000);
    this.rom.set(rom);
  }
  read(address: number): number {
    if (address < 0 || address > 65535 || !Number.isInteger(address)) {
      throw Error("Invalid memory address.");
    }
    if (address < 0x2000) return this.rom[address];
    if (address < 0xf000) return this.ram[address - 0x2000];
    if (address < 0xf300) return this.framebuffer[address - 0xf000];
    if (address === 0xff00) return this.keyboard.code;
    if (address === 0xff01) return this.keyboard.pressed ? 1 : 0;
    return 0;
  }
  private transfer(address: number, value: number, write: boolean) {
    const device = deviceAt(address);
    if (!device) return;
    if (!this.connected.has(device)) {
      throw Error(`${device} is disconnected from the bus.`);
    }
    const last = { device, address, value, write };
    const activity = this.activity.get(device) ?? { reads: 0, writes: 0, last };
    if (write) activity.writes++;
    else activity.reads++;
    activity.last = last;
    this.activity.set(device, activity);
    this.transfers.push(last);
    if (this.transfers.length > 32) this.transfers.shift();
  }
  private busRead(address: number) {
    const value = this.read(address);
    this.transfer(address, value, false);
    return value;
  }
  write(address: number, value: number) {
    if (!Number.isInteger(address) || address < 0 || address > 65535) {
      throw Error("Invalid memory address.");
    }
    const byte = value & 255;
    this.transfer(address, byte, true);
    if (address < 0x2000) throw Error("Cannot write to ROM.");
    if (address < 0xf000) this.ram[address - 0x2000] = byte;
    else if (address < 0xf300) this.framebuffer[address - 0xf000] = byte & 7;
    else if (address === 0xff02 && byte) this.framebuffer.fill(0);
    else if (address === 0xff03) {
      this.terminal = (this.terminal + String.fromCharCode(byte)).slice(-4096);
    }
  }
  private push(value: number) {
    if (this.sp < 0x2000) throw Error("Stack overflow.");
    this.write(this.sp--, value);
  }
  private pop() {
    if (this.sp >= 0xefff) throw Error("Stack underflow.");
    return this.busRead(++this.sp);
  }
  step() {
    if (this.halted) return;
    try {
      const fetch = () => {
        if (this.pc >= 0x2000) throw Error("Execution left ROM.");
        return this.busRead(this.pc++);
      };
      const code = fetch(), op = instructionSet.find((o) => o.code === code);
      if (!op) throw Error(`Unknown opcode ${code.toString(16)}.`);
      const args = [...op.args].map((type) => {
        const n = fetch();
        if (type === "r" && n > 7) throw Error("Invalid register.");
        return type === "a" ? n | (fetch() << 8) : n;
      });
      const [a, b, c] = args, r = this.registers;
      const calculate = (
        operation: ALUOperation,
        x: number,
        y: number,
        store = true,
      ) => {
        const result = this.evaluate(operation, x, y);
        this.lastALU = { operation, a: x, b: y, ...result };
        this.carry = result.carry;
        this.zero = result.zero;
        if (store) r[a] = result.value;
      };
      switch (op.name) {
        case "NOP":
          break;
        case "HALT":
          this.halted = true;
          break;
        case "LDI":
          r[a] = b;
          break;
        case "LD":
          r[a] = this.busRead(b);
          break;
        case "ST":
          this.write(b, r[a]);
          break;
        case "MOV":
          r[a] = r[b];
          break;
        case "ADD":
          calculate("ADD", r[a], r[b]);
          break;
        case "SUB":
          calculate("SUB", r[a], r[b]);
          break;
        case "AND":
          calculate("AND", r[a], r[b]);
          break;
        case "OR":
          calculate("OR", r[a], r[b]);
          break;
        case "XOR":
          calculate("XOR", r[a], r[b]);
          break;
        case "ADDI":
          calculate("ADD", r[a], b);
          break;
        case "SUBI":
          calculate("SUB", r[a], b);
          break;
        case "ANDI":
          calculate("AND", r[a], b);
          break;
        case "SHL":
          calculate("SHL", r[a], 0);
          break;
        case "SHR":
          calculate("SHR", r[a], 0);
          break;
        case "CMP":
          calculate("SUB", r[a], r[b], false);
          break;
        case "CMPI":
          calculate("SUB", r[a], b, false);
          break;
        case "JMP":
          this.pc = a;
          break;
        case "JZ":
          if (this.zero) this.pc = a;
          break;
        case "JNZ":
          if (!this.zero) this.pc = a;
          break;
        case "JC":
          if (this.carry) this.pc = a;
          break;
        case "CALL":
          this.push(this.pc >> 8);
          this.push(this.pc & 255);
          this.pc = a;
          break;
        case "RET": {
          const low = this.pop();
          this.pc = low | (this.pop() << 8);
          break;
        }
        case "PUSH":
          this.push(r[a]);
          break;
        case "POP":
          r[a] = this.pop();
          break;
        case "LDX":
          r[a] = this.busRead((b + r[c]) & 65535);
          break;
        case "STX":
          this.write((b + r[c]) & 65535, r[a]);
          break;
        case "PIXEL":
          if (r[a] < screenWidth && r[b] < screenHeight) {
            this.write(0xf000 + r[b] * screenWidth + r[a], r[c]);
          }
          break;
        case "CLS":
          this.write(0xff02, 1);
          break;
      }
      this.cycles++;
    } catch (error) {
      this.error = (error as Error).message;
      this.halted = true;
    }
  }
  run(budget = 1000) {
    if (!Number.isInteger(budget) || budget < 0 || budget > 100_000) {
      throw Error("Invalid instruction budget.");
    }
    for (let i = 0; i < budget && !this.halted; i++) this.step();
  }
}
