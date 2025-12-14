import { Store } from "@tauri-apps/plugin-store";

let store: Store | null = null;

// Airtable configuration
const AIRTABLE_BASE_ID = "appL7Lq4VPcHgAewL";
const AIRTABLE_APPS_TABLE_ID = "tblr8L369WEh7mGYh";
const AIRTABLE_API_KEY = "patAbSQCuNbPKVIwG.bb8ad8d617b8b32017c7cc5482f021dbcd1efa3598ae05b71cee7aba651f49a7"; // TODO: Move to secure storage

export function getAirtableApiKey(): string {
  return AIRTABLE_API_KEY;
}

// Field IDs
const FIELD_IDS = {
  Name: "fldN41qoRuE3Jbe6D",
  Type: "fldQ4oETBTtcC5qVe",
  Target: "fld0YbsNSWDiMaO0h",
  Enabled: "fld1Bv8ukgCQLvNJb",
  Icon: "fldfF4CSMX5GwlYnL", // Attachment field - requires public URLs
  IconB64: "fld9NOg5wFtWv4xtS", // Long Text field for base64 storage
  Ownership: "fldO6ZWEuutLhTxQU",
  Owner: "fldhgCgBVIoWNCjZB",
  HideGlobal: "fldz5X4t6KOKGmVix",
  Parent: "fldaEnNJPAD99piXc", // Linked record to parent app
  Children: "fldi4KScXLiMCPko9", // Linked records to child apps
};

// Single select choice IDs
const OWNERSHIP_IDS = {
  Global: "selZiQSSE5YAvQGXT",
  Public: "selKiYgxvMTN7ULqO",
  Private: "selYEJUoktPMFM87d",
};

const TYPE_IDS = {
  web: "selNX7ivtZ5EOV1Cw",
  "win app": "selbHeBqGFoXupRwS",
  "mac app": "selicwcchercMg0rA",
  chrome: "selZ9HCVtmMpZt7k8",
};

async function getStore(): Promise<Store> {
  if (!store) {
    console.log("🧠 Loading store...");
    store = await Store.load("settings.json");
    console.log("✅ Store loaded.");
  }
  return store;
}

export async function loadSettings() {
  const s = await getStore();
  const settings: any = await s.get("ui-settings");
  console.log("📥 Loaded settings from disk:", settings);
  const defaults = {
    iconSize: 256,
    iconPadding: 16,
    gridColumns: 4,
    textSize: 18,
    marginMin: 24,
    appIconRadius: 16,
    theme: "light",
    newAppButtonLocation: "inline" as const,
  };

  if (!settings || typeof settings !== "object") {
    return defaults;
  }

  // Coerce and validate values to avoid bad/legacy data (e.g., event objects)
  const sAny = settings as any;
  // Detect an event-like object accidentally saved (has target/currentTarget/type)
  const isEventLike =
    typeof sAny === "object" &&
    ("target" in sAny || "currentTarget" in sAny || typeof sAny.type === "string");

  if (isEventLike) {
    console.warn("🧹 Detected corrupted ui-settings (event object). Clearing stored settings.");
    // Remove the corrupted entry and persist the defaults
    await s.delete("ui-settings");
    await s.save();
    return defaults;
  }
  const coerced = {
    iconSize: Number(sAny.iconSize) || defaults.iconSize,
    iconPadding: Number(sAny.iconPadding) || defaults.iconPadding,
    gridColumns: Number(sAny.gridColumns) || defaults.gridColumns,
    textSize: Number(sAny.textSize) || defaults.textSize,
    marginMin: Number(sAny.marginMin) || defaults.marginMin,
    appIconRadius: Number(sAny.appIconRadius) || defaults.appIconRadius,
    theme: typeof sAny.theme === "string" ? sAny.theme : defaults.theme,
    newAppButtonLocation: (sAny.newAppButtonLocation === "titlebar" || sAny.newAppButtonLocation === "inline") ? sAny.newAppButtonLocation : defaults.newAppButtonLocation,
  };

  return coerced;
}

export async function saveSettings(settings: any) {
  const s = await getStore();
  console.log("💾 Saving settings:", settings);
  await s.set("ui-settings", settings);
  await s.save();
  console.log("✅ Saved settings to disk.");
}

export async function loadCustomApps(): Promise<any[]> {
  const s = await getStore();
  const customApps: any = await s.get("custom-apps");
  console.log("📥 Loaded custom apps from disk:", customApps);
  
  if (!customApps || !Array.isArray(customApps)) {
    return [];
  }
  
  return customApps;
}

