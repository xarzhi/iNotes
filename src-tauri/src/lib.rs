// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent, TrayIconId};
use tauri::{AppHandle, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder, WindowEvent};

/// 独立便签窗口的 label 前缀，需要和前端 src/utils/noteWindow.js 里的 NOTE_WINDOW_PREFIX 保持一致
const NOTE_WINDOW_PREFIX: &str = "note-";
/// 主窗口 label（tauri.conf.json 里显式指定为 main）
const MAIN_WINDOW_LABEL: &str = "main";
/// 默认的全局快捷键
const DEFAULT_SHORTCUT: &str = "Alt+Z";

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// ------------------------------------------------------------------ 设置

#[derive(Debug, Clone, Serialize, Deserialize)]
// 容器级 default：老版本 settings.json 里没有 shortcut 字段，也能正常读出来
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    /// 开机自启
    pub autostart: bool,
    /// 静默启动：启动时不弹出主窗口，只在托盘里待着
    pub silent_start: bool,
    /// 主窗口右上角 x 的行为：true = 最小化至托盘，false = 直接关闭程序
    pub close_to_tray: bool,
    /// 唤出便签窗口的全局快捷键，形如 "Alt+Z"
    pub shortcut: String,
    /// 版本更新检测方式："startup" = 每次启动检测，"never" = 不自动检测
    pub update_check: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            autostart: false,
            silent_start: false,
            // 有了托盘之后默认收进托盘，否则托盘和快捷键就没意义了
            close_to_tray: true,
            shortcut: DEFAULT_SHORTCUT.to_string(),
            update_check: "startup".to_string(),
        }
    }
}

pub struct AppState {
    settings: Mutex<Settings>,
    settings_path: PathBuf,
}

impl AppState {
    fn load(settings_path: PathBuf) -> Self {
        let settings = fs::read_to_string(&settings_path)
            .ok()
            .and_then(|raw| serde_json::from_str::<Settings>(&raw).ok())
            .unwrap_or_default();
        Self {
            settings: Mutex::new(settings),
            settings_path,
        }
    }

    fn settings(&self) -> Settings {
        self.settings.lock().unwrap().clone()
    }

    fn persist(&self, settings: &Settings) {
        if let Some(dir) = self.settings_path.parent() {
            let _ = fs::create_dir_all(dir);
        }
        if let Ok(raw) = serde_json::to_string_pretty(settings) {
            let _ = fs::write(&self.settings_path, raw);
        }
    }
}

#[tauri::command]
fn get_settings(state: tauri::State<'_, AppState>) -> Settings {
    state.settings()
}

#[tauri::command]
fn save_settings(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    settings: Settings,
) -> Result<Settings, String> {
    let previous = state.settings();

    // 只在开关真的变了的时候才动注册表：auto-launch 删除不存在的项会报错
    if previous.autostart != settings.autostart {
        set_autostart(settings.autostart)?;
    }

    // 换了快捷键就重新注册；注册不上（被别的软件占了 / 格式不对）就退回原来那个，且不落盘
    if previous.shortcut != settings.shortcut {
        if let Err(e) = apply_hotkey(app.clone(), &settings.shortcut) {
            let _ = apply_hotkey(app, &previous.shortcut);
            return Err(e);
        }
    }

    state.persist(&settings);
    *state.settings.lock().unwrap() = settings.clone();
    Ok(settings)
}

// ------------------------------------------------------------------ 开机自启

fn set_autostart(enabled: bool) -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;

    let mut builder = auto_launch::AutoLaunchBuilder::new();
    builder
        .set_app_name("inotes")
        .set_app_path(&exe.to_string_lossy());

    let auto = builder.build().map_err(|e| e.to_string())?;
    if enabled {
        auto.enable().map_err(|e| e.to_string())
    } else {
        auto.disable().map_err(|e| e.to_string())
    }
}

// ------------------------------------------------------------------ 窗口

/// 显示主窗口；主窗口要是已经被关掉了，就重新建一个
fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
        return;
    }

    if let Err(e) = WebviewWindowBuilder::new(
        app,
        MAIN_WINDOW_LABEL,
        WebviewUrl::App("index.html".into()),
    )
    .title("inotes")
    .inner_size(360.0, 630.0)
    .min_inner_size(360.0, 630.0)
    .decorations(false)
    .build()
    {
        eprintln!("[inotes] 重新创建主窗口失败: {e}");
    }
}

