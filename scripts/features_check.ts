import assert from "node:assert/strict";
const worktree = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
async function orca(...args: string[]) {
  const result = await new Deno.Command("orca", {
    args: [...args, "--worktree", `path:${worktree}`, "--json"],
    stdout: "piped",
    stderr: "piped",
  }).output();
  const data = JSON.parse(new TextDecoder().decode(result.stdout));
  if (!data.ok) throw Error(JSON.stringify(data.error));
  return data.result;
}
async function run(code: string) {
  await orca("snapshot");
  const value = await orca("eval", "--expression", code);
  await orca("snapshot");
  try {
    return JSON.parse(value.result);
  } catch {
    return value.result;
  }
}
const previousLibrary =
  (await run("({raw:localStorage.getItem('literal.library')})")).raw;
await orca("reload");
await orca("wait", "--selector", "#examples-button");
await run(
  `(() => {document.querySelector('#examples-button').click();document.querySelector('#dialog [data-example=displays]').click();return true})()`,
);
assert.equal(
  await run(
    `document.querySelectorAll('[data-node=segments] [data-segment].high').length`,
  ),
  7,
);
await run(
  `(() => {document.querySelector('[data-node="segment-7"] .component-body').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return true})()`,
);
assert.equal(
  await run(
    `document.querySelectorAll('[data-node=segments] [data-segment].high').length`,
  ),
  8,
);
assert.equal(
  await run(
    `document.querySelector('[data-node=hex] .component-body').getAttribute('aria-label')`,
  ),
  "Hex digit HEX_DISPLAY 5",
);
await run(
  `(() => {document.querySelector('[data-node="bit-3"] .component-body').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return true})()`,
);
assert.equal(
  await run(
    `document.querySelector('[data-node=hex] .component-body').getAttribute('aria-label')`,
  ),
  "Hex digit HEX_DISPLAY D",
);
console.log(
  "PASS seven-segment rendering, decimal point, and live hex decoding",
);
await run(
  `(() => {document.querySelector('#examples-button').click();document.querySelector('#dialog [data-example="half-adder"]').click();document.querySelector('#board').dispatchEvent(new KeyboardEvent('keydown',{key:'a',ctrlKey:true,bubbles:true}));document.querySelector('#create-custom').click();document.querySelector('#custom-name').value='Reusable adder';document.querySelector('#custom-color').value='#7b639b';document.querySelector('#custom-shape').value='diamond';document.querySelector('#custom-form').requestSubmit();return true})()`,
);
const def = await run(
  `JSON.parse(localStorage.getItem('literal.library')).findLast(d=>d.name==='Reusable adder')`,
);
assert.equal(def.color, "#7b639b");
assert.equal(def.shape, "diamond");
await run(
  `(() => {document.querySelector('[data-edit-custom="${def.id}"]').click();document.querySelector('#appearance-color').value='#436e87';document.querySelector('#appearance-shape').value='rectangle';document.querySelector('#appearance-form').requestSubmit();return true})()`,
);
await run(
  `(() => {document.querySelector('#new').click();document.querySelector('[data-custom="${def.id}"]').click();document.querySelector('#place-center').click();return true})()`,
);
const instance = await run(
  `JSON.parse(localStorage.getItem('literal.circuit')).components.find(c=>c.kind==='CUSTOM')`,
);
assert.equal(
  await run(
    `document.querySelectorAll('.component[data-node="${instance.id}"] .pin').length`,
  ),
  4,
);
assert.equal(
  await run(
    `document.querySelector('.custom-case').style.getPropertyValue('--custom-color')`,
  ),
  "#436e87",
);
await run(
  `(() => {document.querySelector('#select-tool').click();document.querySelector('#board').dispatchEvent(new KeyboardEvent('keydown',{key:'a',ctrlKey:true,bubbles:true}));document.querySelector('#duplicate').click();return true})()`,
);
assert.equal(
  await run(
    `JSON.parse(localStorage.getItem('literal.circuit')).components.length`,
  ),
  2,
);
await orca("reload");
await orca("wait", "--selector", "#examples-button");
assert.equal(await run(`document.querySelectorAll('.custom-case').length`), 2);
assert.ok(await run(`!!document.querySelector('[data-custom="${def.id}"]')`));
console.log(
  "PASS custom creation, color/shape, pin interface, duplication, autosave and library reload",
);
await run(
  `(() => {document.querySelector('#examples-button').click();document.querySelector('#dialog [data-example="half-adder"]').click();return true})()`,
);
await run(
  `(() => {localStorage.setItem('literal.library',${
    JSON.stringify(previousLibrary ?? "[]")
  });return true})()`,
);
await orca("reload");
await orca("wait", "--selector", "#examples-button");
assert.equal(
  (await run("({raw:localStorage.getItem('literal.library')})")).raw,
  previousLibrary ?? "[]",
);
console.log("PASS appearance editing and preservation of the existing library");
const screenshot = await orca("screenshot");
await Deno.writeFile(
  new URL("../docs/editor.png", import.meta.url),
  Uint8Array.from(atob(screenshot.data), (c) => c.charCodeAt(0)),
);
