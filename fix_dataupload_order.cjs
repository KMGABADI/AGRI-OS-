const fs = require('fs');
let code = fs.readFileSync('src/pages/DataUpload.tsx', 'utf8');

const handlers = `  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const eMod = { target: { files: e.dataTransfer.files } };
      handleFileUpload(eMod as any);
    }
  };`;

code = code.replace(handlers, '');

code = code.replace(`  const [isDragging, setIsDragging] = useState(false);`, `  const [isDragging, setIsDragging] = useState(false);\n\n${handlers}`);

fs.writeFileSync('src/pages/DataUpload.tsx', code);
