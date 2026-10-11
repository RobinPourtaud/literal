import assert from "node:assert/strict";
const worktree = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
async function orca(...args: string[]) {
  const out = await new Deno.Command("orca", {
    args: [...args, "--worktree", `path:${worktree}`, "--json"],
    stdout: "piped",
    stderr: "piped",
  }).output();
  const data = JSON.parse(new TextDecoder().decode(out.stdout));
  if (!data.ok) throw Error(JSON.stringify(data.error));
  return data.result;
}
async function evaluate(expression: string) {
  const data = await orca("eval", "--expression", expression);
  return typeof data.result === "string"
    ? JSON.parse(data.result)
    : data.result;
}
async function click(name: string, role = "button") {
  const state = await orca("snapshot");
  assert.ok(
    Object.values(state.refs).some((v) =>
      (v as { name: string; role: string }).name === name &&
      (v as { role: string }).role === role
    ),
    `Missing ${role}: ${name}`,
  );
  await evaluate(
    `(() => {const name=${
      JSON.stringify(name)
    },norm=s=>s.replace(/\\s/g,'');const el=[...document.querySelectorAll('button,[role="button"],[role="tab"],[data-row]')].find(e=>(e.getAttribute('aria-label')===name||e.title===name||norm(e.textContent)===norm(name))&&(!document.querySelector('dialog[open]')||e.closest('dialog')));if(!el)throw Error('Missing DOM control '+name);el.focus();if(el.classList.contains('component-body')){const r=el.getBoundingClientRect(),board=document.querySelector('#board'),capture=board.setPointerCapture;board.setPointerCapture=()=>{};el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1,clientX:r.x+r.width/2,clientY:r.y+r.height/2}));board.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:1,clientX:r.x+r.width/2,clientY:r.y+r.height/2}));board.setPointerCapture=capture;}else if(el.click)el.click();else el.dispatchEvent(new MouseEvent('click',{bubbles:true}));return true})()`,
  );
  await orca("snapshot");
}
const saved = () =>
  evaluate('JSON.parse(localStorage.getItem("literal.circuit"))');
const outputs = () =>
  evaluate(
    '[...document.querySelectorAll(".component")].filter(c=>c.querySelector(".component-body").getAttribute("aria-label").endsWith("OUTPUT")).map(c=>c.querySelector(".signal-number").textContent)',
  );
