import { invoke } from "@tauri-apps/api/core";

export async function refreshApps(apiKey: string) {
  return await invoke("refresh_apps", { apiKey });
}
