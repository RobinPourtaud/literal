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
const previous = await run(
  `({circuit:localStorage.getItem('literal.circuit'),assembly:localStorage.getItem('literal.assembly'),kmap:localStorage.getItem('literal.kmap')})`,
);
const screenshot = async (name: string) => {
  const shot = await orca("screenshot");
  await Deno.writeFile(
    new URL(`../docs/${name}.png`, import.meta.url),
    Uint8Array.from(atob(shot.data), (c) => c.charCodeAt(0)),
  );
};
try {
  await orca("reload");
  await orca("wait", "--selector", "#examples-button");
  await run(
    `(()=>{document.querySelector('#examples-button').click();document.querySelector('[data-example="keyboard-pixels"]').click();document.querySelector('[data-node=keyboard] .component-body').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return true})()`,
  );
  assert.equal(
    await run(`document.querySelectorAll('[data-node=keyboard] .pin').length`),
    9,
  );
  await run(
    `(()=>{document.querySelector('[data-virtual-key=A]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));return true})()`,
  );
  assert.equal(
    await run(
      `document.querySelector('[data-node=code] .component-body').getAttribute('aria-label')`,
    ),
    "Code low nibble HEX_DISPLAY 1",
  );
  assert.equal(
    await run(
      `document.querySelectorAll('[data-node=screen] .vga-pixel').length`,
    ),
    1,
  );
  await run(
    `(()=>{document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));document.querySelector('#map-virtual').value='↑';document.querySelector('#map-key').click();document.dispatchEvent(new KeyboardEvent('keydown',{key:'w',code:'KeyW',bubbles:true}));return true})()`,
  );
  assert.equal(
    await run(
      `JSON.parse(localStorage.getItem('literal.circuit')).components.find(c=>c.id==='keyboard').keyMap.KeyW`,
    ),
    "↑",
  );
  await run(
    `(()=>{document.querySelector('#capture-keyboard').click();document.dispatchEvent(new KeyboardEvent('keydown',{key:'w',code:'KeyW',bubbles:true}));return true})()`,
  );
  assert.equal(
    await run(
      `document.querySelector('[data-node=keyboard] .signal-number').textContent`,
    ),
    80,
  );
  assert.equal(
    await run(
      `document.querySelectorAll('[data-node=screen] .vga-pixel').length`,
    ),
    2,
  );
  await run(
    `(()=>{document.dispatchEvent(new KeyboardEvent('keyup',{key:'w',code:'KeyW',bubbles:true}));document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true}));return true})()`,
  );
  assert.match(
    await run(
      `document.querySelector('[data-node=keyboard] .component-body').textContent`,
    ),
    /RELEASED/,
  );
  await run(
    `(()=>{document.querySelector('[data-virtual-key=B]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true}));document.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',code:'Enter',bubbles:true}));return true})()`,
  );
  assert.equal(
    await run(
      `document.querySelectorAll('[data-node=screen] .vga-pixel').length`,
    ),
    3,
  );
  await screenshot("keyboard");
  console.log(
    "PASS virtual keyboard, physical mapping, latched byte, release and pixel writes",
  );
  await run(
    `(()=>{document.querySelector('#examples-button').click();document.querySelector('[data-example="byte-counter"]').click();document.querySelector('#step').click();return true})()`,
  );
  assert.equal(
    await run(
      `document.querySelector('[data-node=lo] .component-body').getAttribute('aria-label')`,
    ),
    "Low nibble HEX_DISPLAY 1",
  );
  await run(`(()=>{document.querySelector('#reset').click();return true})()`);
  assert.equal(
    await run(
      `document.querySelector('[data-node=lo] .component-body').getAttribute('aria-label')`,
    ),
    "Low nibble HEX_DISPLAY 0",
  );
  await run(
    `(()=>{document.querySelector('#computer-tool').click();document.querySelector('#computer-demo').click();document.querySelector('#computer-assemble').click();document.querySelector('#computer-run').click();return true})()`,
  );
  await new Promise((resolve) => setTimeout(resolve, 150));
  await run(
    `(()=>{document.querySelector('#computer-run').click();return true})()`,
  );
  assert.equal(
    await run(`document.querySelector('#computer-terminal').textContent`),
    "LIT\n",
  );
  assert.match(
    await run(`document.querySelector('#cpu-state').textContent`),
    /R010/,
  );
  await run(
    `(()=>{document.querySelector('[data-computer-key="131"]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));document.querySelector('#computer-run').click();return true})()`,
  );
  await new Promise((resolve) => setTimeout(resolve, 150));
  await run(
    `(()=>{document.querySelector('#computer-run').click();document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));return true})()`,
  );
  assert.match(
    await run(`document.querySelector('#cpu-state').textContent`),
    /R011/,
  );
  assert.match(
    await run(`document.querySelector('#memory-bytes').textContent`),
    /^2000  01/,
  );
  await run(
    `(()=>{document.querySelector('#computer-run').click();return true})()`,
  );
  await new Promise((resolve) => setTimeout(resolve, 100));
  await run(
    `(()=>{document.querySelector('#computer-run').click();return true})()`,
  );
  await run(
    `(()=>{document.querySelector('#computer-capture').click();document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',code:'ArrowUp',bubbles:true}));document.querySelector('#computer-run').click();return true})()`,
  );
  await new Promise((resolve) => setTimeout(resolve, 100));
  await run(
    `(()=>{document.querySelector('#computer-run').click();document.body.dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowUp',code:'ArrowUp',bubbles:true}));document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true}));return true})()`,
  );
  assert.match(
    await run(`document.querySelector('#cpu-state').textContent`),
    /R10B/,
  );
  await screenshot("computer");
  await run(
    `(()=>{document.querySelector('#assembly-source').value='LDI R8, 3';document.querySelector('#computer-assemble').click();return true})()`,
  );
  assert.match(
    await run(`document.querySelector('#assembly-error').textContent`),
    /R0–R7/,
  );
  await run(
    `(()=>{document.querySelector('#computer-demo').click();document.querySelector('#computer-assemble').click();document.querySelector('#computer-breakpoint').value='0200';document.querySelector('#computer-run').click();return true})()`,
  );
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(
    await run(`document.querySelector('#computer-run').textContent`),
    "Run",
  );
  assert.match(
    await run(`document.querySelector('#cpu-state').textContent`),
    /PC0200/,
  );
  console.log(
    "PASS byte counter, BIOS boot, opcode game, score in RAM, assembler errors and breakpoints",
  );
  await run(
    `(()=>{document.querySelector('#computer-close').click();document.querySelector('#examples-button').click();document.querySelector('[data-example="half-adder"]').click();document.querySelector('#karnaugh-tool').click();document.querySelector('#kmap-output').value='1';document.querySelector('#kmap-load').click();return true})()`,
  );
  assert.equal(
    await run(`document.querySelector('#kmap-expression').textContent`),
    "A · B",
  );
  assert.equal(await run(`document.querySelectorAll('[data-cell]').length`), 4);
  await run(
    `(()=>{document.querySelector('#kmap-variables').value='4';document.querySelector('#kmap-variables').dispatchEvent(new Event('change',{bubbles:true}));for(const i of [0,2,8,10])document.querySelector('[data-cell="'+i+'"]').click();return true})()`,
  );
  assert.equal(
    await run(`document.querySelector('#kmap-expression').textContent`),
    "¬B · ¬D",
  );
  await screenshot("karnaugh");
  console.log("PASS circuit output import and wrapping Karnaugh groups");
} finally {
  await run(
    `(()=>{for(const [key,value] of Object.entries(${
      JSON.stringify(previous)
    })){const storageKey='literal.'+key;if(value===null)localStorage.removeItem(storageKey);else localStorage.setItem(storageKey,value);}return true})()`,
  );
  await orca("reload");
  await orca("wait", "--selector", "#examples-button");
}
