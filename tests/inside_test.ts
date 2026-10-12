import assert from "node:assert/strict";
import { type Circuit, createDefinition, simulate } from "@literal/core";
import { insideBounds, inspectCircuit } from "../apps/web/src/inside.ts";
import { labGateMembers } from "../apps/web/src/curriculum.ts";
import { labSolution } from "./curriculum-fixtures.ts";

Deno.test("course save selects both half-adder branches and exposes A/B, Sum/Carry", () => {
  const c = labSolution("half-adder");
  const members = labGateMembers("half-adder", c);
  assert.ok(!members.has("A") && !members.has("B"));
  assert.ok(members.has("Sum") && members.has("Carry"));
  const def = createDefinition(c, members, {
    id: "half",
    name: "Half adder",
    color: "#527d3c",
    shape: "rounded",
  });
  assert.deepEqual(
    def.components.filter((n) => n.kind === "INPUT").map((n) => n.label),
    ["A", "B"],
  );
  assert.deepEqual(
    def.components.filter((n) => n.kind === "OUTPUT").map((n) => n.label),
    ["Sum", "Carry"],
  );
  for (let a = 0; a < 2; a++) {
    for (let b = 0; b < 2; b++) {
      const inner: Circuit = {
        version: 1,
        name: "Half",
        components: def.components,
        wires: def.wires,
        definitions: c.definitions,
      };
      const ins = inner.components.filter((n) => n.kind === "INPUT");
      const s = simulate(inner, undefined, {
        [ins[0].id]: a as 0 | 1,
        [ins[1].id]: b as 0 | 1,
      });
      assert.deepEqual(
        inner.components.filter((n) => n.kind === "OUTPUT").map((n) =>
          s.values[n.id]
        ),
        [a ^ b, a & b],
      );
    }
  }
});
Deno.test("internals preserve unknown pins and do not modify the inspected circuit", () => {
  const c = labSolution("half-adder");
  c.wires = c.wires.filter((w) => w.from !== "B");
  const original = JSON.stringify(c),
    s = simulate(c),
    node = c.components.find((n) => n.kind === "CUSTOM")!;
  const inspected = inspectCircuit(node, c, s)!;
  assert.equal(
    inspected.simulation.values[
      inspected.circuit.components.filter((n) => n.kind === "INPUT")[1].id
    ],
    "X",
  );
  assert.equal(JSON.stringify(c), original);
  assert.equal(
    inspectCircuit(c.components.find((n) => n.kind === "POWER")!, c, s),
    null,
  );
  assert.ok(
    Object.values(insideBounds(inspected.circuit)).every(Number.isFinite),
  );
  assert.deepEqual(
    insideBounds({ version: 1, name: "Empty", components: [], wires: [] }),
    { x: 0, y: 0, width: 320, height: 240 },
  );
});
