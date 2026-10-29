import { Connector, ConnectorCredentials, SchemaField, SyncResult } from '../../packages/shared/connectors/types';
import { getFirestore, CollectionReference, DocumentData } from 'firebase-admin/firestore';

export class FirestoreConnector implements Connector {
  private db: any;
  private collectionName: string = '';

  async connect(credentials: ConnectorCredentials): Promise<any> {
    if (!credentials.collection) {
      throw new Error('FirestoreConnector requires collection in credentials');
    }
    this.collectionName = credentials.collection;
    this.db = getFirestore();
    return true;
  }

  async describeSchema(): Promise<SchemaField[]> {
    if (!this.db) throw new Error("Not connected");
    
    // Firestore is schemaless, so we infer from a single document
    const snapshot = await this.db.collection(this.collectionName).limit(1).get();
    if (snapshot.empty) return [];
    
    const data = snapshot.docs[0].data();
    return Object.keys(data).map(key => ({
      fieldName: key,
      dataType: typeof data[key]
    }));
  }

  async read(queryOrFullScan: any): Promise<any[]> {
    if (!this.db) throw new Error("Not connected");
    
    const snapshot = await this.db.collection(this.collectionName).get();
    return snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  async write(rows: any[]): Promise<SyncResult> {
    if (!this.db) throw new Error("Not connected");
    
    const batch = this.db.batch();
    const collection = this.db.collection(this.collectionName);
    
    let inserted = 0;
    let updated = 0;
    
    // NOTE: Firestore batches are limited to 500 operations. 
    // This simple implementation does not chunk. A production connector would chunk into 500-op batches.
    for (const row of rows) {
      const { id, ...data } = row;
      
      // Clean undefined
      Object.keys(data).forEach(k => {
        if (data[k] === undefined) delete data[k];
      });

      if (id) {
        batch.set(collection.doc(id), data, { merge: true });
        updated++;
      } else {
        batch.set(collection.doc(), data);
        inserted++;
      }
    }
    
    try {
      await batch.commit();
      return { inserted, updated, failed: 0, errors: [] };
    } catch (e: any) {
      return { inserted: 0, updated: 0, failed: rows.length, errors: [e.message] };
    }
  }

  supportsTwoWaySync(): boolean {
    return true;
  }

  async disconnect(): Promise<void> {
    this.db = null;
  }
}
