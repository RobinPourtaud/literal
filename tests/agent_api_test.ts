import assert from "node:assert/strict";
import {
  createAgentAPI,
  type LiteralActions,
} from "../apps/web/src/agent-api.ts";
const fixture = () => {
  const calls: unknown[] = [];
  const action = (name: string) => (...args: unknown[]) => {
    calls.push([name, ...args]);
    return { ok: true };
  };
  const actions: LiteralActions = {
    state: action("state"),
    examples: [{ id: "adder", name: "Adder", description: "Add bits" }],
    loadExample: action("load"),
    replaceCircuit: action("replace"),
    setInputs: action("inputs"),
    clock: action("clock"),
    truthTable: action("table"),
    createComponent: action("create"),
    history: action("history"),
    computer: action("computer"),
  };
  return { calls, api: createAgentAPI(actions) };
};
Deno.test("agent API rejects invalid arguments before application mutations", async () => {
  const { calls, api } = fixture();
  for (
    const [name, input] of [
      ["get_state", { unexpected: true }],
      ["get_state", JSON.parse('{"constructor":0}')],
      ["clock", { steps: 101 }],
      ["clock", { steps: NaN }],
      ["clock", { reset: "yes" }],
      ["load_example", { id: "unknown" }],
      ["set_inputs", { values: [{ id: "a", value: 2 }] }],
      ["set_inputs", { values: [] }],
      ["computer", { action: "assemble" }],
      ["computer", { action: "key", code: 65 }],
      ["computer", { action: "reset", source: "HALT" }],
      ["computer", { action: "step", steps: 10001 }],
      ["set_circuit", { json: "a".repeat(20_000_001) }],
    ] as [string, unknown][]
  ) await assert.rejects(() => api.call(name, input));
  await assert.rejects(() => api.call("unknown"));
  assert.deepEqual(calls, []);
  await api.clock();
  assert.deepEqual(calls.pop(), ["clock", 1, false]);
  await api.computer({ action: "key", code: 65, pressed: true });
  assert.deepEqual(calls.pop(), ["computer", {
    action: "key",
    code: 65,
    pressed: true,
  }]);
  const result = await api.minimizeLogic(["A", "B"], [0, 0, 0, 1]);
  assert.equal((result as { expression: string }).expression, "A · B");
  assert.deepEqual(calls, []);
});
Deno.test("agent API provides isolated discovery metadata and direct circuit helpers", async () => {
  const { calls, api } = fixture();
  const tools = api.getTools();
  assert.equal(tools.length, 12);
  assert.equal(tools.find((t) => t.name === "get_state")!.readOnly, true);
  tools[0].name = "changed";
  assert.equal(api.getTools()[0].name, "get_state");
  assert.equal("execute" in tools[0], false);
  await api.getState();
  assert.deepEqual(calls.pop(), ["state"]);
  await api.setCircuit({
    version: 1,
    name: "Empty",
    components: [],
    wires: [],
  });
  assert.deepEqual(calls.pop(), [
    "replace",
    '{"version":1,"name":"Empty","components":[],"wires":[]}',
  ]);
  await api.undo();
  assert.deepEqual(calls.pop(), ["history", "undo"]);
  assert.ok(Object.isFrozen(api));
});
