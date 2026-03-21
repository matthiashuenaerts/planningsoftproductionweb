/**
 * Utilities for converting between pdfjs display coordinates and pdf-lib native coordinates.
 * 
 * pdfjs accounts for page rotation (swaps width/height for 90°/270°),
 * but pdf-lib's page.getSize() returns raw MediaBox dimensions without rotation.
 * These helpers bridge that gap so annotations placed in the editor appear
 * at the correct position in exported PDFs.
 */

/**
 * Returns the "effective" page size as seen by pdfjs (rotation-applied),
 * plus the raw dimensions and rotation angle.
 */
export function getEffectivePageSize(page: any) {
  const { width: rawW, height: rawH } = page.getSize();
  const rotation = (page.getRotation?.()?.angle ?? 0) % 360;
  const isRotated = rotation === 90 || rotation === 270;

  return {
    effWidth: isRotated ? rawH : rawW,
    effHeight: isRotated ? rawW : rawH,
    rawWidth: rawW,
    rawHeight: rawH,
    rotation,
  };
}

/**
 * Transforms a point from display-space (top-down, rotation-applied — as used
 * by pdfjs / Fabric.js canvas) into native PDF coordinates (bottom-up, unrotated)
 * suitable for pdf-lib drawing calls.
 *
 * @param x  X in display space (pixels, relative to effective width)
 * @param y  Y in display space (pixels, relative to effective height, top-down)
 */
export function toNativeCoords(
  x: number,
  y: number,
  rawW: number,
  rawH: number,
  rotation: number
): { x: number; y: number } {
  switch (rotation) {
    case 90:
      return { x: y, y: x };
    case 180:
      return { x: rawW - x, y: y };
    case 270:
      return { x: rawW - y, y: rawH - x };
    default: // 0
      return { x, y: rawH - y };
  }
}

/**
 * Transforms a size (width, height) from display-space to native PDF space.
 * For 90°/270° rotation the width and height are swapped.
 */
export function toNativeSize(
  w: number,
  h: number,
  rotation: number
): { w: number; h: number } {
  const isRotated = rotation === 90 || rotation === 270;
  return { w: isRotated ? h : w, h: isRotated ? w : h };
}
