import { Fragment, useEffect, useId, useRef, useState } from "react";
import { DEFAULT_SETTINGS, getSettings, saveSettings } from "@/utils/settings";
import { CURRENT_VERSION, REPO_URL, checkForUpdate } from "@/utils/version";
import "./Setting.scss";

const PowerIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
    <path d="M12 2v10" />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 9l6 6M15 9l-6 6" />
  </svg>
);

const WarningIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5M12 16.5h.01" />
  </svg>
);

const ChevronIcon = () => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 4.5 6 8l3.5-3.5" />
  </svg>
);

const KeyboardIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7.5 14h9" />
  </svg>
);

const InfoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 7.8h.01" />
  </svg>
);

const RefreshIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    <path d="M23 4v6h-6" />
  </svg>
);

const MODIFIER_KEYS = ["Control", "Alt", "Shift"];

// 只按了修饰键属于录入过程中的正常状态，不该提示错误
const isModifierKey = (key) => MODIFIER_KEYS.includes(key) || key === "Meta";

// 取出主键。优先用 event.code：它对应物理按键，
// 不受输入法/键盘布局影响（非英文布局下 event.key 可能压根不是字母）
function mainKeyFromEvent(event) {
  const { code, key } = event;

  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code;

  if (/^[a-zA-Z]$/.test(key)) return key.toUpperCase();
  if (/^[0-9]$/.test(key)) return key;
  if (/^F([1-9]|1[0-9]|2[0-4])$/i.test(key)) return key.toUpperCase();

  return null;
}

