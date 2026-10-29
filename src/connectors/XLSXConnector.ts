import { Connector, ConnectorCredentials, SchemaField, SyncResult } from '../../packages/shared/connectors/types';
import * as XLSX from 'xlsx';

export class XLSXConnector implements Connector {
  private workbook: XLSX.WorkBook | null = null;
  private targetSheetName: string = '';

  async connect(credentials: ConnectorCredentials): Promise<any> {
    if (credentials.fileBuffer) {
      this.workbook = XLSX.read(credentials.fileBuffer, { type: 'buffer' });
      this.targetSheetName = credentials.sheetName || this.workbook.SheetNames[0];
      return true;
    }
    throw new Error('XLSXConnector requires fileBuffer in credentials');
  }

  async describeSchema(): Promise<SchemaField[]> {
    if (!this.workbook || !this.targetSheetName) throw new Error("Not connected");
    
    const sheet = this.workbook.Sheets[this.targetSheetName];
    if (!sheet) return [];

    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    if (json.length === 0) return [];
    
    const headers = json[0];
    return headers.map((header: string) => ({
      fieldName: header,
      dataType: 'string'
    }));
  }

  async read(queryOrFullScan: any): Promise<any[]> {
    if (!this.workbook || !this.targetSheetName) throw new Error("Not connected");
    
    const sheet = this.workbook.Sheets[this.targetSheetName];
    if (!sheet) return [];

    return XLSX.utils.sheet_to_json(sheet);
  }

  async write(rows: any[]): Promise<SyncResult> {
    throw new Error('Write operation is not supported for uploaded XLSX files in this implementation.');
  }

  supportsTwoWaySync(): boolean {
    return false;
  }

  async disconnect(): Promise<void> {
    this.workbook = null;
  }
}
