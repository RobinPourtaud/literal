import assert from "node:assert/strict";
import { transistorCircuit } from "@literal/core";
import { advancedCourses, solutions } from "../apps/web/src/curriculum.ts";
import { labSolution } from "../tests/curriculum-fixtures.ts";
const worktree = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const page = Deno.args.at(-1);
if (!page || !/^[0-9a-f-]{36}$/.test(page)) {
  throw Error("Pass an Orca page id on the isolated localhost origin.");
}
async function orca(...args: string[]) {
  const output = await new Deno.Command("orca", {
    args: [...args, "--page", page, "--worktree", `path:${worktree}`, "--json"],
    stdout: "piped",
    stderr: "piped",
  }).output();
  const data = JSON.parse(new TextDecoder().decode(output.stdout));
  if (!data.ok) throw Error(JSON.stringify(data.error));
  return data.result;
}
async function run(code: string) {
  await orca("snapshot");
  const value = await orca(
    "eval",
    "--expression",
    `(async()=>await (${code}))()`,
  );
  await orca("snapshot");
  try {
    return JSON.parse(value.result);
  } catch {
    return value.result;
  }
}
const start = Math.max(
  0,
  advancedCourses.findIndex((c) => c.id === Deno.args[0]),
);
assert.equal(await run(`location.hostname`), "localhost");
const previous = await run(
  `JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.startsWith('literal.'))))`,
);
await Deno.writeTextFile(
  new URL("../docs/.browser-backup.json", import.meta.url),
  JSON.stringify(previous),
);
const definitions = ["NOT", "NAND", "AND", "OR", "XOR"].map((kind) => {
  const c = transistorCircuit(kind as "NOT")!;
  return {
    id: `seed-${kind}`,
    name: kind,
    color: "#527d3c",
    shape: "rounded",
    components: c.components,
    wires: c.wires,
  };
});
const click = (selector: string) =>
  run(
    `(()=>{const b=document.querySelector(${
      JSON.stringify(selector)
    });if(!b||b.disabled)throw Error('Button unavailable: '+${
      JSON.stringify(selector)
    });b.click();return 'ok'})()`,
  );
try {
  await run(
    `(()=>{for(const key of Object.keys(localStorage))if(key.startsWith('literal.'))localStorage.removeItem(key);localStorage.setItem('literal.mode','discover');localStorage.setItem('literal.course','xor');localStorage.setItem('literal.completedCourses',${
      JSON.stringify(JSON.stringify(
        advancedCourses.slice(0, start).map((c) => c.id),
      ))
    });localStorage.setItem('literal.library',${
      JSON.stringify(JSON.stringify(definitions))
    });localStorage.setItem('literal.discovered',${
      JSON.stringify(JSON.stringify(definitions.map((d) => d.id)))
    });return 'ok'})()`,
  );
  await orca("reload");
  await orca("wait", "--selector", "#board");
  await click("[data-lesson=courses]");
  await click(`[data-course="${5 + start}"]`);
  for (const [index, course] of advancedCourses.slice(start).entries()) {
    assert.match(
      await run(`document.querySelector('.lesson-progress').textContent`),
      new RegExp(course.name.split(" · ").at(-1)!, "i"),
    );
    await click("[data-lesson=check]");
    await orca("wait", "--selector", "[data-lesson=check]:not(:disabled)");
    assert.equal(
      await run(
        `JSON.stringify(!!document.querySelector('[data-lesson=next-course]'))`,
      ),
      false,
      `unfinished ${course.id}`,
    );
    await click("[data-lesson=hint]");
    assert.ok(
      (await run(`document.querySelector('#dialog-body').textContent`)).length >
        80,
    );
    await click("#close-dialog");
    await click("[data-lesson=example]");
    await click("#close-dialog");
    for (let step = 0; step < 3; step++) await click("[data-lesson=next]");
    if (solutions[course.id] && course.id !== "cpu") {
      await click("[data-focus-node=rom]");
      assert.equal(
        await run(`document.querySelector('#zoom-label').textContent`),
        "100%",
      );
      await run(
        `(()=>{document.querySelector('#rom-source').value=${
          JSON.stringify(solutions[course.id])
        };document.querySelector('#assemble-rom').click();return 'ok'})()`,
      );
      assert.equal(
        await run(`document.querySelector('#rom-assembly-error').textContent`),
        "",
      );
    } else {
      await run(
        `window.literal.setCircuit(${JSON.stringify(labSolution(course.id))})`,
      );
    }
    await click("[data-lesson=check]");
    await orca("wait", "--text", "All functional checks passed");
    assert.equal(
      await run(
        `JSON.stringify(JSON.parse(localStorage.getItem('literal.completedCourses')).includes(${
          JSON.stringify(course.id)
        }))`,
      ),
      true,
    );
    if (index === 0 || solutions[course.id]) {
      await orca("reload");
      await orca(
        "wait",
        "--selector",
        course.id === "projection"
          ? "[data-lesson=free]"
          : "[data-lesson=next-course]",
      );
      assert.match(
        await run(`document.querySelector('.lesson-progress').textContent`),
        /4 \/ 4/,
      );
      const state = await run(`window.literal.getState()`);
      assert.ok(state.circuit.wires.length > 0);
    }
    if (course.id === "cpu") {
      await click("[data-focus-node=rom]");
      assert.equal(
        await run(`JSON.stringify(!!document.querySelector('#rom-source'))`),
        true,
      );
      await click("[data-focus-node=clock]");
      assert.equal(
        await run(`JSON.stringify(!!document.querySelector('#run'))`),
        true,
      );
    }
    if (course.id === "projection") {
      for (let batch = 0; batch < 12; batch++) {
        await run(`window.literal.computer({action:'step',steps:100})`);
      }
      await click("[data-focus-node=screen]");
      await click("#fit");
      const shot = await orca("screenshot");
      await Deno.writeFile(
        new URL("../docs/discover-projection.png", import.meta.url),
        Uint8Array.from(atob(shot.data), (c) => c.charCodeAt(0)),
      );
    }
    console.log(
      `PASS ${course.id}: hints, example, four steps, failed starter, functional check, completion`,
    );
    await click(
      index === advancedCourses.length - start - 1
        ? "[data-lesson=free]"
        : "[data-lesson=next-course]",
    );
  }
  assert.match(
    await run(`document.querySelector('.lesson-progress').textContent`),
    /FREE BUILD/,
  );
  await click("[data-lesson=courses]");
  await click('[data-course="5"]');
  assert.match(
    await run(`document.querySelector('.lesson-progress').textContent`),
    /HALF ADDER/,
  );
  await click("[data-lesson=courses]");
  const shot = await orca("screenshot");
  await Deno.writeFile(
    new URL("../docs/discover-courses.png", import.meta.url),
    Uint8Array.from(atob(shot.data), (c) => c.charCodeAt(0)),
  );
  console.log(
    "PASS complete course path, saved progress after reload, component-specific inspectors, and workspace revisit",
  );
} finally {
  await run(
    `(()=>{for(const key of Object.keys(localStorage))if(key.startsWith('literal.'))localStorage.removeItem(key);for(const [key,value]of Object.entries(${
      JSON.stringify(previous)
    }))localStorage.setItem(key,value);return 'ok'})()`,
  );
  await orca("reload");
}