// 把键盘事件转成规范字符串（Ctrl+Alt+Z）；还构不成合法快捷键时返回 null
function shortcutFromEvent(event) {
  const parts = [];
  if (event.ctrlKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");

  const main = mainKeyFromEvent(event);
  if (!main || parts.length === 0) return null;
  return [...parts, main].join("+");
}

const ShortcutKeys = ({ value }) => (
  <>
    {String(value || "")
      .split("+")
      .filter(Boolean)
      .map((part, index) => (
        <Fragment key={`${part}-${index}`}>
          {index > 0 ? <span className="shortcut_plus">+</span> : null}
          <kbd className="shortcut_key">{part}</kbd>
        </Fragment>
      ))}
  </>
);

// Fluent 风格的快捷键录入控件
const ShortcutRecorder = ({ value, disabled, onChange, onInvalid }) => {
  const [recording, setRecording] = useState(false);
  const onChangeRef = useRef(onChange);
  const onInvalidRef = useRef(onInvalid);
  onChangeRef.current = onChange;
  onInvalidRef.current = onInvalid;

  useEffect(() => {
    if (!recording) return undefined;

    const onKeyDown = (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === "Escape") {
        setRecording(false);
        return;
      }

      const next = shortcutFromEvent(event);
      if (!next) {
        // 只按修饰键是正常的中间状态；按了不支持的键才提示
        if (!isModifierKey(event.key)) {
          onInvalidRef.current?.("请用 Ctrl / Alt / Shift 加上字母、数字或 F1~F24");
        }
        return;
      }

      setRecording(false);
      onInvalidRef.current?.("");
      onChangeRef.current(next);
    };

    // 捕获阶段拦下来，避免录入时触发别的快捷键
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [recording]);

  return (
    <div className="shortcut">
      <button
        type="button"
        className={`shortcut_btn${recording ? " is_recording" : ""}`}
        disabled={disabled}
        aria-label="全局快捷键"
        onClick={() => {
          onInvalidRef.current?.("");
          setRecording(true);
        }}
      >
        {recording ? (
          <span className="shortcut_recording">按下新快捷键…</span>
        ) : (
          <ShortcutKeys value={value} />
        )}
      </button>
      {recording ? <div className="shortcut_hint">Esc 取消</div> : null}
    </div>
  );
};

// Fluent / WinUI 的 ToggleSwitch
const FluentSwitch = ({ checked, disabled, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    className={`fluent_switch${checked ? " is_on" : ""}`}
    onClick={() => onChange(!checked)}
  >
    <span className="fluent_switch_thumb" />
  </button>
);

// Fluent / WinUI 的 ComboBox（下拉选择）
const FluentSelect = ({ value, options, disabled, onChange, ariaLabel }) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef(null);
  const listId = useId();

  const current = options.find((o) => o.value === value);

  // 点击别处 / Esc 收起
  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const openList = () => {
    const index = options.findIndex((o) => o.value === value);
    setActiveIndex(index < 0 ? 0 : index);
    setOpen(true);
  };

  const select = (next) => {
    onChange(next);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (disabled) return;

    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, options.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        select(options[activeIndex].value);
        break;
      default:
        break;
    }
  };

  return (
    <div
      ref={rootRef}
      className={`fluent_select${open ? " is_open" : ""}${
        disabled ? " is_disabled" : ""
      }`}
    >
      <button
        type="button"
        className="fluent_select_btn"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
      >
        <span className="fluent_select_value">{current?.label}</span>
        <span className="fluent_select_chevron">
          <ChevronIcon />
        </span>
      </button>

      {open ? (
        <div className="fluent_select_list" role="listbox" id={listId}>
          {options.map((option, index) => (
            <div
              key={option.value}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={option.value === value}
              className={`fluent_select_item${
                option.value === value ? " is_selected" : ""
              }${index === activeIndex ? " is_active" : ""}`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => select(option.value)}
            >
              {option.label}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

const CLOSE_OPTIONS = [
  { value: "tray", label: "最小化至托盘" },
  { value: "exit", label: "关闭程序" },
];

const UPDATE_CHECK_OPTIONS = [
  { value: "startup", label: "每次启动检测" },
  { value: "never", label: "不自动检测" },
];

const Setting = () => {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [updateStatus, setUpdateStatus] = useState("");
  const [updateFailed, setUpdateFailed] = useState(false);

  useEffect(() => {
    getSettings()
      .then((res) => setSettings({ ...DEFAULT_SETTINGS, ...res }))
      .catch((e) => {
        console.error("[inotes] 读取设置失败", e);
        setError(`读取设置失败：${e}`);
        setSettings({ ...DEFAULT_SETTINGS });
      });
  }, []);

  // 手动检查更新：读仓库里的 version.json 和本地版本比
  const checkUpdate = async () => {
    if (checking) return;
    setChecking(true);
    setUpdateStatus("");
    setUpdateFailed(false);
    try {
      const { hasUpdate, latest } = await checkForUpdate();
      setUpdateStatus(hasUpdate ? `发现新版本 ${latest}` : "已是最新版本");
      setUpdateFailed(false);
    } catch (e) {
      // details 里是每个更新源各自的失败原因，留给控制台
      console.error("[inotes] 检查更新失败", e.details ?? e);
      setUpdateStatus(String(e.message || e));
      setUpdateFailed(true);
    } finally {
      setChecking(false);
    }
  };

  const update = async (patch) => {
    if (!settings || saving) return;

    const previous = settings;
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaving(true);
    setError("");
    try {
      const saved = await saveSettings(next);
      setSettings({ ...DEFAULT_SETTINGS, ...saved });
    } catch (e) {
      console.error("[inotes] 保存设置失败", e);
      setError(`保存失败：${e}`);
      setSettings(previous);
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <div className="setting" />;

  return (
    <div className="setting">
      <h1 className="page_title">设置</h1>

      {error ? (
        <div className="info_bar" role="alert">
          <span className="info_bar_icon">
            <WarningIcon />
          </span>
          <span className="info_bar_text">{error}</span>
        </div>
      ) : null}

      <div className="card">
        <div className="row">
          <span className="row_icon">
            <PowerIcon />
          </span>
          <div className="row_text">
            <div className="row_title">开机自启</div>
            <div className="row_desc">开机后自动运行 iNotes</div>
          </div>
          <div className="row_control">
            <FluentSwitch
              label="开机自启"
              checked={settings.autostart}
              disabled={saving}
              onChange={(checked) => update({ autostart: checked })}
            />
          </div>
        </div>

        <div className="row">
          <span className="row_icon">
            <MoonIcon />
          </span>
          <div className="row_text">
            <div className="row_title">静默启动</div>
            <div className="row_desc">启动时不弹出主窗口，只在托盘里运行</div>
          </div>
          <div className="row_control">
            <FluentSwitch
              label="静默启动"
              checked={settings.silentStart}
              disabled={saving}
              onChange={(checked) => update({ silentStart: checked })}
            />
          </div>
        </div>

        <div className="row">
          <span className="row_icon">
            <KeyboardIcon />
          </span>
          <div className="row_text">
            <div className="row_title">全局快捷键</div>
            <div className="row_desc">随时唤出便签窗口</div>
          </div>
          <div className="row_control">
            <ShortcutRecorder
              value={settings.shortcut}
              disabled={saving}
              onChange={(next) => update({ shortcut: next })}
              onInvalid={setError}
            />
          </div>
        </div>

        <div className="row">
          <span className="row_icon">
            <CloseIcon />
          </span>
          <div className="row_text">
            <div className="row_title">关闭按钮</div>
            <div className="row_desc">主窗口右上角 x 的行为</div>
          </div>
          <div className="row_control">
            <FluentSelect
              ariaLabel="关闭按钮行为"
              value={settings.closeToTray ? "tray" : "exit"}
              options={CLOSE_OPTIONS}
              disabled={saving}
              onChange={(next) => update({ closeToTray: next === "tray" })}
            />
          </div>
        </div>

        <div className="row">
          <span className="row_icon">
            <InfoIcon />
          </span>
          <div className="row_text">
            <div className="row_title">版本</div>
            <div className="row_desc">
              当前 {CURRENT_VERSION}
              {updateStatus ? (
                <>
                  {" · "}
                  <span className={updateFailed ? "is_error" : "is_ok"}>
                    {updateStatus}
                  </span>
                </>
              ) : null}
            </div>
          </div>
          <div className="row_control">
            <button
              type="button"
              className="setting_btn"
              onClick={checkUpdate}
              disabled={checking}
            >
              {checking ? "检查中…" : "检查更新"}
            </button>
          </div>
        </div>

        <div className="row">
          <span className="row_icon">
            <RefreshIcon />
          </span>
          <div className="row_text">
            <div className="row_title">更新检测</div>
            <div className="row_desc">启动时自动检查新版本</div>
          </div>
          <div className="row_control">
            <FluentSelect
              ariaLabel="更新检测方式"
              value={settings.updateCheck}
              options={UPDATE_CHECK_OPTIONS}
              disabled={saving}
              onChange={(next) => update({ updateCheck: next })}
            />
          </div>
        </div>
      </div>

      <div className="page_footer">
        <div>完全退出：托盘菜单 →「退出 inotes」</div>
      </div>
    </div>
  );
};

export default Setting;