async function field(name: string, value: string) {
  await orca("snapshot");
  await evaluate(
    `(() => {const input=[...document.querySelectorAll('#details label')].find(e=>e.firstChild.textContent.trim()===${
      JSON.stringify(name)
    }).querySelector('input');input.focus();input.value=${
      JSON.stringify(value)
    };input.dispatchEvent(new Event('change',{bubbles:true}));input.blur();return true})()`,
  );
  await orca("snapshot");
}
await orca("goto", "--url", "http://127.0.0.1:5176");
await orca("wait", "--selector", "#examples-button");
await click("Examples");
await click("Load example Half adder");
assert.deepEqual(await outputs(), ["1", "0"]);
await click("B INPUT 0. Enter to toggle.");
assert.deepEqual(await outputs(), ["0", "1"]);
await click("Truth table", "tab");
await click("Apply inputs 0, 1", "row");
assert.deepEqual(await outputs(), ["1", "0"]);
console.log("PASS input toggles and truth table application");
await click("Selection", "tab");
await click("New circuit");
for (
  const [palette, label, x] of [["↗ Input +", "A", "160"], [
    "¬ NOT +",
    "Invert",
    "400",
  ], ["◉ Output +", "Result", "640"]]
) {
  await click(palette);
  await click("Place at center");
  await field("Label", label);
  await field("X", x);
  await field("Y", "240");
  await click("Select");
}
assert.equal((await saved()).components.length, 3);
await click("Fit circuit");
await click("A output pin");
await click("Invert input 1 pin");
await click("Invert output pin");
await click("Result input 1 pin");
assert.equal((await saved()).wires.length, 2);
assert.deepEqual(await outputs(), ["1"]);
await click("A INPUT 0. Enter to toggle.");
assert.deepEqual(await outputs(), ["0"]);
await click("Undo");
assert.deepEqual(await outputs(), ["1"]);
await click("Redo");
assert.deepEqual(await outputs(), ["0"]);
console.log("PASS placement, inspector edits, wiring, undo/redo");
await click("Result OUTPUT");
const before = (await saved()).components.find((c: { label: string }) =>
  c.label === "Result"
);
await evaluate(
  `(() => {const el=document.querySelector('.component[data-node="${before.id}"] .component-body'),r=el.getBoundingClientRect(),board=document.querySelector('#board'),capture=board.setPointerCapture;board.setPointerCapture=()=>{};const base={bubbles:true,pointerId:1,clientX:r.x+r.width/2,clientY:r.y+r.height/2};el.dispatchEvent(new PointerEvent('pointerdown',base));board.dispatchEvent(new PointerEvent('pointermove',{...base,clientX:base.clientX+60,clientY:base.clientY+40}));board.dispatchEvent(new PointerEvent('pointerup',{...base,clientX:base.clientX+60,clientY:base.clientY+40}));board.setPointerCapture=capture;return true})()`,
);
await orca("snapshot");
const after = (await saved()).components.find((c: { label: string }) =>
  c.label === "Result"
);
assert.notEqual(after.x, before.x);
assert.equal(after.x % 20, 0);
await click("Duplicate selection");
assert.equal((await saved()).components.length, 4);
await click("Delete selection");
assert.equal((await saved()).components.length, 3);
console.log("PASS dispatched pointer drag, snapping, duplicate/delete");
await orca("reload");
await orca("wait", "--selector", "#examples-button");
assert.deepEqual(await outputs(), ["0"]);
assert.equal((await saved()).wires.length, 2);
const zoom = await evaluate(
  'parseInt(document.querySelector("#zoom-label").textContent)',
);
await click("Zoom in");
assert.ok(
  await evaluate(
    `parseInt(document.querySelector('#zoom-label').textContent)>${zoom}`,
  ),
);
await click("Fit circuit");
await evaluate(
  '(() => {window.__download=null;const old=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download)window.__download={name:this.download,url:this.href};else old.call(this)};document.querySelector("#save").click();HTMLAnchorElement.prototype.click=old;return true})()',
);
assert.ok((await evaluate("window.__download")).name.endsWith(".literal"));
console.log("PASS autosave/reload, zoom, download creation");
await click("Examples");
await click("Close dialog");
assert.equal(await evaluate('document.querySelector("#dialog").open'), false);
await click("Examples");
await click("Load example D flip-flop");
assert.deepEqual(await outputs(), ["0"]);
await click("Toggle all clocks once");
assert.deepEqual(await outputs(), ["1"]);
await click("Reset simulation");
assert.deepEqual(await outputs(), ["0"]);
await click("Run clock");
await orca("wait", "--text", "Pause clock");
await click("Pause clock");
await click("Truth table", "tab");
assert.ok(
  await evaluate(
    'document.querySelector("#details").textContent.includes("combinational")',
  ),
);
console.log("PASS dialogs, clock controls, reset, sequential restriction");
const prior = await saved();
await evaluate(
  '(() => {const input=document.querySelector("#file-input"),dt=new DataTransfer();dt.items.add(new File(["invalid JSON"],"bad.literal",{type:"application/json"}));input.files=dt.files;input.dispatchEvent(new Event("change"));return true})()',
);
await orca("wait", "--selector", "#toast.visible");
assert.deepEqual(await saved(), prior);
const fixture = {
  version: 1,
  name: "Imported test",
  components: [{
    id: "i",
    kind: "INPUT",
    value: 1,
    x: 160,
    y: 160,
    label: "Test",
  }, { id: "o", kind: "OUTPUT", x: 400, y: 160, label: "Lamp" }],
  wires: [{ id: "w", from: "i", to: "o", port: 0 }],
};
await evaluate(
  `(() => {const input=document.querySelector('#file-input'),dt=new DataTransfer();dt.items.add(new File([${
    JSON.stringify(JSON.stringify(fixture))
  }],'test.literal',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change'));return true})()`,
);
await orca("wait", "--text", "Opened Imported test");
assert.deepEqual(await saved(), fixture);
assert.deepEqual(await outputs(), ["1"]);
console.log("PASS malformed import recovery and valid file import");
await click("Selection", "tab");
await evaluate(
  '(() => {const pin=document.querySelector(".pin[data-node=i]");pin.focus();pin.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}));return true})()',
);
assert.ok(
  await evaluate(
    'document.querySelector("#hint").textContent.includes("other pin")',
  ),
);
await evaluate(
  '(() => {document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));return true})()',
);
assert.deepEqual(
  (await orca("console", "--limit", "50")).messages.filter((
    m: { type: string },
  ) => m.type === "error"),
  [],
);
console.log("PASS dispatched keyboard events and no console errors");
await click("Examples");
await click("Load example Half adder");
await click("Truth table", "tab");
const shot = await orca("screenshot");
await Deno.writeFile(
  new URL("../docs/editor.png", import.meta.url),
  Uint8Array.from(atob(shot.data), (c) => c.charCodeAt(0)),
);
