const fs = require('fs');

let eb = fs.readFileSync('src/ErrorBoundary.tsx', 'utf8');
eb = `
import React from 'react';
export class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("React ErrorBoundary caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: 'white', background: 'red', minHeight: '100vh' }}>
          <h1>Something went wrong.</h1>
          <pre>{this.state.error?.toString()}</pre>
          <pre>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
`;
fs.writeFileSync('src/ErrorBoundary.tsx', eb.trim());

let fsStore = fs.readFileSync('src/store/useFarmerStore.ts', 'utf8');
fsStore = fsStore.replace(
  'const latNum = parseFloat(f.latitude);',
  'const latNum = parseFloat(f.latitude as any);'
);
fsStore = fsStore.replace(
  'const lngNum = parseFloat(f.longitude);',
  'const lngNum = parseFloat(f.longitude as any);'
);
fs.writeFileSync('src/store/useFarmerStore.ts', fsStore);
