import { transistorCircuit } from "@literal/core";
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
    `(()=>{for(const key of Object.keys(localStorage))if(key.startsWith('literal.'))localStorage.removeItem(key);localStorage.setItem('literal.mode','playground');localStorage.setItem('literal.lessonStep','0');localStorage.setItem('literal.lessonStep.not','0');localStorage.setItem('literal.course','not');localStorage.setItem('literal.discovered','[]');return 'ok'})()`,
  );
  await orca("reload");
  await orca("wait", "--selector", "#board");
  await run(`window.literal.setCircuit(${JSON.stringify(circuit)})`);
  await run(
    `(()=>{document.querySelector('[data-node=n] .component-body').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));document.querySelector('#component-info').click();return 'ok'})()`,
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
    `(()=>{document.querySelector('[data-lesson=hint]').click();document.querySelector('#close-dialog').click();document.querySelector('[data-lesson=next]').click();return 'ok'})()`,
  );
  await run(
    `(()=>{document.querySelector('[data-lesson=save]').click();document.querySelector('#custom-form').requestSubmit();return 'ok'})()`,
  );
  const def = await run(
    `(await window.literal.getState()).circuit.definitions.find(d=>d.name==='NOT')`,
  );
  assert.match(def.description, /0 becomes 1/);
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
    /Course complete/,
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
  await run(
    `(()=>{document.querySelector('[data-lesson=next-course]').click();return 'ok'})()`,
  );
  assert.match(
    await run(`document.querySelector('.lesson-progress').textContent`),
    /NAND/,
  );
  assert.equal(
    (await run(`window.literal.getState()`)).circuit.components.length,
    0,
  );
  await run(
    `(()=>{document.querySelector('[data-place=NMOS]').click();document.querySelector('#place-center').click();return 'ok'})()`,
  );
  assert.equal(
    await run(
      `JSON.stringify(document.querySelector('#select-tool').classList.contains('active') && document.querySelector('#place-center').hidden && !document.querySelector('#board').classList.contains('placing'))`,
    ),
    true,
  );
  await run(
    `(()=>{document.querySelector('#place-center').click();return 'ok'})()`,
  );
  assert.equal(
    (await run(`window.literal.getState()`)).circuit.components.length,
    1,
  );
  await orca("reload");
  await orca("wait", "--selector", "#discover-guide");
  assert.match(
    await run(`document.querySelector('.lesson-progress').textContent`),
    /NAND/,
  );
  assert.equal(
    (await run(`window.literal.getState()`)).circuit.components.length,
    1,
  );
  await run(
    `(()=>{document.querySelector('[data-lesson=courses]').click();document.querySelector('[data-course="0"]').click();return 'ok'})()`,
  );
  assert.equal(
    (await run(`window.literal.getState()`)).circuit.components.length,
    6,
  );
  assert.match(
    await run(`document.querySelector('.lesson-progress').textContent`),
    /6 \/ 6/,
  );
  await run(
    `(()=>{document.querySelector('[data-lesson=next-course]').click();return 'ok'})()`,
  );
  const base = transistorCircuit("NAND")!;
  const nandCircuit = {
    ...base,
    components: base.components.filter((c) => c.kind !== "OUTPUT").map((c) =>
      c.kind === "INPUT" ? { ...c, kind: "POWER", value: 0 } : c
    ),
    wires: base.wires.filter((w) =>
      base.components.find((c) => c.id === w.to)?.kind !== "OUTPUT"
    ),
  };
  await run(`window.literal.setCircuit(${JSON.stringify(nandCircuit)})`);
  for (let i = 0; i < 4; i++) {
    await run(
      `(()=>{document.querySelector('[data-lesson=next]').click();return 'ok'})()`,
    );
  }
  const controls = base.components.filter((c) => c.kind === "INPUT");
  for (const values of [[0, 1], [1, 0], [1, 1]]) {
    await run(
      `window.literal.setInputs(${
        JSON.stringify(controls.map((c, i) => ({ id: c.id, value: values[i] })))
      })`,
    );
  }
  await orca("reload");
  await orca("wait", "--selector", "#discover-guide");
  assert.equal(
    await run(
      `JSON.stringify(document.querySelector('[data-lesson=next]').disabled)`,
    ),
    false,
  );
  await run(
    `(()=>{document.querySelector('[data-lesson=next]').click();document.querySelector('[data-lesson=save]').click();document.querySelector('#custom-form').requestSubmit();document.querySelector('[data-lesson=next-course]').click();return 'ok'})()`,
  );
  assert.match(
    await run(`document.querySelector('.lesson-progress').textContent`),
    /AND/,
  );
  for (const kind of ["and", "or"]) {
    const defs = (await run(`window.literal.getState()`)).library;
    const not = defs.find((d: { name: string }) => d.name === "NOT"),
      nand = defs.find((d: { name: string }) => d.name === "NAND");
    const scene = {
      version: 1,
      name: kind.toUpperCase(),
      definitions: defs,
      components: [
        { id: "a", kind: "POWER", label: "A", x: 100, y: 100, value: 0 },
        { id: "b", kind: "POWER", label: "B", x: 100, y: 300, value: 0 },
        {
          id: "nand",
          kind: "CUSTOM",
          definition: nand.id,
          label: "NAND",
          x: 400,
          y: 200,
        },
        {
          id: "not-a",
          kind: "CUSTOM",
          definition: not.id,
          label: "NOT",
          x: 650,
          y: 200,
        },
        ...(kind === "or"
          ? [{
            id: "not-b",
            kind: "CUSTOM",
            definition: not.id,
            label: "NOT",
            x: 250,
            y: 300,
          }]
          : []),
      ],
      wires: kind === "and"
        ? [
          { id: "a-nand", from: "a", to: "nand", port: 0 },
          { id: "b-nand", from: "b", to: "nand", port: 1 },
          { id: "out", from: "nand", to: "not-a", port: 0 },
        ]
        : [
          { id: "a-not", from: "a", to: "not-a", port: 0 },
          { id: "b-not", from: "b", to: "not-b", port: 0 },
          { id: "a-nand", from: "not-a", to: "nand", port: 0 },
          { id: "b-nand", from: "not-b", to: "nand", port: 1 },
        ],
    };
    await run(`window.literal.setCircuit(${JSON.stringify(scene)})`);
    await run(
      `(()=>{document.querySelector('[data-lesson=next]').click();document.querySelector('[data-lesson=next]').click();return 'ok'})()`,
    );
    for (const values of [[0, 1], [1, 0], [1, 1]]) {
      await run(
        `window.literal.setInputs([{id:'a',value:${values[0]}},{id:'b',value:${
          values[1]
        }}])`,
      );
    }
    await run(
      `(()=>{document.querySelector('[data-lesson=next]').click();document.querySelector('[data-lesson=save]').click();document.querySelector('#custom-form').requestSubmit();return 'ok'})()`,
    );
    if (kind === "and") {
      await run(
        `(()=>{document.querySelector('[data-lesson=next-course]').click();return 'ok'})()`,
      );
    }
  }
  await run(
    `(()=>{document.querySelector('[data-lesson=next-course]').click();return 'ok'})()`,
  );
  const xorDefs = (await run(`window.literal.getState()`)).library;
  const xorScene = {
    version: 1,
    name: "XOR",
    definitions: xorDefs,
    components: [
      { id: "a", kind: "POWER", label: "A", x: 100, y: 100, value: 0 },
      { id: "b", kind: "POWER", label: "B", x: 100, y: 300, value: 0 },
      ...[["na", "NOT"], ["nb", "NOT"], ["left", "AND"], ["right", "AND"], [
        "result",
        "OR",
      ]].map(([id, name], i) => ({
        id,
        kind: "CUSTOM",
        definition: xorDefs.find((d: { name: string }) => d.name === name).id,
        label: name,
        x: 300 + (i % 3) * 180,
        y: 100 + Math.floor(i / 3) * 200,
      })),
    ],
    wires: [
      ["a", "na", 0],
      ["b", "nb", 0],
      ["a", "left", 0],
      ["nb", "left", 1],
      ["na", "right", 0],
      ["b", "right", 1],
      ["left", "result", 0],
      ["right", "result", 1],
    ].map(([from, to, port], i) => ({ id: `x${i}`, from, to, port })),
  };
  await run(`window.literal.setCircuit(${JSON.stringify(xorScene)})`);
  await run(
    `(()=>{document.querySelector('[data-lesson=next]').click();document.querySelector('[data-lesson=next]').click();return 'ok'})()`,
  );
  for (const [a, b] of [[0, 1], [1, 0], [1, 1]]) {
    await run(
      `window.literal.setInputs([{id:'a',value:${a}},{id:'b',value:${b}}])`,
    );
  }
  await run(
    `(()=>{document.querySelector('[data-lesson=next]').click();document.querySelector('[data-lesson=save]').click();document.querySelector('#custom-form').requestSubmit();return 'ok'})()`,
  );
  assert.equal(
    await run(
      `JSON.stringify(!!document.querySelector('[data-lesson=next-course]'))`,
    ),
    true,
  );
  await run(
    `(()=>{document.querySelector('[data-lesson=courses]').click();document.querySelector('[data-course=free]').click();return 'ok'})()`,
  );
  assert.match(
    await run(`document.querySelector('.lesson-progress').textContent`),
    /FREE BUILD/,
  );
  const state = await run(`window.literal.getState()`);
  assert.ok(
    ["NOT", "NAND", "AND", "OR", "XOR"].every((name) =>
      state.library.some((d: { name: string }) => d.name === name)
    ),
  );
  console.log(
    "PASS next courses NOT → NAND → AND → OR → XOR, free build, workspace restoration, and single placement",
  );
  await run(
    `(()=>{document.querySelector('[data-lesson=courses]').click();document.querySelector('[data-course="0"]').click();return 'ok'})()`,
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
