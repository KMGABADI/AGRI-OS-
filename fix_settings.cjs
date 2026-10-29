const fs = require('fs');
let code = fs.readFileSync('src/pages/Settings.tsx', 'utf8');

code = code.replace("const { dashboard, updateDashboard, features, updateFeatures } = useSettingsStore();", "");
code = code.replace("import { useSettingsStore } from '../store/useSettingsStore';", "import { useSystemConfigStore } from '../store/useSystemConfigStore';\nimport { THEMES } from '../store/useSettingsStore';");

fs.writeFileSync('src/pages/Settings.tsx', code);
