import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { supabase } from '@/integrations/supabase/client';

interface AnnotationData {
  type: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  radius?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  path?: any[];
  angle?: number;
  scaleX?: number;
  scaleY?: number;
  // Legacy percentage-based fields (kept for backward compatibility)
  leftPct?: number;
  topPct?: number;
  widthPct?: number;
  heightPct?: number;
  radiusPct?: number;
  strokeWidthPct?: number;
  fontSizePct?: number;
  pathOffsetXPct?: number;
  pathOffsetYPct?: number;
  [key: string]: any;
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 0, g: 0, b: 0 };
}

/**
 * Detects whether annotations use the legacy percentage-based format (leftPct/topPct)
 * or the current pixel-based format (left/top in PDF points at scale=1).
 */
function isLegacyFormat(annotations: AnnotationData[]): boolean {
  return annotations.some(a => a.leftPct !== undefined || a.topPct !== undefined);
}

/**
 * Generates an annotated PDF by overlaying stored annotations onto the raw PDF bytes.
 * 
 * Annotations are stored as pixel coordinates at scale=1, which corresponds to
 * PDF points (since pdfjs viewport at scale=1 returns dimensions in points).
 * The canvas base size equals the PDF page size, so scaleX/scaleY = 1.
 * 
 * Returns the annotated PDF as a Uint8Array, or null if no annotations exist.
 */
export async function generateAnnotatedPdf(
  projectId: string,
  fileName: string,
  pdfBytes: ArrayBuffer
): Promise<Uint8Array | null> {
  // Fetch annotations from database
  const { data, error } = await supabase
    .from('pdf_annotations')
    .select('page_number, annotations')
    .eq('project_id', projectId)
    .eq('file_name', fileName);

  if (error || !data || data.length === 0) {
    return null; // No annotations, use raw file
  }

  const annotationsMap = new Map<number, AnnotationData[]>();
  data.forEach((row: any) => {
    annotationsMap.set(row.page_number, row.annotations as AnnotationData[]);
  });

  const pdfDoc = await PDFDocument.load(pdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const [pageNum, annotations] of annotationsMap.entries()) {
    const page = pdfDoc.getPage(pageNum - 1);
    const { width: pageWidth, height: pageHeight } = page.getSize();

    // Detect format: legacy (percentage 0-1) or current (PDF points)
    const legacy = isLegacyFormat(annotations);

    for (const annotation of annotations) {
      // Resolve coordinates: legacy uses Pct fields as 0-1 fractions; current uses direct points
      let x: number, y: number;
      if (legacy) {
        x = (annotation.leftPct || 0) * pageWidth;
        y = pageHeight - ((annotation.topPct || 0) * pageHeight);
      } else {
        // Annotations are in PDF points (scale=1 canvas coords)
        // PDF y-axis is bottom-up, canvas y-axis is top-down
        x = annotation.left || 0;
        y = pageHeight - (annotation.top || 0);
      }

      switch (annotation.type) {
        case 'textbox':
          if (annotation.text) {
            let fontSize: number;
            if (legacy) {
              fontSize = (annotation.fontSizePct || 0.03) * pageHeight;
            } else {
              fontSize = annotation.fontSize || 18;
            }
            const c = hexToRgb(annotation.fill || '#000000');
            page.drawText(annotation.text, {
              x,
              y: y - fontSize,
              size: fontSize,
              font,
              color: rgb(c.r / 255, c.g / 255, c.b / 255),
            });
          }
          break;

        case 'rect': {
          let rw: number, rh: number, borderWidth: number;
          if (legacy) {
            rw = (annotation.widthPct || 0) * pageWidth;
            rh = (annotation.heightPct || 0) * pageHeight;
            borderWidth = (annotation.strokeWidthPct || 0.002) * pageWidth;
          } else {
            rw = annotation.width || 0;
            rh = annotation.height || 0;
            borderWidth = annotation.strokeWidth || 1;
          }
          const rc = hexToRgb(annotation.stroke || '#000000');
          page.drawRectangle({
            x,
            y: y - rh,
            width: rw,
            height: rh,
            borderColor: rgb(rc.r / 255, rc.g / 255, rc.b / 255),
            borderWidth,
          });
          break;
        }

        case 'circle': {
          let r: number, borderWidth: number;
          if (legacy) {
            r = (annotation.radiusPct || 0) * pageWidth;
            borderWidth = (annotation.strokeWidthPct || 0.002) * pageWidth;
          } else {
            r = annotation.radius || 0;
            borderWidth = annotation.strokeWidth || 1;
          }
          const cc = hexToRgb(annotation.stroke || '#000000');
          page.drawCircle({
            x: x + r,
            y: y - r,
            size: r,
            borderColor: rgb(cc.r / 255, cc.g / 255, cc.b / 255),
            borderWidth,
          });
          break;
        }

        case 'path':
          if (annotation.path && Array.isArray(annotation.path)) {
            if (legacy) {
              drawPathLegacy(page, annotation, pageWidth, pageHeight);
            } else {
              drawPathOnPage(page, annotation, pageHeight);
            }
          }
          break;
      }
    }
  }

  return new Uint8Array(await pdfDoc.save());
}

/**
 * Draw path using current format: coordinates are in PDF points at scale=1.
 * Mirrors the drawPathOnPage logic from EnhancedPDFEditor.
 */
