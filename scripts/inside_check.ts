import assert from "node:assert/strict";
import { type Circuit, computerCircuit, createDefinition } from "@literal/core";
import { labGateMembers } from "../apps/web/src/curriculum.ts";
import { labSolution } from "../tests/curriculum-fixtures.ts";
const worktree = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const page = Deno.args[0];
if (!page) {
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
  const r = await orca("eval", "--expression", `(async()=>await (${code}))()`);
  await orca("snapshot");
  try {
    return JSON.parse(r.result);
  } catch {
    return r.result;
  }
}
const click = (selector: string) =>
  run(
    `(()=>{const b=document.querySelector(${
      JSON.stringify(selector)
    });if(!b||b.disabled)throw Error('Missing '+${
      JSON.stringify(selector)
    });b.dispatchEvent(new MouseEvent('click',{bubbles:true}));return 'ok'})()`,
  );
assert.equal(await run(`location.hostname`), "localhost");
const previous = await run(
  `JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.startsWith('literal.'))))`,
);
await Deno.writeTextFile(
  "/tmp/literal-inside-test-backup.json",
  JSON.stringify(previous),
);
const half = labSolution("half-adder");
const def = createDefinition(half, labGateMembers("half-adder", half), {
  id: "test-half",
  name: "Half adder",
  color: "#527d3c",
  shape: "rounded",
});
const outer: Circuit = {
  version: 1,
  name: "Inspect half",
  definitions: [...half.definitions!, def],
  components: [{ id: "a", kind: "POWER", label: "A", x: 0, y: 0, value: 1 }, {
    id: "b",
    kind: "POWER",
    label: "B",
    x: 0,
    y: 180,
    value: 0,
  }, {
    id: "half",
    kind: "CUSTOM",
    definition: def.id,
    label: "Half adder",
    x: 300,
    y: 90,
  }],
  wires: [{ id: "aw", from: "a", to: "half", port: 0 }, {
    id: "bw",
    from: "b",
    to: "half",
    port: 1,
  }],
};
try {
  await run(
    `(()=>{localStorage.setItem('literal.mode','playground');return 'ok'})()`,
  );
  await orca("reload");
  await orca("wait", "--selector", "#board");
  await run(`window.literal.setCircuit(${JSON.stringify(outer)})`);
  await run(
    `(()=>{document.querySelector('[data-node=half] .component-body').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));document.querySelector('#see-inside').click();return 'ok'})()`,
  );
  await orca("wait", "--selector", "#inside-find");
  assert.equal(
    await run(
      `JSON.stringify(document.querySelector('#dialog').getBoundingClientRect().width>800)`,
    ),
    true,
  );
  const zoom = await run(`document.querySelector('#inside-zoom').textContent`);
  await click("#inside-zoom-in");
  assert.notEqual(
    await run(`document.querySelector('#inside-zoom').textContent`),
    zoom,
  );
  await click("#inside-fit");
  await run(
    `(()=>{const s=document.querySelector('#inside-find');s.value='g0';s.dispatchEvent(new Event('change',{bubbles:true}));return 'ok'})()`,
  );
  assert.equal(
    await run(`document.querySelector('#inside-zoom').textContent`),
    "100%",
  );
  await run(
    `(()=>{document.querySelector('#inside-circuit [data-node=g0] .component-body').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return 'ok'})()`,
  );
  assert.equal(
    await run(
      `JSON.stringify(document.querySelectorAll('[data-inside-level]').length)`,
    ),
    2,
  );
  await run(
    `(()=>{const n=[...document.querySelectorAll('#inside-circuit .component-body')].find(n=>n.getAttribute('aria-label').includes('NMOS'));n.dispatchEvent(new MouseEvent('click',{bubbles:true}));return 'ok'})()`,
  );
  assert.equal(
    await run(
      `JSON.stringify(!!document.querySelector('.transistor-section'))`,
    ),
    true,
  );
  assert.equal(
    await run(
      `JSON.stringify(document.querySelectorAll('[data-inside-level]').length)`,
    ),
    3,
  );
  await click("#inside-back");
  assert.equal(
    await run(
      `JSON.stringify(document.querySelectorAll('[data-inside-level]').length)`,
    ),
    2,
  );
  await click('[data-inside-level="0"]');
  assert.equal(
    await run(
      `JSON.stringify(document.querySelectorAll('[data-inside-level]').length)`,
    ),
    1,
  );
  const pins = await run(
    `JSON.stringify([...document.querySelectorAll('#inside-circuit .component-body')].map(n=>n.getAttribute('aria-label')))`,
  );
  assert.ok(pins.some((label: string) => label.includes("A INPUT")));
  await click("#close-dialog");
  await run(
    `window.literal.setCircuit(${JSON.stringify(computerCircuit("HALT"))})`,
  );
  await run(
    `(()=>{document.querySelector('[data-node=alu] .component-body').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));document.querySelector('#see-inside').click();return 'ok'})()`,
  );
  await orca("wait", "--selector", "#inside-find");
  assert.ok(
    (await run(
      `JSON.stringify(document.querySelectorAll('#inside-find option').length)`,
    )) > 400,
  );
  await run(
    `(()=>{const s=document.querySelector('#inside-find');s.value=[...s.options].find(o=>o.textContent.includes('AND')).value;s.dispatchEvent(new Event('change',{bubbles:true}));return 'ok'})()`,
  );
  assert.equal(
    await run(`document.querySelector('#inside-zoom').textContent`),
    "100%",
  );
  await click("#close-dialog");
  await run(
    `(()=>{document.querySelector('[data-node=cpu] .component-body').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));document.querySelector('#see-inside').click();return 'ok'})()`,
  );
  assert.ok(
    (await run(`document.querySelector('#inside-find').textContent`)).includes(
      "Instruction fetch and decode",
    ),
  );
  for (
    const label of ["Register writeback", "R0", "R0 bit 0", "R0 bit 0 master"]
  ) {
    await run(
      `(()=>{const option=[...document.querySelector('#inside-find').options].find(o=>o.textContent.includes(${
        JSON.stringify(label)
      }+' · CUSTOM'));if(!option)throw Error('Missing '+${
        JSON.stringify(label)
      });document.querySelector('#inside-circuit [data-node="'+option.value+'"] .component-body').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return 'ok'})()`,
    );
  }
  assert.ok(
    (await run(`document.querySelector('#inside-find').textContent`)).includes(
      "NAND",
    ),
  );
  const gateShot = await orca("screenshot");
  await Deno.writeFile(
    "/tmp/literal-gate-internals.png",
    Uint8Array.from(atob(gateShot.data), (c) => c.charCodeAt(0)),
  );
  await run(
    `(()=>{const option=[...document.querySelector('#inside-find').options].find(o=>o.textContent.includes(' · NAND'));document.querySelector('#inside-circuit [data-node="'+option.value+'"] .component-body').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return 'ok'})()`,
  );
  assert.ok(
    (await run(`document.querySelector('#inside-find').textContent`)).includes(
      "NMOS",
    ),
  );
  await click("#close-dialog");
  await run(
    `(()=>{localStorage.setItem('literal.mode','discover');localStorage.setItem('literal.course','half-adder');localStorage.setItem('literal.discover.circuit',${
      JSON.stringify(JSON.stringify(half))
    });return 'ok'})()`,
  );
  await orca("reload");
  await orca("wait", "--selector", "[data-lesson=save-lab]");
  await click("[data-lesson=save-lab]");
  assert.match(
    await run(`document.querySelector('#custom-preview').textContent`),
    /Inputs \(2\): A, B.*Outputs \(2\): Sum, Carry/s,
  );
  await run(
    `(()=>{document.querySelector('#custom-name').value='Checked half';document.querySelector('#custom-form').requestSubmit();return 'ok'})()`,
  );
  const saved = await run(`window.literal.getState()`);
  assert.equal(
    saved.library.find((d: { name: string }) => d.name === "Checked half")
      .components.filter((n: { kind: string }) => n.kind === "INPUT").length,
    2,
  );
  await run(
    `(()=>{document.querySelector('[data-node=g0] .component-body').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));document.querySelector('#see-inside').click();return 'ok'})()`,
  );
  const before = await run(`localStorage.getItem('literal.discover.circuit')`);
  await click("#inside-open-circuit");
  assert.equal(await run(`localStorage.getItem('literal.mode')`), "playground");
  assert.deepEqual(
    await run(`localStorage.getItem('literal.discover.circuit')`),
    before,
  );
  console.log(
    "PASS fitted internals, zoom, lookup, keyboard descent, transistor/back/breadcrumb navigation, safe Playground copy, and automatic half-adder pin selection",
  );
} finally {
  await run(
    `(()=>{for(const key of Object.keys(localStorage))if(key.startsWith('literal.'))localStorage.removeItem(key);for(const [key,value]of Object.entries(${
      JSON.stringify(previous)
    }))localStorage.setItem(key,value);return 'ok'})()`,
  );
  await orca("reload");
}
