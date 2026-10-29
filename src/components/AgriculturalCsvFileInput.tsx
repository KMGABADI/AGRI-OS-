import React, { useState, useRef, ChangeEvent, DragEvent } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Sprout, 
  Eye, 
  BarChart3, 
  RefreshCw, 
  Sparkles,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Download,
  Check,
  Info
} from 'lucide-react';
import {
  validateCsvSchemaBeforeParse,
  downloadValidAgriculturalTemplate,
  REQUIRED_AGRICULTURAL_COLUMNS,
  SchemaValidationResult
} from '../utils/csvSchemaValidator';

export interface ParsedAgriculturalRecord {
  [key: string]: any;
}

export interface AgriculturalCsvFileInputProps {
  onDataParsed?: (records: ParsedAgriculturalRecord[], headers: string[], file: File) => void;
  onReset?: () => void;
  onSchemaValidated?: (result: SchemaValidationResult) => void;
  currentFile?: File | null;
  className?: string;
  enableSchemaValidation?: boolean;
}

export const AgriculturalCsvFileInput: React.FC<AgriculturalCsvFileInputProps> = ({
  onDataParsed,
  onReset,
  onSchemaValidated,
  currentFile,
  className = '',
  enableSchemaValidation = true
}) => {
  const [file, setFile] = useState<File | null>(currentFile || null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [isValidatingSchema, setIsValidatingSchema] = useState<boolean>(false);
  const [schemaResult, setSchemaResult] = useState<SchemaValidationResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedRecords, setParsedRecords] = useState<ParsedAgriculturalRecord[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeView, setActiveView] = useState<'table' | 'summary'>('table');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quick sample generator to test CSV parsing instantly
  const loadSampleAgriculturalCSV = () => {
    const sampleCSVContent = `Farmer ID,First Name,Last Name,Phone,Gender,State,LGA,Crop,Farm Size (ha),Farming Type,Planting Date,Soil Type,Status
FM-KD-2026-001,Ibrahim,Musa,08031234567,Male,Kaduna,Giwa,Maize,4.5,Rainfed,2026-05-15,Loamy,Active
FM-KN-2026-002,Amina,Bello,08129876543,Female,Kano,Kura,Rice,3.0,Irrigated,2026-04-10,Clay,Active
FM-OY-2026-003,Olumide,Adebayo,07054321987,Male,Oyo,Iseyin,Cassava,6.2,Mixed,2026-03-20,Sandy Loam,Active
FM-BN-2026-004,Dooshima,Terna,09012345678,Female,Benue,Gboko,Soybeans,5.0,Rainfed,2026-06-01,Loamy,Active
FM-OG-2026-005,Babatunde,Ogunleye,08065432109,Male,Ogun,Obafemi Owode,Oil Palm,8.5,Plantation,2025-11-12,Rich Loam,Active
FM-NG-2026-006,Fatima,Aliyu,08134567890,Female,Niger,Mokwa,Sorghum,3.8,Rainfed,2026-05-28,Sandy,Active
FM-ED-2026-007,Osas,Imasuen,07089012345,Male,Edo,Ovia North East,Cocoa,7.0,Plantation,2025-10-05,Loamy,Active
FM-PL-2026-008,Gyang,Pam,08098765432,Male,Plateau,Barkin Ladi,Irish Potato,2.5,Irrigated,2026-02-18,Volcanic Loam,Active`;

    const blob = new Blob([sampleCSVContent], { type: 'text/csv;charset=utf-8;' });
    const sampleFile = new File([blob], 'sample_agricultural_records.csv', { type: 'text/csv' });
    validateAndParseFile(sampleFile);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      validateAndParseFile(droppedFile);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      validateAndParseFile(selectedFile);
    }
  };

  const validateAndParseFile = async (selectedFile: File) => {
    const fileName = selectedFile.name.toLowerCase();
    const isCSV = fileName.endsWith('.csv') || selectedFile.type === 'text/csv' || selectedFile.type === 'application/vnd.ms-excel';
    const isXLSX = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

    if (!isCSV && !isXLSX) {
      setParseError('Please upload a valid CSV file (.csv) or Excel spreadsheet. Selected file format is not supported.');
      setSchemaResult(null);
      return;
    }

    setFile(selectedFile);
    setParseError(null);

    // Schema validation step before parsing: checks for required columns like 'farmer_id', 'date', and 'yield_amount'
    if (enableSchemaValidation) {
      setIsValidatingSchema(true);
      try {
        const validation = await validateCsvSchemaBeforeParse(selectedFile);
        setSchemaResult(validation);
        setIsValidatingSchema(false);

        if (onSchemaValidated) {
          onSchemaValidated(validation);
        }

        // Abort parsing before processing rows if required schema columns are missing
        if (!validation.isValid) {
          setParseError(
            `Schema validation failed: Missing required agricultural columns (${validation.missingColumns.join(', ')}). The CSV file must contain 'farmer_id', 'date', and 'yield_amount' before parsing.`
          );
          return;
        }
      } catch (err: any) {
        setIsValidatingSchema(false);
        setParseError(`Schema pre-inspection error: ${err?.message || 'Failed validating schema.'}`);
        return;
      }
    }

    // Only proceed to parse data rows after schema validation passes
    if (isXLSX) {
      parseExcelFile(selectedFile);
    } else {
      parseCSVFile(selectedFile);
    }
  };

  const parseExcelFile = (fileToParse: File) => {
    setIsParsing(true);
    setParseError(null);
    setFile(fileToParse);
    setCurrentPage(1);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (!rawJson || rawJson.length === 0) {
          setIsParsing(false);
          setParseError('The uploaded Excel spreadsheet is empty.');
          return;
        }

        const validHeaders = (rawJson[0] || []).map(h => String(h || '').trim()).filter(Boolean);
        const rows = rawJson.slice(1).map(row => {
          const obj: Record<string, any> = {};
          validHeaders.forEach((header, idx) => {
            obj[header] = row[idx] !== undefined ? row[idx] : null;
          });
          return obj;
        }).filter(row => Object.values(row).some(v => v !== null && v !== undefined && String(v).trim() !== ''));

        setIsParsing(false);
        setHeaders(validHeaders);
        setParsedRecords(rows);
        if (onDataParsed) {
          onDataParsed(rows, validHeaders, fileToParse);
        }
      } catch (err: any) {
        setIsParsing(false);
        setParseError(`Failed to parse Excel file: ${err?.message || 'Unknown error'}`);
      }
    };
    reader.onerror = () => {
      setIsParsing(false);
      setParseError('Failed reading the Excel file.');
    };
    reader.readAsBinaryString(fileToParse);
  };

  const parseCSVFile = (fileToParse: File) => {
    setIsParsing(true);
    setParseError(null);
    setFile(fileToParse);
    setCurrentPage(1);

    Papa.parse(fileToParse, {
      header: true,
      skipEmptyLines: 'greedy',
      dynamicTyping: true,
      transformHeader: (header: string) => header.trim(),
      complete: (results) => {
        setIsParsing(false);
        if (results.errors && results.errors.length > 0 && results.data.length === 0) {
          setParseError(`CSV Parsing Error: ${results.errors[0].message}`);
          return;
        }

        const validHeaders = results.meta.fields?.filter(h => h && h.length > 0) || [];
        const cleanData = (results.data as ParsedAgriculturalRecord[]).filter(row => {
          // Check if row has at least one non-empty value
          return Object.values(row).some(val => val !== null && val !== undefined && String(val).trim() !== '');
        });

        if (cleanData.length === 0) {
          setParseError('The uploaded CSV file does not contain any valid record rows.');
          return;
        }

        setHeaders(validHeaders);
        setParsedRecords(cleanData);

        if (onDataParsed) {
          onDataParsed(cleanData, validHeaders, fileToParse);
        }
      },
      error: (err) => {
        setIsParsing(false);
        setParseError(`Failed to parse CSV: ${err.message}`);
      }
    });
  };

  const handleReset = () => {
    setFile(null);
    setParsedRecords([]);
    setHeaders([]);
    setParseError(null);
    setSchemaResult(null);
    setSearchQuery('');
    setCurrentPage(1);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (onReset) {
      onReset();
    }
  };

  // Filtered records based on search query
  const filteredRecords = parsedRecords.filter(record => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return Object.values(record).some(val => 
      val !== null && val !== undefined && String(val).toLowerCase().includes(query)
    );
  });

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / rowsPerPage));
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  // Agricultural analytics summary
  const summary = React.useMemo(() => {
    if (parsedRecords.length === 0) return null;

    const cropCounts: Record<string, number> = {};
    const stateCounts: Record<string, number> = {};
    let totalHectares = 0;
    let farmSizeCount = 0;

    parsedRecords.forEach(r => {
      // Find crop key case-insensitively
      const cropKey = Object.keys(r).find(k => k.toLowerCase().includes('crop'));
      if (cropKey && r[cropKey]) {
        const cropName = String(r[cropKey]).trim();
        cropCounts[cropName] = (cropCounts[cropName] || 0) + 1;
      }

      // Find state key
      const stateKey = Object.keys(r).find(k => k.toLowerCase() === 'state' || k.toLowerCase().includes('state'));
      if (stateKey && r[stateKey]) {
        const stateName = String(r[stateKey]).trim();
        stateCounts[stateName] = (stateCounts[stateName] || 0) + 1;
      }

      // Find farm size key
      const sizeKey = Object.keys(r).find(k => k.toLowerCase().includes('size') || k.toLowerCase().includes('ha') || k.toLowerCase().includes('hectare'));
      if (sizeKey && r[sizeKey]) {
        const parsedSize = parseFloat(r[sizeKey]);
        if (!isNaN(parsedSize)) {
          totalHectares += parsedSize;
          farmSizeCount++;
        }
      }
    });

    const topCrops = Object.entries(cropCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topStates = Object.entries(stateCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const avgHectares = farmSizeCount > 0 ? (totalHectares / farmSizeCount).toFixed(1) : '0';

    return {
      topCrops,
      topStates,
      totalHectares: totalHectares.toFixed(1),
      avgHectares
    };
  }, [parsedRecords]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* CSV File Input & Dropzone Card */}
      <div 
        className={`backdrop-blur-2xl border rounded-3xl p-8 shadow-xl transition-all relative ${
          isDragging 
            ? 'bg-emerald-500/10 border-emerald-400 border-dashed ring-4 ring-emerald-500/20' 
            : 'bg-white/5 border-white/10 hover:border-white/20'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input 
          type="file" 
          accept=".csv,text/csv" 
          ref={fileInputRef} 
          onChange={handleFileInputChange} 
          className="hidden" 
          id="agricultural-csv-file-input"
        />

        <div className="flex flex-col items-center justify-center text-center">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 border transition-transform ${
            isDragging 
              ? 'scale-110 bg-emerald-500/30 text-emerald-300 border-emerald-400' 
              : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
          }`}>
            <Upload size={30} className={isParsing ? 'animate-bounce' : ''} />
          </div>

          <h3 className="text-xl font-bold text-slate-100 mb-1 flex items-center gap-2">
            <FileSpreadsheet size={20} className="text-emerald-400" />
            Agricultural Records CSV Upload
          </h3>
          <p className="text-sm text-slate-400 mb-6 max-w-md">
            Drag and drop your agricultural CSV dataset (farmers, crops, field locations, yields) or click to browse.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isParsing}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              <Upload size={16} />
              <span>{isParsing ? 'Parsing CSV...' : 'Select CSV File'}</span>
            </button>

            <button
              type="button"
              onClick={loadSampleAgriculturalCSV}
              disabled={isParsing}
              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl font-semibold transition-all cursor-pointer flex items-center gap-2 text-sm"
              title="Load realistic agricultural sample records for instant testing"
            >
              <Sparkles size={16} className="text-amber-400" />
              <span>Load Sample CSV</span>
            </button>
          </div>

          {/* Active File Badge */}
          {file && (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-xs bg-slate-900/60 border border-emerald-500/30 px-4 py-2 rounded-xl text-slate-300">
              <span className="flex items-center gap-1.5 font-medium text-emerald-400">
                <CheckCircle2 size={15} />
                {file.name}
              </span>
              <span className="text-slate-500">•</span>
              <span className="font-mono text-slate-400">{(file.size / 1024).toFixed(1)} KB</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">{parsedRecords.length} records parsed</span>
              <button
                type="button"
                onClick={handleReset}
                className="ml-2 text-slate-400 hover:text-red-400 transition-colors p-1"
                title="Remove file"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Schema Validation In Progress Indicator */}
          {isValidatingSchema && (
            <div className="mt-4 flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-xl animate-pulse">
              <RefreshCw size={14} className="animate-spin" />
              <span>Checking CSV schema for required columns ('farmer_id', 'date', 'yield_amount')...</span>
            </div>
          )}

          {/* Schema Validation Success Tag */}
          {schemaResult && schemaResult.isValid && !parseError && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl">
              <ShieldCheck size={16} className="text-emerald-400" />
              <span className="font-semibold">Schema Validated:</span>
              <span>All required columns detected:</span>
              <div className="flex gap-1.5 font-mono">
                {REQUIRED_AGRICULTURAL_COLUMNS.map(col => (
                  <span key={col.key} className="bg-emerald-500/20 px-2 py-0.5 rounded text-[11px] text-emerald-300">
                    {col.displayName} ✓
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Schema Validation Error Breakdown */}
          {schemaResult && !schemaResult.isValid && (
            <div className="mt-5 w-full max-w-2xl bg-red-950/40 border border-red-500/40 rounded-2xl p-5 text-left shadow-2xl backdrop-blur-md">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-red-500/20 text-red-400 rounded-xl border border-red-500/30">
                  <ShieldAlert size={22} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-red-200">
                      Schema Validation Failed (Parsing Aborted)
                    </h4>
                    <span className="text-[11px] font-mono uppercase tracking-wider bg-red-500/20 text-red-300 px-2 py-0.5 rounded">
                      Pre-Parse Check
                    </span>
                  </div>
                  <p className="text-xs text-red-300/80 mt-1">
                    The uploaded CSV file does not contain all required columns. To maintain data integrity, parsing was halted before processing records.
                  </p>

                  {/* Required Columns Matrix */}
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {schemaResult.details.map((detail) => (
                      <div 
                        key={detail.requiredKey}
                        className={`p-2.5 rounded-xl border text-xs flex flex-col justify-between ${
                          detail.found
                            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                            : 'bg-red-900/30 border-red-500/40 text-red-300'
                        }`}
                      >
                        <div className="flex items-center justify-between font-mono font-bold">
                          <span>{detail.displayName}</span>
                          {detail.found ? (
                            <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                              <Check size={12} /> Found
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] text-red-400">
                              <X size={12} /> Missing
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 truncate" title={detail.matchedHeader ? `Matched: ${detail.matchedHeader}` : detail.description}>
                          {detail.matchedHeader ? `Matched: "${detail.matchedHeader}"` : detail.description}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Detected Headers */}
                  {schemaResult.detectedHeaders.length > 0 && (
                    <div className="mt-3 text-[11px] text-slate-400">
                      <span className="text-slate-300 font-semibold">Detected Headers in File: </span>
                      <span className="font-mono text-slate-400">
                        {schemaResult.detectedHeaders.slice(0, 10).join(', ')}
                        {schemaResult.detectedHeaders.length > 10 ? ` +${schemaResult.detectedHeaders.length - 10} more` : ''}
                      </span>
                    </div>
                  )}

                  {/* Action Guidance */}
                  <div className="mt-4 pt-3 border-t border-red-500/20 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[11px] text-slate-300 flex items-center gap-1.5">
                      <Info size={13} className="text-amber-400" />
                      Add missing columns or download our compliant template.
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={downloadValidAgriculturalTemplate}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow cursor-pointer"
                      >
                        <Download size={13} />
                        <span>Download Schema Template</span>
                      </button>
                      <button
                        type="button"
                        onClick={loadSampleAgriculturalCSV}
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Sparkles size={13} className="text-amber-400" />
                        <span>Load Compliant Sample</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Standard Parse Error Notification (if other error occurs) */}
          {parseError && (!schemaResult || schemaResult.isValid) && (
            <div className="mt-4 flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-4 py-2.5 rounded-xl max-w-lg">
              <AlertCircle size={18} className="flex-shrink-0" />
              <span>{parseError}</span>
            </div>
          )}
        </div>
      </div>

      {/* Parsed Agricultural Records Display Section */}
      {parsedRecords.length > 0 && (
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          {/* Header Controls & View Toggle */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-white/10 pb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  CSV Parsed Successfully
                </span>
                <span className="text-xs text-slate-400">
                  {headers.length} Columns • {parsedRecords.length} Rows
                </span>
              </div>
              <h3 className="text-xl font-bold text-slate-100 mt-1">
                Parsed Agricultural Records Display
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Review and inspect imported records before field mapping and database persistence.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* View Toggle */}
              <div className="flex items-center bg-black/30 border border-white/10 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setActiveView('table')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeView === 'table'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <Eye size={14} /> Data Table
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('summary')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeView === 'summary'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <BarChart3 size={14} /> Agricultural Insights
                </button>
              </div>

              {/* Search Field */}
              <div className="relative min-w-[200px] flex-1 sm:flex-initial">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search parsed records..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-1.5 bg-black/20 border border-white/10 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <button
                type="button"
                onClick={handleReset}
                className="p-2 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 text-slate-400 hover:text-red-400 rounded-xl transition-colors cursor-pointer"
                title="Clear and reset upload"
              >
                <RefreshCw size={15} />
              </button>
            </div>
          </div>

          {/* Quick Header Column Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400 mr-1 uppercase tracking-wider">Detected Columns:</span>
            {headers.map((h, i) => (
              <span 
                key={i} 
                className="px-2 py-0.5 rounded-md text-[11px] bg-slate-900 border border-white/10 text-slate-300 font-mono"
              >
                {h}
              </span>
            ))}
          </div>

          {/* Summary / Insights View */}
          {activeView === 'summary' && summary && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 bg-slate-900/50 border border-white/10 rounded-2xl">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold mb-2">
                  <Sprout size={16} /> Top Agricultural Crops
                </div>
                <div className="space-y-1.5">
                  {summary.topCrops.length > 0 ? (
                    summary.topCrops.map(([crop, count]) => (
                      <div key={crop} className="flex justify-between items-center text-xs">
                        <span className="text-slate-300">{crop}</span>
                        <span className="font-mono bg-white/5 px-2 py-0.5 rounded text-emerald-300 font-medium">
                          {count} farmers
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500">No crop column explicitly detected</p>
                  )}
                </div>
              </div>

              <div className="p-4 bg-slate-900/50 border border-white/10 rounded-2xl">
                <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold mb-2">
                  <BarChart3 size={16} /> Regional Distribution
                </div>
                <div className="space-y-1.5">
                  {summary.topStates.length > 0 ? (
                    summary.topStates.map(([st, count]) => (
                      <div key={st} className="flex justify-between items-center text-xs">
                        <span className="text-slate-300">{st}</span>
                        <span className="font-mono bg-white/5 px-2 py-0.5 rounded text-blue-300 font-medium">
                          {count} records
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500">No state column explicitly detected</p>
                  )}
                </div>
              </div>

              <div className="p-4 bg-slate-900/50 border border-white/10 rounded-2xl">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold mb-2">
                  <FileText size={16} /> Cultivation Metrics
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Total Farm Area:</span>
                    <span className="font-mono text-slate-200 font-semibold">{summary.totalHectares} ha</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Average Holding:</span>
                    <span className="font-mono text-slate-200 font-semibold">{summary.avgHectares} ha</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Total Records:</span>
                    <span className="font-mono text-emerald-400 font-semibold">{parsedRecords.length}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Table View */}
          {activeView === 'table' && (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/40">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-white/10 font-semibold">
                    <tr>
                      <th className="px-4 py-3 text-center w-12">#</th>
                      {headers.map((header, idx) => (
                        <th key={idx} className="px-4 py-3 whitespace-nowrap">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {paginatedRecords.length > 0 ? (
                      paginatedRecords.map((row, rowIdx) => {
                        const globalIndex = (currentPage - 1) * rowsPerPage + rowIdx + 1;
                        return (
                          <tr key={rowIdx} className="hover:bg-white/[0.03] transition-colors">
                            <td className="px-4 py-2.5 text-center text-slate-500 font-mono">
                              {globalIndex}
                            </td>
                            {headers.map((header, colIdx) => {
                              const cellValue = row[header];
                              const isCropCol = header.toLowerCase().includes('crop');
                              const isStatusCol = header.toLowerCase().includes('status');
                              const isSizeCol = header.toLowerCase().includes('size') || header.toLowerCase().includes('ha');

                              return (
                                <td key={colIdx} className="px-4 py-2.5 whitespace-nowrap font-mono text-[11px]">
                                  {isCropCol && cellValue ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                      <Sprout size={11} />
                                      {String(cellValue)}
                                    </span>
                                  ) : isStatusCol && cellValue ? (
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                      String(cellValue).toLowerCase() === 'active' 
                                        ? 'bg-emerald-500/20 text-emerald-400' 
                                        : 'bg-amber-500/20 text-amber-400'
                                    }`}>
                                      {String(cellValue)}
                                    </span>
                                  ) : isSizeCol && cellValue !== undefined ? (
                                    <span className="text-cyan-300 font-medium">
                                      {String(cellValue)} ha
                                    </span>
                                  ) : (
                                    <span className="text-slate-300">
                                      {cellValue !== null && cellValue !== undefined ? String(cellValue) : '-'}
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={headers.length + 1} className="px-4 py-8 text-center text-slate-400">
                          No matching records found for "{searchQuery}".
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Pagination Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 pt-2">
                <div className="flex items-center gap-2">
                  <span>Show</span>
                  <select
                    value={rowsPerPage}
                    onChange={(e) => {
                      setRowsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-slate-200 outline-none"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                  <span>records per page (showing {(currentPage - 1) * rowsPerPage + 1} - {Math.min(currentPage * rowsPerPage, filteredRecords.length)} of {filteredRecords.length})</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="px-3 py-1 font-mono bg-white/5 rounded-lg border border-white/10 text-slate-300">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AgriculturalCsvFileInput;
