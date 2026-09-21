import { createContext, useContext } from "react";

// 当前正在编辑的便签：路径 / 标题 / 重命名。
// 标题栏（DragTop）和正文（Note）都要用，所以放在 context 里
export const NoteContext = createContext({
  path: null,
  title: "",
  renameNote: async () => {},
});

export const useNote = () => useContext(NoteContext);
