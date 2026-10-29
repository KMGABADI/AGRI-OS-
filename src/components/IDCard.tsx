import React, { memo } from 'react';
import { Farmer } from '../types';

export const IDCard = memo(React.forwardRef<HTMLDivElement, { farmer: Farmer }>(({ farmer }, ref) => {
  return (
    <div 
      ref={ref}
      style={{
        width: '400px',
        height: '250px',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        color: 'white',
        padding: '20px',
        borderRadius: '16px',
        border: '2px solid #334155',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Inter, sans-serif'
      }}
    >
      {/* Background pattern */}
      <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px', background: '#3b82f6', opacity: '0.1', borderRadius: '50%' }} />
      <div style={{ position: 'absolute', bottom: '-20px', left: '-20px', width: '100px', height: '100px', background: '#10b981', opacity: '0.1', borderRadius: '50%' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', letterSpacing: '1px', color: '#f8fafc' }}>FARMER IDENTITY CARD</h2>
          <p style={{ margin: 0, fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Federal Republic of Nigeria</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px' }}>
        <div style={{ width: '80px', height: '100px', backgroundColor: '#334155', borderRadius: '8px', overflow: 'hidden', border: '2px solid #475569' }}>
          {farmer.photo ? (
            <img src={farmer.photo} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
          ) : (
             <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '24px', fontWeight: 'bold' }}>
               {farmer.firstName[0]}{farmer.lastName[0]}
             </div>
          )}
        </div>
        
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Full Name</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#f8fafc' }}>{farmer.title} {farmer.firstName} {farmer.lastName}</div>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Farmer ID</div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#60a5fa', fontFamily: 'monospace' }}>{farmer.farmerID || farmer.id}</div>
            </div>
            <div>
              <div style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>State</div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#f8fafc' }}>{farmer.state || 'N/A'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
             <div>
              <div style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Crop</div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#34d399' }}>{farmer.crop || 'N/A'}</div>
            </div>
          </div>
        </div>
      </div>
      
      <div style={{ position: 'absolute', bottom: '16px', right: '16px', textAlign: 'right' }}>
        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=50x50&data=${farmer.farmerID || farmer.id}`} alt="QR" style={{ width: '40px', height: '40px', borderRadius: '4px' }} crossOrigin="anonymous" />
      </div>
    </div>
  );
}));
