import { useCallback, useEffect, useState } from "react";
import "./index.scss";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useNavigate, useLocation } from "react-router-dom";
import { create, BaseDirectory, exists, stat } from "@tauri-apps/plugin-fs";

const BackBtn = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const { pathname } = location;
  const jump = async (path, params) => {
    if (path === "/note") {
      let name = "未命名";
      let num = 0;
      const addon = "html";
      let bool = true;
      while (bool) {
        const isExist = await exists(`AppData/${name}.${addon}`, {
          baseDir: BaseDirectory.Resource,
        });
        if (isExist) {
          let numb = Number(name.substring(3));
          numb = ++numb;
          name = "未命名" + numb;
        } else {
          bool = false;
        }
      }

      await create(`AppData/${name}.${addon}`, {
        baseDir: BaseDirectory.Resource,
      });
      navigate(path, {
        state: {
          noteInfo: {
            path: `AppData/${name}.${addon}`,
          },
        },
      });
    } else {
      navigate(path, {
        state: {
          ...params,
        },
      });
    }
  };

  const btnMap = new Map([
    [
      "/",
      {
        element: (
          <div
            className="titlebar-button"
            id="titlebar-maximize"
            onClick={() => jump("/note", { noteInfo: {} })}
          >
            <i className="iconfont icon-jia2" alt="新增"></i>
          </div>
        ),
      },
    ],
    [
      "/note",
      {
        element: (
          <div
            onClick={() => jump("/")}
            className="titlebar-button"
            id="titlebar-maximize"
          >
            <i className="iconfont icon-fanhui" alt="返回"></i>
          </div>
        ),
      },
    ],
    [
      "/setting",
      {
        element: (
          <div
            onClick={() => jump("/")}
            className="titlebar-button"
            id="titlebar-maximize"
          >
            <i className="iconfont icon-home2" alt="回家"></i>
          </div>
        ),
      },
    ],
  ]);
  return btnMap.get(pathname)?.element || <></>;
};

const DragTop = () => {
  const navigate = useNavigate();
  const window = getCurrentWindow();
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);
  const location = useLocation();
  const { pathname } = location;

  const [title, setTitle] = useState("");
  useEffect(() => {
    if (pathname === "/note") {
      const title = location.state.noteInfo.path
        .split(/[\\/]/)
        .pop()
        .split(".")
        .shift();

      setTitle(title);
    }
  }, [pathname]);

  // 窗口置于顶层
  const setOnTop = useCallback(async () => {
    const isAlwaysOnTop = await window.isAlwaysOnTop();
    await window.setAlwaysOnTop(!isAlwaysOnTop);
    setIsAlwaysOnTop(!isAlwaysOnTop);
  }, []);

  // 窗口最小化
  const minimize = useCallback(() => {
    window.minimize();
  }, []);
  // 窗口最大化;
  const toggleMaximize = useCallback(() => {
    window.toggleMaximize();
  }, []);
  // 关闭窗口
  const close = useCallback(async () => {
    await window.close();
  }, []);

  return (
    <div data-tauri-drag-region className="titlebar">
      <div className="left">
        <BackBtn />
        <div
          className="titlebar-button"
          id="titlebar-minimize"
          onClick={setOnTop}
        >
          <i
            className="iconfont icon-pin-fill"
            style={{
              color: isAlwaysOnTop ? "blue" : "gray",
            }}
            title="置于顶层"
          ></i>
        </div>
        {/* <div
          className="titlebar-button"
          id="titlebar-maximize"
          onClick={() => navigate("/setting")}
        >
          <i className="iconfont icon-setting3" alt="设置"></i>
        </div> */}
      </div>
      {/* <div className="middle">{pathname === "/note" ? title : ""}</div> */}
      <div className="right">
        <div
          className="titlebar-button"
          id="titlebar-minimize"
          onClick={minimize}
        >
          <i className="iconfont icon-jian2" alt="最小化"></i>
        </div>

        <div
          className="titlebar-button"
          id="titlebar-maximize"
          onClick={toggleMaximize}
        >
          <i className="iconfont icon-jichu_quanping" alt="全屏"></i>
        </div>
        <div className="titlebar-button" id="titlebar-close" onClick={close}>
          <i className="iconfont icon-close4" alt="关闭"></i>
        </div>
      </div>
    </div>
  );
};

export default DragTop;
