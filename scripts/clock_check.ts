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
try {
  await run(
    `(()=>{localStorage.setItem('literal.mode','playground');return 'ok'})()`,
  );
  await orca("reload");
  await orca("wait", "--selector", "#board");
  await run(
    `window.literal.setCircuit({version:1,name:'Clock checks',components:[{id:'one',kind:'CLOCK',label:'Slow clock',x:100,y:100,value:0,frequency:1},{id:'four',kind:'CLOCK',label:'Fast clock',x:100,y:300,value:0,frequency:4},{id:'slow',kind:'COUNTER8',label:'Slow counter',x:400,y:100},{id:'fast',kind:'COUNTER8',label:'Fast counter',x:400,y:300},{id:'enable',kind:'POWER',label:'Enable',x:100,y:500},{id:'zero',kind:'GROUND',label:'Clear',x:400,y:500}],wires:[{id:'w1',from:'one',to:'slow',port:0},{id:'w2',from:'four',to:'fast',port:0},{id:'w3',from:'enable',to:'slow',port:1},{id:'w4',from:'enable',to:'fast',port:1},{id:'w5',from:'zero',to:'slow',port:2},{id:'w6',from:'zero',to:'fast',port:2}]})`,
  );
  const layout = await run(
    `JSON.stringify({viewport:[innerWidth,innerHeight],footer:!!document.querySelector('.statusbar,.canvas-footer'),kbd:!!document.querySelector('.sidebar-title kbd'),globalClock:!!document.querySelector('.toolbar #run,.toolbar #clock-frequency'),github:!!document.querySelector('.source-link svg'),icons:[...document.querySelectorAll('.gate-symbol')].map(n=>[n.getBoundingClientRect().width,n.getBoundingClientRect().height])})`,
  );
  assert.equal(layout.footer, false);
  assert.equal(layout.kbd, false);
  assert.equal(layout.globalClock, false);
  assert.equal(layout.github, true);
  for (const size of layout.icons) assert.deepEqual(size, [23, 23]);
  const counts = await run(
    `(async()=>{const select=id=>document.querySelector('[data-node="'+id+'"] .component-body').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));select('one');document.querySelector('#run').click();select('four');document.querySelector('#run').click();await new Promise(resolve=>setTimeout(resolve,1100));document.querySelector('#run').click();select('one');document.querySelector('#run').click();const state=await window.literal.getState();return JSON.stringify({slow:state.simulation.outputValues.slow.reduce((v,b,i)=>v+(b===1?2**i:0),0),fast:state.simulation.outputValues.fast.reduce((v,b,i)=>v+(b===1?2**i:0),0),frequency:document.querySelector('#clock-frequency').value})})()`,
  );
  assert.equal(counts.slow, 1);
  assert.ok(counts.fast >= 4 && counts.fast <= 5);
  assert.equal(counts.frequency, "1");
  await run(
    `(()=>{const field=document.querySelector('#clock-frequency');field.focus();field.value='2.5';field.dispatchEvent(new Event('change',{bubbles:true}));field.blur();return 'ok'})()`,
  );
  assert.equal(
    (await run(
      `(await window.literal.getState()).circuit.components.find(c=>c.id==='one')`,
    )).frequency,
    2.5,
  );
  await orca("reload");
  await orca("wait", "--selector", "#board");
  assert.equal(
    (await run(
      `(await window.literal.getState()).circuit.components.find(c=>c.id==='one')`,
    )).frequency,
    2.5,
  );
  console.log(
    "PASS removed bars/caption, equal palette icons, GitHub link, independent clocks and saved frequencies",
    layout.viewport,
  );
} finally {
  await run(
    `(()=>{for(const key of Object.keys(localStorage))if(key.startsWith('literal.'))localStorage.removeItem(key);for(const [key,value]of Object.entries(${
      JSON.stringify(previous)
    }))localStorage.setItem(key,value);return 'ok'})()`,
  );
  await orca("reload");
}
