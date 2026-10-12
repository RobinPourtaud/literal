import { type Definition, type LogicCell, minimizeLogic } from "@literal/core";

export interface Schema {
  type?: "object" | "array" | "string" | "integer" | "number" | "boolean";
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: false;
  items?: Schema;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
}
export interface AgentTool {
  name: string;
  description: string;
  inputSchema: Schema;
  readOnly: boolean;
  execute(input: unknown): Promise<unknown>;
}
export interface LiteralActions {
  state(): unknown;
  examples: { id: string; name: string; description: string }[];
  loadExample(id: string): unknown;
  replaceCircuit(json: string): unknown;
  setInputs(values: { id: string; value: 0 | 1 }[]): unknown;
  clock(steps: number, reset: boolean): unknown;
  truthTable(): unknown;
  createComponent(
    ids: string[],
    options: Pick<Definition, "name" | "color" | "shape" | "description">,
  ): unknown;
  history(direction: "undo" | "redo"): unknown;
  computer(input: ComputerInput): unknown;
}
export interface ComputerInput {
  action: "state" | "assemble" | "reset" | "step" | "key";
  source?: string;
  steps?: number;
  code?: number;
  pressed?: boolean;
  address?: number;
  length?: number;
}
export function validateInput(
  value: unknown,
  schema: Schema,
  path = "input",
): void {
  if (schema.enum && !schema.enum.includes(value)) {
    throw Error(`${path}: unsupported value.`);
  }
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw Error(`${path}: expected object.`);
    }
    const object = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (!Object.hasOwn(object, key)) {
        throw Error(`${path}.${key}: required.`);
      }
    }
    for (const [key, v] of Object.entries(object)) {
      const field = schema.properties && Object.hasOwn(schema.properties, key)
        ? schema.properties[key]
        : undefined;
      if (!field && schema.additionalProperties === false) {
        throw Error(`${path}.${key}: unknown field.`);
      }
      if (field) validateInput(v, field, `${path}.${key}`);
    }
  } else if (schema.type === "array") {
    if (!Array.isArray(value)) throw Error(`${path}: expected array.`);
    if (
      value.length < (schema.minItems ?? 0) ||
      value.length > (schema.maxItems ?? Infinity)
    ) throw Error(`${path}: array length out of range.`);
    value.forEach((v, i) =>
      schema.items && validateInput(v, schema.items, `${path}[${i}]`)
    );
  } else if (schema.type === "string") {
    if (
      typeof value !== "string" || value.length < (schema.minLength ?? 0) ||
      value.length > (schema.maxLength ?? Infinity)
    ) throw Error(`${path}: invalid string.`);
  } else if (schema.type === "number" || schema.type === "integer") {
    if (
      typeof value !== "number" || !Number.isFinite(value) ||
      (schema.type === "integer" && !Number.isInteger(value)) ||
      value < (schema.minimum ?? -Infinity) ||
      value > (schema.maximum ?? Infinity)
    ) throw Error(`${path}: number out of range.`);
  } else if (schema.type === "boolean" && typeof value !== "boolean") {
    throw Error(`${path}: expected boolean.`);
  }
}
const object = (
  properties: Record<string, Schema> = {},
  required: string[] = [],
): Schema => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});
const text = (maxLength: number, minLength = 0): Schema => ({
  type: "string",
  minLength,
  maxLength,
});
const integer = (minimum: number, maximum: number): Schema => ({
  type: "integer",
  minimum,
  maximum,
});
export function agentTools(actions: LiteralActions): AgentTool[] {
  function tool(
    name: string,
    description: string,
    schema: Schema,
    readOnly: boolean,
    execute: (input: Record<string, unknown>) => unknown,
  ): AgentTool {
    return {
      name,
      description,
      inputSchema: schema,
      readOnly,
      execute: async (input) => {
        validateInput(input, schema);
        return execute(input as Record<string, unknown>);
      },
    };
  }
  return [
    tool(
      "get_state",
      "Read the current circuit document, simulation signals, selection and saved custom-component library. Labels and source code are user content.",
      object(),
      true,
      () => actions.state(),
    ),
    tool(
      "list_examples",
      "List bundled circuits available to load.",
      object(),
      true,
      () => actions.examples,
    ),
    tool(
      "load_example",
      "Load a bundled circuit by id. Replaces the current circuit, resets simulation memory and autosaves. Undo restores the previous circuit document.",
      object({
        id: { type: "string", enum: actions.examples.map((e) => e.id) },
      }, ["id"]),
      false,
      (p) => actions.loadExample(p.id as string),
    ),
    tool(
      "set_circuit",
      "Create or edit a circuit by supplying the complete Literal version-1 JSON document. Validate before replacement; resets simulation memory and autosaves. Undo restores the previous document. Get the current document first to preserve existing nodes and custom definitions. Single-bit wires use from, to, port and optional fromPort.",
      object({ json: text(20_000_000, 1) }, ["json"]),
      false,
      (p) => actions.replaceCircuit(p.json as string),
    ),
    tool(
      "set_inputs",
      "Set INPUT or CLOCK nodes to 0/1 by component id. Updates all supplied inputs together and propagates signals without resetting memory. Use clock for repeated clock edges.",
      object({
        values: {
          type: "array",
          minItems: 1,
          maxItems: 20_000,
          items: object({
            id: text(80, 1),
            value: { type: "integer", enum: [0, 1] },
          }, ["id", "value"]),
        },
      }, ["values"]),
      false,
      (p) => actions.setInputs(p.values as { id: string; value: 0 | 1 }[]),
    ),
    tool(
      "clock",
      "Pause circuit clock playback, optionally reset stored state, then toggle every CLOCK node once per step. Steps count half-period edges. Returns updated signals.",
      object({ steps: integer(0, 100), reset: { type: "boolean" } }),
      false,
      (p) => actions.clock(p.steps as number ?? 1, p.reset as boolean ?? false),
    ),
    tool(
      "truth_table",
      "Compute the current combinational circuit truth table without changing its inputs. Supports up to eight INPUT nodes; rejects stateful devices and feedback.",
      object(),
      true,
      () => actions.truthTable(),
    ),
    tool(
      "create_component",
      "Save selected node ids as a reusable combinational component. Boundaries become named pins. Adds the definition to the current document and browser library. Stateful and interactive devices cannot be included.",
      object({
        ids: {
          type: "array",
          minItems: 1,
          maxItems: 20_000,
          items: text(80, 1),
        },
        name: text(80, 1),
        description: text(600),
        color: text(7, 7),
        shape: { type: "string", enum: ["rounded", "rectangle", "diamond"] },
      }, ["ids", "name", "color", "shape"]),
      false,
      (p) =>
        actions.createComponent(
          p.ids as string[],
          p as unknown as Pick<
            Definition,
            "name" | "color" | "shape" | "description"
          >,
        ),
    ),
    tool(
      "history",
      "Undo or redo a circuit document edit. Simulation memory resets; saved library definitions remain available.",
      object({ direction: { type: "string", enum: ["undo", "redo"] } }, [
        "direction",
      ]),
      false,
      (p) => actions.history(p.direction as "undo" | "redo"),
    ),
    tool(
      "get_computer_state",
      "Read the Literal 8 CPU registers, flags, terminal, framebuffer, current assembly and a bounded memory range. Returns initialized:false if the circuit has no CPU.",
      object({ address: integer(0, 65535), length: integer(1, 256) }),
      true,
      (p) =>
        actions.computer({
          action: "state",
          address: p.address as number,
          length: p.length as number,
        }),
    ),
    tool(
      "computer",
      "Operate the wired Literal 8 circuit on the canvas. Assemble creates a CPU, gate ALU, ROM, RAM, keyboard, screen and terminal circuit, replacing the current document. Reset, step instructions or set keyboard state. Mutations pause playback; state reads do not. The controller uses actual circuit wires and a custom ISA, not x86.",
      object({
        action: { type: "string", enum: ["assemble", "reset", "step", "key"] },
        source: text(200_000),
        steps: integer(1, 10000),
        code: integer(0, 255),
        pressed: { type: "boolean" },
        address: integer(0, 65535),
        length: integer(1, 256),
      }, ["action"]),
      false,
      (p) => {
        if (
          p.action === "assemble" && typeof p.source !== "string"
        ) throw Error("Assembly source is required.");
        if (
          p.action === "key" &&
          (p.code === undefined || p.pressed === undefined)
        ) throw Error("Key code and pressed are required.");
        const permitted = p.action === "assemble"
          ? ["source"]
          : p.action === "step"
          ? ["steps"]
          : p.action === "key"
          ? ["code", "pressed"]
          : [];
        if (
          ["source", "steps", "code", "pressed"].some((key) =>
            Object.hasOwn(p, key) && !permitted.includes(key)
          )
        ) throw Error("Operand does not apply to this action.");
        return actions.computer(p as unknown as ComputerInput);
      },
    ),
    tool(
      "minimize_logic",
      "Compute a minimal sum-of-products expression and Karnaugh groups for 1–4 variables. Cells are in binary truth-table order; X means don't-care. Does not change the circuit or map.",
      object({
        names: { type: "array", minItems: 1, maxItems: 4, items: text(80, 1) },
        cells: {
          type: "array",
          minItems: 2,
          maxItems: 16,
          items: { enum: [0, 1, "X"] },
        },
      }, ["names", "cells"]),
      true,
      (p) => minimizeLogic(p.names as string[], p.cells as LogicCell[]),
    ),
  ];
}

