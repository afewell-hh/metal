import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigForm } from './form';
import '../css/configEditor.css';

function App() {
  return (
    <div className="container">
      <h1>Hedgehog Metal Configuration Generator</h1>
      <ConfigForm />
    </div>
  );
}

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
