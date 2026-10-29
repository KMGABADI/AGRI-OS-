const fs = require('fs');

const code = `import React, { useState, useRef, useEffect, Suspense, lazy } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFarmerStore } from '../store/useFarmerStore';
import { useInterventionStore } from '../store/useInterventionStore';
import { useBrandingStore } from '../store/useBrandingStore';
import { ArrowLeft, Camera, Activity, FileText, Upload, Download, Trash2, MapPin, Wallet, CreditCard, Send, Map } from 'lucide-react';
import { Farmer } from '../types';
import { useAuth } from '../lib/AuthContext';
import { useActivityLogStore } from '../store/useActivityLogStore';
import { IDCard } from '../components/IDCard';
import { ResourceInventoryTracker } from '../components/ResourceInventoryTracker';
import { Certificate } from '../components/Certificate';
import MapLayerUploader from '../components/MapLayerUploader';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export default function FarmerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { primaryColor } = useBrandingStore();
  const { farmers, updateFarmer, deleteFarmer } = useFarmerStore();
  const logActivity = useActivityLogStore(state => state.logActivity);
  const { profile } = useAuth();
  
  const farmer = farmers.find(f => f.id === id);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Farmer>>(farmer || {});
  const [isLoaded, setIsLoaded] = useState(false); // For performance optimization

  useEffect(() => {
    // Defer heavy rendering by a tick to speed up page entry
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const isSuperAdminUser = profile?.email === 'kmgabadi@gmail.com' || profile?.displayName?.toLowerCase() === 'kumuri gabadi';
  const role = isSuperAdminUser ? 'Super Admin' : (profile?.role || 'Viewer');
  const interventionsRecord = useInterventionStore(state => state.interventions);
  const fetchInterventions = useInterventionStore(state => state.fetchInterventions);

  useEffect(() => {
    if (farmer?.id) fetchInterventions(farmer.id);
  }, [farmer?.id, fetchInterventions]);

  const farmerInterventions = farmer?.id ? (interventionsRecord[farmer.id] || []) : [];

  if (!farmer) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400">
        <p>Farmer not found.</p>
        <button onClick={() => navigate('/farmers')} className="mt-4 text-blue-400 hover:underline">Return to list</button>
      </div>
    );
  }

  const isOwner = profile?.email === farmer?.primaryPhone || profile?.email === farmer?.farmerID;
  const canEditProfile = ['Super Admin', 'Admin', 'Manager', 'Field Agent', 'Enumerator', 'Data Entry Officer'].includes(role) || isOwner;
  const canDeleteProfile = ['Super Admin', 'Admin', 'Manager'].includes(role);

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this farmer? This action cannot be undone.')) {
      if (farmer) {
        await deleteFarmer(farmer.id);
        navigate('/farmers');
      }
    }
  };

  const canEditInitialInfo = ['Super Admin', 'Admin', 'Manager'].includes(role) || isOwner;

  const [docFile, setDocFile] = useState<File | null>(null);
  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState('ID_CARD');
  
  const idCardRef = useRef<HTMLDivElement>(null);
  const certRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const performExport = async (target: 'ID' | 'CERT', ref: React.RefObject<HTMLDivElement>) => {
    if (!farmer || !ref.current) return;
    setIsExporting(true);
    try {
      const [html2canvas, { jsPDF }] = await Promise.all([
        import('html2canvas').then(m => m.default),
        import('jspdf')
      ]);
      const canvas = await html2canvas(ref.current, { scale: 2, useCORS: true, allowTaint: true });
      const imgData = canvas.toDataURL('image/png');
      
      if (target === 'ID') {
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [400, 250] });
        pdf.addImage(imgData, 'PNG', 0, 0, 400, 250);
        pdf.save(\`ID_\${farmer?.farmerID || farmer?.id}.pdf\`);
      } else {
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [800, 600] });
        pdf.addImage(imgData, 'PNG', 0, 0, 800, 600);
        pdf.save(\`Cert_\${farmer?.farmerID || farmer?.id}.pdf\`);
      }

      logActivity({
        action: 'EXPORT',
        entityType: 'FARMER',
        entityId: farmer?.id || '',
        details: \`Exported \${target === 'ID' ? 'ID Card' : 'Certificate'} for \${farmer?.firstName} \${farmer?.lastName}\`
      });
    } catch (e) {
      console.error(e);
      alert('Failed to export. See console for details.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDocumentUpload = () => {
    if (!docName || !docFile) return;
    const url = URL.createObjectURL(docFile);
    const newDoc = {
      id: Date.now().toString(),
      name: docName,
      type: docType,
      url,
      uploadDate: new Date().toISOString(),
      status: 'Pending Verification'
    };
    updateFarmer(farmer.id, { documents: [...(farmer.documents || []), newDoc] });
    setDocName('');
    setDocFile(null);
  };

  const saveProfile = () => {
    updateFarmer(farmer.id, formData);
    setIsEditing(false);
    logActivity({
      action: 'UPDATE',
      entityType: 'FARMER',
      entityId: farmer.id,
      details: \`Updated profile details for \${farmer.firstName} \${farmer.lastName}\`
    });
  };

  const handleBoundaryUpload = (layer: any) => {
    updateFarmer(farmer.id, { farmBoundary: layer.data });
    alert('Farm boundary updated successfully!');
  };

  // Define fields to render
  const profileFields = [
    { label: 'Farmer ID', key: 'farmerID', restricted: true },
    { label: 'BVN', key: 'bvn', restricted: true },
    { label: 'NIN', key: 'nin', restricted: true },
    { label: 'First Name', key: 'firstName', restricted: true },
    { label: 'Last Name', key: 'lastName', restricted: true },
    { label: 'Middle Name', key: 'middleName' },
    { label: 'Full Name', key: 'fullName' },
    { label: 'Gender', key: 'gender' },
    { label: 'Date of Birth', key: 'dob', type: 'date' },
    { label: 'Marital Status', key: 'marital' },
    { label: 'Education', key: 'education' },
    { label: 'Primary Phone', key: 'primaryPhone' },
    { label: 'Alt Phone', key: 'phone' },
    { label: 'Address', key: 'address' },
    { label: 'State', key: 'state' },
    { label: 'LGA', key: 'lga' },
    { label: 'Ward', key: 'ward' },
    { label: 'Community', key: 'community' },
    { label: 'Crop Focus', key: 'crop' },
    { label: 'Farm Size (Hectares)', key: 'farmSize', type: 'number' },
    { label: 'Land Ownership', key: 'landOwnership' },
    { label: 'Soil Type', key: 'soilType' },
    { label: 'Soil Fertility', key: 'soilFertility' },
    { label: 'Irrigation', key: 'irrigation' },
    { label: 'Mechanization', key: 'mechanization' },
    { label: 'Variety', key: 'variety' },
    { label: 'Experience (Years)', key: 'experience', type: 'number' },
    { label: 'Planting Date', key: 'plantingDate', type: 'date' },
    { label: 'Loan Requested', key: 'loanReq', type: 'number' },
    { label: 'Loan Approved', key: 'loanApproved', type: 'number' },
    { label: 'Insurance', key: 'insurance' },
    { label: 'Insurer', key: 'insurer' },
    { label: 'Anchor', key: 'anchor' },
    { label: 'Agent', key: 'agent' },
    { label: 'Registration Date', key: 'registrationDate', type: 'date' },
    { label: 'KYC Complete', key: 'kycComplete', type: 'boolean' },
    { label: 'Phase', key: 'phase' },
    { label: 'Latitude', key: 'latitude', type: 'number' },
    { label: 'Longitude', key: 'longitude', type: 'number' },
    { label: 'Remarks', key: 'remarks' },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-300">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-100">Farmer Profile</h2>
            <p className="text-slate-400">{farmer.farmerID || farmer.id}</p>
          </div>
        </div>
        {canDeleteProfile && (
          <button 
            onClick={handleDelete}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-full transition-colors text-sm font-bold"
          >
            <Trash2 size={16} />
            Delete Farmer
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Quick Actions & Snapshot */}
        <div className="col-span-1 space-y-6">
          <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 flex flex-col items-center text-center relative overflow-hidden shadow-xl">
            <div className="relative group mb-4">
              <div className="w-32 h-32 rounded-full border-4 border-white/10 overflow-hidden bg-slate-800">
                {farmer.photo ? (
                  <img src={farmer.photo} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl text-slate-500 font-bold">
                    {farmer.firstName[0]}{farmer.lastName[0]}
                  </div>
                )}
              </div>
            </div>
            <h3 className="text-xl font-bold text-slate-100">{farmer.title} {farmer.firstName} {farmer.lastName}</h3>
            <p className="text-slate-400 text-sm mt-1 mb-4">{farmer.state}, {farmer.lga}</p>
            
            <div className="w-full bg-slate-900/50 rounded-xl p-4 border border-white/5">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-400">Status</span>
                <span className={\`font-bold \${farmer.profileStatus === 'Active' ? 'text-emerald-400' : 'text-amber-400'}\`}>
                  {farmer.profileStatus}
                </span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-400">Crop Focus</span>
                <span className="text-slate-200 font-medium">{farmer.crop || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">KYC Level</span>
                <span className="text-blue-400 font-medium">{farmer.kycComplete ? 'Level 2' : 'Level 1'}</span>
              </div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl">
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4">Credit Score</h4>
            <div className="flex flex-col items-center">
              <div className="text-5xl font-mono text-slate-100 mb-2">{farmer.creditScore?.score || 'N/A'}</div>
              <p className="text-xs text-slate-500">Last updated: {farmer.creditScore?.lastUpdated ? new Date(farmer.creditScore.lastUpdated).toLocaleDateString() : 'N/A'}</p>
              
              <div className="w-full mt-6 space-y-3">
                {farmer.creditScore?.factors && Object.entries(farmer.creditScore.factors).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-slate-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span className="text-slate-200 font-mono">+{value} pts</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Payment Portal */}
          <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl">
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
              <Wallet size={14} /> Digital Wallet & Payments
            </h4>
            <div className="flex justify-between items-end mb-6">
              <div>
                <p className="text-xs text-slate-400">Available Balance</p>
                <p className="text-3xl font-mono text-emerald-400 font-bold mt-1">₦ {Math.floor(Math.random() * 500000).toLocaleString()}</p>
              </div>
            </div>
            
            <div className="flex gap-2 mb-6">
               <button className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg">
                 <Send size={14} /> Send Funds
               </button>
               <button className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg">
                 <CreditCard size={14} /> Receive
               </button>
            </div>
            
            <h5 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Recent Transactions</h5>
            <div className="space-y-2">
               <div className="flex justify-between items-center p-2 bg-white/5 rounded-lg border border-white/5">
                 <div>
                   <p className="text-xs font-semibold text-slate-200">Input Subsidy</p>
                   <p className="text-[10px] text-slate-500">Today, 09:41 AM</p>
                 </div>
                 <span className="text-xs font-mono font-bold text-emerald-400">+ ₦50,000</span>
               </div>
               <div className="flex justify-between items-center p-2 bg-white/5 rounded-lg border border-white/5">
                 <div>
                   <p className="text-xs font-semibold text-slate-200">Seed Purchase</p>
                   <p className="text-[10px] text-slate-500">Yesterday</p>
                 </div>
                 <span className="text-xs font-mono font-bold text-rose-400">- ₦15,000</span>
               </div>
            </div>
          </div>
          
        </div>

        {/* Right Column: Details & M&E */}
        <div className="col-span-2 space-y-6">
          <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl relative">
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Farm & Demographic Details</h4>
              {canEditProfile && (
                <div className="flex gap-2">
                  {isEditing && (
                    <button 
                      onClick={() => {
                        if (navigator.geolocation) {
                          navigator.geolocation.getCurrentPosition(
                            (position) => setFormData({...formData, latitude: position.coords.latitude, longitude: position.coords.longitude}),
                            (err) => alert("Could not get location.")
                          );
                        }
                      }}
                      className="px-4 py-1.5 rounded-full text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-lg transition-all"
                    >
                      Auto GPS
                    </button>
                  )}
                  <button 
                    onClick={() => isEditing ? saveProfile() : setIsEditing(true)}
                    className="px-4 py-1.5 rounded-full text-xs font-semibold text-white shadow-lg transition-all hover:opacity-90"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {isEditing ? 'Save Changes' : 'Edit Details'}
                  </button>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {profileFields.map(field => (
                <div key={field.key} className="bg-white/5 p-3 rounded-xl border border-white/10">
                  <span className="block text-[10px] uppercase tracking-widest text-slate-500 mb-1">{field.label}</span>
                  {isEditing && (!field.restricted || canEditInitialInfo) ? (
                    field.type === 'boolean' ? (
                       <select
                         value={((formData as any)[field.key] ? 'true' : 'false')}
                         onChange={(e) => setFormData({...formData, [field.key]: e.target.value === 'true'})}
                         className="w-full bg-slate-900/50 border border-white/10 rounded p-1 text-sm text-slate-100 outline-none focus:border-blue-500"
                       >
                         <option value="true">Yes</option>
                         <option value="false">No</option>
                       </select>
                    ) : (
                      <input 
                        type={field.type || 'text'} 
                        value={(formData as any)[field.key] || ''} 
                        onChange={(e) => setFormData({...formData, [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value})}
                        className="w-full bg-slate-900/50 border border-white/10 rounded p-1 text-sm text-slate-100 outline-none focus:border-blue-500"
                      />
                    )
                  ) : (
                    <span className="text-sm font-medium text-slate-200">
                      {field.type === 'boolean' ? ((farmer as any)[field.key] ? 'Yes' : 'No') : ((farmer as any)[field.key] || 'Not specified')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl">
             <div className="flex justify-between items-center mb-6">
               <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                 <MapPin size={14} /> Location Map & Boundaries
               </h4>
             </div>
             
             <div className="mb-4">
                <MapLayerUploader onLayerAdded={handleBoundaryUpload} />
             </div>
             
             {isLoaded && farmer.latitude && farmer.longitude ? (
               <div className="h-64 rounded-xl overflow-hidden border border-white/10">
                  <MapContainer center={[farmer.latitude, farmer.longitude]} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    <Marker position={[farmer.latitude, farmer.longitude]}>
                      <Popup>
                        <div className="text-slate-900 font-semibold">{farmer.firstName} {farmer.lastName}</div>
                      </Popup>
                    </Marker>
                    {farmer.farmBoundary && (
                      <GeoJSON data={farmer.farmBoundary} style={{ color: '#10b981', weight: 2, fillOpacity: 0.2 }} />
                    )}
                  </MapContainer>
               </div>
             ) : (
               <div className="h-64 rounded-xl border border-dashed border-white/10 flex items-center justify-center text-slate-500 text-sm">
                  {isLoaded ? 'No GPS coordinates available for this farmer.' : 'Loading map...'}
               </div>
             )}
          </div>

          {/* Resource Inventory Tracker */}
          {isLoaded && <ResourceInventoryTracker farmerId={farmer.id} />}

          {/* Documents Section */}
          <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Documents</h4>
            </div>

            <div className="mb-6 flex gap-2">
              <input 
                type="text" 
                placeholder="Document Name" 
                value={docName} 
                onChange={e => setDocName(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none"
              />
              <select 
                value={docType} 
                onChange={e => setDocType(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none"
              >
                <option value="ID_CARD">ID Card</option>
                <option value="LAND_TITLE">Land Title</option>
                <option value="LOAN_AGREEMENT">Loan Agreement</option>
                <option value="INSURANCE">Insurance</option>
                <option value="OTHER">Other</option>
              </select>
              <label className="bg-blue-500/20 text-blue-400 px-4 py-2 rounded-lg cursor-pointer hover:bg-blue-500/30 transition-colors text-sm font-semibold flex items-center gap-2">
                <Upload size={16} /> Choose File
                <input type="file" className="hidden" onChange={e => setDocFile(e.target.files?.[0] || null)} />
              </label>
              <button 
                onClick={handleDocumentUpload}
                disabled={!docFile || !docName}
                className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg transition-all"
              >
                Upload
              </button>
            </div>

            <div className="space-y-2">
              {farmer.documents?.map(doc => (
                <div key={doc.id} className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <FileText className="text-slate-400" size={20} />
                    <div>
                      <a href={doc.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-slate-200 hover:text-blue-400 transition-colors">{doc.name}</a>
                      <p className="text-[10px] text-slate-500">{doc.type.replace('_', ' ')} • {new Date(doc.uploadDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className={\`text-xs font-semibold px-2 py-1 rounded \${doc.status === 'Verified' ? 'bg-emerald-500/20 text-emerald-400' : doc.status === 'Rejected' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}\`}>
                    {doc.status}
                  </span>
                </div>
              ))}
              {(!farmer.documents || farmer.documents.length === 0) && (
                <p className="text-sm text-slate-500 text-center py-4">No documents uploaded yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Hidden elements for export */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        <div ref={idCardRef}><IDCard farmer={farmer} /></div>
        <div ref={certRef}><Certificate farmer={farmer} /></div>
      </div>
    </div>
  );
}
`;

fs.writeFileSync('src/pages/FarmerProfile.tsx', code);
