// PDF parsing service for extracting order data from PDFs
// Uses client-side text extraction and pattern matching (no AI)

export interface ParsedOrderData {
  supplier?: string;
  matchedSupplierId?: string;
  orderDate?: string;
  expectedDelivery?: string;
  orderNumber?: string;
  notes?: string;
  items: ParsedOrderItem[];
}

export interface ParsedOrderItem {
  description: string;
  quantity: number;
  article_code: string;
  unit_price?: number;
  notes?: string;
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
}

// Common quantity patterns
const QUANTITY_PATTERNS = [
  /(\d+)\s*(st|stuk|stuks|pcs|pieces|x|qty|aantal)/gi,
  /qty[:\s]*(\d+)/gi,
  /quantity[:\s]*(\d+)/gi,
  /aantal[:\s]*(\d+)/gi,
];

// Article code patterns - more comprehensive
const ARTICLE_CODE_PATTERNS = [
  /\b([A-Z0-9]{2,}\/[^\s]{2,})\b/gi, // Codes with slashes: LB4F/EBL9KA500x734
  /\b([A-Z]{2,5}[\-\.\s]?\d{4,10}[A-Z0-9]*)\b/gi, // XX-12345678
  /\b(\d{5,13})\b/g, // EAN or numeric codes (5-13 digits)
  /art[\.:]?\s*(?:nr|code|nummer)?[:\s]*([A-Z0-9\-\.]+)/gi,
  /article[:\s]*([A-Z0-9\-\.]+)/gi,
  /code[:\s]*([A-Z0-9\-\.]+)/gi,
  /\b([A-Z0-9]{3,}\-[A-Z0-9\-]+)\b/g, // Code with dashes
];

// Price patterns
const PRICE_PATTERNS = [
  /€\s*(\d+(?:[,\.]\d{1,2})?)/g,
  /EUR\s*(\d+(?:[,\.]\d{1,2})?)/gi,
  /(\d+(?:[,\.]\d{1,2})?)\s*€/g,
  /prijs[:\s]*€?\s*(\d+(?:[,\.]\d{1,2})?)/gi,
  /price[:\s]*€?\s*(\d+(?:[,\.]\d{1,2})?)/gi,
];

export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  
  // Use pdfjs-dist v3.x for client-side PDF parsing (v3 doesn't use top-level await)
  const pdfjsLib = await import('pdfjs-dist');
  
  // Configure worker for v3.x
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  
  const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n';
  }
  
  return fullText;
}

// Extract text items with position information for table parsing
async function extractTextWithPositions(file: File): Promise<TextItem[][]> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  
  const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;
  const allPages: TextItem[][] = [];
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    const items: TextItem[] = textContent.items.map((item: any) => ({
      str: item.str,
      transform: item.transform,
      x: item.transform[4],
      y: item.transform[5],
      width: item.width,
      height: item.height || 10
    }));
    
    allPages.push(items);
  }
  
  return allPages;
}

// Group text items into rows based on Y-coordinate
function groupIntoRows(items: TextItem[], yTolerance: number = 5): TableRow[] {
  if (items.length === 0) return [];
  
  // Sort by Y (descending - PDF coordinates start from bottom)
  const sorted = [...items].sort((a, b) => b.y - a.y);
  
  const rows: TableRow[] = [];
  let currentRow: TableRow = { y: sorted[0].y, items: [] };
  
  for (const item of sorted) {
    if (Math.abs(item.y - currentRow.y) <= yTolerance) {
      currentRow.items.push(item);
    } else {
      if (currentRow.items.length > 0) {
        // Sort items within row by X coordinate
        currentRow.items.sort((a, b) => a.x - b.x);
        rows.push(currentRow);
      }
      currentRow = { y: item.y, items: [item] };
    }
  }
  
  if (currentRow.items.length > 0) {
    currentRow.items.sort((a, b) => a.x - b.x);
    rows.push(currentRow);
  }
  
  return rows;
}

