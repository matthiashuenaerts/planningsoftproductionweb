import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { supabase } from '@/integrations/supabase/client';

interface AnnotationData {
  type: string;
  leftPct?: number;
  topPct?: number;
  widthPct?: number;
  heightPct?: number;
  radiusPct?: number;
  fill?: string;
  stroke?: string;
  strokeWidthPct?: number;
  text?: string;
  fontSizePct?: number;
  path?: any[];
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
 * Generates an annotated PDF by overlaying stored annotations onto the raw PDF bytes.
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
    const { width, height } = page.getSize();

    for (const annotation of annotations) {
      const x = (annotation.leftPct || 0) * width;
      const y = height - ((annotation.topPct || 0) * height);

      switch (annotation.type) {
        case 'textbox':
          if (annotation.text) {
            const fontSize = (annotation.fontSizePct || 0.03) * height;
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
          const rw = (annotation.widthPct || 0) * width;
          const rh = (annotation.heightPct || 0) * height;
          const rc = hexToRgb(annotation.stroke || '#000000');
          page.drawRectangle({
            x,
            y: y - rh,
            width: rw,
            height: rh,
            borderColor: rgb(rc.r / 255, rc.g / 255, rc.b / 255),
            borderWidth: (annotation.strokeWidthPct || 0.002) * width,
          });
          break;
        }
        case 'circle': {
          const r = (annotation.radiusPct || 0) * width;
          const cc = hexToRgb(annotation.stroke || '#000000');
          page.drawCircle({
            x: x + r,
            y: y - r,
            size: r,
            borderColor: rgb(cc.r / 255, cc.g / 255, cc.b / 255),
            borderWidth: (annotation.strokeWidthPct || 0.002) * width,
          });
          break;
        }
        case 'path':
          if (annotation.path && Array.isArray(annotation.path)) {
            const pc = hexToRgb(annotation.stroke || '#000000');
            const sw = (annotation.strokeWidthPct || 0.005) * width;
            const pathLeft = (annotation.leftPct || 0) * width;
            const pathTop = (annotation.topPct || 0) * height;
            const offsetX = annotation.pathOffsetXPct != null ? annotation.pathOffsetXPct * width : 0;
            const offsetY = annotation.pathOffsetYPct != null ? annotation.pathOffsetYPct * height : 0;
            let lastX = 0, lastY = 0;
            const steps = 24;
            const color = rgb(pc.r / 255, pc.g / 255, pc.b / 255);

            for (const cmd of annotation.path) {
              if (cmd[0] === 'M') {
                lastX = pathLeft + cmd[1] * width - offsetX;
                lastY = pathTop + cmd[2] * height - offsetY;
              } else if (cmd[0] === 'L') {
                const lx = pathLeft + cmd[1] * width - offsetX;
                const ly = pathTop + cmd[2] * height - offsetY;
                page.drawLine({ start: { x: lastX, y: height - lastY }, end: { x: lx, y: height - ly }, thickness: sw, color });
                lastX = lx; lastY = ly;
              } else if (cmd[0] === 'Q') {
                const cpx = pathLeft + cmd[1] * width - offsetX;
                const cpy = pathTop + cmd[2] * height - offsetY;
                const ex = pathLeft + cmd[3] * width - offsetX;
                const ey = pathTop + cmd[4] * height - offsetY;
                const sx = lastX, sy = lastY;
                for (let t = 1; t <= steps; t++) {
                  const tt = t / steps, mt = 1 - tt;
                  const px = mt * mt * sx + 2 * mt * tt * cpx + tt * tt * ex;
                  const py = mt * mt * sy + 2 * mt * tt * cpy + tt * tt * ey;
                  page.drawLine({ start: { x: lastX, y: height - lastY }, end: { x: px, y: height - py }, thickness: sw, color });
                  lastX = px; lastY = py;
                }
              } else if (cmd[0] === 'C') {
                const c1x = pathLeft + cmd[1] * width - offsetX;
                const c1y = pathTop + cmd[2] * height - offsetY;
                const c2x = pathLeft + cmd[3] * width - offsetX;
                const c2y = pathTop + cmd[4] * height - offsetY;
                const ex = pathLeft + cmd[5] * width - offsetX;
                const ey = pathTop + cmd[6] * height - offsetY;
                const sx = lastX, sy = lastY;
                for (let t = 1; t <= steps; t++) {
                  const tt = t / steps, mt = 1 - tt;
                  const px = mt*mt*mt*sx + 3*mt*mt*tt*c1x + 3*mt*tt*tt*c2x + tt*tt*tt*ex;
                  const py = mt*mt*mt*sy + 3*mt*mt*tt*c1y + 3*mt*tt*tt*c2y + tt*tt*tt*ey;
                  page.drawLine({ start: { x: lastX, y: height - lastY }, end: { x: px, y: height - py }, thickness: sw, color });
                  lastX = px; lastY = py;
                }
              }
            }
          }
          break;
      }
    }
  }

  return new Uint8Array(await pdfDoc.save());
}
