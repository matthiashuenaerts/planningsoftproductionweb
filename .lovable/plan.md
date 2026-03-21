

# Fix PDF Annotation Alignment in Export/Download

## Problem

Annotations drawn in the editor appear shifted when viewed externally (downloaded PDF or via `generateAnnotatedPdf`). The red X annotation is visibly offset from its intended position.

## Root Cause

The editor (PDFViewerEditor) stores annotation positions as **percentages of the pdfjs viewport dimensions** (which accounts for page rotation and uses CropBox). The export code (both `downloadPDF` in PDFViewerEditor and `generateAnnotatedPdf` in the export service) converts those percentages back using **pdf-lib's `page.getSize()`**, which returns raw MediaBox dimensions **without rotation**.

For PDF pages with a `Rotate` entry (common for landscape documents stored as portrait with rotation=90), pdfjs swaps width/height, but pdf-lib does not. This causes percentages computed against (e.g.) 842×595 to be applied to 595×842, shifting all annotations.

## Plan

### 1. Create a shared utility function for effective page dimensions

Add a helper `getEffectivePageSize(page)` that:
- Gets raw dimensions from `page.getSize()`
- Gets rotation from `page.getRotation().angle`
- Swaps width/height for 90° and 270° rotation (matching pdfjs behavior)
- Returns `{ width, height, rotation }`

### 2. Create a coordinate transform function

Add `toNativeCoords(x, y, effWidth, effHeight, rawWidth, rawHeight, rotation)` that transforms display-space coordinates (top-down, rotation-applied) to native PDF coordinates (bottom-up, unrotated) for pdf-lib drawing:

- **0°**: `native_x = x`, `native_y = rawH - y`
- **90°**: `native_x = y`, `native_y = x`
- **180°**: `native_x = rawW - x`, `native_y = y`
- **270°**: `native_x = rawW - y`, `native_y = rawH - x`

### 3. Update `pdfAnnotationExportService.ts`

- Use `getEffectivePageSize()` instead of raw `page.getSize()` for percentage-to-pixel conversion
- Use `toNativeCoords()` for all annotation types (textbox, rect, circle, path) when placing them on the pdf-lib page
- Update both legacy and current format branches

### 4. Update `PDFViewerEditor.tsx` `downloadPDF` function

Same changes as the export service — use effective dimensions and coordinate transform so the in-editor download button also produces correct output.

### Files to Edit

- `src/services/pdfAnnotationExportService.ts` — fix coordinate mapping with rotation awareness
- `src/components/PDFViewerEditor.tsx` — fix `downloadPDF` function (~lines 1676-1810) with same rotation-aware logic

