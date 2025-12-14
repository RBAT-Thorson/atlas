mod airtable;

use airtable::{AppRecord, UserRecord};
use tauri::{AppHandle, Manager, Emitter};
use tauri_plugin_opener::OpenerExt;
use serde::{Deserialize};

#[derive(Deserialize)]
struct OpenTargetParams {
    target: String,
    app_type: Option<String>,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn refresh_apps(api_key: String) -> Result<Vec<AppRecord>, String> {
    airtable::fetch_and_cache_apps(&api_key).map_err(|e| e.to_string())
}

#[tauri::command]
fn fetch_users(api_key: String) -> Result<Vec<UserRecord>, String> {
    airtable::fetch_users(&api_key).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_user(name: String, api_key: String) -> Result<UserRecord, String> {
    airtable::create_user(name, &api_key).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_user_settings(user_id: String, settings_json: String, api_key: String) -> Result<(), String> {
    airtable::update_user_settings(user_id, settings_json, &api_key).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_console_log(level: String, message: String) -> Result<(), String> {
    use std::fs::OpenOptions;
    use std::io::Write;
    use std::time::SystemTime;
    
    let app_data_dir = directories::BaseDirs::new()
        .ok_or_else(|| "Could not determine base directories".to_string())?
        .data_local_dir()
        .to_path_buf();
    
    let log_dir = app_data_dir.join("com.mayerthorson.atlas");
    std::fs::create_dir_all(&log_dir)
        .map_err(|e| format!("Failed to create log directory: {}", e))?;
    
    let log_file = log_dir.join("console.log");
    
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map_err(|e| format!("System time error: {}", e))?;
    
    let log_line = format!("[{}] [{}] {}\n", now.as_secs(), level, message);
    
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_file)
        .map_err(|e| format!("Failed to open log file: {}", e))?;
    
    file.write_all(log_line.as_bytes())
        .map_err(|e| format!("Failed to write to log file: {}", e))?;
    
    Ok(())
}

#[tauri::command]
fn open_target(app_handle: AppHandle, params: OpenTargetParams) -> Result<(), String> {
    use std::process::Command;
    
    let target = &params.target;
    let app_type_str = params.app_type.as_deref().unwrap_or("web").to_lowercase();

    match app_type_str.as_str() {
        "web" => {
            app_handle
                .opener()
                .open_url(target.clone(), Option::<String>::None)
                .map_err(|e| e.to_string())
        }

        "chrome app" => {
            #[cfg(target_os = "macos")]
            {
                let output = Command::new("open")
                    .args(["-a", "Google Chrome", target])
                    .output()
                    .map_err(|e| format!("Failed to spawn process: {}", e))?;
                
                if !output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    return Err(format!("Command failed: {}", stderr));
                }
            }
            #[cfg(target_os = "windows")]
            {
                let output = Command::new("cmd")
                    .args(["/C", "start", "chrome", target])
                    .output()
                    .map_err(|e| format!("Failed to spawn process: {}", e))?;
                
                if !output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    return Err(format!("Command failed: {}", stderr));
                }
            }
            Ok(())
        }

        "mac app" => {
            #[cfg(target_os = "macos")]
            {
                let output = Command::new("open")
                    .args(["-a", target])
                    .output()
                    .map_err(|e| format!("Failed to spawn open command: {}", e))?;
                
                if !output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    return Err(format!("Failed to open app '{}': {}", target, stderr));
                }
            }
            #[cfg(not(target_os = "macos"))]
            {
                return Err("Mac apps can only be launched on macOS".to_string());
            }
            Ok(())
        }

        "win app" => {
            #[cfg(target_os = "windows")]
            {
                let output = Command::new("cmd")
                    .args(["/C", "start", target])
                    .output()
                    .map_err(|e| format!("Failed to spawn process: {}", e))?;
                
                if !output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    return Err(format!("Command failed: {}", stderr));
                }
            }
            Ok(())
        }

        _ => {
            app_handle
                .opener()
                .open_url(target.clone(), Option::<String>::None)
                .map_err(|e| e.to_string())
        }
    }
}

#[derive(serde::Serialize)]
struct AppInfo {
    name: String,
    target: String,
    icon: Option<String>,
}

#[tauri::command]
fn get_app_info(path: String) -> Result<AppInfo, String> {
    use std::path::Path;
    
    let app_path = Path::new(&path);
    let name = app_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Unknown")
        .to_string();
    
    // For .app bundles on macOS, look for the icon
    let icon_path = if path.ends_with(".app") {
        #[cfg(target_os = "macos")]
        {
            // Try to find the icon file in the app bundle
            let contents_path = app_path.join("Contents");
            let resources_path = contents_path.join("Resources");
            
            // Check for .icns files in Resources folder
            if let Ok(entries) = std::fs::read_dir(&resources_path) {
                for entry in entries.flatten() {
                    let entry_path = entry.path();
                    if let Some(ext) = entry_path.extension() {
                        if ext == "icns" {
                            return Ok(AppInfo {
                                name,
                                target: path.clone(),
                                icon: Some(entry_path.to_string_lossy().to_string()),
                            });
                        }
                    }
                }
            }
            None
        }
        #[cfg(not(target_os = "macos"))]
        {
            None
        }
    } else {
        None
    };
    
    Ok(AppInfo {
        name,
        target: path,
        icon: icon_path,
    })
}

#[tauri::command]
fn load_icon_base64(path: String) -> Result<String, String> {
    use std::fs;
    use base64::{Engine as _, engine::general_purpose};
    
    // Read the file
    let icon_data = fs::read(&path)
        .map_err(|e| format!("Failed to read icon file '{}': {}", path, e))?;
    
    // Convert to base64
    let base64_data = general_purpose::STANDARD.encode(&icon_data);
    
    // Determine MIME type based on extension
    // Note: .icns files are Apple icon format, we return them as application/octet-stream
    // and let the frontend extract the PNG
    let mime_type = if path.ends_with(".png") {
        "image/png"
    } else if path.ends_with(".ico") {
        "image/x-icon"
    } else if path.ends_with(".icns") {
        "application/octet-stream"
    } else {
        "image/png" // Default
    };
    
    Ok(format!("data:{};base64,{}", mime_type, base64_data))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri_plugin_global_shortcut::ShortcutState;
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    // Only trigger on key press, not release
                    if event.state == ShortcutState::Pressed {
                        if let Some(window) = app.get_webview_window("main") {
                            let is_visible = window.is_visible().unwrap_or(false);
                            let is_focused = window.is_focused().unwrap_or(false);
                            
                            if !is_visible {
                                // Window is hidden - show and focus it, then trigger search
                                let _ = window.show();
                                let _ = window.set_focus();
                                let _ = window.emit("trigger-search-focus", ());
                            } else if !is_focused {
                                // Window is visible but not focused - focus it
                                let _ = window.set_focus();
                            } else {
                                // Window is visible and focused - trigger search focus or clear
                                let _ = window.emit("trigger-search-toggle", ());
                            }
                        }
                    }
                })
                .build()
        )
        .setup(|app| {
            // Register global shortcut Ctrl+Space
            use tauri_plugin_global_shortcut::GlobalShortcutExt;
            
            app.handle().global_shortcut().on_shortcut("Ctrl+Space", |_app_handle, _shortcut, _event| {
                // Handler is already registered in the plugin builder above
            })?;
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            refresh_apps,
            open_target,
            fetch_users,
            create_user,
            update_user_settings,
            write_console_log,
            get_app_info,
            load_icon_base64
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
