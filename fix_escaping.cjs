const fs = require('fs');
let content = fs.readFileSync('src/components/DashboardEditor.tsx', 'utf8');

// Replace \` with `
content = content.replace(/\\`/g, '`');
// Replace \${ with ${
content = content.replace(/\\\${/g, '${');

fs.writeFileSync('src/components/DashboardEditor.tsx', content);
