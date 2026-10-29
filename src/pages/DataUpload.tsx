import React, { useState, useRef, useEffect } from 'react';
import { useBrandingStore } from '../store/useBrandingStore';
import { useFarmerStore, generateFarmerID } from '../store/useFarmerStore';
import { useImportStagingStore } from '../store/useImportStagingStore';
import { useOrgStore } from '../store/useOrgStore';
import { useProgramStore } from '../store/useProgramStore';
import { 
  Upload as UploadIcon, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Database, 
  Link as LinkIcon, 
  RefreshCw, 
  LogOut, 
  Download,
  ShieldCheck,
  ShieldAlert,
  Check,
  HelpCircle,
  FileCheck,
  Layers,
  Sparkles
} from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { initAuth, googleSignIn, getAccessToken, logout } from '../lib/AuthContext';
import { User } from 'firebase/auth';
import AgriculturalCsvFileInput from '../components/AgriculturalCsvFileInput';
import ConnectedWorkbooks from '../components/ConnectedWorkbooks';
import MappingTemplates from '../components/MappingTemplates';
import DataExport from '../components/DataExport';
import UploadHistoryTable from '../components/UploadHistoryTable';
import { useUploadHistoryStore } from '../store/useUploadHistoryStore';
import { useUploadTaskStore } from '../store/useUploadTaskStore';
import { useActivityLogStore } from '../store/useActivityLogStore';
import {
  validateCsvSchemaBeforeParse,
  downloadValidAgriculturalTemplate,
  REQUIRED_AGRICULTURAL_COLUMNS,
  SchemaValidationResult
} from '../utils/csvSchemaValidator';

