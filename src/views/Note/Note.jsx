import "./Note.scss";
import { useRef, useEffect, useState, useMemo } from "react";
import ToolBox from "@/components/ToolBox/ToolBox";
import { useLocation } from "react-router-dom";
import {
  readTextFile,
  writeTextFile,
  BaseDirectory,
} from "@tauri-apps/plugin-fs";
const NoteContent = () => {
  const location = useLocation();
  const edit_box = useRef(null);
  const [style, setStyle] = useState({});
  const { noteInfo } = location.state;
  const [content, setContent] = useState({});
  const init = async () => {
    const content = await readTextFile(noteInfo.path, {
      baseDir: BaseDirectory.Resource,
    });
    setContent(content);
  };

  useEffect(() => {
    edit_box?.current.focus();
    init();
    observe();
  }, []);
  function rgbToHex(rgbColor) {
    // 如果是 transparent 或 none，直接返回
    if (rgbColor === "transparent" || rgbColor === "rgba(0, 0, 0, 0)")
      return "#00000000";
    if (rgbColor === "none") return "";

    // 提取 rgb/rgba 数值
    const match = rgbColor.match(
      /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/i
    );
    if (!match) return rgbColor; // 非 rgb 格式（如 hex 或颜色名）直接返回

    const r = parseInt(match[1], 10).toString(16).padStart(2, "0");
    const g = parseInt(match[2], 10).toString(16).padStart(2, "0");
    const b = parseInt(match[3], 10).toString(16).padStart(2, "0");
    const alpha = match[4]
      ? Math.round(parseFloat(match[4]) * 255)
          .toString(16)
          .padStart(2, "0")
      : "";

    return `#${r}${g}${b}${alpha}`.toUpperCase();
  }
  function checkTextDecoration(element, type) {
    while (element) {
      const style = window.getComputedStyle(element);
      const decoration = style.textDecoration;
      if (
        decoration.includes(type) || // 直接包含（如 "underline"）
        decoration.split(" ").includes(type) // 复合值（如 "underline line-through"）
      ) {
        return true;
      }
      element = element.parentElement; // 向上查找继承的样式
    }
    return false;
  }

  function getSelectionStyles() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    const parentElement = range.startContainer.parentElement;
    const computedStyle = window.getComputedStyle(parentElement);
    let element = range.startContainer;
    if (element.nodeType === Node.TEXT_NODE) {
      element = element.parentElement; // 如果是文本节点，取父元素
    }
    const backgroundColor = getActualBackgroundColor(element);

    return {
      isBold:
        computedStyle.fontWeight === "bold" ||
        computedStyle.fontWeight >= "700",
      isItalic: computedStyle.fontStyle === "italic",
      color: rgbToHex(computedStyle.color), // 转为16进制
      bgColor: rgbToHex(backgroundColor || computedStyle.backgroundColor), // 转为16进制
      fontSize: computedStyle.fontSize,
      fontFamily: computedStyle.fontFamily,
      underline: checkTextDecoration(element, "underline"),
      lineThrough: checkTextDecoration(element, "line-through"),
    };
  }
  function getActualBackgroundColor(element) {
    while (element) {
      const bgColor = window.getComputedStyle(element).backgroundColor;
      if (bgColor !== "rgba(0, 0, 0, 0)" && bgColor !== "transparent") {
        return bgColor;
      }
      element = element.parentElement;
    }
    return null; // 所有父元素均为透明
  }
  const onClick = () => {
    const style = getSelectionStyles();
    setStyle(style);
  };

  const onKeyDown = (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const selection = window.getSelection();
      if (selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      const tabNode = document.createTextNode("\t"); // 创建制表符文本节点

      // 删除原有选区内容（如果有）
      range.deleteContents();

      // 插入制表符
      range.insertNode(tabNode);

      // 将光标移动到制表符后
      range.setStartAfter(tabNode);
      range.setEndAfter(tabNode);
      selection.removeAllRanges();
      selection.addRange(range);
      console.log(e);
    }
  };
  const observe = () => {
    const observer = new MutationObserver(async (mutations) => {
      await writeTextFile(noteInfo.path, edit_box.current.innerHTML, {
        baseDir: BaseDirectory.Resource,
      });
    });

    observer.observe(edit_box.current, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  };

  return (
    <div className="note_box">
      <div
        className="edit_box"
        contentEditable="true"
        dangerouslySetInnerHTML={{ __html: content }}
        ref={edit_box}
        onClick={onClick}
        onKeyDown={onKeyDown}
      ></div>
      <div className="tool_box">
        <ToolBox style={style} setStyle={onClick} />
      </div>
    </div>
  );
};

export default NoteContent;
