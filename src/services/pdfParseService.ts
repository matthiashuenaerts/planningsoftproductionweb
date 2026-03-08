// PDF parsing service for extracting order data from PDFs
// Uses client-side text extraction and pattern matching (no AI)

export interface ParsedOrderData {
  supplier?: string;
  matchedSupplierId?: string;
  orderDate?: string;
  expectedDelivery?: string;
  orderNumber?: string;
  invoiceNumber?: string;
  referenceNumber?: string;
  customerNumber?: string;
  currency?: string;
  subtotal?: number;
  vatAmount?: number;
  vatPercentage?: number;
  discount?: number;
  shippingCost?: number;
  totalAmount?: number;
  paymentTerms?: string;
  deliveryAddress?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  notes?: string;
  rawText?: string;
  items: ParsedOrderItem[];
  extractionConfidence: 'high' | 'medium' | 'low';
  warnings: string[];
}

export interface ParsedOrderItem {
  description: string;
  quantity: number;
  article_code: string;
  ean?: string;
  unit_price?: number;
  total_price?: number;
  unit?: string;
  discount?: number;
  notes?: string;
  matchConfidence?: 'exact' | 'partial' | 'none';
}

interface ProductMatch {
  id: string;
  name: string;
  article_code: string;
  description?: string;
  supplier?: string;
}

interface MaterialMatch {
  id: string;
  name: string;
  sku: string;
  category: string;
}

interface SupplierMatch {
  id: string;
  name: string;
}

interface TextItem {
  str: string;
  transform: number[];
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TableRow {
  y: number;
  items: TextItem[];
  pageIndex: number;
}

// ─── REGEX PATTERNS ────────────────────────────────────────────────────────────

const QUANTITY_PATTERNS = [
  /(\d+(?:[,\.]\d+)?)\s*(st|stuk|stuks|pcs|pieces|pièces|x|qty|aantal|eenheden|mtr|m|lm|m2|m²|kg|ltr|rol|rollen|set|pak|doos|dozen|paar|unité|unités)\b/gi,
  /(?:qty|quantity|aantal|hoeveelheid|besteld|geleverd|quantité|qté)[:\s]*(\d+(?:[,\.]\d+)?)/gi,
  /^\s*(\d+(?:[,\.]\d+)?)\s+/,                                    // leading number
];

const ARTICLE_CODE_PATTERNS = [
  /\b([A-Z0-9]{2,}\/[^\s]{2,})\b/gi,                             // Codes with slashes
  /\b([A-Z]{1,5}[\-\.]\d{3,12}[A-Z0-9\-\.]*)\b/gi,              // XX-12345
  /\b(\d{6,13})\b/g,                                              // EAN / numeric (6-13 digits)
  /(?:art[\.:]?\s*(?:nr|code|nummer)?|article|artikelcode|item\s*(?:no|nr)|réf(?:érence)?|n°\s*art)[:\s]*([A-Z0-9\-\.\/]+)/gi,
  /\b([A-Z0-9]{3,}\-[A-Z0-9\-]{2,})\b/g,                        // Code-with-dashes
  /\b([A-Z]{2}\d{2}[A-Z0-9]{2,})\b/g,                           // AB12CDE style
];

const PRICE_PATTERNS = [
  /€\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2}))/g,                     // €1.234,56
  /€\s*(\d+(?:,\d{1,2}))/g,                                       // €12,50
  /€\s*(\d+(?:\.\d{1,2}))/g,                                      // €12.50
  /EUR\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2}))/gi,                   // EUR 1.234,56
  /EUR\s*(\d+(?:[,\.]\d{1,2}))/gi,                                // EUR 12,50
  /(\d{1,3}(?:\.\d{3})*(?:,\d{1,2}))\s*€/g,                      // 1.234,56 €
  /(\d+(?:,\d{1,2}))\s*€/g,                                       // 12,50 €
  /(?:prijs|price|bedrag|amount|e\.?\s*prijs|prix|montant|p\.?\s*u\.?)[:\s]*€?\s*(\d{1,3}(?:[\.\s]\d{3})*(?:,\d{1,2}))/gi,
];

const UNIT_PATTERNS = /\b(st|stuk|stuks|pcs|pieces|pièces|m|mtr|meter|mètre|m2|m²|m3|m³|kg|kilogram|ltr|liter|litre|rol|rollen|rouleau|set|pak|doos|dozen|carton|paar|paire|uur|hour|heure|unité)\b/gi;

// ─── TEXT EXTRACTION ──────────────────────────────────────────────────────────

export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    fullText += tc.items.map((item: any) => item.str).join(' ') + '\n';
  }
  return fullText;
}

async function extractTextWithPositions(file: File): Promise<TextItem[][]> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;
  const allPages: TextItem[][] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    allPages.push(tc.items.map((item: any) => ({
      str: item.str,
      transform: item.transform,
      x: item.transform[4],
      y: item.transform[5],
      width: item.width,
      height: item.height || 10,
    })));
  }
  return allPages;
}

// ─── ROW / COLUMN DETECTION ──────────────────────────────────────────────────

