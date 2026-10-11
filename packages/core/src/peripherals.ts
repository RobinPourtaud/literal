export const screenWidth = 32;
export const screenHeight = 24;
export const screenColors = [
  "#101a18",
  "#315ac6",
  "#57a451",
  "#54b9bc",
  "#d05d53",
  "#b56db4",
  "#d5b754",
  "#e8eee1",
];
export const virtualKeys = [
  ...Array.from(
    { length: 26 },
    (_, i) => ({
      key: String.fromCharCode(65 + i),
      code: 65 + i,
      physical: `Key${String.fromCharCode(65 + i)}`,
    }),
  ),
  ...Array.from(
    { length: 10 },
    (_, i) => ({ key: String(i), code: 48 + i, physical: `Digit${i}` }),
  ),
  { key: "Space", code: 32, physical: "Space" },
  { key: "Enter", code: 13, physical: "Enter" },
  { key: "Backspace", code: 8, physical: "Backspace" },
  { key: "Tab", code: 9, physical: "Tab" },
  { key: "↑", code: 128, physical: "ArrowUp" },
  { key: "↓", code: 129, physical: "ArrowDown" },
  { key: "←", code: 130, physical: "ArrowLeft" },
  { key: "→", code: 131, physical: "ArrowRight" },
];
export const keyboardCode = (
  physical: string,
  mapping: Record<string, string> = {},
) => {
  const key = mapping[physical];
  return virtualKeys.find((k) =>
    key === undefined ? k.physical === physical : k.key === key
  )?.code ?? null;
};
export interface KeyboardState {
  code: number;
  pressed: boolean;
}
