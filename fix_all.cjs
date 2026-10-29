const fs = require('fs');

// Layout.tsx
let code = fs.readFileSync('src/components/Layout.tsx', 'utf8');
code = code.replace(/settings\.updateFeatures\(\{\n\s*enableFoodBank: true,\n\s*enableMonitoring: true,\n\s*enableActivityLog: true,\n\s*enableMap: true\n\s*\}\);/g, "useSystemConfigStore.getState().updateFeatures({enableFoodBank: true,enableMonitoring: true,enableActivityLog: true,enableMap: true});");
fs.writeFileSync('src/components/Layout.tsx', code);

// Farmers.tsx
code = fs.readFileSync('src/pages/Farmers.tsx', 'utf8');
code = code.replace(/f\.organizationId === orgFilter \|\| f\.anchor === orgFilter \|\| \(false \/\*f\.interventions\?\.some\*\/\)/g, "f.organizationId === orgFilter || f.anchor === orgFilter");
code = code.replace(/f\.programId === programFilter \|\| false \/\*f\.interventions\?\.some\*\//g, "f.programId === programFilter");
fs.writeFileSync('src/pages/Farmers.tsx', code);

// useFarmerStore.ts
code = fs.readFileSync('src/store/useFarmerStore.ts', 'utf8');
code = code.replace(/if \(updatedFarmer\.interventions\)/g, "if ((updatedFarmer as any).interventions)");
code = code.replace(/updatedFarmer\.interventions\.length/g, "(updatedFarmer as any).interventions.length");
code = code.replace(/delete updatedFarmer\.interventions;/g, "delete (updatedFarmer as any).interventions;");
fs.writeFileSync('src/store/useFarmerStore.ts', code);

