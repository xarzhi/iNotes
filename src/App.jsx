import { useCallback, useMemo, useState } from "react";
import { useLocation, useRoutes } from "react-router-dom";
import { BaseDirectory, rename } from "@tauri-apps/plugin-fs";
import routes from "./router/router.jsx";
import DragTop from "@/components/DragTop/DragTop.jsx";
import Note from "@/views/Note/Note.jsx";
import { NoteContext } from "@/context/NoteContext.jsx";
import { getNotePathFromUrl, getNoteThemeFromUrl } from "@/utils/noteWindow";
import { darkerShade, isDarkColor } from "@/utils/theme";
import {
  isTempNote,
  listNoteTitles,
  notePathFor,
  noteTitleFromPath,
  sanitizeTitle,
  uniqueTitle,
} from "@/utils/noteFile";

import "./App.scss";
function App() {
  const element = useRoutes(routes);
  const location = useLocation();

  // 独立便签窗口：地址上带着 notePath
  const windowNotePath = useMemo(() => getNotePathFromUrl(), []);

  // 主题色只在两种情况生效：独立便签窗口（地址带 theme）、刚新建/弹出的便签（路由 state 带 theme）
  const theme =
    useMemo(() => getNoteThemeFromUrl(), []) || location.state?.noteTheme || null;

  // 路由 state / 地址栏给出的便签路径
  const givenPath = windowNotePath ?? location.state?.noteInfo?.path ?? null;

  // 标题重命名会改掉当前便签路径，但 givenPath 还是旧的，
  // 所以额外存一份；givenPath 真变了才重置（React 官方的“渲染期调整 state”写法，
  // 子组件不会看到中间态）
  const [pathState, setPathState] = useState({ given: givenPath, path: givenPath });
  if (pathState.given !== givenPath) {
    setPathState({ given: givenPath, path: givenPath });
  }
  const notePath = pathState.given === givenPath ? pathState.path : givenPath;
  const title = notePath ? noteTitleFromPath(notePath) : "";

  const renameNote = useCallback(
    async (rawTitle) => {
      if (!notePath) return;

      const next = sanitizeTitle(rawTitle);
      // 清空标题不合法，直接当作没改
      if (!next || next === noteTitleFromPath(notePath)) return;

      const used = new Set(await listNoteTitles());
      used.delete(noteTitleFromPath(notePath));

      const nextPath = notePathFor(uniqueTitle(next, used), isTempNote(notePath));
      await rename(notePath, nextPath, {
        oldPathBaseDir: BaseDirectory.Resource,
        newPathBaseDir: BaseDirectory.Resource,
      });

      setPathState((prev) => ({ ...prev, path: nextPath }));
    },
    [notePath]
  );

  const session = useMemo(
    () => ({ path: notePath, title, renameNote }),
    [notePath, title, renameNote]
  );

  const className = `App${theme && isDarkColor(theme) ? " theme_dark" : ""}`;
  const style = theme
    ? { "--note-theme": theme, "--note-top": darkerShade(theme) }
    : undefined;

  return (
    <NoteContext.Provider value={session}>
      <div className={className} style={style}>
        <div className="top">
          <DragTop />
        </div>
        <div className="app_contnet">
          {/* key 跟着路径走：重命名后强制重挂载，免得正文还往旧路径写 */}
          {notePath ? <Note key={notePath} /> : element}
        </div>
      </div>
    </NoteContext.Provider>
  );
}

export default App;
