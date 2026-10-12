import assert from "node:assert/strict";
const worktree = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const page = Deno.args.at(-1);
if (!page || !/^[0-9a-f-]{36}$/.test(page)) {
  throw Error("Pass an Orca page id on the isolated localhost origin.");
}
async function orca(...args: string[]) {
  const result = await new Deno.Command("orca", {
    args: [...args, "--page", page, "--worktree", `path:${worktree}`, "--json"],
    stdout: "piped",
    stderr: "piped",
  }).output();
  const data = JSON.parse(new TextDecoder().decode(result.stdout));
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
assert.equal(await run(`location.hostname`), "localhost");
const previous = await run(
  `JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.startsWith('literal.'))))`,
);
const select = (id: string) =>
  run(
    `(()=>{document.activeElement?.blur();document.querySelector('[data-node="${id}"] .component-body').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return JSON.stringify({selected:!!document.querySelector('#see-inside')})})()`,
  );
try {
  await run(
    `(()=>{localStorage.setItem('literal.mode','playground');return 'ok'})()`,
  );
  await orca("reload");
  await orca("wait", "--selector", "#examples-button");
  await run(
    `(()=>{document.querySelector('#examples-button').click();document.querySelector('[data-example="snake-computer"]').click();return 'ok'})()`,
  );
  await select("keyboard");
  assert.equal(
    await run(`JSON.stringify(!!document.querySelector('#map-key'))`),
    true,
  );
  await select("rom");
  assert.equal(
    await run(`JSON.stringify(!!document.querySelector('#rom-source'))`),
    true,
  );
  await run(
    `(()=>{document.querySelector('#rom-source').focus();document.querySelector('[data-node="ram"] .component-body').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return 'ok'})()`,
  );
  assert.equal(
    await run(`JSON.stringify(!!document.querySelector('#ram-write'))`),
    true,
  );
  await run(
    `(()=>{document.querySelector('#ram-write').value='2A 00 FF';document.querySelector('#write-ram').click();return 'ok'})()`,
  );
  assert.equal(
    (await run(
      `JSON.stringify((await window.literal.getComputerState()).memory.bytes)`,
    ))[0],
    42,
  );
  await select("screen");
  assert.equal(
    await run(`document.querySelectorAll('.screen-preview').length`),
    1,
  );
  await run(
    `(async()=>{await window.literal.computer({action:'assemble',source:'LDI R0, 1\\nLDI R1, 2\\nLDI R2, 7\\nPIXEL R0, R1, R2\\nloop: JMP loop'});await window.literal.computer({action:'step',steps:4});return 'ok'})()`,
  );
  assert.equal(
    await run(
      `document.querySelectorAll('[data-node="screen"] .vga-pixel').length`,
    ),
    1,
  );
  await select("clock");
  await run(
    `(()=>{const hz=document.querySelector('#clock-frequency');hz.value='2';hz.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#run').click();return 'ok'})()`,
  );
  const elapsed = await run(
    `(async()=>{const before=(await window.literal.getComputerState()).cycles;await new Promise(resolve=>setTimeout(resolve,1100));return JSON.stringify((await window.literal.getComputerState()).cycles-before)})()`,
  );
  assert.ok(elapsed >= 2 && elapsed <= 3, `${elapsed} cycles at 2 Hz`);
  await run(`(()=>{document.querySelector('#run').click();return 'ok'})()`);
  const faster = await run(
    `(async()=>{const hz=document.querySelector('#clock-frequency');hz.value='100';hz.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#run').click();const before=(await window.literal.getComputerState()).cycles;await new Promise(resolve=>setTimeout(resolve,500));const count=(await window.literal.getComputerState()).cycles-before;document.querySelector('#run').click();return JSON.stringify(count)})()`,
  );
  assert.ok(faster >= 5, `${faster} cycles after increasing frequency`);
  await select("alu");
  await run(
    `(()=>{document.querySelector('#see-inside').click();return 'ok'})()`,
  );
  assert.ok(
    await run(
      `document.querySelectorAll('#inside-circuit [data-node]').length`,
    ) > 400,
  );
  await run(
    `(()=>{document.querySelector('#inside-circuit .component-body[aria-label*=\" AND\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));return 'ok'})()`,
  );
  assert.ok(
    await run(
      `document.querySelectorAll('#inside-circuit .transistor-channel').length`,
    ) >= 4,
  );
  await run(
    `(()=>{document.querySelector('#inside-circuit .component-body[aria-label*=\"NMOS\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));return 'ok'})()`,
  );
  assert.equal(
    await run(
      `JSON.stringify(!!document.querySelector('.transistor-section'))`,
    ),
    true,
  );
  await run(
    `(()=>{document.querySelector('#close-dialog').click();document.querySelector('#mode-button').click();document.querySelector('[data-mode="discover"]').click();return 'ok'})()`,
  );
  assert.deepEqual(
    await run(
      `JSON.stringify([...document.querySelectorAll('[data-place]')].filter(b=>!b.hidden).map(b=>b.dataset.place).sort())`,
    ),
    ["GROUND", "JUNCTION", "NMOS", "PMOS", "POWER"].sort(),
  );
  await run(
    `(()=>{document.querySelector('#mode-button').click();document.querySelector('[data-mode="playground"]').click();return 'ok'})()`,
  );
  assert.equal(
    await run(
      `document.querySelectorAll('[data-node="screen"] .vga-pixel').length`,
    ),
    0,
  );
  console.log(
    "PASS device controls, wired framebuffer, ROM/RAM, 2 Hz clock, recursive ALU and Discover palette",
  );
  await run(
    `(async()=>{document.querySelector('#examples-button').click();document.querySelector('[data-example="snake-computer"]').click();await window.literal.computer({action:'step',steps:8000});return 'ok'})()`,
  );
  assert.match(
    await run(`(await window.literal.getComputerState()).terminal`),
    /self-test OK/,
  );
  assert.ok(
    await run(
      `document.querySelectorAll('[data-node="screen"] .vga-pixel').length`,
    ) > 100,
  );
  const shot = await orca("screenshot");
  for (const name of ["computer", "snake"]) {
    await Deno.writeFile(
      new URL(`../docs/${name}.png`, import.meta.url),
      Uint8Array.from(atob(shot.data), (c) => c.charCodeAt(0)),
    );
  }
  console.log("PASS BIOS self-test and opcode Snake rendered on circuit");
} finally {
  await run(
    `(()=>{document.querySelector('#run')?.textContent.includes('Pause')&&document.querySelector('#run').click();for(const key of Object.keys(localStorage))if(key.startsWith('literal.'))localStorage.removeItem(key);for(const [key,value]of Object.entries(${
      JSON.stringify(previous)
    }))localStorage.setItem(key,value);return 'ok'})()`,
  );
  await orca("reload");
}
