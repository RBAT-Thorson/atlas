use serde::{Deserialize, Serialize, Deserializer, Serializer};
use std::{fs, path::PathBuf};
use directories::ProjectDirs;
use reqwest::blocking::Client;

const AIRTABLE_BASE: &str = "appL7Lq4VPcHgAewL";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Attachment {
    pub url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SingleSelectField {
    pub id: String,
    pub name: String,
}

/// Custom deserializer that handles both string and object for Type field
fn deserialize_type_field<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
where
    D: Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum TypeField {
        String(String),
        Object(SingleSelectField),
    }
    
    match Option::<TypeField>::deserialize(deserializer)? {
        None => Ok(None),
        Some(TypeField::String(s)) => Ok(Some(s)),
        Some(TypeField::Object(obj)) => Ok(Some(obj.name)),
    }
}

/// Custom deserializer for Ownership single-select field
fn deserialize_ownership_field<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
where
    D: Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum OwnershipField {
        String(String),
        Object(SingleSelectField),
    }
    
    match Option::<OwnershipField>::deserialize(deserializer)? {
        None => Ok(None),
        Some(OwnershipField::String(s)) => Ok(Some(s)),
        Some(OwnershipField::Object(obj)) => Ok(Some(obj.name)),
    }
}

#[allow(non_snake_case)]
#[derive(Debug, Deserialize, Clone)]
pub struct AppRecord {
    pub id: Option<String>, // Airtable record ID
    pub Name: Option<String>,
    pub Enabled: Option<bool>,
    #[serde(rename = "Type", deserialize_with = "deserialize_type_field")]
    pub type_field: Option<String>,
    pub Target: Option<String>,
    pub Icon: Option<Vec<Attachment>>,
    pub Owner: Option<Vec<String>>, // Link to Users table (array of record IDs)
    #[serde(rename = "Ownership", deserialize_with = "deserialize_ownership_field")]
    pub ownership: Option<String>, // Single-select: "Global", "Public", or "Private"
    pub IconB64: Option<String>, // Base64 encoded icon data
    pub HideFrom: Option<Vec<String>>, // Users who should not see this app
    pub PublicUsers: Option<Vec<String>>, // Users with public access to this app
    pub Parent: Option<Vec<String>>, // Link to parent app (array with single record ID)
    pub Children: Option<Vec<String>>, // Link to child apps (array of record IDs)
}

impl Serialize for AppRecord {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut state = serializer.serialize_struct("AppRecord", 13)?;
        state.serialize_field("id", &self.id)?;
        state.serialize_field("Name", &self.Name)?;
        state.serialize_field("Enabled", &self.Enabled)?;
        state.serialize_field("type_field", &self.type_field)?;
        state.serialize_field("Target", &self.Target)?;
        state.serialize_field("Icon", &self.Icon)?;
        state.serialize_field("owner", &self.Owner)?;
        state.serialize_field("ownership", &self.ownership)?;
        state.serialize_field("IconB64", &self.IconB64)?;
        state.serialize_field("HideFrom", &self.HideFrom)?;
        state.serialize_field("PublicUsers", &self.PublicUsers)?;
        state.serialize_field("Parent", &self.Parent)?;
        state.serialize_field("Children", &self.Children)?;
        state.end()
    }
}

/// User record from Airtable Users table (for sending to frontend)
#[allow(non_snake_case)]
#[derive(Debug, Serialize, Clone)]
pub struct UserRecord {
    pub id: String, // Airtable record ID
    pub Name: Option<String>,
    pub OwnedApps: Option<Vec<String>>, // Link to Apps table (array of record IDs) - apps they OWN
    pub PublicApps: Option<Vec<String>>, // Public apps they've added to their launcher
    pub UserSettings: Option<String>, // JSON string of user settings
    pub HideGlobal: Option<Vec<String>>, // Global apps hidden by this user
}

/// User fields from Airtable (for deserializing from API)
#[allow(non_snake_case)]
#[derive(Debug, Deserialize)]
struct UserFields {
    pub Name: Option<String>,
    pub OwnedApps: Option<Vec<String>>,
    pub PublicApps: Option<Vec<String>>,
    pub UserSettings: Option<String>, // JSON string of user settings
    pub HideGlobal: Option<Vec<String>>, // Global apps hidden by this user
}

