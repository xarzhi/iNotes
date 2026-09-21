import "./home.scss";
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Dropdown, message } from "antd";
import {
  stat,
  BaseDirectory,
  readDir,
  readTextFileLines,
  remove
} from "@tauri-apps/plugin-fs";
import { openNoteWindow } from "@/utils/noteWindow";
import { noteTitleFromPath } from "@/utils/noteFile";
import { DEFAULT_SETTINGS, getSettings } from "@/utils/settings";
import { REPO_URL, checkForUpdate } from "@/utils/version";
import { openUrl } from "@tauri-apps/plugin-opener";

const items = [
  {
    label: "从新窗口打开",
    key: "openWindow",
  },
  {
    label: "删除",
    key: "delete",
  },
];

async function getFileDetails(path) {
  const stats = await stat(path, {
    baseDir: BaseDirectory.Resource,
  });
  const filelines = await readTextFileLines(path, {
    baseDir: BaseDirectory.Resource,
  });
  let line1 = await filelines.next();
  let line2 = await filelines.next();
  let line3 = await filelines.next();
  line1 = line1.value ?? "";
  line2 = line2.value ?? "";
  line3 = line3.value ?? "";
  const content = line1 + line2 + line3;
  return {
    path,
    // 只剥掉已知后缀，标题里带点（比如 v1.2）也不会被截断
    title: noteTitleFromPath(path),
    createTime: new Date(stats.birthtime).toLocaleString(), // 创建时间
    updateTime: new Date(stats.mtime).toLocaleString(), // 修改时间
    content,
  };
}

// 高亮关键词：只在文本节点上动手。
// 直接对整段 HTML 做字符串替换有两个坑——
// 1) 关键词落在标签/属性里（比如搜 "div"）会把标签拆坏
// 2) 搜索词本身会被当成 HTML 解析执行
function highlightHtml(html, keyword) {
  const source = String(html ?? "");
  if (!keyword || !source.includes(keyword)) return source;

  const doc = new DOMParser().parseFromString(`<div>${source}</div>`, "text/html");
  const root = doc.body.firstChild;
  if (!root) return source;

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  textNodes.forEach((node) => {
    const text = node.nodeValue ?? "";
    if (!text.includes(keyword)) return;

    const fragment = doc.createDocumentFragment();
    let cursor = 0;
    for (;;) {
      const hit = text.indexOf(keyword, cursor);
      if (hit === -1) {
        fragment.appendChild(doc.createTextNode(text.slice(cursor)));
        break;
      }
      fragment.appendChild(doc.createTextNode(text.slice(cursor, hit)));
      const mark = doc.createElement("span");
      mark.className = "search_hit";
      // 用 textContent 写入，搜索词里的尖括号不会被解析成标签
      mark.textContent = keyword;
      fragment.appendChild(mark);
      cursor = hit + keyword.length;
    }
    node.parentNode.replaceChild(fragment, node);
  });

  return root.innerHTML;
}

