import { Connector, ConnectorCredentials, SchemaField, SyncResult } from '../../packages/shared/connectors/types';
import { google } from 'googleapis';

export class GoogleSheetsConnector implements Connector {
  private auth: any;
  private spreadsheetId: string = '';
  private sheetName: string = '';

  async connect(credentials: ConnectorCredentials): Promise<any> {
    if (!credentials.accessToken || !credentials.spreadsheetId) {
      throw new Error('GoogleSheetsConnector requires accessToken and spreadsheetId');
    }
    this.spreadsheetId = credentials.spreadsheetId;
    this.sheetName = credentials.sheetName || 'Sheet1';
    
    this.auth = new google.auth.OAuth2();
    this.auth.setCredentials({ access_token: credentials.accessToken });
    return true;
  }

  async describeSchema(): Promise<SchemaField[]> {
    if (!this.auth) throw new Error("Not connected");
    
    const sheets = google.sheets({ version: 'v4', auth: this.auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!1:1`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return [];
    
    const headers = rows[0];
    return headers.map((header: string) => ({
      fieldName: header,
      dataType: 'string' // Assume string for simplicity in generic connector
    }));
  }

  async read(queryOrFullScan: any): Promise<any[]> {
    if (!this.auth) throw new Error("Not connected");
    
    const sheets = google.sheets({ version: 'v4', auth: this.auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: this.sheetName,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return [];

    const headers = rows[0];
    const data = rows.slice(1).map(row => {
      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });

    return data;
  }

  async write(rows: any[]): Promise<SyncResult> {
    if (!this.auth) throw new Error("Not connected");
    if (!rows || rows.length === 0) return { inserted: 0, updated: 0, failed: 0, errors: [] };

    // Basic append operation
    const sheets = google.sheets({ version: 'v4', auth: this.auth });
    
    // Convert object rows back to arrays based on the first row's keys
    const headers = Object.keys(rows[0]);
    const values = rows.map(row => headers.map(header => row[header] || ''));
    
    // Include headers if writing to a new sheet, otherwise append values. 
    // For simplicity, we just append. If the sheet is empty, headers should be added first.
    
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: this.sheetName,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: values
        }
      });
      return { inserted: rows.length, updated: 0, failed: 0, errors: [] };
    } catch (e: any) {
      return { inserted: 0, updated: 0, failed: rows.length, errors: [e.message] };
    }
  }

  supportsTwoWaySync(): boolean {
    return true;
  }

  async disconnect(): Promise<void> {
    this.auth = null;
  }
}
