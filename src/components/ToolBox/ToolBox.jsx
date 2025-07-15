import "./ToolBox.scss";
import { useState, useCallback, useMemo } from "react";
import { ColorPicker, theme } from "antd";

const ToolBox = (props) => {
  const { style, setStyle } = props;

  const [fontColor, setFontColor] = useState();
  const [bgColor, setBgColor] = useState();
  const [selectContent, setSelectContent] = useState("");
  const presets = useMemo(() => {
    return [
      {
        label: "推荐颜色",
        colors: ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF"],
      },
    ];
  }, []);
  function removeExistingColorSpans(fragment) {
    const spans = fragment.querySelectorAll('span[style*="color"]');
    spans.forEach((span) => {
      const parent = span.parentNode;
      while (span.firstChild) {
        parent.insertBefore(span.firstChild, span);
      }
      parent.removeChild(span);
    });
  }

  function applyColorToFragment(fragment, color) {
    const newFragment = document.createDocumentFragment();
    const walker = document.createTreeWalker(
      fragment,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let currentNode,
      lastSpan = null;
    while ((currentNode = walker.nextNode())) {
      if (!currentNode.textContent.trim()) continue;

      // 合并相邻文本节点到同一个 span（优化性能）
      if (lastSpan && currentNode.previousSibling === lastSpan.lastChild) {
        lastSpan.lastChild.textContent += currentNode.textContent;
      } else {
        const span = document.createElement("span");
        span.style.color = color;
        span.appendChild(currentNode.cloneNode(true));
        newFragment.appendChild(span);
        lastSpan = span;
      }
    }

    return newFragment;
  }
  function setTextColor(color) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

    const range = sel.getRangeAt(0);
    const fragment = range.cloneContents();

    removeExistingColorSpans(fragment);

    const newFragment = applyColorToFragment(fragment, color);

    range.deleteContents();
    range.insertNode(newFragment);

    sel.removeAllRanges();
    sel.addRange(range);
  }

  const toolBtnClick = (e, command, color) => {
    e.preventDefault();
    if (command === "foreColor") {
      setTextColor(hex);
    } else {
      document.execCommand(command, false, color);
    }
    setStyle();
  };
  const rgbToHex = useCallback((r, g, b) => {
    const hex = ((1 << 24) + (r << 16) + (g << 8) + b)
      .toString(16)
      .slice(1)
      .toUpperCase();
    return "#" + hex;
  }, []);
  // 保存选区
  const saveSelection = () => {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      setSelectContent(selection.getRangeAt(0));
    }
  };

  // 恢复选区
  const restoreSelection = () => {
    if (!selectContent) return;
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(selectContent);
  };

  const onBgChangeComplete = (e) => {
    restoreSelection();
    const { r, g, b } = e.metaColor;
    const hex = rgbToHex(r, g, b);
    document.execCommand("backColor", false, hex);
    setBgColor(hex);
    setStyle();
  };
  const onFtChangeComplete = (e) => {
    restoreSelection();
    const { r, g, b } = e.metaColor;
    const hex = rgbToHex(r, g, b);

    setTextColor(hex);
    setFontColor(hex);
    setStyle();
  };
  // 颜色选择框开关回调
  const onOpenChange = (open) => {
    if (open) {
      saveSelection();
    } else {
      restoreSelection();
    }
  };

  return (
    <div className="tool_box">
      {/* 文字加粗 */}
      <button
        className="option_btn"
        onClick={(e) => toolBtnClick(e, "bold", null)}
        style={{ background: style.isBold ? "#eceaea" : "" }}
      >
        <i className="iconfont icon-bold"></i>
      </button>
      {/* 文字倾斜 */}
      <button
        className="option_btn"
        onClick={(e) => toolBtnClick(e, "italic", null)}
        style={{ background: style.isItalic ? "#eceaea" : "" }}
      >
        <i className="iconfont icon-qingxie"></i>
      </button>
      {/* 文字下划线 */}
      <button
        className="option_btn"
        onClick={(e) => toolBtnClick(e, "underline", null)}
        style={{ background: style.underline ? "#eceaea" : "" }}
      >
        <i className="iconfont icon-xiahuaxian2"></i>
      </button>
      {/* 文字删除线 */}
      <button
        className="option_btn"
        onClick={(e) => toolBtnClick(e, "strikeThrough", null)}
        style={{ background: style.lineThrough ? "#eceaea" : "" }}
      >
        <i className="iconfont icon-shanchuxian"></i>
      </button>
      {/* 无序列表 */}
      <button
        className="option_btn"
        onClick={(e) => toolBtnClick(e, "insertUnorderedList", null)}
      >
        <i className="iconfont icon-list"></i>
      </button>
      {/* 有序列表 */}
      <button
        className="option_btn"
        onClick={(e) => toolBtnClick(e, "insertOrderedList", null)}
      >
        <i className="iconfont icon-youxuliebiao3"></i>
      </button>
      {/* 文字颜色 */}
      <ColorPicker
        value={fontColor}
        disabledAlpha
        onChangeComplete={onFtChangeComplete}
        onOpenChange={onOpenChange}
        presets={presets}
        trigger="hover"
      >
        <button className="option_btn font_color_btn">
          <i
            className="iconfont icon-wenziyanse2"
            style={{ color: style.color ? style.color : "gray" }}
          ></i>
        </button>
      </ColorPicker>
      {/* 文字背景颜色 */}
      <ColorPicker
        value={bgColor}
        onChangeComplete={onBgChangeComplete}
        onOpenChange={onOpenChange}
        disabledAlpha
        presets={presets}
        trigger="hover"
      >
        <button className="option_btn">
          <span
            style={{
              background: style.bgColor
                ? style.bgColor === "#FFF7D1"
                  ? "#999"
                  : style.bgColor
                : "#999",
            }}
            className="font_bg_btn"
          >
            A
          </span>
        </button>
      </ColorPicker>
    </div>
  );
};

export default ToolBox;
