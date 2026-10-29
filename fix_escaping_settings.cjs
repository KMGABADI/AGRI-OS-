const fs = require('fs');
let content = fs.readFileSync('src/pages/Settings.tsx', 'utf8');

content = content.replace(/\\`/g, '`');
content = content.replace(/\\\${/g, '${');

fs.writeFileSync('src/pages/Settings.tsx', content);