export default function DataUpload() {
  const { addRecord } = useUploadHistoryStore();
  const { primaryColor } = useBrandingStore();




  const { farmers, bulkAddFarmers } = useFarmerStore();
  const { stagedRecords, commitRecord, rejectRecord, clearStaged } = useImportStagingStore();
  const { organizations } = useOrgStore();
  const { programs } = useProgramStore();

  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[] | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  
  // Schema Validation state
  const [schemaValidationResult, setSchemaValidationResult] = useState<SchemaValidationResult | null>(null);
  const [isCheckingSchema, setIsCheckingSchema] = useState<boolean>(false);
  const [strictSchemaEnforced, setStrictSchemaEnforced] = useState<boolean>(true);
  
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [uploadMethod, setUploadMethod] = useState<'csv' | 'sheets'>('csv');

  const handleAgriculturalDataParsed = (data: any[], headers: string[], parsedFile: File) => {
    setFile(parsedFile);
    setParsedData(data);
    setCsvHeaders(headers);
    autoMatchFields(headers);
    setIsProcessing(false);
  };

  const handleAgriculturalReset = () => {
    setFile(null);
    setParsedData(null);
    setCsvHeaders([]);
    setFieldMapping({});
    setResult(null);
    setSchemaValidationResult(null);
    setCurrentErrors([]);
  };
  
  const [activeTab, setActiveTab] = useState<'import' | 'templates' | 'export'>('import');
  const { isProcessing, uploadProgress, progressMessage, result, setProcessing: setIsProcessing, setProgress, setResult } = useUploadTaskStore();
  const setUploadProgress = (p: number) => setProgress(p, progressMessage);
  const setProgressMessage = (m: string) => setProgress(uploadProgress, m);
  const [currentErrors, setCurrentErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Google Sheets state
  const [sheetUrl, setSheetUrl] = useState('');
  const [needsAuth, setNeedsAuth] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const eMod = { target: { files: e.dataTransfer.files } };
      handleFileUpload(eMod as any);
    }
  };
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    initAuth(
      (user, token) => {
        setUser(user);
        setToken(token);
        setNeedsAuth(false);
      },
      () => setNeedsAuth(true)
    );
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setToken(result.accessToken);
        setUser(result.user);
        setNeedsAuth(false);
      }
    } catch (err) {
      console.error('Login failed:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setNeedsAuth(true);
  };

  const defaultHeaders = "farmer_id,date,yield_amount,firstName,lastName,primaryPhone,middleName,fullName,gender,state,lga,ward,community,crop,farmSize,status,kycComplete,phase,bvn,nin,dob,marital,education,address,landOwnership,soilType,soilFertility,irrigation,mechanization,variety,loanReq,loanApproved,insurance,insurer,anchor,remarks,experience,agent,regDate";

  const downloadTemplate = () => {
    const blob = new Blob([defaultHeaders], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'farmer_upload_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadAgriculturalRecordsCSV = () => {
    if (!farmers || farmers.length === 0) {
      alert('No agricultural records found to export.');
      return;
    }

    setIsExportingCSV(true);
    try {
      const exportData = farmers.map(f => {
        const orgName = organizations.find(o => o.id === f.organizationId)?.name || f.organizationId || '';
        const progName = programs.find(p => p.id === f.programId)?.name || f.programId || '';

        return {
          'Farmer ID': f.farmerID || '',
          'Full Name': f.fullName || `${f.firstName || ''} ${f.lastName || ''}`.trim(),
          'First Name': f.firstName || '',
          'Middle Name': f.middleName || '',
          'Last Name': f.lastName || '',
          'Gender': f.gender || '',
          'Primary Phone': f.primaryPhone || f.phone || '',
          'State': f.state || '',
          'LGA': f.lga || '',
          'Ward': f.ward || '',
          'Community': f.community || '',
          'Address': f.address || '',
          'Crop Focus': f.crop || '',
          'Farm Size (ha)': f.farmSize ?? '',
          'Variety': f.variety || '',
          'Farming Type': f.farmingType || '',
          'Planting Date': f.plantingDate || '',
          'Land Ownership': f.landOwnership || '',
          'Soil Type': f.soilType || '',
          'Soil Fertility': f.soilFertility || '',
          'Irrigation': f.irrigation || '',
          'Mechanization': f.mechanization || '',
          'Organization': orgName,
          'Program': progName,
          'Status': f.profileStatus || f.status || 'Active',
          'KYC Verified': f.kycComplete ? 'Yes' : 'No',
          'Phase': f.phase || '',
          'BVN': f.bvn || '',
          'NIN': f.nin || '',
          'Date of Birth': f.dob || '',
          'Marital Status': f.marital || '',
          'Education': f.education || '',
          'Experience (Years)': f.experience ?? '',
          'Loan Requested': f.loanReq ?? '',
          'Loan Approved': f.loanApproved ?? '',
          'Insurance': f.insurance || '',
          'Insurer': f.insurer || '',
          'Anchor': f.anchor || '',
          'Agent': f.agent || '',
          'Registration Date': f.registrationDate || '',
          'Latitude': f.latitude ?? '',
          'Longitude': f.longitude ?? '',
          'Credit Score': f.creditScore?.score ?? '',
          'Remarks': f.remarks || ''
        };
      });

      const csv = Papa.unparse(exportData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const today = new Date().toISOString().split('T')[0];
      a.download = `agricultural_records_${today}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      try {
        useActivityLogStore.getState().logActivity({
          action: 'EXPORT',
          entityType: 'FARMER',
          entityId: 'csv-export',
          details: `Exported ${exportData.length} agricultural farmer records to CSV`
        });
      } catch (logErr) {
        console.warn('Could not log CSV export activity:', logErr);
      }
    } catch (err: any) {
      console.error('Failed to export CSV:', err);
      alert('Failed to export CSV: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsExportingCSV(false);
    }
  };

  const downloadStagedCSV = () => {
    if (!stagedRecords || stagedRecords.length === 0) return;
    try {
      const flatData = stagedRecords.map(r => ({
        Status: r.status,
        ErrorReason: r.errorReason || '',
        ...(r.data || {})
      }));
      const csv = Papa.unparse(flatData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `staged_agricultural_records_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export staged records:', err);
    }
  };

  const systemFields = [
    { key: 'id', label: 'System ID' },
    { key: 'farmerID', label: 'Farmer ID (Required: farmer_id)', required: true },
    { key: 'date', label: 'Record / Planting Date (Required: date)' },
    { key: 'yield_amount', label: 'Yield Amount (Required: yield_amount)' },
    { key: 'firstName', label: 'First Name (Required)', required: true },
    { key: 'lastName', label: 'Last Name (Required)', required: true },
    { key: 'middleName', label: 'Middle Name' },
    { key: 'fullName', label: 'Full Name' },
    { key: 'gender', label: 'Gender' },
    { key: 'phone', label: 'Phone Number (Required)', required: true },
    { key: 'state', label: 'State' },
    { key: 'lga', label: 'LGA' },
    { key: 'ward', label: 'Ward' },
    { key: 'community', label: 'Community' },
    { key: 'crop', label: 'Crop Focus' },
    { key: 'farmSize', label: 'Farm Size (Hectares)' },
    { key: 'status', label: 'Status' },
    { key: 'kycComplete', label: 'KYC Complete (true/false)' },
    { key: 'phase', label: 'Phase' },
    { key: 'bvn', label: 'BVN' },
    { key: 'nin', label: 'NIN' },
    { key: 'dob', label: 'Date of Birth' },
    { key: 'marital', label: 'Marital Status' },
    { key: 'education', label: 'Education' },
    { key: 'address', label: 'Address' },
    { key: 'landOwnership', label: 'Land Ownership' },
    { key: 'soilType', label: 'Soil Type' },
    { key: 'soilFertility', label: 'Soil Fertility' },
    { key: 'irrigation', label: 'Irrigation' },
    { key: 'mechanization', label: 'Mechanization' },
    { key: 'variety', label: 'Variety' },
    { key: 'loanReq', label: 'Loan Requested' },
    { key: 'loanApproved', label: 'Loan Approved' },
    { key: 'insurance', label: 'Insurance' },
    { key: 'insurer', label: 'Insurer' },
    { key: 'anchor', label: 'Anchor' },
    { key: 'remarks', label: 'Remarks' },
    { key: 'experience', label: 'Experience (Years)' },
    { key: 'agent', label: 'Agent' },
    { key: 'registrationDate', label: 'Registration Date' },
    { key: 'latitude', label: 'Latitude' },
    { key: 'longitude', label: 'Longitude' }
  ];

  const autoMatchFields = (headers: string[]) => {
    const mapping: Record<string, string> = {};
    const normalizedHeaders = headers.map(h => ({ original: h, normalized: h.toLowerCase().replace(/[^a-z0-9]/g, '') }));
    
    // Priority exact/close matching for required schema fields
    const findCandidate = (candidates: string[]) => {
      for (const cand of candidates) {
        const norm = cand.toLowerCase().replace(/[^a-z0-9]/g, '');
        const match = normalizedHeaders.find(h => h.normalized === norm || h.normalized.includes(norm) || norm.includes(h.normalized));
        if (match) return match.original;
      }
      return undefined;
    };

    const matchedFarmerId = findCandidate(['farmer_id', 'farmerid', 'farmer id', 'farmerID', 'id']);
    if (matchedFarmerId) mapping['farmerID'] = matchedFarmerId;

    const matchedDate = findCandidate(['date', 'record_date', 'harvest_date', 'planting_date', 'plantingDate']);
    if (matchedDate) mapping['date'] = matchedDate;

    const matchedYield = findCandidate(['yield_amount', 'yieldamount', 'yield amount', 'yield_amt', 'yield_kg', 'yield']);
    if (matchedYield) mapping['yield_amount'] = matchedYield;

    systemFields.forEach(field => {
      if (mapping[field.key]) return;
      const normalizedField = field.key.toLowerCase();
      const match = normalizedHeaders.find(h => h.normalized === normalizedField || h.normalized.includes(normalizedField) || normalizedField.includes(h.normalized));
      if (match) {
        mapping[field.key] = match.original;
      }
    });
    setFieldMapping(mapping);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setFile(f);
      setResult(null);
      setCurrentErrors([]);

      // Step 1: Pre-Parse Schema Validation (Checks required columns like 'farmer_id', 'date', 'yield_amount')
      if (strictSchemaEnforced) {
        setIsCheckingSchema(true);
        try {
          const validation = await validateCsvSchemaBeforeParse(f);
          setSchemaValidationResult(validation);
          setIsCheckingSchema(false);

          if (!validation.isValid) {
            setIsProcessing(false);
            setCurrentErrors([
              validation.error || 'Schema validation failed: CSV missing required columns (farmer_id, date, yield_amount). Parsing aborted.'
            ]);
            return; // Abort before parsing!
          }
        } catch (err: any) {
          setIsCheckingSchema(false);
          setCurrentErrors([`Schema validation failed: ${err?.message || 'Error inspecting file'}`]);
          return;
        }
      }

      setIsProcessing(true);
      setUploadProgress(0);
      setProgressMessage('Parsing file...');
      
      const fileExt = f.name.split('.').pop()?.toLowerCase();
      if (fileExt === 'xlsx' || fileExt === 'xls') {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
          
          if (data.length > 0) {
            const headers = data[0].map((h: any) => String(h));
            setCsvHeaders(headers);
            
            const rows = data.slice(1).map((row: any[]) => {
              const obj: any = {};
              headers.forEach((h: string, i: number) => {
                obj[h] = row[i];
              });
              return obj;
            });
            
            setParsedData(rows);
            autoMatchFields(headers);
            setIsProcessing(false);
          } else {
            setIsProcessing(false);
          }
        };
        reader.readAsBinaryString(f);
      } else {
        Papa.parse(f, {
          header: true,
          skipEmptyLines: true,
          worker: true,
          complete: (results) => {
            setCsvHeaders(results.meta.fields || []);
            setParsedData(results.data);
            autoMatchFields(results.meta.fields || []);
            setIsProcessing(false);
          }
        });
      }
    }
  };

  const mapDataToFarmers = (data: any[]) => {
    return data.map(row => {
      let gender = 'Unknown';
      if (row.gender) {
        const g = String(row.gender).trim().toUpperCase();
        if (g === 'M' || g === 'MALE') gender = 'Male';
        else if (g === 'F' || g === 'FEMALE') gender = 'Female';
        else gender = row.gender;
      }
      const farmerObj: any = {
        ...row,
        id: row.id || undefined,
        farmerID: row.farmerID || row.farmer_id,
        date: row.date || row.plantingDate || row.record_date || undefined,
        yield_amount: row.yield_amount !== undefined && row.yield_amount !== null ? Number(row.yield_amount) : undefined,
        firstName: row.firstName || 'Unknown',
        lastName: row.lastName || 'Unknown',
        middleName: row.middleName,
        fullName: row.fullName || `${row.firstName} ${row.lastName}`,
        gender: gender,
        primaryPhone: row.phone || row.primaryPhone || '0000000000',
        state: row.state,
        lga: row.lga,
        crop: row.crop,
        farmSize: Number(row.farmSize) || undefined,
        kycComplete: row.kycComplete === true || row.kycComplete === 'true' || row.kycComplete === 1 || row.kycComplete === '1' || (typeof row.kycComplete === 'string' && row.kycComplete.toLowerCase() === 'yes'),
        experience: Number(row.experience) || undefined,
        profileStatus: (row.status === 'Active' || row.status === 'Pending' || row.status === 'Suspended') ? row.status : 'Active',
        registrationDate: row.registrationDate || row.regDate || new Date().toISOString(),
        bvn: row.bvn,
        nin: row.nin,
        organizationId: selectedOrgId || undefined,
        programId: selectedProgramId || undefined,
        loanReq: Number(row.loanReq) || undefined,
        loanApproved: Number(row.loanApproved) || undefined,
        latitude: Number(row.latitude) || undefined,
        longitude: Number(row.longitude) || undefined,
      };
      if (!farmerObj.farmerID) {
        farmerObj.farmerID = generateFarmerID(farmerObj);
      }
      return farmerObj;
    });
  };

  const processFile = async () => {
    if (!parsedData) return;
    setIsProcessing(true);
    setUploadProgress(0);
    setProgressMessage('Validating data...');
    setCurrentErrors([]);

    try {
      // Map data according to user's mapping
      const errors: string[] = [];
      const validRows: any[] = [];
      
      parsedData.forEach((row: any, index: number) => {
        const obj: any = {};
        Object.entries(fieldMapping).forEach(([sysField, csvCol]) => {
          if (csvCol) obj[sysField] = row[csvCol as string];
        });
        
        // Validate
        const missingFields = systemFields.filter(f => f.required && !obj[f.key]);
        if (missingFields.length > 0) {
          const rowDisplay = obj.firstName || obj.lastName || `Row ${index + 2}`;
          errors.push(`Row ${index + 2} (${rowDisplay}): Missing required fields - ${missingFields.map(f => f.label).join(', ')}`);
        } else {
          validRows.push(obj);
        }
      });

      const newFarmers = mapDataToFarmers(validRows);
      
      if (errors.length > 0) {
        setCurrentErrors([...errors]);
      }

      // Write back to a new database sheet if using Google Sheets
      if (sheetUrl && token) {
        let spreadsheetId = '';
        const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (match && match[1]) {
          spreadsheetId = match[1];
        } else {
          spreadsheetId = sheetUrl;
        }

        try {
          // Create new sheet
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const newSheetTitle = `System_DB_${timestamp}`;
          const addSheetRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
            method: 'POST',
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              requests: [{ addSheet: { properties: { title: newSheetTitle } } }]
            })
          });

          if (addSheetRes.ok) {
            // Prepare data for export, preserving system IDs
            const headers = ['id', 'farmerID', 'firstName', 'lastName', 'gender', 'primaryPhone', 'state', 'lga', 'crop', 'farmSize', 'kycComplete', 'experience', 'profileStatus', 'registrationDate', 'bvn', 'nin'];
            const rows = newFarmers.map((f: any) => headers.map(h => f[h] ?? ''));

            // Write data to the new sheet
            await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${newSheetTitle}!A1:append?valueInputOption=USER_ENTERED`, {
              method: 'POST',
              headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                range: `${newSheetTitle}!A1`,
                majorDimension: 'ROWS',
                values: [headers, ...rows]
              })
            });
          }
        } catch (e) {
          console.error("Failed to write to Google Sheets", e);
        }
      }

      // If no valid rows, just stop here
      if (newFarmers.length === 0) {
        setIsProcessing(false);
        addRecord({
          fileName: file?.name || 'Google Sheets Import',
          totalRows: errors.length,
          successCount: 0,
          failedCount: errors.length,
          status: 'Failed'
        });
        setResult({ success: 0, failed: errors.length, errors });
        setFile(null);
        setParsedData(null);
        setCurrentErrors([]);
        return;
      }

      const chunkSize = 500;
      const chunks = [];
      for (let i = 0; i < newFarmers.length; i += chunkSize) {
        chunks.push(newFarmers.slice(i, i + chunkSize));
      }

      let totalSuccess = 0;
      let totalFailed = errors.length;
      let allApiErrors = [...errors];

      setProgressMessage(`Importing ${newFarmers.length} records...`);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        // Direct upload to Firestore via optimized bulk method
        try {
          await bulkAddFarmers(chunk);
          totalSuccess += chunk.length;
        } catch (localError: any) {
          allApiErrors.push(localError.message);
          setCurrentErrors(prev => [...prev, localError.message]);
        }
        
        const progress = Math.round(((i + 1) / chunks.length) * 100);
        setUploadProgress(progress);
        setProgressMessage(`Processed ${Math.min((i + 1) * chunkSize, newFarmers.length)} of ${newFarmers.length} records...`);
        
        // Yield to main thread to allow React to paint the UI progress bar
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      setIsProcessing(false);
      const finalStatus = totalFailed === 0 ? 'Success' : totalSuccess === 0 ? 'Failed' : 'Partial';
      addRecord({
        fileName: file?.name || 'Google Sheets Import',
        totalRows: totalSuccess + totalFailed,
        successCount: totalSuccess,
        failedCount: totalFailed,
        status: finalStatus
      });
      setResult({ 
        success: totalSuccess, 
        failed: totalFailed,
        errors: allApiErrors
      });
      setFile(null);
      setParsedData(null);
      setCurrentErrors([]);
    } catch (error: any) {
      console.error(error);
      setIsProcessing(false);
      const failedCount = parsedData ? parsedData.length : 1;
      addRecord({
        fileName: file?.name || 'Google Sheets Import',
        totalRows: failedCount,
        successCount: 0,
        failedCount: failedCount,
        status: 'Failed'
      });
      setResult({ success: 0, failed: failedCount, errors: [error.message || 'An unknown error occurred.'] });
      setCurrentErrors([]);
    }
  };

  const fetchFromGoogleSheets = async () => {
    if (!sheetUrl || !token) return;
    setIsProcessing(true);
    setUploadProgress(0);
    setProgressMessage('Fetching spreadsheet data...');
    setResult(null);

    try {
      let spreadsheetId = '';
      const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        spreadsheetId = match[1];
      } else {
        spreadsheetId = sheetUrl;
      }

      // First fetch spreadsheet metadata to get the first sheet's name
      const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!metaRes.ok) {
        throw new Error('Failed to fetch spreadsheet metadata');
      }
      
      const metaData = await metaRes.json();
      const firstSheetName = metaData.sheets[0].properties.title;

      // Then fetch the data from the first sheet
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(firstSheetName)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error('Failed to fetch spreadsheet data');
      }

      const data = await res.json();
      if (!data.values || data.values.length < 2) {
        throw new Error('Spreadsheet is empty or has no data rows');
      }

      const headers = data.values[0];
      const rows = data.values.slice(1);
      
      const parsedData = rows.map((row: any[]) => {
        const obj: any = {};
        headers.forEach((header: string, index: number) => {
          obj[header.trim()] = row[index];
        });
        return obj;
      });

      setCsvHeaders(headers.map((h: string) => h.trim()));
      setParsedData(parsedData);
      autoMatchFields(headers.map((h: string) => h.trim()));
      setIsProcessing(false);
      
    } catch (error) {
      console.error(error);
      setIsProcessing(false);
      setResult({ success: 0, failed: 1 });
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100">Data Upload & Integration</h2>
          <p className="text-slate-400">Bulk upload farmers from CSV or import directly from Google Sheets.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            id="btn-download-csv-header"
            type="button"
            onClick={downloadAgriculturalRecordsCSV}
            disabled={isExportingCSV || farmers.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg hover:shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            title={farmers.length === 0 ? "No agricultural records available to export" : "Download agricultural records in CSV format"}
          >
            <Download size={16} />
            <span>{isExportingCSV ? 'Exporting...' : 'Download CSV'}</span>
            <span className="text-xs bg-emerald-700/60 px-2 py-0.5 rounded-full text-emerald-100 font-mono">
              {farmers.length}
            </span>
          </button>
        </div>
      </div>

      <div className="flex border-b border-white/10 mb-6">
        <button
          onClick={() => setActiveTab('import')}
          className={`px-6 py-3 text-sm font-semibold transition-colors ${activeTab === 'import' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Data Import
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-6 py-3 text-sm font-semibold transition-colors ${activeTab === 'templates' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Mapping Templates
        </button>
        <button
          onClick={() => setActiveTab('export')}
          className={`px-6 py-3 text-sm font-semibold transition-colors ${activeTab === 'export' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Data Export
        </button>
      </div>
      
      {activeTab === 'templates' ? (
        <MappingTemplates />
      ) : activeTab === 'export' ? (
        <DataExport />
      ) : (
        <div className="space-y-6">

      {/* Integration Method Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 p-1.5 bg-black/20 border border-white/10 rounded-2xl w-fit">
          <button
            type="button"
            onClick={() => setUploadMethod('csv')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              uploadMethod === 'csv'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <FileText size={15} /> Agricultural CSV Upload & Parser
          </button>
          <button
            type="button"
            onClick={() => setUploadMethod('sheets')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              uploadMethod === 'sheets'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Database size={15} /> Google Sheets Integration
          </button>
        </div>

        <div className="text-xs text-slate-400 flex items-center gap-2">
          <span>Active Mode:</span>
          <span className="font-semibold text-emerald-400 uppercase tracking-wider text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            {uploadMethod === 'csv' ? 'CSV File Input' : 'Google Sheets Sync'}
          </span>
        </div>
      </div>

      {/* Agricultural CSV Schema Validation Step Panel */}
      {uploadMethod === 'csv' && (
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shadow-sm">
                <ShieldCheck size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-emerald-500/30">
                    Step 1: Schema Validation
                  </span>
                  <span className="text-xs text-slate-400">• Checks Before Parsing</span>
                </div>
                <h4 className="text-base font-bold text-slate-100 mt-0.5">
                  Required Agricultural CSV Columns
                </h4>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={downloadValidAgriculturalTemplate}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-sm hover:border-emerald-500/30"
                title="Download CSV template containing farmer_id, date, and yield_amount columns"
              >
                <Download size={13} className="text-emerald-400" />
                <span>Download Schema Template</span>
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            To prevent inconsistent or unmapped farm records from entering the database, the parser runs an automated schema inspection step before processing CSV rows. Uploaded files must include:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {REQUIRED_AGRICULTURAL_COLUMNS.map((col) => {
              const isMatched = schemaValidationResult?.matchedColumns[col.key];
              const isMissing = schemaValidationResult && !schemaValidationResult.isValid && schemaValidationResult.missingColumns.includes(col.displayName);

              return (
                <div 
                  key={col.key}
                  className={`p-3.5 rounded-2xl border text-xs transition-all ${
                    isMatched
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                      : isMissing
                      ? 'bg-red-950/40 border-red-500/50 text-red-300 ring-1 ring-red-500/30'
                      : 'bg-white/5 border-white/10 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono font-bold">
                    <span className="text-slate-100 text-sm">{col.displayName}</span>
                    {isMatched ? (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-md font-semibold">
                        <Check size={12} /> Verified
                      </span>
                    ) : isMissing ? (
                      <span className="flex items-center gap-1 text-[10px] text-red-400 bg-red-500/20 px-2 py-0.5 rounded-md font-semibold">
                        <AlertCircle size={12} /> Missing
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 bg-black/40 px-2 py-0.5 rounded-md">
                        Required
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5">{col.description}</p>
                  <div className="text-[10px] text-slate-400 mt-2 font-mono bg-black/30 px-2 py-1 rounded">
                    {isMatched ? `Matched column: "${isMatched}"` : `Example: ${col.example}`}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Validation Status Message & Toggle */}
          <div className="flex flex-wrap items-center justify-between text-xs pt-2 border-t border-white/10 gap-3">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">Validation Status:</span>
              {isCheckingSchema ? (
                <span className="text-amber-400 flex items-center gap-1.5 font-medium animate-pulse">
                  <RefreshCw size={13} className="animate-spin" /> Checking CSV headers before parsing...
                </span>
              ) : schemaValidationResult ? (
                schemaValidationResult.isValid ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 size={14} /> Schema Passed: farmer_id, date, and yield_amount detected. Safe to parse.
                  </span>
                ) : (
                  <span className="text-red-400 font-semibold flex items-center gap-1.5">
                    <AlertCircle size={14} /> Schema Validation Failed: Missing {schemaValidationResult.missingColumns.join(', ')}. Parsing halted.
                  </span>
                )
              ) : (
                <span className="text-slate-400">
                  Ready. Files are inspected for required columns prior to record processing.
                </span>
              )}
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300 hover:text-white">
              <input 
                type="checkbox" 
                checked={strictSchemaEnforced} 
                onChange={(e) => setStrictSchemaEnforced(e.target.checked)}
                className="rounded border-white/20 bg-black/40 text-emerald-500 focus:ring-emerald-500/40"
              />
              <span className="font-medium">Strict Pre-Parse Validation</span>
            </label>
          </div>
        </div>
      )}

      {uploadMethod === 'csv' ? (
        <AgriculturalCsvFileInput
          onDataParsed={handleAgriculturalDataParsed}
          onReset={handleAgriculturalReset}
          onSchemaValidated={(res) => setSchemaValidationResult(res)}
          currentFile={file}
          enableSchemaValidation={strictSchemaEnforced}
        />
      ) : (
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-xl flex flex-col">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-500/20 text-green-400 rounded-xl flex items-center justify-center border border-green-500/30">
                <Database size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">Google Sheets Import</h3>
                <p className="text-xs text-slate-400">Sync data directly from your spreadsheets.</p>
              </div>
            </div>
            {user && (
              <button onClick={handleLogout} className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors">
                <LogOut size={14} /> Disconnect
              </button>
            )}
          </div>
          
          {needsAuth ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
              <p className="text-sm text-slate-400 mb-6">Connect your Google Workspace account to import data seamlessly.</p>
              <button 
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="gsi-material-button w-full max-w-[240px]"
              >
                <div className="gsi-material-button-state"></div>
                <div className="gsi-material-button-content-wrapper flex items-center justify-center gap-3 px-4 py-2 bg-white rounded shadow-sm hover:bg-gray-50 transition-colors">
                  <div className="gsi-material-button-icon">
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="18" height="18" style={{ display: 'block' }}>
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                      <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                  </div>
                  <span className="text-slate-700 font-medium text-sm font-sans">Sign in with Google</span>
                </div>
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Spreadsheet URL</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LinkIcon size={16} className="text-slate-500" />
                  </div>
                  <input
                    type="text"
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-white/10 rounded-xl text-sm text-slate-200 outline-none focus:border-green-500 transition-colors"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-2">Ensure the first sheet (tab) contains your data using the standard template headers.</p>
              </div>
              
              <button 
                onClick={fetchFromGoogleSheets}
                disabled={!sheetUrl || isProcessing}
                className={`mt-6 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold shadow-lg transition-all ${(!sheetUrl || isProcessing) ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
                style={{ backgroundColor: primaryColor }}
              >
                {isProcessing ? <RefreshCw size={18} className="animate-spin" /> : <Database size={18} />}
                {isProcessing ? 'Importing Data...' : 'Sync from Google Sheets'}
              </button>
            </div>
          )}
        </div>
      )}

      
      <ConnectedWorkbooks />
      
      <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Upload Instructions & Template</h3>
          <ul className="text-sm text-slate-300 space-y-1 list-disc pl-4">
            <li>Ensure your file is in CSV/Excel format or linked from Google Sheets.</li>
            <li>Required columns: firstName, lastName, phone.</li>
            <li>Use the standard template for highest match rate, or download existing records to inspect formatting.</li>
          </ul>
        </div>
        <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
          <button 
            id="btn-download-csv-instructions"
            type="button"
            onClick={downloadAgriculturalRecordsCSV}
            disabled={isExportingCSV || farmers.length === 0}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600/20 border border-emerald-500/30 rounded-xl text-emerald-300 font-semibold hover:bg-emerald-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm cursor-pointer"
            title="Download current agricultural records as CSV"
          >
            <Download size={18} /> {isExportingCSV ? 'Exporting...' : `Download CSV (${farmers.length})`}
          </button>
          <button 
            id="btn-download-template"
            type="button"
            onClick={downloadTemplate}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-white/5 border border-white/10 rounded-xl text-slate-300 font-semibold hover:bg-white/10 transition-colors text-sm cursor-pointer"
          >
            <FileText size={18} /> Download Template
          </button>
        </div>
      </div>

      {parsedData && (
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-xl">
          <div className="flex justify-between items-center mb-6">
             <div>
                <h3 className="text-lg font-bold text-slate-100">Data Field Mapping</h3>
                <p className="text-xs text-slate-400 mt-1">Match your CSV columns to the system fields. We've auto-matched fields where possible.</p>
             </div>
             <div className="text-sm font-mono text-slate-400 bg-white/5 px-3 py-1 rounded border border-white/10">
               {parsedData.length} records found
             </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-900/50 p-4 rounded-xl border border-white/10 flex flex-col gap-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-slate-300">
                Organization <span className="text-red-400 ml-1">*</span>
              </label>
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className={`w-full bg-white/5 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 [&>option]:bg-slate-800 transition-colors ${!selectedOrgId ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-blue-500 text-slate-200'}`}
              >
                <option value="">-- Select Organization --</option>
                {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div className="bg-slate-900/50 p-4 rounded-xl border border-white/10 flex flex-col gap-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-slate-300">
                Program (Optional)
              </label>
              <select
                value={selectedProgramId}
                onChange={(e) => setSelectedProgramId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 text-slate-200 focus:ring-1 [&>option]:bg-slate-800 transition-colors"
              >
                <option value="">-- Select Program --</option>
                {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {systemFields.map(field => (
              <div key={field.key} className="bg-slate-900/50 p-4 rounded-xl border border-white/10 flex flex-col gap-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-slate-300">
                  {field.label}
                  {field.required && <span className="text-red-400 ml-1">*</span>}
                </label>
                <select
                  value={fieldMapping[field.key] || ''}
                  onChange={(e) => setFieldMapping({...fieldMapping, [field.key]: e.target.value})}
                  className={`w-full bg-white/5 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 [&>option]:bg-slate-800 transition-colors
                    ${field.required && !fieldMapping[field.key] ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-blue-500 text-slate-200'}`}
                >
                  <option value="">-- Ignore Field --</option>
                  {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>



          {currentErrors.length > 0 && isProcessing && (
             <div className="mb-6 p-4 bg-amber-500/10 rounded-xl border border-amber-500/20 max-h-40 overflow-y-auto">
               <h4 className="text-amber-500 text-sm font-bold mb-2 flex items-center gap-2"><AlertCircle size={16} /> Validation / Import Issues</h4>
               <ul className="text-amber-400/80 text-xs list-disc pl-4 space-y-1">
                 {currentErrors.map((err, i) => <li key={i}>{err}</li>)}
               </ul>
             </div>
          )}
          <div className="flex justify-end gap-4 border-t border-white/10 pt-6">
            <button 
              onClick={() => { setFile(null); setParsedData(null); }}
              className="px-6 py-2 bg-white/5 border border-white/10 text-slate-300 rounded-full font-semibold hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={processFile}
              disabled={isProcessing || !selectedOrgId || systemFields.some(f => f.required && !fieldMapping[f.key])}
              className={`px-8 py-2 rounded-full text-white font-bold shadow-lg transition-all ${isProcessing || !selectedOrgId || systemFields.some(f => f.required && !fieldMapping[f.key]) ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
              style={{ backgroundColor: primaryColor }}
            >
              {isProcessing ? 'Importing...' : 'Confirm & Import Data'}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className={`p-4 rounded-xl border flex flex-col gap-3
          ${result.failed === 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}
        `}>
          <div className="flex items-start gap-3">
            {result.failed === 0 ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
            <div className="flex-1">
              <h5 className="font-bold text-sm">Import Complete</h5>
              <p className="text-xs opacity-80 mt-1">Successfully imported {result.success} records. Failed: {result.failed}.</p>
              
              {result.errors && result.errors.length > 0 && (
                <button 
                  onClick={() => {
                    const blob = new Blob([result.errors!.join('\n')], { type: 'text/plain' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'import_errors.txt';
                    a.click();
                    window.URL.revokeObjectURL(url);
                  }}
                  className="mt-3 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 rounded text-xs font-bold transition-colors inline-flex items-center gap-2"
                >
                  <FileText size={14} /> Download Error Report
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <UploadHistoryTable />

      {stagedRecords.length > 0 && (
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <Database className="text-yellow-400" /> Import Staging Area
              </h3>
              <p className="text-slate-400 text-sm mt-1">
                {stagedRecords.length} records awaiting review. Review conflicts or commit directly to the live database.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={downloadStagedCSV} 
                className="px-4 py-2 bg-white/5 border border-white/10 text-slate-300 rounded-xl hover:bg-white/10 text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                title="Export staged records as CSV"
              >
                <Download size={15} /> Export Staged CSV
              </button>
              <button onClick={() => clearStaged()} className="px-4 py-2 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 text-sm font-semibold transition-colors cursor-pointer">
                Clear All Staged
              </button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs uppercase bg-white/5 text-slate-400">
                <tr>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Crop</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {stagedRecords.map((r, i) => (
                  <tr key={r.id || i} className="hover:bg-white/5">
                    <td className="px-4 py-3">
                      {r.status === 'pending' && <span className="text-green-400 flex items-center gap-1"><CheckCircle2 size={14}/> Ready</span>}
                      {r.status === 'duplicate_warning' && <span className="text-yellow-400 flex items-center gap-1"><AlertCircle size={14}/> Duplicate</span>}
                      {r.status === 'error' && <span className="text-red-400 flex items-center gap-1" title={r.errorReason}><AlertCircle size={14}/> Error: {r.errorReason}</span>}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-100">{r.data?.firstName} {r.data?.lastName}</td>
                    <td className="px-4 py-3">{r.data?.primaryPhone || r.data?.phone}</td>
                    <td className="px-4 py-3">{r.data?.crop}</td>
                    <td className="px-4 py-3 flex items-center gap-2">
                      <button onClick={() => commitRecord(r.id, r.status === 'duplicate_warning')} className="px-3 py-1 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 text-xs font-semibold">
                        Commit
                      </button>
                      <button onClick={() => rejectRecord(r.id)} className="px-3 py-1 bg-rose-500/20 text-rose-400 rounded-lg hover:bg-rose-500/30 text-xs font-semibold">
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
        </div>
      )}
    </div>
  );
}

