import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { supabase } from '@/integrations/supabase/client';
import { getEffectivePageSize, toNativeCoords, toNativeSize } from './pdfCoordinateUtils';

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

function isLegacyFormat(annotations: AnnotationData[]): boolean {
  return annotations.some(a => a.leftPct !== undefined || a.topPct !== undefined);
}

export async function generateAnnotatedPdf(
  projectId: string,
  fileName: string,
  pdfBytes: ArrayBuffer
): Promise<Uint8Array | null> {
  const { data, error } = await supabase
    .from('pdf_annotations')
    .select('page_number, annotations')
    .eq('project_id', projectId)
    .eq('file_name', fileName);

  if (error || !data || data.length === 0) {
    return null;
  }

  const annotationsMap = new Map<number, AnnotationData[]>();
  data.forEach((row: any) => {
    annotationsMap.set(row.page_number, row.annotations as AnnotationData[]);
  });

  const pdfDoc = await PDFDocument.load(pdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const [pageNum, annotations] of annotationsMap.entries()) {
    const page = pdfDoc.getPage(pageNum - 1);
    const { effWidth, effHeight, rawWidth, rawHeight, rotation } = getEffectivePageSize(page);

    const legacy = isLegacyFormat(annotations);

    for (const annotation of annotations) {
      // Resolve display-space coordinates
      let dispX: number, dispY: number;
      if (legacy) {
        dispX = (annotation.leftPct || 0) * effWidth;
        dispY = (annotation.topPct || 0) * effHeight;
      } else {
        dispX = annotation.left || 0;
        dispY = annotation.top || 0;
      }

      switch (annotation.type) {
        case 'textbox':
          if (annotation.text) {
            let fontSize: number;
            if (legacy) {
              fontSize = (annotation.fontSizePct || 0.03) * effHeight;
            } else {
              fontSize = annotation.fontSize || 18;
            }
            const c = hexToRgb(annotation.fill || '#000000');
            const textPos = toNativeCoords(dispX, dispY + fontSize, rawWidth, rawHeight, rotation);
            page.drawText(annotation.text, {
              x: textPos.x,
              y: textPos.y,
              size: fontSize,
              font,
              color: rgb(c.r / 255, c.g / 255, c.b / 255),
            });
          }
          break;

        case 'rect': {
          let rw: number, rh: number, borderWidth: number;
          if (legacy) {
            rw = (annotation.widthPct || 0) * effWidth;
            rh = (annotation.heightPct || 0) * effHeight;
            borderWidth = (annotation.strokeWidthPct || 0.002) * effWidth;
          } else {
            rw = annotation.width || 0;
            rh = annotation.height || 0;
            borderWidth = annotation.strokeWidth || 1;
          }
          const rc = hexToRgb(annotation.stroke || '#000000');
          // Bottom-left corner in display space is (dispX, dispY + rh)
          const rectPos = toNativeCoords(dispX, dispY + rh, rawWidth, rawHeight, rotation);
          const nativeSize = toNativeSize(rw, rh, rotation);
          page.drawRectangle({
            x: rectPos.x,
            y: rectPos.y,
            width: nativeSize.w,
            height: nativeSize.h,
            borderColor: rgb(rc.r / 255, rc.g / 255, rc.b / 255),
            borderWidth,
          });
          break;
        }

        case 'circle': {
          let r: number, borderWidth: number;
          if (legacy) {
            r = (annotation.radiusPct || 0) * effWidth;
            borderWidth = (annotation.strokeWidthPct || 0.002) * effWidth;
          } else {
            r = annotation.radius || 0;
            borderWidth = annotation.strokeWidth || 1;
          }
          const cc = hexToRgb(annotation.stroke || '#000000');
          // Center in display space is (dispX + r, dispY + r)
          const circleCenter = toNativeCoords(dispX + r, dispY + r, rawWidth, rawHeight, rotation);
          page.drawCircle({
            x: circleCenter.x,
            y: circleCenter.y,
            size: r,
            borderColor: rgb(cc.r / 255, cc.g / 255, cc.b / 255),
            borderWidth,
          });
          break;
        }

        case 'path':
          if (annotation.path && Array.isArray(annotation.path)) {
            if (legacy) {
              drawPathLegacy(page, annotation, effWidth, effHeight, rawWidth, rawHeight, rotation);
            } else {
              drawPathOnPage(page, annotation, rawWidth, rawHeight, rotation);
            }
          }
          break;
      }
    }
  }

  return new Uint8Array(await pdfDoc.save());
}