export async function saveCustomApps(apps: any[]) {
  const s = await getStore();
  console.log("💾 Saving custom apps:", apps);
  await s.set("custom-apps", apps);
  await s.save();
  console.log("✅ Saved custom apps to disk.");
}

// Icon data storage - maps app Target to icon data URL
export async function saveIconData(target: string, iconDataUrl: string) {
  const s = await getStore();
  const iconData: any = await s.get("icon-data") || {};
  iconData[target] = iconDataUrl;
  await s.set("icon-data", iconData);
  await s.save();
  console.log("💾 Saved icon data for:", target);
}

export async function loadIconData(target: string): Promise<string | null> {
  const s = await getStore();
  const iconData: any = await s.get("icon-data") || {};
  return iconData[target] || null;
}

export async function loadAllIconData(): Promise<Record<string, string>> {
  const s = await getStore();
  const iconData: any = await s.get("icon-data") || {};
  return iconData;
}

export async function loadSelectedUser(): Promise<string | null> {
  const s = await getStore();
  const userId: any = await s.get("selected-user-id");
  console.log("📥 Loaded selected user ID from disk:", userId);
  
  if (typeof userId !== "string") {
    return null;
  }
  
  return userId;
}

export async function saveSelectedUser(userId: string) {
  const s = await getStore();
  console.log("💾 Saving selected user ID:", userId);
  await s.set("selected-user-id", userId);
  await s.save();
  console.log("✅ Saved selected user ID to disk.");
}

export async function loadSettingsFromUser(userSettings: string | null | undefined): Promise<any> {
  const defaults = {
    iconSize: 256,
    iconPadding: 16,
    gridColumns: 4,
    textSize: 18,
    marginMin: 24,
    appIconRadius: 16,
    theme: "light",
    newAppButtonLocation: "inline" as const,
  };

  if (!userSettings || typeof userSettings !== "string") {
    console.log("📥 No user settings found, using defaults");
    return defaults;
  }

  try {
    const parsed = JSON.parse(userSettings);
    console.log("📥 Loaded settings from user record:", parsed);
    
    // Validate and coerce values
    const coerced = {
      iconSize: Number(parsed.iconSize) || defaults.iconSize,
      iconPadding: Number(parsed.iconPadding) || defaults.iconPadding,
      gridColumns: Number(parsed.gridColumns) || defaults.gridColumns,
      textSize: Number(parsed.textSize) || defaults.textSize,
      marginMin: Number(parsed.marginMin) || defaults.marginMin,
      appIconRadius: Number(parsed.appIconRadius) || defaults.appIconRadius,
      theme: typeof parsed.theme === "string" ? parsed.theme : defaults.theme,
      newAppButtonLocation: (parsed.newAppButtonLocation === "titlebar" || parsed.newAppButtonLocation === "inline") ? parsed.newAppButtonLocation : defaults.newAppButtonLocation,
    };
    
    return coerced;
  } catch (e) {
    console.error("Failed to parse user settings:", e);
    return defaults;
  }
}

interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function loadWindowState(): Promise<WindowState | null> {
  const s = await getStore();
  const state: any = await s.get("window-state");
  
  if (!state || typeof state !== "object") {
    return null;
  }
  
  // Validate the window state has required properties
  if (typeof state.x !== "number" || typeof state.y !== "number" || 
      typeof state.width !== "number" || typeof state.height !== "number") {
    return null;
  }
  
  return {
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
  };
}

export async function saveWindowState(state: WindowState) {
  const s = await getStore();
  await s.set("window-state", state);
  await s.save();
}

// ============================================================================
// Airtable API Functions
// ============================================================================

interface AirtableApp {
  Name: string;
  Type: string; // "mac app", "web", "win app", "chrome"
  Target: string;
  Enabled: boolean;
  Icon?: string; // base64 data URL for icons
  IconB64?: string; // base64 data for icon storage in Long Text field
  Ownership: "Global" | "Public" | "Private";
  Owner: string[]; // Array of user record IDs
  Parent?: string[];
}

/**
 * Create a new app in Airtable
 * @param app App data
 * @param userId Current user's Airtable record ID
 * @returns Created app record from Airtable
 */
