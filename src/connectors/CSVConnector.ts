import { Connector, ConnectorCredentials, SchemaField, SyncResult } from '../../packages/shared/connectors/types';
import Papa from 'papaparse';

export class CSVConnector implements Connector {
  private fileContent: string = '';
  
  async connect(credentials: ConnectorCredentials): Promise<any> {
    if (credentials.fileContent) {
      this.fileContent = credentials.fileContent;
      return true;
    }
    throw new Error('CSVConnector requires fileContent in credentials');
  }

  async describeSchema(): Promise<SchemaField[]> {
    return new Promise((resolve, reject) => {
      Papa.parse(this.fileContent, {
        header: true,
        preview: 1,
        complete: (results) => {
          if (results.meta.fields) {
            const schema = results.meta.fields.map(field => ({
              fieldName: field,
              dataType: 'string'
            }));
            resolve(schema);
          } else {
            resolve([]);
          }
        },
        error: (error: any) => reject(error)
      });
    });
  }

  async read(queryOrFullScan: any): Promise<any[]> {
    return new Promise((resolve, reject) => {
      Papa.parse(this.fileContent, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          resolve(results.data);
        },
        error: (error: any) => reject(error)
      });
    });
  }

  async write(rows: any[]): Promise<SyncResult> {
    throw new Error('Write operation is not supported for CSV file uploads in this implementation.');
  }

  supportsTwoWaySync(): boolean {
    return false;
  }

  async disconnect(): Promise<void> {
    this.fileContent = '';
  }
}