function drawPathOnPage(page: any, annotation: AnnotationData, rawW: number, rawH: number, rotation: number) {
  if (!annotation.path || !Array.isArray(annotation.path)) return;

  const pc = hexToRgb(annotation.stroke || '#ff0000');
  const borderWidth = annotation.strokeWidth || 2;
  const color = rgb(pc.r / 255, pc.g / 255, pc.b / 255);

  let lastDispX = 0, lastDispY = 0;

  for (const segment of annotation.path) {
    if (!Array.isArray(segment)) continue;
    const [command, ...coords] = segment;

    switch (command) {
      case 'M':
        lastDispX = coords[0];
        lastDispY = coords[1];
        break;
      case 'L': {
        const start = toNativeCoords(lastDispX, lastDispY, rawW, rawH, rotation);
        const end = toNativeCoords(coords[0], coords[1], rawW, rawH, rotation);
        page.drawLine({ start, end, thickness: borderWidth, color });
        lastDispX = coords[0];
        lastDispY = coords[1];
        break;
      }
      case 'Q':
        if (coords.length >= 4) {
          const steps = 24;
          const sx = lastDispX, sy = lastDispY;
          const cpx = coords[0], cpy = coords[1];
          const endX = coords[2], endY = coords[3];
          for (let t = 1; t <= steps; t++) {
            const tt = t / steps, mt = 1 - tt;
            const px = mt * mt * sx + 2 * mt * tt * cpx + tt * tt * endX;
            const py = mt * mt * sy + 2 * mt * tt * cpy + tt * tt * endY;
            const start = toNativeCoords(lastDispX, lastDispY, rawW, rawH, rotation);
            const end = toNativeCoords(px, py, rawW, rawH, rotation);
            page.drawLine({ start, end, thickness: borderWidth, color });
            lastDispX = px;
            lastDispY = py;
          }
        }
        break;
      case 'C':
        if (coords.length >= 6) {
          const steps = 24;
          const sx = lastDispX, sy = lastDispY;
          const c1x = coords[0], c1y = coords[1];
          const c2x = coords[2], c2y = coords[3];
          const endX = coords[4], endY = coords[5];
          for (let t = 1; t <= steps; t++) {
            const tt = t / steps, mt = 1 - tt;
            const px = mt**3 * sx + 3 * mt**2 * tt * c1x + 3 * mt * tt**2 * c2x + tt**3 * endX;
            const py = mt**3 * sy + 3 * mt**2 * tt * c1y + 3 * mt * tt**2 * c2y + tt**3 * endY;
            const start = toNativeCoords(lastDispX, lastDispY, rawW, rawH, rotation);
            const end = toNativeCoords(px, py, rawW, rawH, rotation);
            page.drawLine({ start, end, thickness: borderWidth, color });
            lastDispX = px;
            lastDispY = py;
          }
        }
        break;
    }
  }
}

function drawPathLegacy(
  page: any, annotation: AnnotationData,
  effW: number, effH: number, rawW: number, rawH: number, rotation: number
) {
  const pc = hexToRgb(annotation.stroke || '#000000');
  const sw = (annotation.strokeWidthPct || 0.005) * effW;
  const pathLeft = (annotation.leftPct || 0) * effW;
  const pathTop = (annotation.topPct || 0) * effH;
  const offsetX = annotation.pathOffsetXPct != null ? annotation.pathOffsetXPct * effW : 0;
  const offsetY = annotation.pathOffsetYPct != null ? annotation.pathOffsetYPct * effH : 0;
  let lastDispX = 0, lastDispY = 0;
  const steps = 24;
  const color = rgb(pc.r / 255, pc.g / 255, pc.b / 255);

  for (const cmd of annotation.path!) {
    if (cmd[0] === 'M') {
      lastDispX = pathLeft + cmd[1] * effW - offsetX;
      lastDispY = pathTop + cmd[2] * effH - offsetY;
    } else if (cmd[0] === 'L') {
      const lx = pathLeft + cmd[1] * effW - offsetX;
      const ly = pathTop + cmd[2] * effH - offsetY;
      const start = toNativeCoords(lastDispX, lastDispY, rawW, rawH, rotation);
      const end = toNativeCoords(lx, ly, rawW, rawH, rotation);
      page.drawLine({ start, end, thickness: sw, color });
      lastDispX = lx; lastDispY = ly;
    } else if (cmd[0] === 'Q') {
      const cpx = pathLeft + cmd[1] * effW - offsetX;
      const cpy = pathTop + cmd[2] * effH - offsetY;
      const ex = pathLeft + cmd[3] * effW - offsetX;
      const ey = pathTop + cmd[4] * effH - offsetY;
      const sx = lastDispX, sy = lastDispY;
      for (let t = 1; t <= steps; t++) {
        const tt = t / steps, mt = 1 - tt;
        const px = mt * mt * sx + 2 * mt * tt * cpx + tt * tt * ex;
        const py = mt * mt * sy + 2 * mt * tt * cpy + tt * tt * ey;
        const start = toNativeCoords(lastDispX, lastDispY, rawW, rawH, rotation);
        const end = toNativeCoords(px, py, rawW, rawH, rotation);
        page.drawLine({ start, end, thickness: sw, color });
        lastDispX = px; lastDispY = py;
      }
    } else if (cmd[0] === 'C') {
      const c1x = pathLeft + cmd[1] * effW - offsetX;
      const c1y = pathTop + cmd[2] * effH - offsetY;
      const c2x = pathLeft + cmd[3] * effW - offsetX;
      const c2y = pathTop + cmd[4] * effH - offsetY;
      const ex = pathLeft + cmd[5] * effW - offsetX;
      const ey = pathTop + cmd[6] * effH - offsetY;
      const sx = lastDispX, sy = lastDispY;
      for (let t = 1; t <= steps; t++) {
        const tt = t / steps, mt = 1 - tt;
        const px = mt*mt*mt*sx + 3*mt*mt*tt*c1x + 3*mt*tt*tt*c2x + tt*tt*tt*ex;
        const py = mt*mt*mt*sy + 3*mt*mt*tt*c1y + 3*mt*tt*tt*c2y + tt*tt*tt*ey;
        const start = toNativeCoords(lastDispX, lastDispY, rawW, rawH, rotation);
        const end = toNativeCoords(px, py, rawW, rawH, rotation);
        page.drawLine({ start, end, thickness: sw, color });
        lastDispX = px; lastDispY = py;
      }
    }
  }
}
