import { simulate, type Circuit } from '@literal/core';
import './style.css';
const circuit: Circuit = { version: 1, name: 'Half adder', components: [
  { id: 'a', kind: 'INPUT', x: 0, y: 0, label: 'A', value: 0 },
  { id: 'b', kind: 'INPUT', x: 0, y: 80, label: 'B', value: 0 },
  { id: 'sum', kind: 'XOR', x: 160, y: 0, label: 'Sum' },
  { id: 'carry', kind: 'AND', x: 160, y: 80, label: 'Carry' },
], wires: [
  { id: 'w1', from: 'a', to: 'sum', port: 0 }, { id: 'w2', from: 'b', to: 'sum', port: 1 },
  { id: 'w3', from: 'a', to: 'carry', port: 0 }, { id: 'w4', from: 'b', to: 'carry', port: 1 },
] };
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `<header><img src="/mark.svg" alt="" width="36" height="36"><strong>Literal</strong><span>Digital circuits</span></header><main><h1>Half adder</h1><p>Toggle the inputs. Sum uses XOR; carry uses AND.</p><section aria-label="Half adder inputs"><button id="a" aria-pressed="false">A: 0</button><button id="b" aria-pressed="false">B: 0</button></section><output aria-live="polite"></output><p class="status">Development preview · circuit editor in progress</p></main>`;
function render() {
  const { values } = simulate(circuit);
  for (const c of circuit.components.slice(0, 2)) {
    const button = document.getElementById(c.id)!;
    button.textContent = `${c.label}: ${c.value}`;
    button.setAttribute('aria-pressed', String(c.value === 1));
  }
  document.querySelector('output')!.textContent = `Sum: ${values.sum} · Carry: ${values.carry}`;
}
for (const c of circuit.components.slice(0, 2)) document.getElementById(c.id)!.onclick = () => { c.value = c.value === 1 ? 0 : 1; render(); };
render();
