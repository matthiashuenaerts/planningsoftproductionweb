// PDF parsing service for extracting order data from PDFs
// Uses client-side text extraction and pattern matching (no AI)

export interface ParsedOrderData {
  supplier?: string;
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

// Common date patterns in various formats
const DATE_PATTERNS = [
  /(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})/g, // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  /(\d{4})[\/\-\.](\d{2})[\/\-\.](\d{2})/g, // YYYY/MM/DD, YYYY-MM-DD, YYYY.MM.DD
  /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)[a-z]*\s+(\d{4})/gi,
];

// Common quantity patterns
const QUANTITY_PATTERNS = [
  /(\d+)\s*(st|stuk|stuks|pcs|pieces|x|qty|aantal)/gi,
  /qty[:\s]*(\d+)/gi,
  /quantity[:\s]*(\d+)/gi,
  /aantal[:\s]*(\d+)/gi,
  /^(\d+)\s+(?=[A-Z])/gm, // Number at start of line followed by text
];

// Article code patterns
const ARTICLE_CODE_PATTERNS = [
  /\b([A-Z]{2,4}[\-\s]?\d{4,8})\b/g, // XX-1234567
  /\b(\d{6,13})\b/g, // EAN or numeric codes
  /art[\.:]?\s*(?:nr|code|nummer)?[:\s]*([A-Z0-9\-]+)/gi,
  /article[:\s]*([A-Z0-9\-]+)/gi,
  /code[:\s]*([A-Z0-9\-]+)/gi,
];

// Price patterns
const PRICE_PATTERNS = [
  /€\s*(\d+[,\.]\d{2})/g,
  /EUR\s*(\d+[,\.]\d{2})/gi,
  /(\d+[,\.]\d{2})\s*€/g,
  /prijs[:\s]*€?\s*(\d+[,\.]\d{2})/gi,
  /price[:\s]*€?\s*(\d+[,\.]\d{2})/gi,
];