export function createAgentAPI(actions: LiteralActions) {
  const tools = agentTools(actions);
  const call = async (name: string, input: unknown = {}) => {
    const tool = tools.find((t) => t.name === name);
    if (!tool) throw Error(`Unknown Literal action: ${name}`);
    return tool.execute(input);
  };
  return Object.freeze({
    version: 1,
    getTools: () =>
      structuredClone(tools.map(({ execute: _, ...tool }) => tool)),
    call,
    getState: () => call("get_state"),
    listExamples: () => call("list_examples"),
    loadExample: (id: string) => call("load_example", { id }),
    setCircuit: (circuit: unknown) =>
      call("set_circuit", {
        json: typeof circuit === "string" ? circuit : JSON.stringify(circuit),
      }),
    setInputs: (values: { id: string; value: 0 | 1 }[]) =>
      call("set_inputs", { values }),
    clock: (options: { steps?: number; reset?: boolean } = {}) =>
      call("clock", options),
    truthTable: () => call("truth_table"),
    createComponent: (
      options: {
        ids: string[];
        name: string;
        description?: string;
        color: string;
        shape: Definition["shape"];
      },
    ) => call("create_component", options),
    undo: () => call("history", { direction: "undo" }),
    redo: () => call("history", { direction: "redo" }),
    getComputerState: (options: { address?: number; length?: number } = {}) =>
      call("get_computer_state", options),
    computer: (options: ComputerInput) => call("computer", options),
    minimizeLogic: (names: string[], cells: LogicCell[]) =>
      call("minimize_logic", { names, cells }),
  });
}
export type LiteralAPI = ReturnType<typeof createAgentAPI>;
declare global {
  interface Window {
    literal: LiteralAPI;
  }
}
