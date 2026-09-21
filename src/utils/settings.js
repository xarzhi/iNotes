import { invoke } from "@tauri-apps/api/core";

// 字段名需要和 src-tauri/src/lib.rs 里的 Settings 对齐（serde camelCase）
export const DEFAULT_SETTINGS = {
  autostart: false,
  silentStart: false,
  closeToTray: true,
  shortcut: "Alt+Z",
  // "startup" = 每次启动检测，"never" = 不自动检测
  updateCheck: "startup",
};

export function getSettings() {
  return invoke("get_settings");
}

export function saveSettings(settings) {
  return invoke("save_settings", { settings });
}
