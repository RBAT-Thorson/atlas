# Global CSS Integration - Setup Complete ✅

## Overview
A new `global.css` file has been created in `/static/themes/` to centralize all theme-independent CSS variables and base styles. This separates structural/layout concerns from theme-specific concerns.

## File Structure

### `/static/themes/`
```
global.css     ← New: Theme-independent styles (loaded once)
dark.css       ← Theme variables only (dark mode)
light.css      ← Theme variables only (light mode)
norge.css      ← Theme variables only (Norge theme)
```

## What's in `global.css`?

### 1. **CSS Custom Properties (Variables)**
- **Typography**: Font family, weights (400, 700, 900)
- **Spacing Scale**: xs (4px), sm (8px), md (12px), lg (16px), xl (24px), 2xl (32px)
- **Border Radius**: sm, md, lg, xl, full
- **Z-indexes**: base, dropdown, modal, tooltip
- **Transitions**: fast (150ms), normal (250ms), slow (350ms)

### 2. **Base Element Styles**
- Universal reset (`*`)
- HTML/Body styling (font family, background, color)
- Heading hierarchy (h1-h6)
- Paragraph defaults

### 3. **Form & Input Styling**
- Base button, input, select, textarea reset
- Text input focus/hover states (using theme variables)
- Checkbox cursor handling
- Select element styling with custom arrow

### 4. **Global Elements**
- Links (color from theme variables)
- Scrollbars (WebKit based on theme colors)
- Selection/highlight (accent color)
- Cards & containers (base structure)
- Shadow utilities

### 5. **Accessibility & Utility**
- Screen reader only text (`.sr-only`)
- Focus visible states
- Disabled element states
- Shadow utilities (sm, md, lg)

## How It Works

### Load Order
1. **`app.html`** preloads `global.css` statically
   - This ensures base styles are available immediately
   
2. **`+page.svelte`** dynamically loads theme CSS
   - Global CSS is loaded only once (checks for `#global-css` ID)
   - Theme CSS is replaced when user switches themes
   - Both cascade properly (global first, then theme overrides)

### The `loadTheme()` Function
```javascript
function loadTheme(themeName: string) {
  // Load global.css once
  if (!document.getElementById('global-css')) {
    const globalLink = document.createElement('link');
    globalLink.id = 'global-css';
    globalLink.rel = 'stylesheet';
    globalLink.href = '/themes/global.css';
    document.head.appendChild(globalLink);
  }

  // Remove old theme CSS
  const existingLink = document.getElementById('theme-css');
  if (existingLink) existingLink.remove();

  // Load new theme CSS
  const link = document.createElement('link');
  link.id = 'theme-css';
  link.rel = 'stylesheet';
  link.href = `/themes/${themeName}.css`;
  document.head.appendChild(link);
}
```

## Theme Variables (in `dark.css`, `light.css`, `norge.css`)

Each theme file defines:
- Background colors (window-bg, window-bg-light, card-bg, etc.)
- Text colors (text-primary, text-secondary, text-muted)
- Border colors (border-color, border-light, border-hover)
- Accent colors (accent-color, accent-hover)
- Status colors (success, error, with variants)
- Shadows (shadow-small, shadow-medium, shadow-large)

## Usage in Svelte Components

### In CSS:
```css
/* Variables automatically available from global + active theme */
background-color: var(--window-bg);
color: var(--text-primary);
border: 1px solid var(--border-color);
padding: var(--spacing-lg);
border-radius: var(--radius-md);
transition: all var(--transition-normal);
```

### In Inline Styles:
```svelte
<div style="
  background: var(--card-bg);
  padding: var(--spacing-md);
">
  Content
</div>
```

## Benefits

✅ **DRY Principle**: Spacing, typography, and structure defined once  
✅ **Theme Flexibility**: Easy to add new themes - just define variables  
✅ **Maintainability**: Changes to spacing/radius apply globally  
✅ **Performance**: CSS variables enable dynamic theming without reloads  
✅ **Scalability**: Foundation for parametizing ALL UI values  

## Next Steps

To add more parametized UI variables:

1. **Define in `global.css`** under `:root`
   ```css
   :root {
     --my-new-var: value;
   }
   ```

2. **Override in themes** if needed:
   ```css
   /* In dark.css, light.css, norge.css */
   :root {
     --my-new-var: different-value;
   }
   ```

3. **Use in components**:
   ```css
   .my-element {
     property: var(--my-new-var);
   }
   ```

## Files Modified

- ✅ Created `/static/themes/global.css` - New theme-independent stylesheet
- ✅ Updated `/src/app.html` - Added `<link>` to load global.css
- ✅ Updated `/src/routes/+page.svelte` - Modified `loadTheme()` to handle global.css

## Verification

All files are in place and integrated:
- `global.css` loaded statically in HTML
- Dynamic theme loading updated to check for and maintain global CSS
- Theme cascade working: global → theme-specific
