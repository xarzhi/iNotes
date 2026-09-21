import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { randomNoteTheme } from "@/utils/theme";
import { noteTitleFromPath } from "@/utils/noteFile";

// 独立便签窗口的 label 前缀，需要和 src-tauri/src/lib.rs 里的 NOTE_WINDOW_PREFIX 保持一致
const NOTE_WINDOW_PREFIX = "note-";

// 便签窗口的初始大小和最小尺寸，和主窗口保持一致
const NOTE_WINDOW_SIZE = {
  width: 360,
  height: 630,
  minWidth: 360,
  minHeight: 630,
};

// Tauri 的窗口 label 只允许 a-zA-Z0-9-/:_ 这些字符，中文文件名没法直接当 label，
// 所以用 FNV-1a 把便签路径压成一个短的、稳定的字符串：同一条便签永远得到同一个 label
function hashPath(path) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < path.length; i += 1) {
    hash ^= path.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

// 便签文件名（去掉目录和扩展名），用作窗口标题
export const noteNameFromPath = noteTitleFromPath;

// 独立便签窗口靠地址上的 notePath 知道自己该显示哪条便签；普通窗口返回 null
export function getNotePathFromUrl() {
  const path = new URLSearchParams(window.location.search).get("notePath");
  return path || null;
}

// 独立便签窗口的主题色（开窗时随机选一个写在地址上）
export function getNoteThemeFromUrl() {
  const theme = new URLSearchParams(window.location.search).get("theme");
  return theme || null;
}

// 从新窗口打开某条便签：已经开着就把那个窗口重新显示并置于最前，没有才新建
export async function openNoteWindow(path) {
  const label = NOTE_WINDOW_PREFIX + hashPath(path);
  const opened = await WebviewWindow.getByLabel(label);

  if (opened) {
    await opened.unminimize();
    await opened.show();
    await opened.setFocus();
    return opened;
  }

  // 每次新开一个便签窗口，从主题色板里随机挑一个
  const theme = randomNoteTheme();
  const query = new URLSearchParams({ notePath: path, theme }).toString();

  const win = new WebviewWindow(label, {
    url: `index.html?${query}`,
    title: noteNameFromPath(path),
    ...NOTE_WINDOW_SIZE,
    decorations: false,
    resizable: true,
    focus: true,
  });

  win.once("tauri://error", (e) => {
    console.error("[inotes] 打开便签窗口失败", e);
  });

  return win;
}