/// Response wrapper for Airtable API
#[derive(Debug, Deserialize)]
struct AirtableResponse<T> {
    records: Vec<AirtableRecord<T>>,
}

#[derive(Debug, Deserialize)]
struct AirtableRecord<T> {
    id: String,
    fields: T,
}

/// Wrapper for creating a new user record
#[allow(non_snake_case)]
#[derive(Debug, Serialize)]
struct CreateUserFields {
    pub Name: String,
}

pub fn fetch_and_cache_apps(api_key: &str) -> anyhow::Result<Vec<AppRecord>> {
    let client = Client::new();
    let url = format!("https://api.airtable.com/v0/{}/Apps", AIRTABLE_BASE);

    let resp = client
        .get(&url)
        .bearer_auth(api_key)
        .send()?
        .error_for_status()?
        .json::<serde_json::Value>()?;

    let records: Vec<AppRecord> = resp["records"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|r| {
            let mut app_record: AppRecord = serde_json::from_value(r["fields"].clone()).ok()?;
            app_record.id = r["id"].as_str().map(|s| s.to_string());
            Some(app_record)
        })
        .collect();

    // cache locally
    let dirs = ProjectDirs::from("com", "Laminar", "Atlas").unwrap();
    let cache_path: PathBuf = dirs.cache_dir().join("apps.json");
    fs::create_dir_all(cache_path.parent().unwrap())?;
    fs::write(&cache_path, serde_json::to_string_pretty(&records)?)?;

    Ok(records)
}

pub fn fetch_users(api_key: &str) -> anyhow::Result<Vec<UserRecord>> {
    let client = Client::new();
    let url = format!("https://api.airtable.com/v0/{}/Users", AIRTABLE_BASE);

    let resp = client
        .get(&url)
        .bearer_auth(api_key)
        .send()?
        .error_for_status()?
        .json::<AirtableResponse<UserFields>>()?;

    let users: Vec<UserRecord> = resp.records
        .into_iter()
        .map(|record| {
            UserRecord {
                id: record.id,
                Name: record.fields.Name,
                OwnedApps: record.fields.OwnedApps,
                PublicApps: record.fields.PublicApps,
                UserSettings: record.fields.UserSettings,
                HideGlobal: record.fields.HideGlobal,
            }
        })
        .collect();

    Ok(users)
}

pub fn create_user(name: String, api_key: &str) -> anyhow::Result<UserRecord> {
    let client = Client::new();
    let url = format!("https://api.airtable.com/v0/{}/Users", AIRTABLE_BASE);

    let fields = CreateUserFields { Name: name };
    
    #[derive(Serialize)]
    struct CreateUserRequest {
        fields: CreateUserFields,
    }
    
    let request = CreateUserRequest { fields };

    let resp = client
        .post(&url)
        .bearer_auth(api_key)
        .json(&request)
        .send()?
        .error_for_status()?
        .json::<AirtableRecord<UserFields>>()?;

    let user = UserRecord {
        id: resp.id,
        Name: resp.fields.Name,
        OwnedApps: resp.fields.OwnedApps,
        PublicApps: resp.fields.PublicApps,
        UserSettings: resp.fields.UserSettings,
        HideGlobal: resp.fields.HideGlobal,
    };

    Ok(user)
}

pub fn update_user_settings(user_id: String, settings_json: String, api_key: &str) -> anyhow::Result<()> {
    let client = Client::new();
    let url = format!("https://api.airtable.com/v0/{}/Users/{}", AIRTABLE_BASE, user_id);

    #[derive(Serialize)]
    struct UpdateSettingsFields {
        #[serde(rename = "UserSettings")]
        user_settings: String,
    }
    
    #[derive(Serialize)]
    struct UpdateSettingsRequest {
        fields: UpdateSettingsFields,
    }
    
    let request = UpdateSettingsRequest {
        fields: UpdateSettingsFields {
            user_settings: settings_json,
        },
    };

    client
        .patch(&url)
        .bearer_auth(api_key)
        .json(&request)
        .send()?
        .error_for_status()?;

    Ok(())
}
