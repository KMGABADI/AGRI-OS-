import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface ColumnDefinition {
  key: string;
  displayName: string;
  aliases: string[];
  description: string;
  example: string;
}

export const REQUIRED_AGRICULTURAL_COLUMNS: ColumnDefinition[] = [
  {
    key: 'farmer_id',
    displayName: 'farmer_id',
    aliases: [
      'farmer_id',
      'farmerid',
      'farmer id',
      'farmer_identification',
      'farmer_code',
      'farmerID',
      'id'
    ],
    description: 'Unique identifier for the farmer or farm unit',
    example: 'FM-KD-2026-001'
  },
  {
    key: 'date',
    displayName: 'date',
    aliases: [
      'date',
      'record_date',
      'harvest_date',
      'planting_date',
      'activity_date',
      'entry_date',
      'date_recorded',
      'registrationdate',
      'regdate'
    ],
    description: 'Date of planting, harvest, or record entry (YYYY-MM-DD)',
    example: '2026-05-15'
  },
  {
    key: 'yield_amount',
    displayName: 'yield_amount',
    aliases: [
      'yield_amount',
      'yieldamount',
      'yield amount',
      'yield_amt',
      'yield_kg',
      'yield_tonnes',
      'yield_qty',
      'yield_quantity',
      'harvest_yield',
      'yield'
    ],
    description: 'Harvested or expected yield quantity (kg / MT)',
    example: '450.5'
  }
];

export interface ColumnValidationDetail {
  requiredKey: string;
  displayName: string;
  found: boolean;
  matchedHeader?: string;
  description: string;
  example: string;
}

export interface SchemaValidationResult {
  isValid: boolean;
  detectedHeaders: string[];
  missingColumns: string[];
  matchedColumns: Record<string, string>; // e.g. { farmer_id: 'Farmer ID' }
  details: ColumnValidationDetail[];
  error?: string;
  summaryMessage: string;
}

/**
 * Normalizes a header string for flexible comparison
 * Removes whitespace, underscores, hyphens, and converts to lowercase
 */
export const normalizeHeader = (header: string): string => {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_\-.]+/g, '');
};

/**
 * Checks a list of headers against the required agricultural schema columns
 */
export const validateHeadersSchema = (
  headers: string[],
  requiredDefs: ColumnDefinition[] = REQUIRED_AGRICULTURAL_COLUMNS
): SchemaValidationResult => {
  const cleanHeaders = headers.map(h => String(h || '').trim()).filter(Boolean);
  const normalizedHeadersMap = new Map<string, string>(); // normalized -> original
  cleanHeaders.forEach(h => {
    normalizedHeadersMap.set(normalizeHeader(h), h);
  });

  const matchedColumns: Record<string, string> = {};
  const missingColumns: string[] = [];
  const details: ColumnValidationDetail[] = [];

  for (const def of requiredDefs) {
    let matchedOriginal: string | undefined;

    // 1. Exact match test
    const exactMatch = cleanHeaders.find(h => h.toLowerCase() === def.key.toLowerCase());
    if (exactMatch) {
      matchedOriginal = exactMatch;
    } else {
      // 2. Alias match
      for (const alias of def.aliases) {
        const normAlias = normalizeHeader(alias);
        if (normalizedHeadersMap.has(normAlias)) {
          matchedOriginal = normalizedHeadersMap.get(normAlias);
          break;
        }
      }

      // 3. Fallback partial inclusion match if still not found
      if (!matchedOriginal) {
        const normDefKey = normalizeHeader(def.key);
        for (const [normH, orig] of normalizedHeadersMap.entries()) {
          if (normH.includes(normDefKey) || normDefKey.includes(normH)) {
            matchedOriginal = orig;
            break;
          }
        }
      }
    }

    if (matchedOriginal) {
      matchedColumns[def.key] = matchedOriginal;
      details.push({
        requiredKey: def.key,
        displayName: def.displayName,
        found: true,
        matchedHeader: matchedOriginal,
        description: def.description,
        example: def.example
      });
    } else {
      missingColumns.push(def.displayName);
      details.push({
        requiredKey: def.key,
        displayName: def.displayName,
        found: false,
        description: def.description,
        example: def.example
      });
    }
  }

  const isValid = missingColumns.length === 0;
  let summaryMessage = '';
  let error: string | undefined;

  if (isValid) {
    summaryMessage = `Schema validation passed: All required columns verified (${requiredDefs.map(d => d.displayName).join(', ')}).`;
  } else {
    error = `Schema validation failed: Missing required column${missingColumns.length > 1 ? 's' : ''}: ${missingColumns.map(c => `'${c}'`).join(', ')}. The CSV must contain these columns before parsing.`;
    summaryMessage = error;
  }

  return {
    isValid,
    detectedHeaders: cleanHeaders,
    missingColumns,
    matchedColumns,
    details,
    error,
    summaryMessage
  };
};

