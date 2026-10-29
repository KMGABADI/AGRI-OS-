const admin = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'utilitarian-habitat-q4dh4' });
}

const db = getFirestore();

async function migrate() {
  console.log('Starting migration...');
  const snapshot = await db.collection('farmers').get();
  console.log(`Found ${snapshot.size} farmers to migrate.`);

  let migratedCount = 0;
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const id = doc.id;
    let needsUpdate = false;
    const updates = {};
    
    // 1. Move BVN/NIN to sensitive subcollection
    if (data.bvn || data.nin) {
      console.log(`Migrating sensitive data for ${id}`);
      await db.collection('farmers').doc(id).collection('sensitive').doc('kyc').set({
        bvn: data.bvn || '',
        nin: data.nin || ''
      }, { merge: true });
      
      updates.bvn = FieldValue.delete();
      updates.nin = FieldValue.delete();
      needsUpdate = true;
    }
    
    // 2. Move interventions to subcollection
    if (data.interventions && Array.isArray(data.interventions) && data.interventions.length > 0) {
      console.log(`Migrating ${data.interventions.length} interventions for ${id}`);
      const batch = db.batch();
      data.interventions.forEach((intervention, idx) => {
        const subId = `migrated-${idx}-${Date.now()}`;
        const ref = db.collection('farmers').doc(id).collection('interventions').doc(subId);
        batch.set(ref, {
          ...intervention,
          dateApplied: intervention.dateApplied || intervention.date || new Date().toISOString()
        });
      });
      await batch.commit();
      
      updates.interventions = FieldValue.delete();
      needsUpdate = true;
    }
    
    if (needsUpdate) {
      await db.collection('farmers').doc(id).update(updates);
      migratedCount++;
    }
  }
  
  console.log(`Migration complete. Migrated ${migratedCount} farmers.`);
}

migrate().catch(console.error);
