import { useEffect, useRef, useState } from "react";
import "./NoteDialog.scss";

const NoteDialog = ({ open, onCancel, onConfirm }) => {
  const [title, setTitle] = useState("");
  const [isTemp, setIsTemp] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  // 每次打开都回到干净状态并聚焦输入框
  useEffect(() => {
    if (!open) return undefined;
    setTitle("");
    setIsTemp(false);
    setBusy(false);
    const timer = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm({ title, isTemp });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="note_dialog_mask" onMouseDown={onCancel}>
      <div
        className="note_dialog"
        role="dialog"
        aria-modal="true"
        aria-label="新建便签"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="note_dialog_title">新建便签</div>

        <div className="note_dialog_field">
          <label className="note_dialog_label" htmlFor="note-dialog-title">
            标题
          </label>
          <input
            id="note-dialog-title"
            ref={inputRef}
            className="note_dialog_input"
            value={title}
            maxLength={40}
            placeholder="不填则自动命名"
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              }
            }}
          />
        </div>

        <div className="note_dialog_field">
          <div className="note_dialog_label">类型</div>

          <label className="note_dialog_radio">
            <input
              type="radio"
              name="note-dialog-type"
              checked={!isTemp}
              onChange={() => setIsTemp(false)}
            />
            <span className="note_dialog_radio_mark" />
            <span>常规便签</span>
          </label>

          <label className="note_dialog_radio">
            <input
              type="radio"
              name="note-dialog-type"
              checked={isTemp}
              onChange={() => setIsTemp(true)}
            />
            <span className="note_dialog_radio_mark" />
            <span>临时便签</span>
            <span className="note_dialog_radio_hint">关闭程序时自动删除</span>
          </label>
        </div>

        <div className="note_dialog_actions">
          <button
            type="button"
            className="note_dialog_btn"
            onClick={onCancel}
            disabled={busy}
          >
            取消
          </button>
          <button
            type="button"
            className="note_dialog_btn is_primary"
            onClick={submit}
            disabled={busy}
          >
            创建
          </button>
        </div>
      </div>
    </div>
  );
};

export default NoteDialog;
