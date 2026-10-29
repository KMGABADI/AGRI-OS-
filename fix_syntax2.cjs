const fs = require('fs');
let code = fs.readFileSync('src/pages/FarmerProfile.tsx', 'utf8');

code = code.replace(
  "        </div>\n      </div>\n    </div>\n\n        {/* Right Column: Details & M&E */}",
  "        </div>\n\n        {/* Right Column: Details & M&E */}"
);

fs.writeFileSync('src/pages/FarmerProfile.tsx', code);