/**
 * Inspects a CSV or Excel file's header row BEFORE parsing the body/records.
 * Reads minimal data to extract headers and perform strict schema validation.
 */
export const validateCsvSchemaBeforeParse = async (
  file: File,
  requiredDefs: ColumnDefinition[] = REQUIRED_AGRICULTURAL_COLUMNS
): Promise<SchemaValidationResult> => {
  const fileName = file.name.toLowerCase();
  const isXLSX = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

  if (isXLSX) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary', sheetRows: 1 });
          const firstSheetName = workbook.SheetNames[0];
          if (!firstSheetName) {
            resolve({
              isValid: false,
              detectedHeaders: [],
              missingColumns: requiredDefs.map(d => d.displayName),
              matchedColumns: {},
              details: requiredDefs.map(d => ({
                requiredKey: d.key,
                displayName: d.displayName,
                found: false,
                description: d.description,
                example: d.example
              })),
              error: 'Spreadsheet has no sheets.',
              summaryMessage: 'Spreadsheet has no sheets.'
            });
            return;
          }

          const worksheet = workbook.Sheets[firstSheetName];
          const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          if (!rawRows || rawRows.length === 0 || !Array.isArray(rawRows[0])) {
            resolve({
              isValid: false,
              detectedHeaders: [],
              missingColumns: requiredDefs.map(d => d.displayName),
              matchedColumns: {},
              details: requiredDefs.map(d => ({
                requiredKey: d.key,
                displayName: d.displayName,
                found: false,
                description: d.description,
                example: d.example
              })),
              error: 'No header row found in Excel spreadsheet.',
              summaryMessage: 'No header row found in Excel spreadsheet.'
            });
            return;
          }

          const headers = rawRows[0].map(h => String(h || '').trim()).filter(Boolean);
          resolve(validateHeadersSchema(headers, requiredDefs));
        } catch (err: any) {
          resolve({
            isValid: false,
            detectedHeaders: [],
            missingColumns: requiredDefs.map(d => d.displayName),
            matchedColumns: {},
            details: requiredDefs.map(d => ({
              requiredKey: d.key,
              displayName: d.displayName,
              found: false,
              description: d.description,
              example: d.example
            })),
            error: `Failed to inspect Excel file headers: ${err?.message || 'Unknown error'}`,
            summaryMessage: `Failed to inspect Excel file headers: ${err?.message || 'Unknown error'}`
          });
        }
      };
      reader.onerror = () => {
        resolve({
          isValid: false,
          detectedHeaders: [],
          missingColumns: requiredDefs.map(d => d.displayName),
          matchedColumns: {},
          details: requiredDefs.map(d => ({
            requiredKey: d.key,
            displayName: d.displayName,
            found: false,
            description: d.description,
            example: d.example
          })),
          error: 'Failed to read Excel file for schema inspection.',
          summaryMessage: 'Failed to read Excel file for schema inspection.'
        });
      };
      reader.readAsBinaryString(file);
    });
  }

  // For CSV: Read the header chunk (first 4KB is ample for CSV header line)
  return new Promise((resolve) => {
    // Read up to first 8KB to ensure full header row is captured even with dozens of columns
    const chunk = file.slice(0, Math.min(file.size, 8192));
    const reader = new FileReader();

    reader.onload = (e) => {
      const text = (e.target?.result as string) || '';
      if (!text.trim()) {
        resolve({
          isValid: false,
          detectedHeaders: [],
          missingColumns: requiredDefs.map(d => d.displayName),
          matchedColumns: {},
          details: requiredDefs.map(d => ({
            requiredKey: d.key,
            displayName: d.displayName,
            found: false,
            description: d.description,
            example: d.example
          })),
          error: 'Uploaded CSV file is empty.',
          summaryMessage: 'Uploaded CSV file is empty.'
        });
        return;
      }

      Papa.parse(text, {
        preview: 1,
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          if (!results.data || results.data.length === 0 || !Array.isArray(results.data[0])) {
            resolve({
              isValid: false,
              detectedHeaders: [],
              missingColumns: requiredDefs.map(d => d.displayName),
              matchedColumns: {},
              details: requiredDefs.map(d => ({
                requiredKey: d.key,
                displayName: d.displayName,
                found: false,
                description: d.description,
                example: d.example
              })),
              error: 'No valid header row detected in CSV file.',
              summaryMessage: 'No valid header row detected in CSV file.'
            });
            return;
          }

          const rawHeaders = (results.data[0] as string[]).map(h => String(h || '').trim()).filter(Boolean);
          resolve(validateHeadersSchema(rawHeaders, requiredDefs));
        },
        error: (err) => {
          resolve({
            isValid: false,
            detectedHeaders: [],
            missingColumns: requiredDefs.map(d => d.displayName),
            matchedColumns: {},
            details: requiredDefs.map(d => ({
              requiredKey: d.key,
              displayName: d.displayName,
              found: false,
              description: d.description,
              example: d.example
            })),
            error: `Failed to inspect CSV header row: ${err.message}`,
            summaryMessage: `Failed to inspect CSV header row: ${err.message}`
          });
        }
      });
    };

    reader.onerror = () => {
      resolve({
        isValid: false,
        detectedHeaders: [],
        missingColumns: requiredDefs.map(d => d.displayName),
        matchedColumns: {},
        details: requiredDefs.map(d => ({
          requiredKey: d.key,
          displayName: d.displayName,
          found: false,
          description: d.description,
          example: d.example
        })),
        error: 'Unable to read file for pre-parse schema validation.',
        summaryMessage: 'Unable to read file for pre-parse schema validation.'
      });
    };

    reader.readAsText(chunk);
  });
};