// Detect column positions from header row
function detectColumns(rows: TableRow[]): Map<string, number> {
  const columnHeaders = new Map<string, number>();
  
  // Common header keywords and their variations
  const headerPatterns: Record<string, RegExp> = {
    'article_code': /^(art|article|code|artikelcode|artikel|artnr|art\.nr|item|sku|ean|product\s*code)/i,
    'description': /^(description|omschrijving|desc|naam|name|product|artikel\s*naam|item\s*description)/i,
    'quantity': /^(qty|quantity|aantal|hoeveelheid|stuks|pcs|aant|besteld)/i,
    'price': /^(price|prijs|unit\s*price|eenheid|bedrag|€|eur|amount|e\.?\s*prijs|e\.?\s*price|e\.?prijs\s*eur)/i,
  };
  
  // Look for header row in first 10 rows
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i];
    const rowText = row.items.map(item => item.str.toLowerCase().trim()).join(' ');
    
    // Check if this row contains multiple header keywords
    let headerCount = 0;
    for (const pattern of Object.values(headerPatterns)) {
      if (pattern.test(rowText)) headerCount++;
    }
    
    if (headerCount >= 2) {
      // This is likely a header row
      for (const item of row.items) {
        const text = item.str.toLowerCase().trim();
        for (const [columnName, pattern] of Object.entries(headerPatterns)) {
          if (pattern.test(text)) {
            columnHeaders.set(columnName, item.x);
            break;
          }
        }
      }
      break;
    }
  }
  
  return columnHeaders;
}

function parseQuantityValue(value?: string): number | undefined {
  if (!value) return undefined;
  // Support formats like "20,00" or "20.00" or "20"
  const cleaned = value
    .replace(/\s/g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.]/g, '');
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.round(n);
}

function parsePriceValue(value?: string): number | undefined {
  if (!value) return undefined;
  const cleaned = value
    .replace(/\s/g, '')
    .replace(/€/g, '')
    .replace(/EUR/gi, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.]/g, '');
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

function extractHeuristicTableData(rows: TableRow[]): Record<string, string>[] {
  const result: Record<string, string>[] = [];

  for (const row of rows) {
    const line = row.items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim();
    if (!line) continue;

    // Skip likely headers/footers
    if (/^(artikel|omschrijving|aantal|qty|quantity|price|prijs|datum|date)\b/i.test(line)) continue;
    if (/^totaal/i.test(line)) continue;

    const articleCode = extractArticleCodeFromLine(line);
    const qty = extractQuantityFromLine(line);
    const price = extractPriceFromLine(line);

    // Require at least a code OR a quantity to consider it an item row
    if (!articleCode && !qty) continue;

    let description = line;
    if (articleCode) {
      description = description.replace(new RegExp(articleCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
    }
    if (price !== undefined) {
      description = description.replace(/€\s*\d+(?:[\.,]\d{1,2})?/g, '');
      description = description.replace(/\d+(?:[\.,]\d{1,2})?\s*€/g, '');
    }
    if (qty !== undefined) {
      description = description.replace(/\b\d{1,4}(?:[\.,]\d+)?\b/g, '');
    }
    description = description.replace(/\s+/g, ' ').trim();
    if (!description && articleCode) description = articleCode;

    result.push({
      description,
      article_code: articleCode || '',
      quantity: qty !== undefined ? String(qty) : '1',
      price: price !== undefined ? String(price) : '',
    });
  }

  return result;
}

// Extract table rows with column assignment
function extractTableData(rows: TableRow[], columnPositions: Map<string, number>): Record<string, string>[] {
  const result: Record<string, string>[] = [];
  const columns = Array.from(columnPositions.entries()).sort((a, b) => a[1] - b[1]);
  
  if (columns.length === 0) return result;
  
  // Find the header row index
  let headerIndex = -1;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const rowText = rows[i].items.map(item => item.str.toLowerCase().trim()).join(' ');
    if (/artikel|product|beschrijving|quantity|qty|hoeveelheid/i.test(rowText)) {
      headerIndex = i;
      break;
    }
  }
  
  // Process rows after header
  const dataRows = headerIndex >= 0 ? rows.slice(headerIndex + 1) : rows.slice(3);
  
  for (const row of dataRows) {
    // Skip rows with very few characters (likely empty or separator rows)
    const totalText = row.items.map(i => i.str).join('').trim();
    if (totalText.length < 3) continue;
    
    const record: Record<string, string> = {};
    
    for (const item of row.items) {
      // Find which column this item belongs to
      let bestColumn = '';
      let minDistance = Infinity;
      
      for (const [colName, colX] of columns) {
        const distance = Math.abs(item.x - colX);
        if (distance < minDistance && distance < 100) { // 100px tolerance
          minDistance = distance;
          bestColumn = colName;
        }
      }
      
      if (bestColumn) {
        record[bestColumn] = (record[bestColumn] || '') + ' ' + item.str;
      }
    }
    
    // Clean up values
    for (const key of Object.keys(record)) {
      record[key] = record[key].trim();
    }
    
    // Only add if we have some meaningful data
    if (record['description'] || record['article_code']) {
      result.push(record);
    }
  }
  
  return result;
}

function extractDateFromString(str: string): string | undefined {
  // Try DD/MM/YYYY format
  const dmyMatch = str.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Try YYYY-MM-DD format
  const ymdMatch = str.match(/(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return undefined;
}

// Match extracted supplier text against database suppliers
function matchSupplier(extractedText: string, suppliers: SupplierMatch[]): SupplierMatch | undefined {
  if (!extractedText || suppliers.length === 0) return undefined;
  
  const normalizedText = extractedText.toLowerCase().trim();
  
  // First, try exact match
  const exactMatch = suppliers.find(s => 
    s.name.toLowerCase().trim() === normalizedText
  );
  if (exactMatch) return exactMatch;
  
  // Try partial match - supplier name contained in text or vice versa
  let bestMatch: SupplierMatch | undefined;
  let bestScore = 0;
  
  for (const supplier of suppliers) {
    const supplierName = supplier.name.toLowerCase().trim();
    
    // Check if supplier name is in the extracted text
    if (normalizedText.includes(supplierName)) {
      const score = supplierName.length;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = supplier;
      }
    }
    
    // Check if extracted text is in supplier name
    if (supplierName.includes(normalizedText)) {
      const score = normalizedText.length;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = supplier;
      }
    }
    
    // Check word overlap
    const textWords = normalizedText.split(/\s+/).filter(w => w.length > 2);
    const supplierWords = supplierName.split(/\s+/).filter(w => w.length > 2);
    
    const matchingWords = textWords.filter(tw => 
      supplierWords.some(sw => sw.includes(tw) || tw.includes(sw))
    );
    
    if (matchingWords.length > 0) {
      const score = matchingWords.join('').length;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = supplier;
      }
    }
  }
  
  return bestMatch;
}

