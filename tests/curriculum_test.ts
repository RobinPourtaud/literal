import { parseCircuit } from "@literal/core";
import assert from "node:assert/strict";
import {
  advancedCourses,
  applyProgram,
  checkLab,
  labStarter,
  solutions,
} from "../apps/web/src/curriculum.ts";
import { courses } from "../apps/web/src/discover.ts";
import { labSolution } from "./curriculum-fixtures.ts";

Deno.test("Discover has a continuous curriculum through projection with useful hints", () => {
  assert.equal(new Set(courses.map((c) => c.id)).size, courses.length);
  assert.deepEqual(courses.slice(0, 5).map((c) => c.id), [
    "not",
    "nand",
    "and",
    "or",
    "xor",
  ]);
  assert.equal(courses.at(-1)!.id, "projection");
  for (const course of courses) {
    assert.ok(
      course.steps.every((s) =>
        s.title && s.text.length > 40 && s.hint.length > 40
      ),
    );
    if (course.lab) assert.equal(course.steps.length, 4);
  }
});
for (const course of advancedCourses) {
  Deno.test(`${course.id}: working circuit passes; disconnected practice does not; check preserves circuit`, () => {
    const solution = labSolution(course.id), before = JSON.stringify(solution);
    const good = checkLab(course.id, solution);
    assert.equal(good.passed, true, good.message);
    assert.equal(JSON.stringify(solution), before);
    const starter = labStarter(course.id, []);
    assert.equal(
      checkLab(course.id, starter).passed,
      false,
      `Unfinished ${course.id} must fail`,
    );
    const broken = structuredClone(solution);
    if (course.id === "latch") {
      broken.wires = broken.wires.filter((w) => w.to !== "Q");
    } else if (broken.components.some((n) => n.kind === "BUS_CPU")) {
      broken.wires = broken.wires.filter((w) =>
        !(w.to === "cpu" && w.port === 18)
      );
    } else {broken.wires = broken.wires.filter((w) =>
        w.to !==
          (course.id === "byte-adder"
            ? "Cout"
            : ["half-adder", "full-adder"].includes(course.id)
            ? "Carry"
            : ["mux", "alu"].includes(course.id)
            ? "Y"
            : "Q0")
      );}
    assert.equal(
      checkLab(course.id, broken).passed,
      false,
      `Broken ${course.id} must fail`,
    );
  });
}
Deno.test("BIOS checks the failed-memory path and keyboard reads each pressed code", () => {
  const bios = labSolution("bios");
  applyProgram(bios, solutions.bios.replace("JNZ failed", "NOP"));
  const unchecked = checkLab("bios", bios);
  assert.equal(unchecked.passed, false);
  assert.match(unchecked.message, /writes disabled/);
  const keyboard = labSolution("keyboard");
  applyProgram(
    keyboard,
    solutions.keyboard.replace("LD R0, 0xFF00", "LDI R0, 130"),
  );
  const hardcoded = checkLab("keyboard", keyboard);
  assert.equal(hardcoded.passed, false);
  assert.match(hardcoded.message, /131/);
  assert.equal(checkLab("not-a-course", keyboard).passed, false);
});

Deno.test("later machine workspaces remain portable when the reference ALU is already in the library", () => {
  const library = labSolution("cpu").definitions!;
  for (const id of ["cpu", "opcode", "bios", "projection"]) {
    const c = labStarter(id, library);
    assert.equal(
      parseCircuit(JSON.stringify(c)).definitions!.length,
      library.length,
    );
  }
});

Deno.test("memory labs reject swapped data bits and aliased address bits", () => {
  const register = labSolution("register");
  const low = register.wires.find((w) => w.to === "Q0")!,
    high = register.wires.find((w) => w.to === "Q7")!;
  [low.from, high.from] = [high.from, low.from];
  assert.equal(checkLab("register", register).passed, false);
  for (const id of ["ram", "rom"]) {
    const c = labSolution(id);
    c.wires.find((w) => w.to === "Memory" && w.port === 7)!.from = "A0";
    assert.equal(checkLab(id, c).passed, false);
  }
});
