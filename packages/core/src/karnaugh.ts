export type LogicCell = 0 | 1 | "X";
export interface LogicGroup {
  pattern: string;
  cells: number[];
  term: string;
}
export function minimizeLogic(
  names: string[],
  cells: LogicCell[],
): { expression: string; groups: LogicGroup[] } {
  if (
    names.length < 1 || names.length > 4 ||
    cells.length !== 2 ** names.length ||
    cells.some((c) => c !== 0 && c !== 1 && c !== "X")
  ) throw Error("Karnaugh maps need 1–4 variables and a complete 0/1/X table.");
  const ones = cells.flatMap((v, i) => v === 1 ? [i] : []);
  if (!ones.length) return { expression: "0", groups: [] };
  let patterns = cells.flatMap((v, i) =>
    v !== 0 ? [i.toString(2).padStart(names.length, "0")] : []
  );
  const primes = new Set<string>();
  while (patterns.length) {
    const used = new Set<string>(), next = new Set<string>();
    for (let i = 0; i < patterns.length; i++) {
      for (let j = i + 1; j < patterns.length; j++) {
        const differences = [...patterns[i]].flatMap((v, k) =>
          v !== patterns[j][k] ? [k] : []
        );
        if (differences.length === 1) {
          const k = differences[0];
          if (patterns[i][k] === "-" || patterns[j][k] === "-") {
            continue;
          }
          used.add(patterns[i]);
          used.add(patterns[j]);
          next.add(patterns[i].slice(0, k) + "-" + patterns[i].slice(k + 1));
        }
      }
    }
    patterns.filter((p) => !used.has(p)).forEach((p) => primes.add(p));
    patterns = [...next];
  }
  const groups = [...primes].map((pattern) => {
    const indices = cells.flatMap((v, i) =>
      v !== 0 &&
        [...pattern].every((b, k) =>
          b === "-" || b === i.toString(2).padStart(names.length, "0")[k]
        )
        ? [i]
        : []
    );
    return {
      pattern,
      cells: indices,
      term: [...pattern].flatMap((v, i) =>
        v === "-" ? [] : [v === "0" ? `¬${names[i]}` : names[i]]
      ).join(" · ") || "1",
    };
  }).filter((g) => g.cells.some((i) => cells[i] === 1));
  let best: number[] | null = null, bestCost = Infinity;
  const search = (chosen: number[], uncovered: number[]) => {
    const cost = chosen.length * 100 +
      chosen.reduce(
        (n, i) => n + [...groups[i].pattern].filter((c) => c !== "-").length,
        0,
      );
    if (cost >= bestCost) return;
    if (!uncovered.length) {
      best = [...chosen];
      bestCost = cost;
      return;
    }
    const target = uncovered.reduce((a, b) =>
      groups.filter((g) => g.cells.includes(a)).length <=
          groups.filter((g) => g.cells.includes(b)).length
        ? a
        : b
    );
    for (const [i, g] of groups.entries()) {
      if (!chosen.includes(i) && g.cells.includes(target)) {
        search(
          [...chosen, i],
          uncovered.filter((c) => !g.cells.includes(c)),
        );
      }
    }
  };
  search([], ones);
  const selected = (best ?? []).map((i) => groups[i]);
  return {
    expression: selected.map((g) => g.term).join(" + "),
    groups: selected,
  };
}
export function grayOrder(bits: number): number[] {
  return Array.from({ length: 2 ** bits }, (_, i) => i ^ (i >> 1));
}
