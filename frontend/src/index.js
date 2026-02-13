import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app.js';

// This is the entry point that connects your React code to the 'root' div in your HTML
const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);