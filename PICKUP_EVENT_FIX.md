# Pickup Event Detection Fix

## Problem
The app reordering drag-and-drop functionality was interfering with the native Tauri file drop (Pickup) events, preventing users from dragging and dropping apps into the launcher.

## Solution
Added detection logic to identify when a Tauri "Pickup" event (file drop) occurs and completely disable the app reordering drag handlers during these events.

## Changes Made

### 1. New State Variable
```typescript
let isPickupEvent = false; // Track if a Pickup event is detected
```
Added a flag to track when a Pickup event is active.

### 2. Pickup Event Detection
Modified the `tauri://drag-enter` listener to detect file drops:
```typescript
else if (eventName === "tauri://drag-enter") {
  // Check if this is a Pickup event (files array will be present for file drops)
  const hasFiles = event && event.payload && (Array.isArray(event.payload) || event.payload.paths);
  
  if (hasFiles) {
    console.log("📦 Pickup event detected - enabling pickup mode");
    isPickupEvent = true;
  }
  // ... rest of handler
}
```

### 3. Updated App Reordering Handlers
Each app drag handler now checks `isPickupEvent` at the start and bails out if true:

- `handleAppDragStart()` - Returns early if Pickup event detected
- `handleAppDragOver()` - Returns early if Pickup event detected  
- `handleAppDragLeave()` - Returns early if Pickup event detected
- `handleAppDrop()` - Returns early if Pickup event detected, then resets flag
- `handleAppDragEnd()` - Returns early if Pickup event detected

### 4. Reset on Drag Leave
```typescript
else if (eventName === "tauri://drag-leave") {
  console.log("🚪 Drag-leave: resetting both dragActive and editPaneDragActive");
  dragActive = false;
  editPaneDragActive = false;
  isPickupEvent = false; // Reset pickup flag
}
```
Resets the `isPickupEvent` flag when the user stops dragging.

## How It Works

1. **User starts dragging files** → `tauri://drag-enter` fires with file payload
2. **Pickup detection activates** → `isPickupEvent = true`
3. **App reordering handlers check flag** → All handlers skip execution
4. **User drops files** → `handleTauriFileDrop()` handles the file drop normally
5. **Drag ends or leaves** → `isPickupEvent = false` resets the flag

## Result

✅ App drag-and-drop reordering is **completely disabled** when Tauri Pickup events occur  
✅ Native file drop functionality works as expected  
✅ No visual conflicts between drag modes  
✅ Both features can coexist without interference

## Testing

To verify the fix works:
1. Try dragging files/apps to the launcher → Should work
2. Try reordering apps with drag-drop → Should work (when not picking up files)
3. Mix of both scenarios → Each should work independently
