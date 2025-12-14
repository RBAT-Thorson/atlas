# Icon Extraction Technical Documentation

## Overview
Atlas extracts and displays icons from macOS `.app` bundles by parsing `.icns` files and extracting embedded PNG data.

## The Complete Pipeline

### 1. **User Drops .app File**
- **File**: `src/routes/+page.svelte` → `handleTauriFileDrop()`
- Tauri's file drop event captures the `.app` bundle path
- Example: `/Applications/Phone.app`

### 2. **Extract App Info (Rust)**
- **File**: `src-tauri/src/lib.rs` → `get_app_info()`
- Receives the `.app` bundle path
- Looks inside `Contents/Resources/` for `.icns` files
- Returns JSON with app name, target path, and icon path
- Example output:
  ```json
  {
    "name": "Phone",
    "target": "/System/Applications/Phone.app",
    "icon": "/System/Applications/Phone.app/Contents/Resources/AppIcon.icns"
  }
  ```

### 3. **Load Icon as Base64 (Rust)**
- **File**: `src-tauri/src/lib.rs` → `load_icon_base64()`
- Reads the `.icns` file from disk as raw bytes
- Encodes to base64 string
- Returns data URL: `data:application/octet-stream;base64,aWNucw...`
- **Important**: Uses MIME type `application/octet-stream` for `.icns` files (not `image/png`)

### 4. **Extract PNG from .icns Container (JavaScript)**
- **File**: `src/routes/+page.svelte` → `loadIconDataUrl()`
- Detects `.icns` file extension
- Converts base64 data URL back to ArrayBuffer
- Calls `extractPngFromIcnsBuffer()`

### 5. **Parse .icns Binary Format**
- **File**: `src/routes/+page.svelte` → `extractPngFromIcnsBuffer()`

#### .icns File Structure
```
Byte 0-3:   Magic number (0x69636e73 = "icns")
Byte 4-7:   File size (big-endian)
Byte 8+:    Chunks containing image data
```

#### Critical Fix: Magic Number
- **Correct**: `0x69636e73`
  - 'i' = 0x69
  - 'c' = 0x63
  - 'n' = 0x6e ← This was wrong in original code
  - 's' = 0x73
- **Wrong**: `0x69637873` (had 'x' instead of 'n')

#### Chunk Structure
Each chunk has:
```
Byte 0-3:   Chunk type (4-char code like "ic09", "ic08", etc.)
Byte 4-7:   Chunk size including header (big-endian)
Byte 8+:    Chunk data
```

#### Target Chunk Types
We search for these chunk types that typically contain PNG data:
- `ic09` - 512x512 PNG
- `ic08` - 256x256 PNG  
- `ic07` - 128x128 PNG
- `ic06` - 64x64 PNG
- `it32` - 128x128 PNG (older format)

#### PNG Detection
Within each target chunk, we check for PNG magic bytes:
```javascript
// PNG magic: 0x89 0x50 0x4E 0x47
if (chunkData[0] === 0x89 && chunkData[1] === 0x50 && 
    chunkData[2] === 0x4E && chunkData[3] === 0x47)
```

### 6. **Convert PNG to Data URL**
- Extract the PNG bytes from the chunk
- Create a Blob with MIME type `image/png`
- Use FileReader to convert Blob to data URL
- Returns: `data:image/png;base64,iVBORw0KG...`

### 7. **Cache and Store**
- **File**: `src/routes/+page.svelte` → `iconCache` Map
- Cache the PNG data URL (not the original .icns data)
- Store in app object as `iconDataUrl`
- Save to disk via `saveCustomApps()`

### 8. **Render Image**
- **File**: `src/routes/+page.svelte` → Image component
- Call `dataUrlToBlobUrl()` to convert data URL to blob URL for rendering
- Blob URLs are more efficient for `<img>` tags
- Example: `blob:http://localhost:1420/e2c6cbd2-42bd-46bf-9403-7adf2b7dce69`

## Key Dependencies

### Rust (Cargo.toml)
```toml
base64 = "0.22"  # For encoding binary files to base64
```

### JavaScript
- `atob()` - Decode base64 to binary
- `FileReader` - Convert Blob to data URL
- `URL.createObjectURL()` - Create blob URLs for rendering

## Common Issues & Solutions

### Issue 1: Invalid Magic Number
**Symptom**: `Not a valid .icns file (invalid magic number)`
**Cause**: Wrong hex value in magic number check
**Solution**: Use `0x69636e73` not `0x69637873`

### Issue 2: Image Won't Display
**Symptom**: Blob URL created but image fails to load
**Cause**: Wrong MIME type in Rust or no PNG found in .icns
**Solution**: 
- Ensure Rust returns `application/octet-stream` for .icns
- Verify PNG extraction finds valid PNG chunks
- Check console for "Found PNG in ic09 chunk" messages

### Issue 3: Icon Not Persisting
**Symptom**: Icon shows on add but disappears on restart
**Cause**: Blob URL not persisted (blob URLs are memory-only)
**Solution**: Always store data URLs, convert to blob URLs only for rendering

## File Locations

### Frontend
- `src/routes/+page.svelte` (lines 193-330)
  - `loadIconDataUrl()` - Main entry point
  - `extractPngFromIcnsBuffer()` - Binary parser
  - `dataUrlToBlobUrl()` - Rendering converter

### Backend
- `src-tauri/src/lib.rs` (lines 105-251)
  - `get_app_info()` - Find .icns in app bundle
  - `load_icon_base64()` - Load and encode file
  - Registered in `invoke_handler![]`

### Storage
- `~/Library/Application Support/com.mayerthorson.atlas/custom-apps.json`
  - Apps saved with `iconDataUrl` field containing PNG data URLs

## Testing

To verify the pipeline works:

1. **Check Rust command**: 
   ```
   Console: "📱 App info received: {name, target, icon}"
   ```

2. **Check base64 loading**:
   ```
   Console: "✅ Step 1 complete: Icon loaded, size: X chars"
   ```

3. **Check .icns detection**:
   ```
   Console: "🔄 Step 2: File is .icns, starting PNG extraction..."
   ```

4. **Check magic number**:
   ```
   Console: "Magic number: 69636e73 (expected: 69636e73)"
   ```

5. **Check PNG extraction**:
   ```
   Console: "✅ Found PNG in ic09 chunk at offset X"
   ```

6. **Check rendering**:
   ```
   Console: "✅ Image loaded successfully for [App Name]"
   ```

## Performance Notes

- Icons are cached in memory (`iconCache` Map) to avoid re-extraction
- Data URLs are stored to disk for persistence
- Blob URLs are created on-demand for rendering only
- Typical .icns file: 30-50KB
- Extracted PNG: 2-10KB
- Processing time: <100ms per icon

## Future Enhancements

- Support for Windows `.ico` files (multi-resolution)
- Support for Linux `.svg` icons
- Fallback to smaller PNG sizes if ic09/ic08 not found
- Icon preview before adding app
- Custom icon upload/selection
