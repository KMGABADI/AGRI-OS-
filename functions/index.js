const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.preventOrphanedFarmersOrg = functions.firestore
  .document('organizations/{orgId}')
  .onDelete(async (snap, context) => {
    const orgId = context.params.orgId;
    const orphaned = await admin.firestore()
      .collection('farmers')
      .where('organizationId', '==', orgId)
      .limit(1)
      .get();
    if (!orphaned.empty) {
      await snap.ref.set(snap.data());
      throw new Error(`Blocked delete: organization ${orgId} still has farmers referencing it`);
    }
  });

exports.preventOrphanedFarmersProg = functions.firestore
  .document('programs/{progId}')
  .onDelete(async (snap, context) => {
    const progId = context.params.progId;
    const orphaned = await admin.firestore()
      .collection('farmers')
      .where('programId', '==', progId)
      .limit(1)
      .get();
    if (!orphaned.empty) {
      await snap.ref.set(snap.data());
      throw new Error(`Blocked delete: program ${progId} still has farmers referencing it`);
    }
  });
