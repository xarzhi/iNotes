import "./home.scss";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Dropdown } from "antd";
import {
  stat,
  BaseDirectory,
  readDir,
  readTextFileLines,
  remove,
  rename
} from "@tauri-apps/plugin-fs";

const items = [
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
    title: path.split(/[\\/]/).pop().split(".").shift(),
    createTime: new Date(stats.birthtime).toLocaleString(), // 创建时间
    updateTime: new Date(stats.mtime).toLocaleString(), // 修改时间
    content,
  };
}
const Home = () => {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState("");
  const [topShaow, setTopShaow] = useState("");

  const [noteList, setNoteList] = useState([]);
  const [searchList, setSearchList] = useState([]);
  const renameRef = useRef()
  // 搜索 + 搜索高亮
  const handleSearch = () => {
    const prelist = noteList.filter((item) => {
      return (
        item.content?.includes(searchText) || item.title?.includes(searchText)
      );
    });
    const list = prelist.map((item) => {
      const content = item.content.replaceAll(
        searchText,
        `<span style="background:yellow">${searchText}</span>`
      );
      const title = item.title.replaceAll(
        searchText,
        `<span style="background:yellow">${searchText}</span>`
      );
      return {
        ...item,
        title,
        content,
      };
    });
    setSearchList(list);
  };

  const handleChange = (e) => {
    setSearchText(e.target.value);
  };

  useEffect(() => {
    handleSearch();
  }, [searchText]);

  const keyDown = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const noteClick = (item) => {
    navigate("/note", {
      state: {
        noteInfo: item,
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
      setSearchList([...res]);
    });
  };

  useEffect(() => {
    init();
  }, []);

  const onClick = async (opt, item, index) => {
    if (opt.key === "delete") {
      await remove(item.path, {
        baseDir: BaseDirectory.Resource,
      });
      init();
    } else if (opt.key === 'rename') {
      item.rename = true
      const list = searchList.map((item, index1) => {
        return {
          ...item,
          rename: index === index1 ? true : false
        }
      })
      setSearchList([...list])
      setTimeout(() => {
        renameRef.current.focus()
        renameRef.current.value = item.title
      })
    }
  };
  const onBlur = async (item, index) => {
    const list = searchList.map((item, index1) => {
      return {
        ...item,
        rename: false
      }
    })
    setSearchList([...list])
    await rename(item.path, renameRef.current.value + '.html', {
      oldPathBaseDir: BaseDirectory.Resource,
      newPathBaseDir: BaseDirectory.Resource,
    });
    init();

  }
  const inputClick = (e) => {
    e.stopPropagation()
  }
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
        <div className="notes" onScroll={onScroll}>
          {searchList.length ? (
            searchList.map((item, index) => {
              return (
                <div
                  className="note"
                  key={index}
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
                      menu={{ items, onClick: (key) => onClick(key, item, index) }}
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
