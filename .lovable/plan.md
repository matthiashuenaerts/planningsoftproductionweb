

## Root Cause Found

The problem is **Radix UI's Select primitive internally injects a `<style>` tag** into the DOM that forces scrollbar hiding on the viewport:

```css
[data-radix-select-viewport] {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
[data-radix-select-viewport]::-webkit-scrollbar {
  display: none;
}
```

This is built into Radix's source code and cannot be removed by changing component props or classes. In the Lovable editor (which uses a sandboxed iframe), this behaves differently than in a standalone Chrome/Edge tab. The hidden scrollbar prevents native wheel scrolling from working properly in production browsers.

## Fix

### 1. Global CSS override in `src/index.css`

Add a high-specificity CSS rule that overrides Radix's injected styles, re-enabling native scrollbar and wheel scrolling on all select viewports:

```css
/* Override Radix UI's injected scrollbar-hiding on Select viewports */
[data-radix-select-viewport] {
  scrollbar-width: thin !important;
  -ms-overflow-style: auto !important;
  overflow-y: auto !important;
}
[data-radix-select-viewport]::-webkit-scrollbar {
  display: block !important;
  width: 6px;
}
[data-radix-select-viewport]::-webkit-scrollbar-thumb {
  background-color: hsl(var(--border));
  border-radius: 3px;
}
```

### 2. Simplify `src/components/ui/select.tsx`

Remove the conflicting `overflow-y-auto` and `max-h` from the Viewport className (since the global CSS now handles it), and keep the Content wrapper with `overflow-hidden` as Radix expects. The Viewport's scrolling is now controlled purely by the global CSS override.

### 3. No changes needed for DropdownMenu and ContextMenu

Those components use `DropdownMenuPrimitive.Content` / `ContextMenuPrimitive.Content` which already have `overflow-y-auto` and `max-h-[80vh]` and do not suffer from the same injected-style problem. The Select is the only Radix primitive that injects scrollbar-hiding styles.

This is a two-file change (index.css + select.tsx) that fixes the problem globally for every Select dropdown in the app.

