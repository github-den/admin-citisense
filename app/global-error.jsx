'use client';

import React from 'react';

export default function GlobalError({ error, reset }) {
  React.useEffect(() => {
    console.error('Unhandled global error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: '#f8fafc',
        color: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        margin: 0,
        padding: '24px',
        textAlign: 'center'
      }}>
        <div style={{
          background: '#ffffff',
          padding: '40px',
          borderRadius: '16px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          maxWidth: '480px',
          width: '100%'
        }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 12px 0', color: '#dc2626' }}>
            Something went wrong!
          </h2>
          <p style={{ color: '#64748b', fontSize: '15px', lineHeight: 1.6, margin: '0 0 24px 0' }}>
            An unexpected error occurred in the civic portal. Our technical team has been notified.
          </p>
          <button
            onClick={() => reset()}
            style={{
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 150ms'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
