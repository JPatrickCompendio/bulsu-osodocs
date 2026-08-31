import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Suppress unhandled noise errors from browser extensions & injected VM scripts
window.addEventListener('error', (event) => {
  const msg = String(event.message || '');
  const filename = String(event.filename || '');
  if (!filename || filename.includes('VM') || msg.includes('startTime') || msg.includes('reportAllChanges')) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