const Home = () => {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState("");
  const [topShaow, setTopShaow] = useState("");
  const [noteList, setNoteList] = useState([]);
  const [latestVersion, setLatestVersion] = useState("");

  // 搜索结果是直接从 noteList 派生的，不再单独存一份 searchList：
  // 原来用 useEffect([searchText]) 同步，noteList 变了（比如删完便签重新 init）
  // 过滤结果不会跟着更新，搜索框里还留着关键词但列表已经变回全部了
  const keyword = searchText.trim();
  const searchList = useMemo(() => {
    // 空关键词直接返回原列表。
    // 原来这里会走 replaceAll("")，结果是每个字符之间都插一个空 span
    if (!keyword) return noteList;

    return noteList
      .filter(
        (item) =>
          item.content?.includes(keyword) || item.title?.includes(keyword)
      )
      .map((item) => ({
        ...item,
        content: highlightHtml(item.content, keyword),
      }));
  }, [noteList, keyword]);

  const handleChange = (e) => {
    setSearchText(e.target.value);
  };

  // 搜索本来就是实时的，点放大镜/回车只是把首尾空格去掉
  const handleSearch = () => setSearchText((text) => text.trim());

  const keyDown = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const noteClick = (item) => {
    navigate("/note", {
      state: {
        noteInfo: {
          path: item.path,
        },
      },
    });
  };

  const onScroll = (e) => {
    const scrollTop = e.target.scrollTop;
    if (scrollTop === 0) {
      setTopShaow("");
    } else {
      setTopShaow("5px 0px 10px 10px rgb(206, 206, 206)");
    }
  };

  const init = async () => {
    const entries = await readDir("AppData", {
      baseDir: BaseDirectory.Resource,
    });
    const list = entries.map(async (item) => {
      const path = "AppData/" + item.name;
      const res = await getFileDetails(path);
      return res;
    });
    Promise.all([...list]).then((res) => {
      setNoteList([...res]);
    });
  };

  useEffect(() => {
    init();
  }, []);

  // 启动时按设置决定要不要检查更新；这是后台静默检查，失败只记日志不打扰用户
  useEffect(() => {
    let cancelled = false;

    getSettings()
      .then((res) => {
        const mode = res?.updateCheck ?? DEFAULT_SETTINGS.updateCheck;
        if (mode !== "startup") return null;
        return checkForUpdate();
      })
      .then((result) => {
        if (!cancelled && result?.hasUpdate) setLatestVersion(result.latest);
      })
      .catch((e) => console.error("[inotes] 启动检查更新失败", e));

    return () => {
      cancelled = true;
    };
  }, []);

  const openRepo = async () => {
    try {
      await openUrl(REPO_URL);
    } catch (e) {
      console.error("[inotes] 打开仓库地址失败", e);
    }
  };

  const onClick = async (opt, item) => {
    if (opt.key === "openWindow") {
      try {
        await openNoteWindow(item.path);
      } catch (e) {
        console.error("[inotes] 打开新窗口失败", e);
        message.error("打开新窗口失败");
      }
    } else if (opt.key === "delete") {
      await remove(item.path, {
        baseDir: BaseDirectory.Resource,
      });
      init();
    }
  };

  const openDropDown = (e) => {
    e.stopPropagation();
  };
  return (
    <div className="home">
      <div className="note_list">
        <div className="top_box" style={{ boxShadow: topShaow }}>
          <h1 className="app_title">iNotes</h1>
          <div className="search_box">
            <div className="input_box">
              <input
                type="text"
                value={searchText}
                onChange={(e) => handleChange(e)}
                placeholder="搜索..."
                onKeyDown={keyDown}
              />
              <div className="seatch_btn" onClick={handleSearch}>
                <i className="iconfont icon-search"></i>
              </div>
            </div>
          </div>
        </div>
        {latestVersion ? (
          <div className="update_banner">
            <span className="update_banner_text">
              发现新版本 {latestVersion}
            </span>
            <button
              type="button"
              className="update_banner_btn"
              onClick={openRepo}
            >
              查看
            </button>
            <span
              className="update_banner_close"
              title="这次先不管"
              onClick={() => setLatestVersion("")}
            >
              ×
            </span>
          </div>
        ) : null}
        <div className="notes" onScroll={onScroll}>

          {searchList.length ? (
            searchList.map((item, index) => {
              return (
                <div
                  className="note"
                  key={item.path}
                  onClick={() => noteClick(item)}
                >
                  <div
                    className="note_content"
                    dangerouslySetInnerHTML={{ __html: item.content }}
                  ></div>
                  <div className="bottom">
                    <div className="note_last_update_time">
                      创建时间：{item?.createTime}
                    </div>
                    <div className="note_last_update_time">
                      更新时间：{item?.updateTime}
                    </div>
                  </div>
                  <div className="option_btn" onClick={openDropDown}>
                    <Dropdown
                      menu={{ items, onClick: (key) => onClick(key, item) }}
                      placement="bottomRight"
                    >
                      <i className="iconfont icon-dots"></i>
                    </Dropdown>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="empty">空空如也，快创建一个便签吧！</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
