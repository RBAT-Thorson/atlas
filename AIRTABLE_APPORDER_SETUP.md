# Airtable Configuration - App Reordering

## Field Setup Required

### User Table - New Field

**Field Name**: `AppOrder`  
**Field Type**: `Long text`  
**Description**: JSON array of app record IDs in the order they should appear for this user

### Field Configuration

```
Field Name: AppOrder
Field Type: Long text
Required: No (optional)
Unique: No
Description: "Store app display order as JSON array of app IDs"
```

### Example Field Values

**User 1 (Alice)**
```json
["recXXX001", "recXXX002", "recXXX003", "recXXX004"]
```

**User 2 (Bob)**
```json
["recXXX003", "recXXX001", "recXXX004", "recXXX002"]
```

**User 3 (Charlie) - No custom order yet**
```
(empty)
```

## How It Works in Airtable

1. **Create the field** in the User table as described above
2. **Leave it empty initially** - new users start with default order
3. **Atlas app populates it** when user reorders apps
4. **Store returns JSON** when querying the field
5. **Apps sync automatically** when user switches profiles

## Field Content Format

### Valid AppOrder Values

```json
[]                              // Empty (use default order)
["recABC123"]                   // Single app
["recABC123", "recDEF456"]      // Multiple apps
["recABC123", "recDEF456", "recGHI789", "recJKL012"]  // Full list
```

### Invalid Formats (won't work)

```json
"recABC123"              // String instead of array
[123, 456]               // Numbers instead of strings
{"1": "recABC123"}       // Object instead of array
"["recABC123"]"          // Double-encoded JSON
```

## Data Integrity

- **Atlas validates** that AppOrder is valid JSON before saving
- **Missing apps** (not in current list) are ignored
- **New apps** added to user's workspace appear at end if not in order
- **Deleted apps** automatically removed from order
- **No duplicate IDs** in order array

## API Calls

### Load Order
```
GET /v0/{BASE_ID}/tblbpYp0Cza2JMKKR/{USER_ID}
Header: Authorization: Bearer {API_TOKEN}

Response:
{
  "fields": {
    "AppOrder": "[\"recXXX001\", \"recXXX002\"]"
  }
}
```

### Save Order
```
PATCH /v0/{BASE_ID}/tblbpYp0Cza2JMKKR/{USER_ID}
Header: Authorization: Bearer {API_TOKEN}
Content-Type: application/json

Body:
{
  "fields": {
    "AppOrder": "[\"recXXX001\", \"recXXX002\", \"recXXX003\"]"
  }
}
```

## Backup & Migration

If you need to back up app orders:
1. Export User table as CSV
2. AppOrder column contains JSON arrays
3. To restore: Import CSV and update AppOrder field

Example backup CSV row:
```
Name,Email,AppOrder
Alice,alice@example.com,"[""recXXX001"", ""recXXX002""]"
Bob,bob@example.com,"[""recXXX003"", ""recXXX001""]"
```

## Performance Notes

- Field queries are fast (text search not indexed, but single record is instant)
- JSON parsing happens client-side (minimal server load)
- Updates are immediate (no need for refresh)
- No additional API credits used (within normal Airtable limits)

## Compatibility

- Works with existing global, public, and private app structures
- Doesn't affect existing user settings or preferences
- Can coexist with other user data (UserSettings, HideGlobal, PublicApps, etc.)
- Backwards compatible: Users without AppOrder get default order