/// 把所有已经打开的便签窗口重新显示出来并置于最前；一个便签窗口都没有时打开主窗口
fn show_all_note_windows(app: &AppHandle) {
    let mut found = false;
    for (label, window) in app.webview_windows() {
        if label.starts_with(NOTE_WINDOW_PREFIX) {
            found = true;
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
    }

    if !found {
        show_main_window(app);
    }
}

// ------------------------------------------------------------------ 临时便签

/// 删掉所有临时便签（文件名以 .tmp.html 结尾的那些）。
/// 退出时调一次；启动时也调一次，兜住被强杀、没走到退出流程的情况
fn remove_temp_notes(app: &AppHandle) {
    let Ok(resource_dir) = app.path().resource_dir() else {
        return;
    };

    let Ok(entries) = fs::read_dir(resource_dir.join("AppData")) else {
        return;
    };

    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.ends_with(".tmp.html") {
            let _ = fs::remove_file(entry.path());
        }
    }
}


// ------------------------------------------------------------------ 托盘

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let show_item = MenuItem::with_id(app, "show-main", "显示主窗口", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "退出 inotes", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

    let mut builder = TrayIconBuilder::with_id(TrayIconId::new("inotes-tray"))
        .menu(&menu)
        // 左键点击直接唤出主窗口，右键才出菜单
        .show_menu_on_left_click(false)
        .tooltip("iNotes")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show-main" => show_main_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });

    // 用打包时嵌进去的应用图标（tauri.conf.json -> bundle.icon）
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app)?;
    Ok(())
}

// ------------------------------------------------------------------ 全局快捷键

/// 当前承载全局快捷键的线程（线程 id + 句柄）。换快捷键时先把它停掉
#[cfg(windows)]
static HOTKEY_THREAD: Mutex<Option<(u32, std::thread::JoinHandle<()>)>> = Mutex::new(None);

/// 把 "Alt+Z" 这样的字符串解析成 Win32 的 (修饰键, 虚拟键码)
#[cfg(windows)]
fn parse_shortcut(shortcut: &str) -> Result<(u32, u32), String> {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{MOD_ALT, MOD_CONTROL, MOD_SHIFT};

    let mut modifiers = 0u32;
    let mut key = None;

    for part in shortcut.split('+').map(str::trim).filter(|p| !p.is_empty()) {
        match part.to_ascii_lowercase().as_str() {
            "alt" => modifiers |= MOD_ALT,
            "ctrl" | "control" => modifiers |= MOD_CONTROL,
            "shift" => modifiers |= MOD_SHIFT,
            other => {
                if key.is_some() {
                    return Err(format!("快捷键 {shortcut} 里有多个主键"));
                }
                key = Some(parse_key(other).ok_or_else(|| format!("不支持的按键：{part}"))?);
            }
        }
    }

    let key = key.ok_or_else(|| format!("快捷键 {shortcut} 缺少主键"))?;
    if modifiers == 0 {
        return Err("快捷键至少要带一个修饰键（Ctrl / Alt / Shift）".into());
    }

    Ok((modifiers, key))
}

/// 支持字母、数字、F1~F24；返回虚拟键码
#[cfg(windows)]
fn parse_key(name: &str) -> Option<u32> {
    let upper = name.to_ascii_uppercase();

    // 字母 / 数字的虚拟键码就是它自己的 ASCII
    if upper.len() == 1 {
        let c = upper.chars().next()?;
        if c.is_ascii_uppercase() || c.is_ascii_digit() {
            return Some(c as u32);
        }
    }

    // F1 ~ F24
    if let Some(rest) = upper.strip_prefix('F') {
        if let Ok(n) = rest.parse::<u32>() {
            if (1..=24).contains(&n) {
                return Some(0x70 + n - 1);
            }
        }
    }

    None
}

