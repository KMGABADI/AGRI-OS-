const fs = require('fs');
let code = fs.readFileSync('src/store/useFarmerStore.ts', 'utf8');

// In addFarmer, extract bvn and nin
code = code.replace(`    addFarmer: async (farmer) => {
      const newFarmer: any = { 
        ...farmer, `, `    addFarmer: async (farmer) => {
      const { bvn, nin, interventions, ...farmerWithoutSensitive } = farmer as any;
      const newFarmer: any = { 
        ...farmerWithoutSensitive, `);

// In updateFarmer, fix updatedFarmer redeclaration and type errors
code = code.replace(`        const { bvn, nin, ...updatesWithoutSensitive } = updates as any;
        if (bvn || nin) await setFarmerSensitive(id, { bvn, nin });
        const updatedFarmer: any = { ...current, ...updatesWithoutSensitive };
        const updatedFarmer: any = { ...current, ...updates };`, `        const { bvn, nin, interventions, ...updatesWithoutSensitive } = updates as any;
        if (bvn || nin) await setFarmerSensitive(id, { bvn, nin });
        const updatedFarmer: any = { ...current, ...updatesWithoutSensitive };`);

// In bulkAddFarmers, extract bvn and nin from f
code = code.replace(`        processed.id = docRef.id;
        currentBatch.set(docRef, processed);
        if (bvn || nin) {`, `        const { bvn, nin, interventions, ...processedWithoutSensitive } = processed as any;
        processedWithoutSensitive.id = docRef.id;
        currentBatch.set(docRef, processedWithoutSensitive);
        if (bvn || nin) {`);

code = code.replace(`        const processed = {`, `        const processed: any = {`);

fs.writeFileSync('src/store/useFarmerStore.ts', code);