export async function extractTextFromPDF(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Use pdfjs-dist for client-side PDF parsing
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
        
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
        
        resolve(fullText);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

function parseDate(text: string): string | undefined {
  // Look for date labels first
  const dateLabels = [
    /(?:order\s*date|besteldatum|datum)[:\s]*([^\n]+)/gi,
    /(?:delivery\s*date|leverdatum|leveringsdatum)[:\s]*([^\n]+)/gi,
    /(?:expected|verwacht)[:\s]*([^\n]+)/gi,
  ];

  for (const pattern of dateLabels) {
    const match = pattern.exec(text);
    if (match) {
      const dateStr = match[1].trim();
      const parsed = extractDateFromString(dateStr);
      if (parsed) return parsed;
    }
  }

  return undefined;
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

function extractSupplier(text: string): string | undefined {
  const supplierPatterns = [
    /(?:supplier|leverancier|vendor)[:\s]*([^\n]+)/gi,
    /(?:from|van)[:\s]*([^\n]+)/gi,
    /(?:company|bedrijf)[:\s]*([^\n]+)/gi,
  ];

  for (const pattern of supplierPatterns) {
    const match = pattern.exec(text);
    if (match) {
      return match[1].trim().substring(0, 100);
    }
  }

  return undefined;
}

function extractOrderNumber(text: string): string | undefined {
  const patterns = [
    /(?:order\s*(?:no|nr|number|nummer)|bestelnummer)[:\s#]*([A-Z0-9\-]+)/gi,
    /(?:po|p\.o\.)[:\s#]*([A-Z0-9\-]+)/gi,
    /(?:reference|referentie)[:\s#]*([A-Z0-9\-]+)/gi,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) {
      return match[1].trim();
    }
  }

  return undefined;
}

function findMatchingProducts(
  text: string,
  products: ProductMatch[],
  materials: MaterialMatch[]
): ParsedOrderItem[] {
  const items: ParsedOrderItem[] = [];
  const lines = text.split('\n').filter(line => line.trim());
  
  // Create lookup maps for faster matching
  const productByCode = new Map<string, ProductMatch>();
  const productByName = new Map<string, ProductMatch>();
  
  for (const product of products) {
    if (product.article_code) {
      productByCode.set(product.article_code.toLowerCase(), product);
    }
    productByName.set(product.name.toLowerCase(), product);
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
    
    // Try to find product by article code
    for (const pattern of ARTICLE_CODE_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(line)) !== null) {
        const code = match[1];
        const product = productByCode.get(code.toLowerCase());
        if (product) {
          const quantity = extractQuantityFromLine(line);
          const price = extractPriceFromLine(line);
          items.push({
            description: product.name,
            quantity: quantity || 1,
            article_code: product.article_code,
            unit_price: price,
          });
        }
      }
    }

    // Try to find product by name (partial matching)
    for (const [name, product] of productByName) {
      if (lineLower.includes(name) && name.length > 3) {
        const alreadyFound = items.some(i => i.article_code === product.article_code);
        if (!alreadyFound) {
          const quantity = extractQuantityFromLine(line);
          const price = extractPriceFromLine(line);
          items.push({
            description: product.name,
            quantity: quantity || 1,
            article_code: product.article_code,
            unit_price: price,
          });
        }
      }
    }

    // Try to find material by SKU
    for (const [sku, material] of materialBySku) {
      if (lineLower.includes(sku)) {
        const alreadyFound = items.some(i => i.article_code === material.sku);
        if (!alreadyFound) {
          const quantity = extractQuantityFromLine(line);
          const price = extractPriceFromLine(line);
          items.push({
            description: `${material.name} (${material.category})`,
            quantity: quantity || 1,
            article_code: material.sku,
            unit_price: price,
          });
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

function extractQuantityFromLine(line: string): number | undefined {
  for (const pattern of QUANTITY_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(line);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  
  // Try to find standalone numbers that look like quantities
  const numbers = line.match(/\b(\d{1,4})\b/g);
  if (numbers && numbers.length > 0) {
    const qty = parseInt(numbers[0], 10);
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

function extractTableItems(text: string): ParsedOrderItem[] {
  const items: ParsedOrderItem[] = [];
  const lines = text.split('\n').filter(line => line.trim());
  
  // Look for lines that appear to be table rows with item data
  for (const line of lines) {
    // Skip header-like lines
    if (/^(item|artikel|description|omschrijving|qty|quantity|price)/i.test(line)) {
      continue;
    }
    
    // Look for lines with numeric data that suggest they're order items
    const hasQuantity = /\b\d{1,4}\s*(st|stuk|pcs|x)?\b/i.test(line);
    const hasCode = /\b[A-Z0-9\-]{5,}\b/.test(line);
    
    if (hasQuantity || hasCode) {
      const quantity = extractQuantityFromLine(line) || 1;
      const price = extractPriceFromLine(line);
      
      // Extract article code
      let articleCode = '';
      for (const pattern of ARTICLE_CODE_PATTERNS) {
        pattern.lastIndex = 0;
        const match = pattern.exec(line);
        if (match) {
          articleCode = match[1];
          break;
        }
      }
      
      // Use the line as description (cleaned up)
      const description = line
        .replace(/\d+[,\.]\d{2}\s*€?/g, '') // Remove prices
        .replace(/€\s*\d+/g, '')
        .replace(/\b\d{1,4}\s*(st|stuk|pcs|x)?\b/gi, '') // Remove quantities
        .trim()
        .substring(0, 200);
      
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
  
  return items.slice(0, 50); // Limit to 50 items
}

export async function parsePDFForOrder(
  file: File,
  products: ProductMatch[],
  materials: MaterialMatch[]
): Promise<ParsedOrderData> {
  const text = await extractTextFromPDF(file);
  
  console.log('Extracted PDF text:', text.substring(0, 1000));
  
  const supplier = extractSupplier(text);
  const orderNumber = extractOrderNumber(text);
  
  // Extract dates
  const orderDateMatch = text.match(/(?:order\s*date|besteldatum|datum)[:\s]*([^\n]+)/gi);
  const deliveryDateMatch = text.match(/(?:delivery|levering|lever)[^\n]*[:\s]*([^\n]+)/gi);
  
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
  
  // Find matching items
  const items = findMatchingProducts(text, products, materials);
  
  return {
    supplier,
    orderDate,
    expectedDelivery,
    orderNumber,
    notes: orderNumber ? `Order #${orderNumber}` : undefined,
    items,
  };
}