/// 开一个独立线程注册全局快捷键并跑消息循环；注册成功返回线程 id
#[cfg(windows)]
fn spawn_hotkey_thread(app: AppHandle, shortcut: &str) -> Result<u32, String> {
    use windows_sys::Win32::System::Threading::GetCurrentThreadId;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        RegisterHotKey, UnregisterHotKey, MOD_NOREPEAT,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetMessageW, PeekMessageW, MSG, PM_NOREMOVE, WM_HOTKEY,
    };

    const HOTKEY_ID: i32 = 0x1A2B; // 进程内唯一即可

    let (modifiers, vk) = parse_shortcut(shortcut)?;
    let (tx, rx) = std::sync::mpsc::channel::<Result<u32, String>>();
    let owned = shortcut.to_string();

    let handle = std::thread::spawn(move || unsafe {
        // 先碰一下消息队列，保证别的线程能 PostThreadMessage 进来把它叫停
        let mut msg: MSG = std::mem::zeroed();
        PeekMessageW(&mut msg, std::ptr::null_mut(), 0, 0, PM_NOREMOVE);
        let thread_id = GetCurrentThreadId();

        // hwnd 传 null 表示注册成线程级热键，WM_HOTKEY 会投递到本线程的消息队列
        if RegisterHotKey(std::ptr::null_mut(), HOTKEY_ID, modifiers | MOD_NOREPEAT, vk) == 0 {
            let _ = tx.send(Err(format!(
                "注册快捷键 {owned} 失败，可能已被其它程序占用"
            )));
            return;
        }

        let _ = tx.send(Ok(thread_id));

        while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {
            if msg.message == WM_HOTKEY && msg.wParam as i32 == HOTKEY_ID {
                show_all_note_windows(&app);
            }
        }

        UnregisterHotKey(std::ptr::null_mut(), HOTKEY_ID);
    });

    match rx.recv_timeout(std::time::Duration::from_secs(3)) {
        Ok(Ok(thread_id)) => {
            *HOTKEY_THREAD.lock().unwrap() = Some((thread_id, handle));
            Ok(thread_id)
        }
        Ok(Err(e)) => {
            let _ = handle.join();
            Err(e)
        }
        Err(_) => Err("注册快捷键超时".into()),
    }
}

/// 停掉承载快捷键的线程：GetMessageW 收到 WM_QUIT 会返回 0，线程自己注销热键后退出
#[cfg(windows)]
fn stop_hotkey_thread() {
    use windows_sys::Win32::UI::WindowsAndMessaging::{PostThreadMessageW, WM_QUIT};

    let previous = HOTKEY_THREAD.lock().unwrap().take();
    if let Some((thread_id, handle)) = previous {
        unsafe { PostThreadMessageW(thread_id, WM_QUIT, 0, 0) };
        let _ = handle.join();
    }
}

/// 换成新的全局快捷键
#[cfg(windows)]
fn apply_hotkey(app: AppHandle, shortcut: &str) -> Result<(), String> {
    // 先校验格式，格式不对就别把现有的快捷键拆了
    parse_shortcut(shortcut)?;
    stop_hotkey_thread();
    spawn_hotkey_thread(app, shortcut).map(|_| ())
}

/// 非 Windows 平台暂时不支持这个全局快捷键
#[cfg(not(windows))]
fn apply_hotkey(_app: AppHandle, _shortcut: &str) -> Result<(), String> {
    Ok(())
}

// ------------------------------------------------------------------ 入口

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, get_settings, save_settings])
        .setup(|app| {
            let handle = app.handle().clone();

            let settings_path = app.path().app_config_dir()?.join("settings.json");
            let state = AppState::load(settings_path);
            let settings = state.settings();
            app.manage(state);

            // 上次要是被强杀，临时便签会留到现在，先清掉
            remove_temp_notes(&handle);

            build_tray(&handle)?;

            // 静默启动：开了就只留在托盘里，不弹主窗口（主窗口在 tauri.conf.json 里默认 visible: false）
            if !settings.silent_start {
                show_main_window(&handle);
            }

            // 注册全局快捷键；失败不拦启动，用户可以去设置页换一个
            if let Err(e) = apply_hotkey(handle.clone(), &settings.shortcut) {
                eprintln!("[inotes] {e}");
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| match event {
        // 主窗口右上角的 x：按设置决定收进托盘还是退出程序
        RunEvent::WindowEvent {
            label,
            event: WindowEvent::CloseRequested { api, .. },
            ..
        } if label == MAIN_WINDOW_LABEL => {
            api.prevent_close();

            if app_handle.state::<AppState>().settings().close_to_tray {
                if let Some(window) = app_handle.get_webview_window(MAIN_WINDOW_LABEL) {
                    let _ = window.hide();
                }
            } else {
                app_handle.exit(0);
            }
        }
        // 所有窗口都关掉时不跟着退出，留在托盘里，方便 Alt+Z / 托盘再把主窗口唤回来
        RunEvent::ExitRequested { code, api, .. } => {
            if code.is_none() {
                api.prevent_exit();
            }
        }
        // 真正退出之前清掉临时便签
        RunEvent::Exit => remove_temp_notes(app_handle),
        _ => {}
    });
}
