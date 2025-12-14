# Parametizing UI Variables - Implementation Guide

This guide shows how to systematically parametize UI values by moving them from hardcoded values to CSS variables in the global and theme systems.

## Pattern 1: Spacing & Layout

### Before (Hardcoded)
```css
.container {
  padding: 24px;
  margin-top: 32px;
  gap: 16px;
}

.button {
  padding: 12px 24px;
  margin-right: 8px;
}
```

### After (Parametized)
In `global.css`:
```css
:root {
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 12px;
  --spacing-lg: 16px;
  --spacing-xl: 24px;
  --spacing-2xl: 32px;
}
```

In component:
```css
.container {
  padding: var(--spacing-xl);
  margin-top: var(--spacing-2xl);
  gap: var(--spacing-lg);
}

.button {
  padding: var(--spacing-md) var(--spacing-xl);
  margin-right: var(--spacing-sm);
}
```

## Pattern 2: Border Radius

### Before (Hardcoded)
```css
.card {
  border-radius: 8px;
}

.button {
  border-radius: 6px;
}

.icon {
  border-radius: 16px;
}
```

### After (Parametized)
In `global.css`:
```css
:root {
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
}
```

In component:
```css
.card {
  border-radius: var(--radius-md);
}

.button {
  border-radius: var(--radius-sm);
}

.icon {
  border-radius: var(--radius-xl);
}
```

## Pattern 3: Transitions & Animations

### Before (Hardcoded)
```css
.hover-element {
  transition: all 0.15s ease;
}

.modal {
  animation: slideIn 0.3s ease-out;
}

.delayed-effect {
  transition: opacity 0.35s ease-in-out;
}
```

### After (Parametized)
In `global.css`:
```css
:root {
  --transition-fast: 150ms ease-in-out;
  --transition-normal: 250ms ease-in-out;
  --transition-slow: 350ms ease-in-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

In component:
```css
.hover-element {
  transition: all var(--transition-fast);
}

.modal {
  animation: slideIn var(--transition-fast);
}

.delayed-effect {
  transition: opacity var(--transition-slow);
}
```

## Pattern 4: Z-Indexes

### Before (Hardcoded)
```css
.dropdown { z-index: 10; }
.modal { z-index: 100; }
.tooltip { z-index: 1000; }
.context-menu { z-index: 999; }
```

### After (Parametized)
In `global.css`:
```css
:root {
  --z-base: 0;
  --z-dropdown: 10;
  --z-sticky: 20;
  --z-modal-backdrop: 50;
  --z-modal: 100;
  --z-popover: 500;
  --z-tooltip: 1000;
}
```

In component:
```css
.dropdown { z-index: var(--z-dropdown); }
.modal { z-index: var(--z-modal); }
.tooltip { z-index: var(--z-tooltip); }
```

## Pattern 5: Typography

### Before (Hardcoded)
```css
h1 { font-size: 28px; font-weight: 700; }
h2 { font-size: 24px; font-weight: 700; }
.small-text { font-size: 12px; }
.label { font-size: 14px; font-weight: 600; }
```

### After (Parametized)
In `global.css`:
```css
:root {
  --font-family-primary: 'Nunito Sans', sans-serif;
  --font-weight-normal: 400;
  --font-weight-semi-bold: 600;
  --font-weight-bold: 700;
  
  --font-size-xs: 12px;
  --font-size-sm: 14px;
  --font-size-md: 16px;
  --font-size-lg: 20px;
  --font-size-xl: 24px;
  --font-size-2xl: 28px;
  
  --line-height-tight: 1.2;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.75;
}

h1 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
}

h2 {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
}

.small-text {
  font-size: var(--font-size-xs);
}

.label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semi-bold);
}
```

## Pattern 6: Box Shadows

### Before (Hardcoded)
```css
.card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.modal {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.button {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
```

### After (Parametized)
In `global.css`:
```css
:root {
  /* Shadows are defined in each theme, but are referenced here */
  /* See dark.css, light.css, norge.css */
}
```

In themes:
```css
/* dark.css */
:root {
  --shadow-small: 0 2px 8px rgba(0, 0, 0, 0.4);
  --shadow-medium: 0 2px 12px rgba(0, 0, 0, 0.5);
  --shadow-large: 0 8px 32px rgba(0, 0, 0, 0.7);
}

/* light.css */
:root {
  --shadow-small: 0 2px 8px rgba(0, 0, 0, 0.1);
  --shadow-medium: 0 2px 12px rgba(0, 0, 0, 0.15);
  --shadow-large: 0 8px 32px rgba(0, 0, 0, 0.3);
}
```

In component:
```css
.card:hover {
  box-shadow: var(--shadow-medium);
}

.modal {
  box-shadow: var(--shadow-large);
}

.button {
  box-shadow: var(--shadow-small);
}
```

## Recommended Workflow for Complete Parametization

### Step 1: Audit the Codebase
Search for hardcoded values:
```bash
grep -r "[0-9]\+px" src/
grep -r "[0-9]\+ms" src/
grep -r "rgba\|rgb\|#[0-9a-f]" src/
```

### Step 2: Categorize Values
Group similar values and identify scale:
- Spacing: 4px, 8px, 12px, 16px, 24px, 32px...
- Border radius: 4px, 6px, 8px, 12px, 16px...
- Transitions: 150ms, 250ms, 350ms...

### Step 3: Add to Global
Add new variables to `:root` in `global.css`:
```css
:root {
  --new-category-small: value;
  --new-category-medium: value;
  --new-category-large: value;
}
```

### Step 4: Update Components
Replace hardcoded values with variables:
```css
/* Before */
padding: 16px;

/* After */
padding: var(--spacing-lg);
```

### Step 5: Override in Themes (if needed)
If a value should differ by theme:
```css
/* In dark.css */
:root {
  --my-variable: dark-value;
}

/* In light.css */
:root {
  --my-variable: light-value;
}
```

## Benefits of This Approach

✅ **Consistency**: Same values used everywhere  
✅ **Maintainability**: Change once, affects all occurrences  
✅ **Scalability**: Easy to add new variations  
✅ **Theme Support**: Different values per theme  
✅ **Design System**: Foundation for future updates  
✅ **Developer Experience**: Clear naming conventions  

## Naming Conventions

Use descriptive, hierarchical names:
```css
/* ✅ Good */
--spacing-sm
--border-radius-lg
--transition-normal
--z-modal
--shadow-medium
--font-size-xl

/* ❌ Avoid */
--s (too vague)
--radius-2 (not semantic)
--trans (unclear)
--z-10 (not named)
--box-sh (abbreviated)
--fs-20 (unclear units)
```

## File Organization

```
static/themes/
├── global.css          ← All theme-independent values
├── dark.css            ← Theme-specific overrides (dark)
├── light.css           ← Theme-specific overrides (light)
└── norge.css           ← Theme-specific overrides (norge)
```

## Next Actions

1. Identify all remaining hardcoded values in components
2. Add new CSS variable categories to `global.css`
3. Update components to use variables
4. Update themes if values should vary
5. Document new variables in this guide

---

**Remember**: The goal is to make all visual design decisions configurable through CSS variables, enabling:
- Easy theme creation
- Consistent design system
- Reduced component styling complexity
- Better maintainability
