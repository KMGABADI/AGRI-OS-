export interface ConnectorCredentials {
  [key: string]: any;
}

export interface SchemaField {
  fieldName: string;
  dataType: string;
  sample?: any;
}

export interface SyncResult {
  inserted: number;
  updated: number;
  failed: number;
  errors: string[];
}

export interface Connector {
  connect(credentials: ConnectorCredentials): Promise<any>;
  describeSchema(): Promise<SchemaField[]>;
  read(queryOrFullScan: any): Promise<any[]>;
  write(rows: any[]): Promise<SyncResult>;
  supportsTwoWaySync(): boolean;
  disconnect(): Promise<void>;
}