export async function createAirtableApp(app: AirtableApp, userId: string): Promise<any> {
  console.log("📤 Creating app in Airtable:", app.Name);
  console.log("   Base ID:", AIRTABLE_BASE_ID);
  console.log("   Table ID:", AIRTABLE_APPS_TABLE_ID);
  console.log("   User ID:", userId);
  
  const typeChoiceId = TYPE_IDS[app.Type as keyof typeof TYPE_IDS] || TYPE_IDS["mac app"];
  const ownershipChoiceId = OWNERSHIP_IDS[app.Ownership] || OWNERSHIP_IDS.Private;
  
  console.log("   Type:", app.Type, "→", typeChoiceId);
  console.log("   Ownership:", app.Ownership, "→", ownershipChoiceId);
  
  const fields: any = {
    [FIELD_IDS.Name]: app.Name,
    [FIELD_IDS.Type]: typeChoiceId,
    [FIELD_IDS.Target]: app.Target,
    [FIELD_IDS.Enabled]: app.Enabled,
    [FIELD_IDS.Ownership]: ownershipChoiceId,
    [FIELD_IDS.Owner]: [userId],
  };
  
  // Store base64 icon data in IconB64 Long Text field
  if (app.Icon && app.Icon.length > 0) {
    console.log("   Storing icon in IconB64 field (length:", app.Icon.length, "chars)");
    fields[FIELD_IDS.IconB64] = app.Icon;
  }

  if (app.Parent && app.Parent.length > 0) {
    fields[FIELD_IDS.Parent] = app.Parent;
  }
  
  try {
    const response = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_APPS_TABLE_ID}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fields }),
      }
    );
    
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: response.statusText };
      }
      console.error("❌ Airtable create failed:", response.status, errorData);
      console.error("   Request body was:", JSON.stringify({ fields }, null, 2));
      throw new Error(`Failed to create app in Airtable: ${response.status} ${JSON.stringify(errorData)}`);
    }
    
    const data = await response.json();
    console.log("✅ App created in Airtable:", data);
    return data;
  } catch (error) {
    console.error("❌ Error creating app in Airtable:", error);
    throw error;
  }
}

/**
 * Update an existing app in Airtable
 * @param recordId Airtable record ID
 * @param updates Fields to update
 * @returns Updated app record from Airtable
 */
export async function updateAirtableApp(recordId: string, updates: Partial<AirtableApp>): Promise<any> {
  console.log("📤 Updating app in Airtable:", recordId);
  
  const fields: any = {};
  
  if (updates.Name !== undefined) {
    fields[FIELD_IDS.Name] = updates.Name;
  }
  if (updates.Type !== undefined) {
    fields[FIELD_IDS.Type] = TYPE_IDS[updates.Type as keyof typeof TYPE_IDS] || TYPE_IDS["mac app"];
  }
  if (updates.Target !== undefined) {
    fields[FIELD_IDS.Target] = updates.Target;
  }
  if (updates.Enabled !== undefined) {
    fields[FIELD_IDS.Enabled] = updates.Enabled;
  }
  if (updates.Ownership !== undefined) {
    fields[FIELD_IDS.Ownership] = OWNERSHIP_IDS[updates.Ownership] || OWNERSHIP_IDS.Private;
  }
  if (updates.Owner !== undefined) {
    fields[FIELD_IDS.Owner] = updates.Owner;
  }
  if (updates.Icon !== undefined) {
    fields[FIELD_IDS.Icon] = [{
      url: updates.Icon
    }];
  }
  if (updates.IconB64 !== undefined) {
    fields[FIELD_IDS.IconB64] = updates.IconB64;
  }
  if (updates.Parent !== undefined) {
    fields[FIELD_IDS.Parent] = updates.Parent;
  }
  
  try {
    const response = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_APPS_TABLE_ID}/${recordId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fields }),
      }
    );
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ Airtable update failed:", errorData);
      throw new Error(`Failed to update app in Airtable: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log("✅ App updated in Airtable:", data);
    return data;
  } catch (error) {
    console.error("❌ Error updating app in Airtable:", error);
    throw error;
  }
}

/**
 * Delete an app from Airtable
 * @param recordId Airtable record ID
 */
export async function deleteAirtableApp(recordId: string): Promise<void> {
  console.log("🗑️ Deleting app from Airtable:", recordId);
  
  try {
    const response = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_APPS_TABLE_ID}/${recordId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        },
      }
    );
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ Airtable delete failed:", errorData);
      throw new Error(`Failed to delete app from Airtable: ${response.statusText}`);
    }
    
    console.log("✅ App deleted from Airtable");
  } catch (error) {
    console.error("❌ Error deleting app from Airtable:", error);
    throw error;
  }
}

/**
 * Hide a Global app for a specific user by adding the app to the user's HideGlobal field
 * @param appRecordId Airtable record ID of the app
 * @param userId Airtable record ID of the user
 */
export async function hideGlobalApp(appRecordId: string, userId: string): Promise<void> {
  console.log("🙈 Hiding Global app:", appRecordId, "for user:", userId);
  
  try {
    // Get current user's HideGlobal array
    const getUserResponse = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/tblbpYp0Cza2JMKKR/${userId}`,
      {
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        },
      }
    );
    
    if (!getUserResponse.ok) {
      throw new Error(`Failed to fetch user: ${getUserResponse.statusText}`);
    }
    
    const userData = await getUserResponse.json();
    const currentHideGlobal = userData.fields.HideGlobal || [];
    
    // Add app if not already in the array
    if (!currentHideGlobal.includes(appRecordId)) {
      currentHideGlobal.push(appRecordId);
      
      const updateResponse = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/tblbpYp0Cza2JMKKR/${userId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${AIRTABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fields: {
              HideGlobal: currentHideGlobal,
            },
          }),
        }
      );
      
      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        console.error("❌ Failed to hide Global app:", errorData);
        throw new Error(`Failed to hide Global app: ${updateResponse.statusText}`);
      }
      
      console.log("✅ Global app hidden for user");
    } else {
      console.log("ℹ️ User already has this app hidden");
    }
  } catch (error) {
    console.error("❌ Error hiding Global app:", error);
    throw error;
  }
}

