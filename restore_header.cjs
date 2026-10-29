const fs = require('fs');
let code = fs.readFileSync('src/pages/DataUpload.tsx', 'utf8');

const oldReturn = `  return (
    <div className="max-w-6xl mx-auto space-y-6">

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">`;

const newReturn = `  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-100">Data Upload & Integration</h2>
        <p className="text-slate-400">Bulk upload farmers from CSV or import directly from Google Sheets.</p>
      </div>

      <div className="flex border-b border-white/10 mb-6">
        <button
          onClick={() => setActiveTab('import')}
          className={\`px-6 py-3 text-sm font-semibold transition-colors \${activeTab === 'import' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-slate-200'}\`}
        >
          Data Import
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={\`px-6 py-3 text-sm font-semibold transition-colors \${activeTab === 'templates' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-slate-400 hover:text-slate-200'}\`}
        >
          Mapping Templates
        </button>
        <button
          onClick={() => setActiveTab('export')}
          className={\`px-6 py-3 text-sm font-semibold transition-colors \${activeTab === 'export' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-400 hover:text-slate-200'}\`}
        >
          Data Export
        </button>
      </div>
      
      {activeTab === 'templates' ? (
        <MappingTemplates />
      ) : activeTab === 'export' ? (
        <DataExport />
      ) : (
        <div className="space-y-6">

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">`;

code = code.replace(oldReturn, newReturn);
fs.writeFileSync('src/pages/DataUpload.tsx', code);