function groupIntoRows(items: TextItem[], pageIndex: number, yTolerance: number = 4): TableRow[] {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => b.y - a.y);
  const rows: TableRow[] = [];
  let cur: TableRow = { y: sorted[0].y, items: [], pageIndex };
  for (const item of sorted) {
    if (Math.abs(item.y - cur.y) <= yTolerance) {
      cur.items.push(item);
    } else {
      if (cur.items.length > 0) {
        cur.items.sort((a, b) => a.x - b.x);
        rows.push(cur);
      }
      cur = { y: item.y, items: [item], pageIndex };
    }
  }
  if (cur.items.length > 0) {
    cur.items.sort((a, b) => a.x - b.x);
    rows.push(cur);
  }
  return rows;
}

// Merge adjacent rows that belong to the same logical table row (multi-line cells)
function mergeMultiLineRows(rows: TableRow[], maxGap: number = 12): TableRow[] {
  if (rows.length < 2) return rows;
  const merged: TableRow[] = [rows[0]];
  for (let i = 1; i < rows.length; i++) {
    const prev = merged[merged.length - 1];
    const cur = rows[i];
    // If gap is small and current row has fewer items (continuation), merge
    const gap = Math.abs(prev.y - cur.y);
    if (gap < maxGap && cur.items.length <= prev.items.length && cur.pageIndex === prev.pageIndex) {
      // Check if any item in cur overlaps an x-range from prev
      const prevMaxX = Math.max(...prev.items.map(it => it.x + it.width));
      const curMinX = Math.min(...cur.items.map(it => it.x));
      if (curMinX < prevMaxX) {
        // Merge: append text to closest column items
        for (const ci of cur.items) {
          const closest = prev.items.reduce((best, pi) => 
            Math.abs(pi.x - ci.x) < Math.abs(best.x - ci.x) ? pi : best
          );
          closest.str += ' ' + ci.str;
        }
        continue;
      }
    }
    merged.push(cur);
  }
  return merged;
}

const COLUMN_HEADER_PATTERNS: Record<string, RegExp> = {
  'ean': /^(ean|ean[\-\s]*code|barcode|gtin|upc)\b/i,
  'article_code': /^(art|article|code|artikelcode|artikel\s*code|artnr|art[\.\s]*nr|item\s*(?:no|nr)?|sku|product\s*code|bestelnr|materiaal|mat[\.\s]*nr|réf(?:érence)?|n°\s*art|code\s*art)\b/i,
  'description': /^(description|omschrijving|desc|naam|name|product|benaming|artikel\s*naam|item\s*desc|tekst|material|désignation|libellé|intitulé)\b/i,
  'quantity': /^(qty|quantity|aantal|hoeveelheid|stuks|pcs|aant|besteld|geleverd|hoeveelh|order\s*qty|aant\.?|quantité|qté|qte)\b/i,
  'unit': /^(unit|eenheid|enh|uom|me|vpe|unité)\b/i,
  'price': /^(price|prijs|unit\s*price|eenheid|e\.?\s*prijs|stukprijs|netto\s*prijs|prijs\/eenheid|prijs\s*per|per\s*stuk|prix|p\.?\s*u\.?|prix\s*unit)\b/i,
  'total': /^(total|totaal|bedrag|amount|netto\s*bedrag|regel\s*bedrag|line\s*total|montant|total\s*ligne)\b/i,
  'subtotal': /^(subtotal|subtotaal|sous[\-\s]?total)\b/i,
  'discount': /^(discount|korting|remise|rabat|réduction)\b/i,
};

function detectColumns(rows: TableRow[]): { columns: Map<string, number>; headerRowIndex: number } {
  const columns = new Map<string, number>();
  let headerRowIndex = -1;

  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const row = rows[i];
    let matchCount = 0;
    const tempCols = new Map<string, number>();

    // Build concatenated text per item and also try merging adjacent items for multi-word headers
    const itemTexts: { text: string; x: number }[] = [];
    for (const item of row.items) {
      itemTexts.push({ text: item.str.trim(), x: item.x });
    }
    // Also create merged pairs for multi-word headers like "Prijs per stuk [excl. BTW]"
    for (let j = 0; j < itemTexts.length; j++) {
      const merged = itemTexts.slice(j, j + 3).map(it => it.text).join(' ').trim();
      if (merged.length > itemTexts[j].text.length) {
        itemTexts.push({ text: merged, x: itemTexts[j].x });
      }
    }

    for (const { text, x } of itemTexts) {
      if (!text) continue;
      for (const [colName, pattern] of Object.entries(COLUMN_HEADER_PATTERNS)) {
        if (pattern.test(text) && !tempCols.has(colName)) {
          tempCols.set(colName, x);
          matchCount++;
          break;
        }
      }
    }

    if (matchCount >= 2 && matchCount > columns.size) {
      columns.clear();
      tempCols.forEach((v, k) => columns.set(k, v));
      headerRowIndex = i;
    }
  }

  return { columns, headerRowIndex };
}

// ─── VALUE PARSING ───────────────────────────────────────────────────────────