/**
 * Hide a Public app for a specific user by removing the app from the user's Public Apps field
 * @param appRecordId Airtable record ID of the app
 * @param userId Airtable record ID of the user
 */
export async function hidePublicApp(appRecordId: string, userId: string): Promise<void> {
  console.log("🙈 Hiding Public app:", appRecordId, "from user:", userId);
  
  try {
    // Get current user's Public Apps array
    const getUserResponse = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/tblbpYp0Cza2JMKKR/${userId}`,
      {
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        },
      }
    );
    
    if (!getUserResponse.ok) {
      throw new Error(`Failed to fetch user: ${getUserResponse.statusText}`);
    }
    
    const userData = await getUserResponse.json();
    const currentPublicApps = userData.fields.PublicApps || [];
    
    // Remove app from user's Public Apps array
    const updatedPublicApps = currentPublicApps.filter((id: string) => id !== appRecordId);
    
    if (updatedPublicApps.length !== currentPublicApps.length) {
      const updateResponse = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/tblbpYp0Cza2JMKKR/${userId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${AIRTABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fields: {
              PublicApps: updatedPublicApps,
            },
          }),
        }
      );
      
      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        console.error("❌ Failed to hide Public app:", errorData);
        throw new Error(`Failed to hide Public app: ${updateResponse.statusText}`);
      }
      
      console.log("✅ Public app hidden from user");
    } else {
      console.log("ℹ️ App was not in user's Public Apps list");
    }
  } catch (error) {
    console.error("❌ Error hiding Public app:", error);
    throw error;
  }
}

/**
 * Load app order for a user from the Airtable AppOrder field
 * AppOrder is stored as JSON array of app IDs in the order they should appear
 * @param userId Airtable record ID of the user
 * @returns Array of app IDs in order, or empty array if not set
 */
export async function loadAppOrder(userId: string): Promise<string[]> {
  console.log("📋 Loading app order for user:", userId);
  
  try {
    const response = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/tblbpYp0Cza2JMKKR/${userId}`,
      {
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch user: ${response.statusText}`);
    }
    
    const userData = await response.json();
    const appOrderJson = userData.fields.AppOrder;
    
    if (!appOrderJson || typeof appOrderJson !== "string") {
      console.log("ℹ️ No app order set for user, returning empty array");
      return [];
    }
    
    try {
      const appOrder = JSON.parse(appOrderJson);
      if (Array.isArray(appOrder)) {
        console.log("✅ Loaded app order:", appOrder);
        return appOrder;
      } else {
        console.warn("⚠️ App order is not an array, returning empty array");
        return [];
      }
    } catch (parseError) {
      console.error("❌ Failed to parse AppOrder JSON:", parseError);
      return [];
    }
  } catch (error) {
    console.error("❌ Error loading app order:", error);
    return [];
  }
}

/**
 * Save app order for a user to the Airtable AppOrder field
 * @param userId Airtable record ID of the user
 * @param appOrder Array of app IDs in order
 */
export async function saveAppOrder(userId: string, appOrder: string[]): Promise<void> {
  console.log("💾 Saving app order for user:", userId, "order:", appOrder);
  
  try {
    const appOrderJson = JSON.stringify(appOrder);
    
    const response = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/tblbpYp0Cza2JMKKR/${userId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fields: {
            AppOrder: appOrderJson,
          },
        }),
      }
    );
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ Failed to save app order:", errorData);
      throw new Error(`Failed to save app order: ${response.statusText}`);
    }
    
    console.log("✅ App order saved successfully");
  } catch (error) {
    console.error("❌ Error saving app order:", error);
    throw error;
  }
}
