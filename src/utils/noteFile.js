import { BaseDirectory, readDir, rename } from "@tauri-apps/plugin-fs";

export const NOTE_DIR = "AppData";
// 临时便签用文件名后缀标记：单一事实来源，重启后依然认得出来，
// 退出时只要删掉 AppData 下所有 *.tmp.html 就行
export const TEMP_SUFFIX = ".tmp.html";
const NORMAL_SUFFIX = ".html";

export function isNotePath(path) {
  return /\.html$/i.test(String(path));
}

export function isTempNote(path) {
  return String(path).endsWith(TEMP_SUFFIX);
}

// 从路径还原标题（只剥掉已知后缀，不会被标题里的点影响）
export function noteTitleFromPath(path) {
  const name = String(path).split(/[\\/]/).pop() || "";
  if (isTempNote(name)) return name.slice(0, -TEMP_SUFFIX.length);
  return name.replace(/\.html$/i, "");
}

export function notePathFor(title, isTemp) {
  return `${NOTE_DIR}/${title}${isTemp ? TEMP_SUFFIX : NORMAL_SUFFIX}`;
}

// 文件名里不能出现的字符 + Windows 不允许的结尾点/空格
export function sanitizeTitle(raw) {
  return String(raw ?? "")
    .replace(/[\\/:*?"<>|]/g, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.\s]+$/, "")
    .slice(0, 40)
    .trim();
}

export async function listNotePaths() {
  const entries = await readDir(NOTE_DIR, { baseDir: BaseDirectory.Resource });
  return entries
    .map((entry) => `${NOTE_DIR}/${entry.name}`)
    .filter(isNotePath);
}

export async function listNoteTitles() {
  return (await listNotePaths()).map(noteTitleFromPath);
}

// 未命名便签01、未命名便签02 …… 取第一个没被占用的
export function nextUntitledName(usedTitles) {
  for (let i = 1; i < 1000; i += 1) {
    const name = `未命名便签${String(i).padStart(2, "0")}`;
    if (!usedTitles.has(name)) return name;
  }
  return `未命名便签${Date.now()}`;
}

// 用户自己填的标题撞名了就往后加序号，避免覆盖已有便签
export function uniqueTitle(base, usedTitles) {
  if (!usedTitles.has(base)) return base;
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${base}${i}`;
    if (!usedTitles.has(candidate)) return candidate;
  }
  return `${base}${Date.now()}`;
}

// 重命名便签文件：保留临时便签的 .tmp 标记、自动避开撞名。
// 返回新的路径（没改或改不成就返回原路径）
export async function renameNoteFile(path, rawTitle) {
  const next = sanitizeTitle(rawTitle);
  if (!next || next === noteTitleFromPath(path)) return path;

  const used = new Set(await listNoteTitles());
  used.delete(noteTitleFromPath(path));

  const nextPath = notePathFor(uniqueTitle(next, used), isTempNote(path));
  await rename(path, nextPath, {
    oldPathBaseDir: BaseDirectory.Resource,
    newPathBaseDir: BaseDirectory.Resource,
  });
  return nextPath;
}
