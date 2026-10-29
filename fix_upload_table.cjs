const fs = require('fs');
let code = fs.readFileSync('src/pages/DataUpload.tsx', 'utf8');

code = code.replace(
  `        </div>
        <UploadHistoryTable />
      )}`,
  `        </div>
      )}
      <UploadHistoryTable />`
);

fs.writeFileSync('src/pages/DataUpload.tsx', code);