function extractSupplier(text: string): string | undefined {
  const supplierPatterns = [
    /(?:supplier|leverancier|vendor)[:\s]*([^\n]+)/gi,
    /(?:from|van|afzender)[:\s]*([^\n]+)/gi,
    /(?:company|bedrijf|firma)[:\s]*([^\n]+)/gi,
    /(?:verkoper|seller)[:\s]*([^\n]+)/gi,
  ];

  for (const pattern of supplierPatterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match) {
      return match[1].trim().substring(0, 100);
    }
  }

  // Try to find company name in first few lines (often contains sender info)
  const lines = text.split('\n').slice(0, 10);
  for (const line of lines) {
    // Look for patterns like "Company Name" or "Company Name B.V." or "Company Name BV"
    const companyMatch = line.match(/^([A-Z][A-Za-z\s&]+(?:B\.?V\.?|N\.?V\.?|BV|NV|GmbH|Inc|Ltd|LLC)?)\s*$/);
    if (companyMatch) {
      const name = companyMatch[1].trim();
      if (name.length > 3 && name.length < 60) {
        return name;
      }
    }
  }

  return undefined;
}

function extractOrderNumber(text: string): string | undefined {
  const patterns = [
    /(?:order\s*(?:no|nr|number|nummer)|bestelnummer|bestellnummer)[:\s#]*([A-Z0-9\-]+)/gi,
    /(?:po|p\.o\.)[:\s#]*([A-Z0-9\-]+)/gi,
    /(?:reference|referentie|ref)[:\s#]*([A-Z0-9\-]+)/gi,
    /(?:document\s*(?:no|nr|nummer))[:\s#]*([A-Z0-9\-]+)/gi,
  ];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match) {
      return match[1].trim();
    }
  }

  return undefined;
}

function extractQuantityFromLine(line: string): number | undefined {
  for (const pattern of QUANTITY_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(line);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  
  // Try to find standalone numbers that look like quantities (1-4 digits, at start or with context)
  const qtyMatch = line.match(/^\s*(\d{1,4})\s+/);
  if (qtyMatch) {
    const qty = parseInt(qtyMatch[1], 10);
    if (qty > 0 && qty < 10000) {
      return qty;
    }
  }
  
  return undefined;
}

function extractPriceFromLine(line: string): number | undefined {
  for (const pattern of PRICE_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(line);
    if (match) {
      return parseFloat(match[1].replace(',', '.'));
    }
  }
  return undefined;
}

function extractArticleCodeFromLine(line: string): string {
  for (const pattern of ARTICLE_CODE_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(line);
    if (match) {
      return match[1];
    }
  }
  return '';
}

function findMatchingProducts(
  text: string,
  products: ProductMatch[],
  materials: MaterialMatch[]
): ParsedOrderItem[] {
  const items: ParsedOrderItem[] = [];
  const lines = text.split('\n').filter(line => line.trim());
  const foundCodes = new Set<string>();
  
  // Create lookup maps for faster matching
  const productByCode = new Map<string, ProductMatch>();
  const productByName = new Map<string, ProductMatch>();
  
  for (const product of products) {
    if (product.article_code) {
      productByCode.set(product.article_code.toLowerCase(), product);
    }
    if (product.name) {
      productByName.set(product.name.toLowerCase(), product);
    }
  }

  const materialBySku = new Map<string, MaterialMatch>();
  const materialByName = new Map<string, MaterialMatch>();
  
  for (const material of materials) {
    if (material.sku) {
      materialBySku.set(material.sku.toLowerCase(), material);
    }
    materialByName.set(material.name.toLowerCase(), material);
  }

  // Process each line looking for items
  for (const line of lines) {
    const lineLower = line.toLowerCase();
    
    // Skip header-like lines
    if (/^(item|artikel|description|omschrijving|qty|quantity|price|prijs|totaal|total|subtotal)/i.test(line.trim())) {
      continue;
    }
    
    // Try to find product by article code first
    for (const pattern of ARTICLE_CODE_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(line)) !== null) {
        const code = match[1];
        const codeLower = code.toLowerCase();
        
        if (foundCodes.has(codeLower)) continue;
        
        const product = productByCode.get(codeLower);
        if (product) {
          const quantity = extractQuantityFromLine(line) || 1;
          const price = extractPriceFromLine(line);
          items.push({
            description: product.name,
            quantity: quantity,
            article_code: product.article_code,
            unit_price: price,
          });
          foundCodes.add(codeLower);
        }
        
        // Check materials
        const material = materialBySku.get(codeLower);
        if (material && !foundCodes.has(codeLower)) {
          const quantity = extractQuantityFromLine(line) || 1;
          const price = extractPriceFromLine(line);
          items.push({
            description: `${material.name} (${material.category})`,
            quantity: quantity,
            article_code: material.sku,
            unit_price: price,
          });
          foundCodes.add(codeLower);
        }
      }
    }

    // Try to find product by name (partial matching for names > 5 chars)
    for (const [name, product] of productByName) {
      if (name.length > 5 && lineLower.includes(name)) {
        const codeKey = (product.article_code || name).toLowerCase();
        if (!foundCodes.has(codeKey)) {
          const quantity = extractQuantityFromLine(line) || 1;
          const price = extractPriceFromLine(line);
          items.push({
            description: product.name,
            quantity: quantity,
            article_code: product.article_code,
            unit_price: price,
          });
          foundCodes.add(codeKey);
        }
      }
    }
  }

  // If no matches found, try to extract generic items from table-like structures
  if (items.length === 0) {
    const tableItems = extractTableItems(text);
    items.push(...tableItems);
  }

  return items;
}

function extractTableItems(text: string): ParsedOrderItem[] {
  const items: ParsedOrderItem[] = [];
  const lines = text.split('\n').filter(line => line.trim());
  
  // Look for lines that appear to be table rows with item data
  for (const line of lines) {
    // Skip header-like lines
    if (/^(item|artikel|description|omschrijving|qty|quantity|price|prijs|total)/i.test(line.trim())) {
      continue;
    }
    
    // Skip very short lines or lines that are just numbers
    if (line.trim().length < 5 || /^\d+$/.test(line.trim())) {
      continue;
    }
    
    // Look for lines with numeric data that suggest they're order items
    const hasQuantity = /\b\d{1,4}\s*(st|stuk|pcs|x)?\b/i.test(line);
    const hasCode = /\b[A-Z0-9\-\.]{5,}\b/.test(line);
    
    if (hasQuantity || hasCode) {
      const quantity = extractQuantityFromLine(line) || 1;
      const price = extractPriceFromLine(line);
      const articleCode = extractArticleCodeFromLine(line);
      
      // Clean description: remove prices, quantities, and article codes
      let description = line
        .replace(/\d+[,\.]\d{2}\s*€?/g, '') // Remove prices
        .replace(/€\s*\d+/g, '')
        .replace(/\b\d{1,4}\s*(st|stuk|pcs|x)?\b/gi, '') // Remove quantities
        .trim();
      
      // Remove the article code from description if found
      if (articleCode) {
        description = description.replace(new RegExp(articleCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
      }
      
      description = description.replace(/\s+/g, ' ').trim().substring(0, 200);
      
      if (description.length > 3) {
        items.push({
          description,
          quantity,
          article_code: articleCode,
          unit_price: price,
        });
      }
    }
  }
  
  return items.slice(0, 100); // Limit to 100 items
}

// Main parse function with enhanced features
export async function parsePDFForOrder(
  file: File,
  products: ProductMatch[],
  materials: MaterialMatch[],
  suppliers?: SupplierMatch[]
): Promise<ParsedOrderData> {
  // Extract text with positions for table parsing
  let tableData: Record<string, string>[] = [];
  
  try {
    const textWithPositions = await extractTextWithPositions(file);
    
    for (const pageItems of textWithPositions) {
      const rows = groupIntoRows(pageItems);
      const columnPositions = detectColumns(rows);
      
      if (columnPositions.size >= 2) {
        const pageData = extractTableData(rows, columnPositions);
        tableData.push(...pageData);
        } else {
          // Fallback: attempt to parse item rows even when headers/columns aren't detected reliably
          const heuristic = extractHeuristicTableData(rows);
          tableData.push(...heuristic);
      }
    }
  } catch (e) {
    console.log('Table extraction failed, falling back to text extraction:', e);
  }
  
  // Also extract plain text for metadata and fallback matching
  const text = await extractTextFromPDF(file);
  
  console.log('Extracted PDF text:', text.substring(0, 1000));
  console.log('Table data extracted:', tableData.length, 'rows');
  
  const extractedSupplier = extractSupplier(text);
  const orderNumber = extractOrderNumber(text);
  
  // Match supplier against database
  let matchedSupplier: SupplierMatch | undefined;
  if (extractedSupplier && suppliers && suppliers.length > 0) {
    matchedSupplier = matchSupplier(extractedSupplier, suppliers);
    console.log('Matched supplier:', matchedSupplier?.name || 'none', 'from extracted:', extractedSupplier);
  }
  
  // Extract dates
  const orderDateMatch = text.match(/(?:order\s*date|besteldatum|datum|date)[:\s]*([^\n]+)/gi);
  const deliveryDateMatch = text.match(/(?:delivery|levering|lever|expected)[^\n]*[:\s]*([^\n]+)/gi);
  
  let orderDate: string | undefined;
  let expectedDelivery: string | undefined;
  
  if (orderDateMatch) {
    orderDate = extractDateFromString(orderDateMatch[0]);
  }
  
  if (deliveryDateMatch) {
    expectedDelivery = extractDateFromString(deliveryDateMatch[0]);
  }
  
  // If no specific dates found, look for any dates in the document
  if (!orderDate || !expectedDelivery) {
    const allDates: string[] = [];
    const datePattern = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/g;
    let match;
    while ((match = datePattern.exec(text)) !== null) {
      const parsed = extractDateFromString(match[0]);
      if (parsed) allDates.push(parsed);
    }
    
    if (allDates.length > 0) {
      allDates.sort();
      if (!orderDate) orderDate = allDates[0];
      if (!expectedDelivery && allDates.length > 1) expectedDelivery = allDates[allDates.length - 1];
    }
  }
  
  // Build items from table data first
  let items: ParsedOrderItem[] = [];
  
  if (tableData.length > 0) {
    items = tableData
      .map(row => {
        let description = row['description'] || '';
        let article_code = row['article_code'] || '';
        const quantity = parseQuantityValue(row['quantity']) || 1;
        const unit_price = parsePriceValue(row['price']);

        // Some suppliers put the full line in "Artikel" (incl. description). Ensure we always have a description.
        if (!description && article_code) {
          description = article_code;
        }

        // Try to extract a clean article code from description if needed
        if ((!article_code || article_code.length > 30) && description) {
          const extracted = extractArticleCodeFromLine(description);
          if (extracted) article_code = extracted;
        }

        return {
          description,
          quantity,
          article_code,
          unit_price,
        };
      })
      .filter(item => item.description || item.article_code);
  }
  
  // If no table items, try text-based matching
  if (items.length === 0) {
    items = findMatchingProducts(text, products, materials);
  }
  
  return {
    supplier: matchedSupplier?.name || extractedSupplier,
    matchedSupplierId: matchedSupplier?.id,
    orderDate,
    expectedDelivery,
    orderNumber,
    notes: orderNumber ? `Order #${orderNumber}` : undefined,
    items,
  };
}