/**
 * Helper to download a valid CSV template pre-populated with required schema columns
 */
export const downloadValidAgriculturalTemplate = () => {
  const headers = [
    'farmer_id',
    'date',
    'yield_amount',
    'firstName',
    'lastName',
    'primaryPhone',
    'gender',
    'state',
    'lga',
    'crop',
    'farmSize',
    'farmingType',
    'soilType',
    'status'
  ];

  const sampleRows = [
    [
      'FM-KD-2026-001',
      '2026-05-15',
      '450.5',
      'Ibrahim',
      'Musa',
      '08031234567',
      'Male',
      'Kaduna',
      'Giwa',
      'Maize',
      '4.5',
      'Rainfed',
      'Loamy',
      'Active'
    ],
    [
      'FM-KN-2026-002',
      '2026-04-10',
      '320.0',
      'Amina',
      'Bello',
      '08129876543',
      'Female',
      'Kano',
      'Kura',
      'Rice',
      '3.0',
      'Irrigated',
      'Clay',
      'Active'
    ],
    [
      'FM-OY-2026-003',
      '2026-03-20',
      '780.0',
      'Olumide',
      'Adebayo',
      '07054321987',
      'Male',
      'Oyo',
      'Iseyin',
      'Cassava',
      '6.2',
      'Mixed',
      'Sandy Loam',
      'Active'
    ]
  ];

  const csvContent = [headers.join(','), ...sampleRows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'agricultural_records_schema_template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};
