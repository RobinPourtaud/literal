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
const previous = await run(
  `JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.startsWith('literal.'))))`,
);
const circuit = {
  version: 1,
  name: "First NOT",
  components: [
    { id: "a", kind: "POWER", label: "A", x: 100, y: 240, value: 0 },
    { id: "vdd", kind: "POWER", label: "VDD", x: 100, y: 80 },
    { id: "gnd", kind: "GROUND", label: "Ground", x: 100, y: 400 },
    { id: "p", kind: "PMOS", label: "PMOS", x: 360, y: 140 },
    { id: "n", kind: "NMOS", label: "NMOS", x: 360, y: 340 },
    { id: "out", kind: "JUNCTION", label: "Output", x: 640, y: 240 },
  ],
  wires: [
    { id: "ap", from: "a", to: "p", port: 0 },
    { id: "an", from: "a", to: "n", port: 0 },
    { id: "vp", from: "vdd", to: "p", port: 1 },
    { id: "gn", from: "gnd", to: "n", port: 1 },
    { id: "po", from: "p", to: "out", port: 0 },
    { id: "no", from: "n", to: "out", port: 1 },
  ],
};
try {
  await run(
    `(()=>{localStorage.setItem('literal.mode','playground');localStorage.setItem('literal.lessonStep','0');return 'ok'})()`,
  );
  await orca("reload");
  await orca("wait", "--selector", "[data-about=NMOS]");
  await run(
    `(()=>{document.querySelector('[data-about=NMOS]').click();return 'ok'})()`,
  );
  assert.match(
    await run(`document.querySelector('#dialog-body').textContent`),
    /Gate.*Source.*Drain/s,
  );
  await run(
    `(()=>{document.querySelector('#close-dialog').click();document.querySelector('#mode-button').click();document.querySelector('[data-mode=discover]').click();return 'ok'})()`,
  );
  await run(
    `window.literal.setCircuit({version:1,name:'First gate',components:[],wires:[]})`,
  );
  assert.equal(
    await run(
      `JSON.stringify(document.querySelector('[data-lesson=next]').disabled)`,
    ),
    true,
  );
  assert.match(
    await run(`document.querySelector('#discover-guide').textContent`),
    /First of all/,
  );
  const stages = [[3, 0], [5, 0], [5, 4], [6, 6]];
  for (let i = 0; i < stages.length; i++) {
    const [nodes, wires] = stages[i];
    await run(
      `window.literal.setCircuit(${
        JSON.stringify({
          ...circuit,
          components: circuit.components.slice(0, nodes),
          wires: circuit.wires.slice(0, wires),
        })
      })`,
    );
    assert.equal(
      await run(
        `JSON.stringify(document.querySelector('[data-lesson=next]').disabled)`,
      ),
      false,
    );
    await run(
      `(()=>{document.querySelector('[data-lesson=next]').click();return 'ok'})()`,
    );
    assert.match(
      await run(`document.querySelector('.lesson-progress').textContent`),
      new RegExp(`${i + 2} / 6`),
    );
  }
  assert.equal(
    await run(
      `JSON.stringify(document.querySelector('[data-lesson=next]').disabled)`,
    ),
    true,
  );
  await run(`window.literal.setInputs([{id:'a',value:1}])`);
  assert.equal(
    await run(
      `JSON.stringify(document.querySelector('[data-lesson=next]').disabled)`,
    ),
    false,
  );
  await run(
    `(()=>{document.querySelector('#discover-guide details').open=true;document.querySelector('[data-lesson=next]').click();return 'ok'})()`,
  );
  await run(
    `(()=>{document.querySelector('[data-lesson=save]').click();document.querySelector('#custom-form').requestSubmit();return 'ok'})()`,
  );
  const def = await run(
    `(await window.literal.getState()).circuit.definitions.find(d=>d.name==='NOT')`,
  );
  assert.match(def.description, /Inverts/);
  assert.equal(
    def.components.filter((c: { kind: string }) => c.kind === "INPUT").length,
    1,
  );
  assert.equal(
    def.components.filter((c: { kind: string }) => c.kind === "OUTPUT").length,
    1,
  );
  assert.match(
    await run(`document.querySelector('#discover-guide').textContent`),
    /Your gate is in the library/,
  );
  await run(
    `(()=>{document.querySelector('[data-edit-custom="${def.id}"]').click();document.querySelector('#appearance-description').value='My first CMOS NOT gate';document.querySelector('#appearance-form').requestSubmit();return 'ok'})()`,
  );
  await orca("reload");
  await orca("wait", "--selector", "#discover-guide");
  assert.match(
    await run(`document.querySelector('.lesson-progress').textContent`),
    /6 \/ 6/,
  );
  assert.equal(
    await run(
      `(await window.literal.getState()).circuit.definitions.find(d=>d.name==='NOT').description`,
    ),
    "My first CMOS NOT gate",
  );
  const shot = await orca("screenshot");
  await Deno.writeFile(
    new URL("../docs/discover.png", import.meta.url),
    Uint8Array.from(atob(shot.data), (c) => c.charCodeAt(0)),
  );
  console.log(
    "PASS component descriptions, six guided steps, hints, real input testing, saving NOT and persistence",
  );
} finally {
  await run(
    `(()=>{for(const key of Object.keys(localStorage))if(key.startsWith('literal.'))localStorage.removeItem(key);for(const [key,value]of Object.entries(${
      JSON.stringify(previous)
    }))localStorage.setItem(key,value);return 'ok'})()`,
  );
  await orca("reload");
}
