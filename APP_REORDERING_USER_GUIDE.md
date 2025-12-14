# App Reordering - User Guide

## How to Reorder Apps

### Step 1: Click and Hold
Click and hold on any app icon you want to move.

### Step 2: Drag Over Target
Drag the app over the position where you want it to appear. You'll see:
- The dragged app becomes faded and smaller
- The target location highlights with a border and grows slightly

### Step 3: Release to Drop
Release the mouse button to drop the app in the new position.

### Step 4: Order is Saved
✅ The new order is automatically saved to your profile and synced across all your devices!

---

## Important Notes

- **Order is per-user**: Each person can have their own custom app order
- **Global apps included**: Even shared global apps can be reordered per user
- **Persistent**: Order is saved to Airtable and loads on every device
- **Auto-sorting**: Apps display in your custom order every time you launch
- **New apps**: When you add a new app, it appears at the end of your list

---

## Visual Cues During Reordering

| State | Visual |
|-------|--------|
| **Dragging** | App is faded (50% opacity), smaller (90% scale) |
| **Drop Target** | App has accent border, highlighted background, slightly larger (108% scale) |
| **Success** | Green checkmark notification shows "✅ Apps reordered" |

---

## Troubleshooting

**Q: My app order didn't save**
- A: Make sure you have a user profile selected (shows in footer)
- A: Check internet connection for Airtable sync

**Q: App went back to old order**
- A: Order is synced from Airtable when you load the app
- A: Try switching users and back to refresh

**Q: New app I added isn't in my custom order**
- A: New apps appear at the end by default
- A: Drag them to the position you want

---

## Airtable Storage

Your app order is stored in the User table:
- **Field**: `AppOrder`
- **Type**: Long Text
- **Format**: JSON array of app IDs
- **Example**: `["recABC123", "recDEF456", "recGHI789"]`

This ensures your order syncs across all devices automatically!