function drawPathOnPage(page: any, annotation: AnnotationData, pageHeight: number) {
  if (!annotation.path || !Array.isArray(annotation.path)) return;

  const pc = hexToRgb(annotation.stroke || '#ff0000');
  const borderWidth = annotation.strokeWidth || 2;
  const color = rgb(pc.r / 255, pc.g / 255, pc.b / 255);

  // Path coordinates are already in PDF points (scale=1)
  // No additional scaling needed (scaleX = scaleY = 1)
  let lastX = 0, lastY = 0;

  for (const segment of annotation.path) {
    if (!Array.isArray(segment)) continue;
    const [command, ...coords] = segment;

    switch (command) {
      case 'M':
        lastX = coords[0];
        lastY = coords[1];
        break;
      case 'L':
        page.drawLine({
          start: { x: lastX, y: pageHeight - lastY },
          end: { x: coords[0], y: pageHeight - coords[1] },
          thickness: borderWidth,
          color,
        });
        lastX = coords[0];
        lastY = coords[1];
        break;
      case 'Q':
        if (coords.length >= 4) {
          const steps = 24;
          const sx = lastX, sy = lastY;
          const cpx = coords[0], cpy = coords[1];
          const endX = coords[2], endY = coords[3];
          for (let t = 1; t <= steps; t++) {
            const tt = t / steps, mt = 1 - tt;
            const px = mt * mt * sx + 2 * mt * tt * cpx + tt * tt * endX;
            const py = mt * mt * sy + 2 * mt * tt * cpy + tt * tt * endY;
            page.drawLine({
              start: { x: lastX, y: pageHeight - lastY },
              end: { x: px, y: pageHeight - py },
              thickness: borderWidth,
              color,
            });
            lastX = px;
            lastY = py;
          }
        }
        break;
      case 'C':
        if (coords.length >= 6) {
          const steps = 24;
          const sx = lastX, sy = lastY;
          const c1x = coords[0], c1y = coords[1];
          const c2x = coords[2], c2y = coords[3];
          const endX = coords[4], endY = coords[5];
          for (let t = 1; t <= steps; t++) {
            const tt = t / steps, mt = 1 - tt;
            const px = mt**3 * sx + 3 * mt**2 * tt * c1x + 3 * mt * tt**2 * c2x + tt**3 * endX;
            const py = mt**3 * sy + 3 * mt**2 * tt * c1y + 3 * mt * tt**2 * c2y + tt**3 * endY;
            page.drawLine({
              start: { x: lastX, y: pageHeight - lastY },
              end: { x: px, y: pageHeight - py },
              thickness: borderWidth,
              color,
            });
            lastX = px;
            lastY = py;
          }
        }
        break;
    }
  }
}

/**
 * Legacy path drawing using percentage-based coordinates (backward compatibility).
 */
function drawPathLegacy(page: any, annotation: AnnotationData, pageWidth: number, pageHeight: number) {
  const pc = hexToRgb(annotation.stroke || '#000000');
  const sw = (annotation.strokeWidthPct || 0.005) * pageWidth;
  const pathLeft = (annotation.leftPct || 0) * pageWidth;
  const pathTop = (annotation.topPct || 0) * pageHeight;
  const offsetX = annotation.pathOffsetXPct != null ? annotation.pathOffsetXPct * pageWidth : 0;
  const offsetY = annotation.pathOffsetYPct != null ? annotation.pathOffsetYPct * pageHeight : 0;
  let lastX = 0, lastY = 0;
  const steps = 24;
  const color = rgb(pc.r / 255, pc.g / 255, pc.b / 255);

  for (const cmd of annotation.path!) {
    if (cmd[0] === 'M') {
      lastX = pathLeft + cmd[1] * pageWidth - offsetX;
      lastY = pathTop + cmd[2] * pageHeight - offsetY;
    } else if (cmd[0] === 'L') {
      const lx = pathLeft + cmd[1] * pageWidth - offsetX;
      const ly = pathTop + cmd[2] * pageHeight - offsetY;
      page.drawLine({ start: { x: lastX, y: pageHeight - lastY }, end: { x: lx, y: pageHeight - ly }, thickness: sw, color });
      lastX = lx; lastY = ly;
    } else if (cmd[0] === 'Q') {
      const cpx = pathLeft + cmd[1] * pageWidth - offsetX;
      const cpy = pathTop + cmd[2] * pageHeight - offsetY;
      const ex = pathLeft + cmd[3] * pageWidth - offsetX;
      const ey = pathTop + cmd[4] * pageHeight - offsetY;
      const sx = lastX, sy = lastY;
      for (let t = 1; t <= steps; t++) {
        const tt = t / steps, mt = 1 - tt;
        const px = mt * mt * sx + 2 * mt * tt * cpx + tt * tt * ex;
        const py = mt * mt * sy + 2 * mt * tt * cpy + tt * tt * ey;
        page.drawLine({ start: { x: lastX, y: pageHeight - lastY }, end: { x: px, y: pageHeight - py }, thickness: sw, color });
        lastX = px; lastY = py;
      }
    } else if (cmd[0] === 'C') {
      const c1x = pathLeft + cmd[1] * pageWidth - offsetX;
      const c1y = pathTop + cmd[2] * pageHeight - offsetY;
      const c2x = pathLeft + cmd[3] * pageWidth - offsetX;
      const c2y = pathTop + cmd[4] * pageHeight - offsetY;
      const ex = pathLeft + cmd[5] * pageWidth - offsetX;
      const ey = pathTop + cmd[6] * pageHeight - offsetY;
      const sx = lastX, sy = lastY;
      for (let t = 1; t <= steps; t++) {
        const tt = t / steps, mt = 1 - tt;
        const px = mt*mt*mt*sx + 3*mt*mt*tt*c1x + 3*mt*tt*tt*c2x + tt*tt*tt*ex;
        const py = mt*mt*mt*sy + 3*mt*mt*tt*c1y + 3*mt*tt*tt*c2y + tt*tt*tt*ey;
        page.drawLine({ start: { x: lastX, y: pageHeight - lastY }, end: { x: px, y: pageHeight - py }, thickness: sw, color });
        lastX = px; lastY = py;
      }
    }
  }
}
