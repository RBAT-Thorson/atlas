# App Reordering Implementation - Complete ✅

## Overview
Apps can now be reordered via drag-and-drop. The order is saved per-user in Airtable's `AppOrder` field and synced across all devices.

## How It Works

### 1. **Data Storage Format**
- **Field**: `AppOrder` (long text field in User table)
- **Format**: JSON array of app IDs in order
  ```json
  ["rec123abc", "rec456def", "rec789ghi"]
  ```
- **Index = Position**: Position 0 = first app, Position 1 = second, etc.

### 2. **Key Components Added**

#### Store Functions (`src/lib/store.ts`)
```typescript
loadAppOrder(userId)    // Load app order from Airtable
saveAppOrder(userId, appOrder)  // Save app order to Airtable
```

#### State Variables (`src/routes/+page.svelte`)
```typescript
appOrder: string[]              // Current user's app order
draggedAppId: string | null     // App being dragged
dragOverAppId: string | null    // App under cursor
```

#### Event Handlers
- `handleAppDragStart()` - Start dragging app
- `handleAppDragOver()` - Visual feedback when over target
- `handleAppDragLeave()` - Remove hover effect
- `handleAppDrop()` - Handle drop and save new order
- `handleAppDragEnd()` - Clean up drag state

### 3. **User Flow**

1. **User selects profile** → App order loaded from Airtable
2. **User drags app onto another** → Visual feedback shows drop zone
3. **User releases** → New order calculated and saved
4. **Order persists** → Saved to Airtable and synced to all devices

### 4. **Visual Feedback**

During drag:
- Dragged app: `opacity: 0.5`, `scale: 0.9` (faded, smaller)
- Drop target: `border: 2px accent`, `scale: 1.08` (highlighted, larger)

### 5. **App Sorting Logic**

The reactive filter now:
1. Filters apps by search/visibility (unchanged)
2. Sorts by `appOrder` array:
   - Apps in order appear first (sorted by position)
   - Apps not in order appear after
   - Maintains relative order for unordered apps

```typescript
$: {
  let filtered = apps.filter(...);  // Existing filter logic
  
  // Sort by appOrder if available
  if (appOrder && appOrder.length > 0) {
    filtered.sort((a, b) => {
      const indexA = appOrder.indexOf(a.id);
      const indexB = appOrder.indexOf(b.id);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return 0;
    });
  }
  
  filteredApps = filtered;
}
```

### 6. **Loading App Order**

When a user is selected:
1. Settings are loaded from Airtable
2. `appOrder = await loadAppOrder(userId)` - App order fetched
3. Apps are refreshed and automatically sorted by order

### 7. **Saving App Order**

When user reorders apps:
1. New order array calculated from drag position
2. `await saveAppOrder(selectedUserId, newOrder)` - Saved to Airtable
3. Local `appOrder` state updated
4. Reactive sorting takes effect
5. Success message shown (auto-clears in 2 seconds)

## Implementation Details

### Drag Events Handling
```typescript
draggable="true"                           // Enable native drag
on:dragstart={(e) => handleAppDragStart(e, app.id)}
on:dragover={(e) => handleAppDragOver(e, app.id)}
on:dragleave={handleAppDragLeave}
on:drop={(e) => handleAppDrop(e, app.id)}
on:dragend={handleAppDragEnd}
```

### CSS Classes
```css
.icon-wrapper.dragging       /* Faded, scaled down */
.icon-wrapper.drag-over      /* Highlighted, scale up */
```

## Per-User Behavior

✅ **Different users can have different app orders**
- User A: [AppX, AppY, AppZ]
- User B: [AppZ, AppX, AppY]

✅ **Global/Public apps have different positions per user**
- Global app in position 3 for User A
- Same global app in position 1 for User B

✅ **Order syncs across devices**
- User A reorders on Device 1
- User A switches to Device 2
- App order reflects changes from Device 1

## Edge Cases Handled

1. **New user** → No AppOrder set → Apps display in default order
2. **App deleted** → Removed from order, other apps maintain positions
3. **App added** → Not in appOrder initially, appears after ordered apps
4. **App hidden** → Removed from view via existing filter logic
5. **App unhidden** → Maintains position from appOrder

## Files Modified

- ✅ `/src/lib/store.ts` - Added `loadAppOrder()` and `saveAppOrder()`
- ✅ `/src/routes/+page.svelte` - Added drag handlers, sorting logic, UI feedback

## Testing Checklist

- [ ] Drag app within grid
- [ ] Drop app on another app
- [ ] Verify new order displayed
- [ ] Switch user and verify app order changes
- [ ] Refresh page and verify order persists
- [ ] Switch devices and verify order syncs
- [ ] Add new app and verify it appears at end
- [ ] Hide and unhide app, verify position maintained

## Future Enhancements

- Save to local storage for offline reordering, then sync
- Show visual insertion point line between apps
- Handle touch/mobile drag-and-drop
- Undo/redo for reordering
- Reorder within sections (Global, Public, Private)