/** Parse European-style numbers: "1.234,56" → 1234.56 */
function parseEuropeanNumber(str: string): number | undefined {
  if (!str) return undefined;
  let cleaned = str.replace(/\s/g, '').replace(/€/g, '').replace(/EUR/gi, '');
  // Remove thousands separators (dots) then convert comma to dot
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    cleaned = cleaned.replace(',', '.');
  }
  cleaned = cleaned.replace(/[^0-9.\-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function parseQuantityValue(value?: string): number | undefined {
  if (!value) return undefined;
  const n = parseEuropeanNumber(value);
  if (n === undefined || n <= 0) return undefined;
  return Math.round(n);
}

function parsePriceValue(value?: string): number | undefined {
  if (!value) return undefined;
  return parseEuropeanNumber(value);
}

function extractQuantityFromLine(line: string): number | undefined {
  for (const pattern of QUANTITY_PATTERNS) {
    if (pattern instanceof RegExp) {
      pattern.lastIndex = 0;
      const match = pattern.exec(line);
      if (match) {
        const n = parseEuropeanNumber(match[1]);
        if (n && n > 0 && n < 100000) return Math.round(n);
      }
    }
  }
  return undefined;
}

function extractUnitFromLine(line: string): string | undefined {
  UNIT_PATTERNS.lastIndex = 0;
  const match = UNIT_PATTERNS.exec(line);
  return match ? match[1].toLowerCase() : undefined;
}

function extractPriceFromLine(line: string): number | undefined {
  for (const pattern of PRICE_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(line);
    if (match) return parseEuropeanNumber(match[1]);
  }
  return undefined;
}

function extractArticleCodeFromLine(line: string): string {
  for (const pattern of ARTICLE_CODE_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(line);
    if (match) return match[1];
  }
  return '';
}

/** Extract an article code embedded at the start of a description, e.g. "11731 Stekkerdoos..." → { code: "11731", remaining: "Stekkerdoos..." } */
function extractEmbeddedArticleCode(description: string): { code: string; remainingDescription: string } | null {
  if (!description) return null;
  const trimmed = description.trim();
  
  // Pattern 1: Number at the start (e.g., "11731 Stekkerdoos...", "500438 SC FIS-CT...", "2608669278 Starlock...")
  const leadingNumMatch = trimmed.match(/^(\d{4,10})\s+(.+)/);
  if (leadingNumMatch) {
    return { code: leadingNumMatch[1], remainingDescription: leadingNumMatch[2].trim() };
  }
  
  // Pattern 2: Alphanumeric code at start (e.g., "AB-1234 Description...")
  const leadingCodeMatch = trimmed.match(/^([A-Z0-9]{2,}[\-\.\/][A-Z0-9\-\.\/]+)\s+(.+)/i);
  if (leadingCodeMatch && leadingCodeMatch[1].length <= 20) {
    return { code: leadingCodeMatch[1], remainingDescription: leadingCodeMatch[2].trim() };
  }
  
  // Pattern 3: Code with letters and numbers mixed (e.g., "FIS123 Description...")
  const mixedMatch = trimmed.match(/^([A-Z]{1,5}\d{3,10}[A-Z0-9]*)\s+(.+)/i);
  if (mixedMatch) {
    return { code: mixedMatch[1], remainingDescription: mixedMatch[2].trim() };
  }
  
  return null;
}

// ─── TABLE EXTRACTION ────────────────────────────────────────────────────────

function extractTableData(rows: TableRow[], columnPositions: Map<string, number>, headerRowIndex: number): Record<string, string>[] {
  const result: Record<string, string>[] = [];
  const columns = Array.from(columnPositions.entries()).sort((a, b) => a[1] - b[1]);
  if (columns.length === 0) return result;

  // Calculate adaptive max distance based on average column spacing
  const colXValues = columns.map(c => c[1]).sort((a, b) => a - b);
  let maxDistance = 150; // generous default
  if (colXValues.length >= 2) {
    const avgSpacing = (colXValues[colXValues.length - 1] - colXValues[0]) / (colXValues.length - 1);
    maxDistance = Math.max(avgSpacing * 0.6, 80);
  }

  const dataRows = rows.slice(headerRowIndex + 1);

  for (const row of dataRows) {
    const totalText = row.items.map(i => i.str).join('').trim();
    if (totalText.length < 2) continue;
    // Stop at summary rows (but not "subtotal" column values that are numbers)
    if (/^(totaal|total|sub\s*totaal|btw|vat|netto|bruto)\b/i.test(totalText) && !/^\d/.test(totalText)) break;

    const record: Record<string, string> = {};

    for (const item of row.items) {
      let bestColumn = '';
      let minDistance = Infinity;
      for (const [colName, colX] of columns) {
        const distance = Math.abs(item.x - colX);
        if (distance < minDistance && distance < maxDistance) {
          minDistance = distance;
          bestColumn = colName;
        }
      }
      if (bestColumn) {
        record[bestColumn] = ((record[bestColumn] || '') + ' ' + item.str).trim();
      }
    }

    if (record['description'] || record['article_code'] || record['ean']) {
      result.push(record);
    }
  }

  return result;
}

function extractHeuristicTableData(rows: TableRow[]): Record<string, string>[] {
  const result: Record<string, string>[] = [];

  for (const row of rows) {
    const line = row.items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim();
    if (!line || line.length < 4) continue;
    if (/^(artikel|omschrijving|aantal|qty|quantity|price|prijs|datum|date|totaal|total|subtotal|btw|vat)\b/i.test(line)) continue;

    const articleCode = extractArticleCodeFromLine(line);
    const qty = extractQuantityFromLine(line);
    const price = extractPriceFromLine(line);
    const unit = extractUnitFromLine(line);

    if (!articleCode && !qty) continue;

    let description = line;
    if (articleCode) {
      description = description.replace(new RegExp(articleCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
    }
    // Remove prices
    description = description.replace(/€\s*\d{1,3}(?:[\.\s]\d{3})*(?:,\d{1,2})?/g, '');
    description = description.replace(/\d{1,3}(?:[\.\s]\d{3})*(?:,\d{1,2})?\s*€/g, '');
    // Remove quantity with unit
    description = description.replace(/\b\d{1,4}(?:[,\.]\d+)?\s*(?:st|stuk|stuks|pcs|x|m|mtr|kg|ltr|set|rol|pak|doos|paar)\b/gi, '');
    description = description.replace(/\s+/g, ' ').trim();
    if (!description && articleCode) description = articleCode;

    result.push({
      description,
      article_code: articleCode || '',
      quantity: qty !== undefined ? String(qty) : '1',
      price: price !== undefined ? String(price) : '',
      unit: unit || '',
    });
  }

  return result;
}

// ─── METADATA EXTRACTION ─────────────────────────────────────────────────────

function extractDateFromString(str: string): string | undefined {
  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmy = str.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // YYYY-MM-DD
  const ymd = str.match(/(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (ymd) {
    const [, y, m, d] = ymd;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Named months: "8 maart 2026", "March 8, 2026"
  const MONTHS: Record<string, string> = {
    jan: '01', januari: '01', january: '01', feb: '02', februari: '02', february: '02',
    mrt: '03', maart: '03', march: '03', apr: '04', april: '04',
    mei: '05', may: '05', jun: '06', juni: '06', june: '06',
    jul: '07', juli: '07', july: '07', aug: '08', augustus: '08', august: '08',
    sep: '09', sept: '09', september: '09', okt: '10', oct: '10', oktober: '10', october: '10',
    nov: '11', november: '11', dec: '12', december: '12',
  };
  const namedMatch = str.match(/(\d{1,2})[\s\-\.]*([a-zA-Z]+)[\s\-\.,]*(\d{4})/);
  if (namedMatch) {
    const monthKey = namedMatch[2].toLowerCase();
    const m = MONTHS[monthKey];
    if (m) return `${namedMatch[3]}-${m}-${namedMatch[1].padStart(2, '0')}`;
  }
  // "March 8, 2026"
  const namedMatch2 = str.match(/([a-zA-Z]+)[\s\-\.]*(\d{1,2})[\s\-\.,]*(\d{4})/);
  if (namedMatch2) {
    const monthKey = namedMatch2[1].toLowerCase();
    const m = MONTHS[monthKey];
    if (m) return `${namedMatch2[3]}-${m}-${namedMatch2[2].padStart(2, '0')}`;
  }
  return undefined;
}

function extractAllDatesWithContext(text: string): Array<{ date: string; context: string; label?: string }> {
  const results: Array<{ date: string; context: string; label?: string }> = [];
  const lines = text.split('\n');
  
  for (const line of lines) {
    const parsed = extractDateFromString(line);
    if (!parsed) continue;
    
    const lower = line.toLowerCase();
    let label: string | undefined;
    if (/order\s*(?:date|datum)|besteldatum|bestelingsdatum|date\s*(?:de\s*)?commande/i.test(lower)) label = 'orderDate';
    else if (/delivery|levering|lever\s*datum|aflever|bezorg|livraison|date\s*(?:de\s*)?livraison/i.test(lower)) label = 'deliveryDate';
    else if (/invoice\s*date|factuur\s*datum|date\s*(?:de\s*)?facture/i.test(lower)) label = 'invoiceDate';
    else if (/vervaldatum|due\s*date|betaal\s*datum|date\s*d'échéance|échéance/i.test(lower)) label = 'dueDate';
    
    results.push({ date: parsed, context: line.trim(), label });
  }
  
  return results;
}

function extractSupplier(text: string): string | undefined {
  const patterns = [
    /(?:supplier|leverancier|vendor|geleverd\s*door|fournisseur|vendeur)[:\s]*([^\n]+)/gi,
    /(?:from|van|afzender|verzender|de\s*la\s*part\s*de|expéditeur)[:\s]*([^\n]+)/gi,
    /(?:company|bedrijf|firma|société|entreprise)[:\s]*([^\n]+)/gi,
    /(?:verkoper|seller)[:\s]*([^\n]+)/gi,
  ];
  for (const p of patterns) {
    p.lastIndex = 0;
    const m = p.exec(text);
    if (m) return m[1].trim().substring(0, 100);
  }
  // Try company name in first lines
  const lines = text.split('\n').slice(0, 10);
  for (const line of lines) {
    const cm = line.match(/^([A-Z][A-Za-z\s&àâéèêëïîôùûüçÀÂÉÈÊËÏÎÔÙÛÜÇ]+(?:B\.?V\.?|N\.?V\.?|BV|NV|GmbH|Inc|Ltd|LLC|S\.?A\.?|BVBA|SAS|SARL|SPRL)?)\s*$/);
    if (cm && cm[1].trim().length > 3 && cm[1].trim().length < 60) return cm[1].trim();
  }
  return undefined;
}

function extractOrderNumber(text: string): string | undefined {
  const patterns = [
    /(?:order\s*(?:no|nr|number|nummer)|bestelnummer|bestellnummer|bestelling|n°\s*(?:de\s*)?commande|commande\s*n°)[:\s#]*([A-Z0-9\-\/]+)/gi,
    /(?:po|p\.o\.)\s*[:\s#]*([A-Z0-9\-\/]+)/gi,
    /(?:reference|referentie|ref|référence|réf)[:\s#]*([A-Z0-9\-\/]+)/gi,
    /(?:document\s*(?:no|nr|nummer|n°))[:\s#]*([A-Z0-9\-\/]+)/gi,
    /(?:onze\s*ref|uw\s*ref|your\s*ref|our\s*ref|notre\s*réf|votre\s*réf)[:\s#]*([A-Z0-9\-\/]+)/gi,
  ];
  for (const p of patterns) {
    p.lastIndex = 0;
    const m = p.exec(text);
    if (m) return m[1].trim();
  }
  return undefined;
}

function extractInvoiceNumber(text: string): string | undefined {
  const patterns = [
    /(?:invoice\s*(?:no|nr|number|nummer)|factuur\s*(?:no|nr|nummer)|factuurnummer|facture\s*(?:n°|no|nr)|n°\s*(?:de\s*)?facture)[:\s#]*([A-Z0-9\-\/]+)/gi,
    /(?:bill\s*(?:no|nr)|bon\s*(?:de\s*)?commande)[:\s#]*([A-Z0-9\-\/]+)/gi,
  ];
  for (const p of patterns) {
    p.lastIndex = 0;
    const m = p.exec(text);
    if (m) return m[1].trim();
  }
  return undefined;
}

function extractCustomerNumber(text: string): string | undefined {
  const patterns = [
    /(?:klant(?:en)?(?:\s*nr|nummer)|customer\s*(?:no|nr|number|id)|debiteurnummer|debiteur\s*(?:nr|nummer)|n°\s*client|client\s*(?:n°|no|nr))[:\s#]*([A-Z0-9\-\/]+)/gi,
  ];
  for (const p of patterns) {
    p.lastIndex = 0;
    const m = p.exec(text);
    if (m) return m[1].trim();
  }
  return undefined;
}

function extractCurrency(text: string): string {
  if (/€|EUR\b/i.test(text)) return 'EUR';
  if (/\$|USD\b/i.test(text)) return 'USD';
  if (/£|GBP\b/i.test(text)) return 'GBP';
  return 'EUR'; // default
}

function extractTotals(text: string): { subtotal?: number; vatAmount?: number; vatPercentage?: number; discount?: number; shippingCost?: number; totalAmount?: number } {
  const result: ReturnType<typeof extractTotals> = {};

  // Subtotal
  const subMatch = text.match(/(?:subtotaal|subtotal|netto\s*bedrag|net\s*amount|sous[\-\s]?total|montant\s*h\.?t\.?)[:\s]*€?\s*([\d.,]+)/i);
  if (subMatch) result.subtotal = parseEuropeanNumber(subMatch[1]);

  // VAT / BTW / TVA
  const vatMatch = text.match(/(?:btw|vat|tva|mwst|tax)[:\s]*€?\s*([\d.,]+)/i);
  if (vatMatch) result.vatAmount = parseEuropeanNumber(vatMatch[1]);
  
  const vatPctMatch = text.match(/(?:btw|vat|tva|mwst|tax)\s*(\d{1,2})\s*%/i);
  if (vatPctMatch) result.vatPercentage = parseInt(vatPctMatch[1], 10);

  // Discount
  const discMatch = text.match(/(?:korting|discount|remise|rabat|réduction)[:\s]*-?\s*€?\s*([\d.,]+)/i);
  if (discMatch) result.discount = parseEuropeanNumber(discMatch[1]);

  // Shipping
  const shipMatch = text.match(/(?:verzend(?:kosten)?|shipping|transport|bezorg(?:kosten)?|franco|vracht|frais\s*(?:de\s*)?(?:port|livraison|expédition))[:\s]*€?\s*([\d.,]+)/i);
  if (shipMatch) result.shippingCost = parseEuropeanNumber(shipMatch[1]);

  // Grand total
  const totalPatterns = [
    /(?:totaal\s*(?:bedrag|incl|inc)|total\s*(?:amount|incl)|grand\s*total|te\s*betalen|totaal\s*€|total\s*t\.?t\.?c\.?|montant\s*t\.?t\.?c\.?|net\s*à\s*payer)[:\s]*€?\s*([\d.,]+)/i,
    /(?:^|\n)\s*(?:totaal|total)\s*€?\s*([\d.,]+)\s*(?:$|\n)/im,
  ];
  for (const p of totalPatterns) {
    const m = text.match(p);
    if (m) { result.totalAmount = parseEuropeanNumber(m[1]); break; }
  }

  return result;
}

function extractPaymentTerms(text: string): string | undefined {
  const patterns = [
    /(?:betaal(?:termijn|conditie|voorwaarden)|payment\s*(?:terms?|conditions?)|betalingsvoorwaarden|conditions?\s*de\s*paiement|modalités?\s*de\s*paiement)[:\s]*([^\n]+)/gi,
    /(?:betaling\s*binnen|payment\s*within|net\s*|paiement\s*(?:à|sous)\s*)\s*(\d+)\s*(?:dagen|days|jours)/gi,
  ];
  for (const p of patterns) {
    p.lastIndex = 0;
    const m = p.exec(text);
    if (m) return m[1]?.trim() || m[0].trim();
  }
  return undefined;
}

function extractDeliveryAddress(text: string): string | undefined {
  const patterns = [
    /(?:aflever\s*adres|delivery\s*address|bezorg\s*adres|ship\s*to|levering\s*aan|adresse\s*(?:de\s*)?livraison|livrer\s*à)[:\s]*\n?((?:[^\n]+\n?){1,4})/gi,
  ];
  for (const p of patterns) {
    p.lastIndex = 0;
    const m = p.exec(text);
    if (m) return m[1].replace(/\n/g, ', ').trim().substring(0, 200);
  }
  return undefined;
}

function extractContactInfo(text: string): { person?: string; phone?: string; email?: string } {
  const result: { person?: string; phone?: string; email?: string } = {};

  const personMatch = text.match(/(?:contact\s*(?:person|persoon)?|t\.a\.v\.?|attn\.?)[:\s]*([^\n]+)/i);
  if (personMatch) result.person = personMatch[1].trim().substring(0, 80);

  const phoneMatch = text.match(/(?:tel(?:efoon)?|phone|fax|gsm|mobiel)[:\s]*([\+\d\s\-\(\)]{8,20})/i);
  if (phoneMatch) result.phone = phoneMatch[1].trim();

  const emailMatch = text.match(/[\w.\-+]+@[\w.\-]+\.\w{2,}/i);
  if (emailMatch) result.email = emailMatch[0];

  return result;
}

// ─── SUPPLIER MATCHING ──────────────────────────────────────────────────────

function matchSupplier(extractedText: string, suppliers: SupplierMatch[]): SupplierMatch | undefined {
  if (!extractedText || suppliers.length === 0) return undefined;
  const norm = extractedText.toLowerCase().trim();

  // Exact match
  const exact = suppliers.find(s => s.name.toLowerCase().trim() === norm);
  if (exact) return exact;

  // Best partial match
  let best: SupplierMatch | undefined;
  let bestScore = 0;

  for (const s of suppliers) {
    const sn = s.name.toLowerCase().trim();
    if (norm.includes(sn) && sn.length > bestScore) { bestScore = sn.length; best = s; }
    if (sn.includes(norm) && norm.length > bestScore) { bestScore = norm.length; best = s; }
    
    const words = norm.split(/\s+/).filter(w => w.length > 2);
    const sWords = sn.split(/\s+/).filter(w => w.length > 2);
    const overlap = words.filter(tw => sWords.some(sw => sw.includes(tw) || tw.includes(sw)));
    const score = overlap.join('').length;
    if (score > bestScore) { bestScore = score; best = s; }
  }
  return best;
}

// ─── PRODUCT MATCHING ────────────────────────────────────────────────────────

function findMatchingProducts(text: string, products: ProductMatch[], materials: MaterialMatch[]): ParsedOrderItem[] {
  const items: ParsedOrderItem[] = [];
  const lines = text.split('\n').filter(l => l.trim());
  const foundCodes = new Set<string>();

  const productByCode = new Map<string, ProductMatch>();
  const productByName = new Map<string, ProductMatch>();
  for (const p of products) {
    if (p.article_code) productByCode.set(p.article_code.toLowerCase(), p);
    if (p.name) productByName.set(p.name.toLowerCase(), p);
  }

  const materialBySku = new Map<string, MaterialMatch>();
  for (const m of materials) {
    if (m.sku) materialBySku.set(m.sku.toLowerCase(), m);
  }

  for (const line of lines) {
    if (/^(item|artikel|description|omschrijving|qty|quantity|price|prijs|totaal|total|subtotal)/i.test(line.trim())) continue;

    for (const pattern of ARTICLE_CODE_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(line)) !== null) {
        const code = match[1];
        const cl = code.toLowerCase();
        if (foundCodes.has(cl)) continue;

        const product = productByCode.get(cl);
        if (product) {
          items.push({
            description: product.name,
            quantity: extractQuantityFromLine(line) || 1,
            article_code: product.article_code,
            unit_price: extractPriceFromLine(line),
            unit: extractUnitFromLine(line),
            matchConfidence: 'exact',
          });
          foundCodes.add(cl);
          continue;
        }

        const material = materialBySku.get(cl);
        if (material) {
          items.push({
            description: `${material.name} (${material.category})`,
            quantity: extractQuantityFromLine(line) || 1,
            article_code: material.sku,
            unit_price: extractPriceFromLine(line),
            unit: extractUnitFromLine(line),
            matchConfidence: 'exact',
          });
          foundCodes.add(cl);
        }
      }
    }

    // Name-based matching
    for (const [name, product] of productByName) {
      if (name.length > 5 && line.toLowerCase().includes(name)) {
        const key = (product.article_code || name).toLowerCase();
        if (!foundCodes.has(key)) {
          items.push({
            description: product.name,
            quantity: extractQuantityFromLine(line) || 1,
            article_code: product.article_code,
            unit_price: extractPriceFromLine(line),
            unit: extractUnitFromLine(line),
            matchConfidence: 'partial',
          });
          foundCodes.add(key);
        }
      }
    }
  }

  if (items.length === 0) {
    return extractTableItems(text);
  }

  return items;
}

function extractTableItems(text: string): ParsedOrderItem[] {
  const items: ParsedOrderItem[] = [];
  const lines = text.split('\n').filter(l => l.trim());

  for (const line of lines) {
    if (/^(item|artikel|description|omschrijving|qty|quantity|price|prijs|total|totaal|subtotal|btw|vat)/i.test(line.trim())) continue;
    if (line.trim().length < 5 || /^\d+$/.test(line.trim())) continue;

    const hasQuantity = /\b\d{1,4}\s*(st|stuk|pcs|x|m|kg|ltr|rol|set|pak)?\b/i.test(line);
    const hasCode = /\b[A-Z0-9\-\.\/]{5,}\b/.test(line);

    if (hasQuantity || hasCode) {
      const quantity = extractQuantityFromLine(line) || 1;
      const price = extractPriceFromLine(line);
      const articleCode = extractArticleCodeFromLine(line);
      const unit = extractUnitFromLine(line);

      let description = line
        .replace(/€\s*\d{1,3}(?:[\.\s]\d{3})*(?:,\d{1,2})?/g, '')
        .replace(/\d{1,3}(?:[\.\s]\d{3})*(?:,\d{1,2})?\s*€/g, '')
        .replace(/\b\d{1,4}\s*(?:st|stuk|stuks|pcs|x|m|mtr|kg|ltr|set|rol|pak|doos|paar)\b/gi, '')
        .trim();

      if (articleCode) {
        description = description.replace(new RegExp(articleCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
      }
      description = description.replace(/\s+/g, ' ').trim().substring(0, 200);
      if (description.length > 3) {
        items.push({ description, quantity, article_code: articleCode, unit_price: price, unit, matchConfidence: 'none' });
      }
    }
  }

  return items.slice(0, 200);
}

// ─── MAIN PARSE ──────────────────────────────────────────────────────────────

export async function parsePDFForOrder(
  file: File,
  products: ProductMatch[],
  materials: MaterialMatch[],
  suppliers?: SupplierMatch[]
): Promise<ParsedOrderData> {
  const warnings: string[] = [];

  // Extract text with positions for table parsing
  let tableData: Record<string, string>[] = [];

  try {
    const pagesItems = await extractTextWithPositions(file);
    let detectedColumns: Map<string, number> | null = null;
    let detectedHeaderRow = -1;

    for (let pi = 0; pi < pagesItems.length; pi++) {
      const rows = groupIntoRows(pagesItems[pi], pi);
      const merged = mergeMultiLineRows(rows);

      // Try to detect columns from this page (re-use across pages)
      if (!detectedColumns || detectedColumns.size < 2) {
        const { columns, headerRowIndex } = detectColumns(merged);
        if (columns.size >= 2) {
          detectedColumns = columns;
          detectedHeaderRow = headerRowIndex;
          const pageData = extractTableData(merged, columns, headerRowIndex);
          tableData.push(...pageData);
          continue;
        }
      }

      if (detectedColumns && detectedColumns.size >= 2) {
        // Continuation page – use same columns, start from row 0
        const pageData = extractTableData(merged, detectedColumns, -1);
        tableData.push(...pageData);
      } else {
        const heuristic = extractHeuristicTableData(merged);
        tableData.push(...heuristic);
      }
    }
  } catch (e) {
    console.warn('Table extraction failed, falling back to text extraction:', e);
    warnings.push('Table structure could not be parsed; used text fallback');
  }

  // Plain text for metadata
  const text = await extractTextFromPDF(file);

  console.log('Extracted PDF text (first 1500 chars):', text.substring(0, 1500));
  console.log('Table data extracted:', tableData.length, 'rows');

  // ── Metadata extraction ──
  const extractedSupplier = extractSupplier(text);
  const orderNumber = extractOrderNumber(text);
  const invoiceNumber = extractInvoiceNumber(text);
  const customerNumber = extractCustomerNumber(text);
  const currency = extractCurrency(text);
  const totals = extractTotals(text);
  const paymentTerms = extractPaymentTerms(text);
  const deliveryAddress = extractDeliveryAddress(text);
  const contact = extractContactInfo(text);

  // Supplier matching
  let matchedSupplier: SupplierMatch | undefined;
  if (extractedSupplier && suppliers?.length) {
    matchedSupplier = matchSupplier(extractedSupplier, suppliers);
    console.log('Matched supplier:', matchedSupplier?.name || 'none', 'from extracted:', extractedSupplier);
  }

  // Date extraction
  const datesWithContext = extractAllDatesWithContext(text);
  let orderDate = datesWithContext.find(d => d.label === 'orderDate')?.date;
  let expectedDelivery = datesWithContext.find(d => d.label === 'deliveryDate')?.date;

  if (!orderDate && !expectedDelivery) {
    const allDates = datesWithContext.map(d => d.date).sort();
    if (allDates.length > 0) orderDate = allDates[0];
    if (allDates.length > 1) expectedDelivery = allDates[allDates.length - 1];
  }
  if (!orderDate && datesWithContext.length > 0) {
    orderDate = datesWithContext[0].date;
  }

  // ── Build items ──
  let items: ParsedOrderItem[] = [];

  if (tableData.length > 0) {
    console.log('Table data sample:', JSON.stringify(tableData.slice(0, 3)));
    items = tableData.map(row => {
      let description = row['description'] || '';
      let article_code = row['article_code'] || '';
      let ean = row['ean'] || '';
      const quantity = parseQuantityValue(row['quantity']) || 1;
      const unit_price = parsePriceValue(row['price']);
      const total_price = parsePriceValue(row['total'] || row['subtotal']);
      const unit = row['unit'] || extractUnitFromLine(row['quantity'] || '') || undefined;
      const discount = parsePriceValue(row['discount']);

      // If we have an EAN column value but no article_code, check if description has embedded code
      if (!article_code && ean) {
        // EAN is the barcode; try to extract the real article code from description
        const embeddedCode = extractEmbeddedArticleCode(description);
        if (embeddedCode) {
          article_code = embeddedCode.code;
          description = embeddedCode.remainingDescription;
        } else {
          // Use EAN as article code fallback
          article_code = ean;
        }
      }

      // If article_code column captured what looks like an EAN (13 digits), move it
      if (article_code && /^\d{12,13}$/.test(article_code.trim()) && !ean) {
        ean = article_code.trim();
        const embeddedCode = extractEmbeddedArticleCode(description);
        if (embeddedCode) {
          article_code = embeddedCode.code;
          description = embeddedCode.remainingDescription;
        }
      }

      if (!description && article_code) description = article_code;
      if ((!article_code || article_code.length > 30) && description) {
        const embeddedCode = extractEmbeddedArticleCode(description);
        if (embeddedCode) {
          article_code = embeddedCode.code;
          description = embeddedCode.remainingDescription;
        } else {
          const extracted = extractArticleCodeFromLine(description);
          if (extracted) article_code = extracted;
        }
      }

      // Clean description: remove the article code if it's at the start
      if (article_code && description.startsWith(article_code)) {
        description = description.substring(article_code.length).trim();
      }

      // Determine match confidence by checking against products DB
      let matchConfidence: 'exact' | 'partial' | 'none' = 'none';
      const codesToCheck = [article_code, ean].filter(Boolean);
      for (const code of codesToCheck) {
        const codeLower = code.toLowerCase();
        if (products.some(p => p.article_code?.toLowerCase() === codeLower)) { matchConfidence = 'exact'; break; }
        if (materials.some(m => m.sku?.toLowerCase() === codeLower)) { matchConfidence = 'exact'; break; }
      }

      return { description, quantity, article_code, ean: ean || undefined, unit_price, total_price, unit, discount, matchConfidence };
    }).filter(item => item.description || item.article_code);
  }

  if (items.length === 0) {
    items = findMatchingProducts(text, products, materials);
  }

  // Warnings
  if (items.length === 0) warnings.push('No order items could be extracted from this PDF');
  if (!extractedSupplier && !matchedSupplier) warnings.push('Supplier could not be detected');
  if (!orderDate) warnings.push('Order date could not be detected');

  // Confidence scoring
  let confidence: 'high' | 'medium' | 'low' = 'low';
  const signals = [
    items.length > 0,
    !!matchedSupplier || !!extractedSupplier,
    !!orderDate,
    !!orderNumber || !!invoiceNumber,
    items.some(i => i.matchConfidence === 'exact'),
    tableData.length > 0,
  ];
  const trueCount = signals.filter(Boolean).length;
  if (trueCount >= 5) confidence = 'high';
  else if (trueCount >= 3) confidence = 'medium';

  return {
    supplier: matchedSupplier?.name || extractedSupplier,
    matchedSupplierId: matchedSupplier?.id,
    orderDate,
    expectedDelivery,
    orderNumber,
    invoiceNumber,
    referenceNumber: orderNumber, // alias
    customerNumber,
    currency,
    subtotal: totals.subtotal,
    vatAmount: totals.vatAmount,
    vatPercentage: totals.vatPercentage,
    discount: totals.discount,
    shippingCost: totals.shippingCost,
    totalAmount: totals.totalAmount,
    paymentTerms,
    deliveryAddress,
    contactPerson: contact.person,
    contactPhone: contact.phone,
    contactEmail: contact.email,
    notes: [orderNumber && `Order #${orderNumber}`, invoiceNumber && `Invoice #${invoiceNumber}`].filter(Boolean).join(' · ') || undefined,
    rawText: text,
    items,
    extractionConfidence: confidence,
    warnings,
  };
}
