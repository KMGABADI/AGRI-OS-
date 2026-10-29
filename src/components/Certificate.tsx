import React, { memo } from 'react';
import { Farmer } from '../types';

export const Certificate = memo(React.forwardRef<HTMLDivElement, { farmer: Farmer }>(({ farmer }, ref) => {
  return (
    <div 
      ref={ref}
      style={{
        width: '800px',
        height: '600px',
        background: '#ffffff',
        color: '#0f172a',
        padding: '40px',
        position: 'relative',
        fontFamily: 'Inter, serif'
      }}
    >
      <div style={{
        width: '100%',
        height: '100%',
        border: '10px solid #cbd5e1',
        padding: '2px',
        position: 'relative'
      }}>
        <div style={{
          width: '100%',
          height: '100%',
          border: '2px solid #94a3b8',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
          textAlign: 'center',
          background: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(248,250,252,1) 100%)'
        }}>
          
          <div style={{ color: '#64748b', textTransform: 'uppercase', letterSpacing: '4px', fontSize: '14px', marginBottom: '24px' }}>
            Agricultural Registration System
          </div>
          
          <h1 style={{ fontSize: '48px', color: '#1e293b', margin: '0 0 40px 0', fontFamily: 'serif' }}>Certificate of Registration</h1>
          
          <p style={{ fontSize: '18px', color: '#64748b', marginBottom: '16px' }}>This is to certify that</p>
          
          <h2 style={{ fontSize: '36px', color: '#0f172a', borderBottom: '2px solid #3b82f6', paddingBottom: '8px', marginBottom: '32px', display: 'inline-block', minWidth: '300px' }}>
            {farmer.title} {farmer.firstName} {farmer.lastName}
          </h2>
          
          <p style={{ fontSize: '16px', color: '#475569', lineHeight: '1.6', maxWidth: '600px', marginBottom: '48px' }}>
            has been successfully registered as a verified farmer under the national agricultural registry database. 
            They are authorized to participate in associated farming interventions and schemes.
          </p>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: 'auto', padding: '0 40px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: 'monospace', color: '#1e293b', marginBottom: '8px' }}>
                {farmer.farmerID || farmer.id}
              </div>
              <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '8px', fontSize: '12px', color: '#64748b', textTransform: 'uppercase' }}>
                Registration ID
              </div>
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}>
                {new Date(farmer.registrationDate).toLocaleDateString()}
              </div>
              <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '8px', fontSize: '12px', color: '#64748b', textTransform: 'uppercase' }}>
                Date of Issue
              </div>
            </div>
          </div>
          
          {/* Decorative seal */}
          <div style={{ position: 'absolute', bottom: '60px', left: '50%', transform: 'translateX(-50%)', width: '80px', height: '80px', borderRadius: '50%', border: '4px solid #fbbf24', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: '10px', color: '#d97706', fontWeight: 'bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Verified<br/>Farmer
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}));
