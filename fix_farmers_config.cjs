const fs = require('fs');
let code = fs.readFileSync('src/pages/Farmers.tsx', 'utf8');

code = code.replace(
  `  const { farmers, addFarmer } = useFarmerStore();`,
  `  const { farmers, addFarmer } = useFarmerStore();\n  const config = useSystemConfigStore(state => state.config);`
);

fs.writeFileSync('src/pages/Farmers.tsx', code);
