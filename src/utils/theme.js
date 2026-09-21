// 便签的主题色板
export const NOTE_THEMES = [
  "#ffe66e",
  "#ffafdf",
  "#d7afff",
  "#9edfff",
  "#e0e0e0",
  "#a1ef9b",
  "#767676",
];

export function randomNoteTheme() {
  return NOTE_THEMES[Math.floor(Math.random() * NOTE_THEMES.length)];
}

// 标题栏用比主题色稍深一点的同色系，保留原来 #fff7d1 / #fff2ab 那种层次感
export function darkerShade(hex, ratio = 0.06) {
  const value = String(hex).replace("#", "");
  const channels = [0, 2, 4].map((i) =>
    Math.round(parseInt(value.slice(i, i + 2), 16) * (1 - ratio))
  );
  return `#${channels.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

// 相对亮度：判断是不是深色主题（#767676 就是），深色时文字要翻成白色
export function isDarkColor(hex) {
  const value = String(hex).replace("#", "");
  const [r, g, b] = [0, 2, 4].map(
    (i) => parseInt(value.slice(i, i + 2), 16) / 255
  );
  const linear = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b) < 0.5;
}
