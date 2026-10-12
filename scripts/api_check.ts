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
  `Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.startsWith('literal.')))`,
);
try {
  await run(
    `(()=>{localStorage.setItem("literal.mode","playground");return true})()`,
  );
  await orca("reload");
  await orca("wait", "--selector", "#examples-button");
  assert.equal(await run(`window.literal.version`), 1);
  assert.equal(await run(`window.literal.getTools().length`), 12);
  await run(`window.literal.loadExample('half-adder')`);
  const state = await run(`window.literal.getState()`);
  const inputs = state.circuit.components.filter((c: { kind: string }) =>
    c.kind === "INPUT"
  );
  await run(
    `window.literal.setInputs(${
      JSON.stringify(
        inputs.map((c: { id: string }) => ({ id: c.id, value: 1 })),
      )
    })`,
  );
  const on = await run(`window.literal.getState()`);
  const sum = on.circuit.components.find((c: { label: string }) =>
      c.label === "Sum"
    ),
    carry = on.circuit.components.find((c: { label: string }) =>
      c.label === "Carry"
    );
  assert.equal(on.simulation.values[sum.id], 0);
  assert.equal(on.simulation.values[carry.id], 1);
  assert.equal((await run(`window.literal.truthTable()`)).rows.length, 4);
  assert.equal(
    await run(
      `document.querySelector('[data-node="${carry.id}"] .signal-number').textContent`,
    ),
    1,
  );
  const bad = await run(
    `(async()=>{const before=JSON.stringify((await window.literal.getState()).circuit);try{await window.literal.setCircuit({version:1,name:'Broken',components:[],wires:[{id:'bad',from:'missing',to:'missing',port:0}]});return false;}catch{return before===JSON.stringify((await window.literal.getState()).circuit);}})()`,
  );
  assert.equal(bad, true);
  const def = await run(
    `window.literal.createComponent({ids:${
      JSON.stringify(on.circuit.components.map((c: { id: string }) => c.id))
    },name:'API adder',color:'#527d3c',shape:'rounded'})`,
  );
  assert.equal(def.name, "API adder");
  assert.ok(await run(`!!document.querySelector('[data-custom="${def.id}"]')`));
  await run(`window.literal.undo()`);
  assert.ok(
    !(await run(`window.literal.getState()`)).circuit.definitions?.some((
      d: { id: string },
    ) => d.id === def.id),
  );
  await run(`window.literal.loadExample('byte-counter')`);
  const clock = await run(`window.literal.clock({steps:1,reset:true})`);
  assert.equal(clock.simulation.outputValues.counter[0], 1);
  const computer = await run(
    `window.literal.computer({action:'assemble',source:${
      JSON.stringify("LDI R0, 42\nST R0, 0x2000\nHALT")
    }})`,
  );
  assert.equal(computer.pc, 0);
  const after = await run(
    `window.literal.computer({action:'step',steps:10,address:8192,length:1})`,
  );
  assert.equal(after.memory.bytes[0], 42);
  assert.equal(after.halted, true);
  assert.equal(
    (await run(`window.literal.minimizeLogic(['A','B'],[0,0,0,1])`)).expression,
    "A · B",
  );
  const discovery = await run(
    `(async()=>({html:(await (await fetch('/')).text()).includes('If you are an'),doc:(await fetch('/api.md')).status}))()`,
  );
  assert.equal(discovery.html, true);
  assert.equal(discovery.doc, 200);
  console.log(
    "PASS API discovery, real circuit inputs, atomic validation, components, undo, clock, CPU and Karnaugh",
  );
} finally {
  await run(
    `(()=>{for(const key of Object.keys(localStorage))if(key.startsWith("literal."))localStorage.removeItem(key);for(const [key,value] of Object.entries(${
      JSON.stringify(previous)
    })){const storageKey=key;if(value===null)localStorage.removeItem(storageKey);else localStorage.setItem(storageKey,value);}return true})()`,
  );
  await orca("reload");
  await orca("wait", "--selector", "#examples-button");
}
