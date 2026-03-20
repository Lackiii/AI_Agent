import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { AppTheme } from './providers/AppTheme';
import './index.css';

const container = document.getElementById('app');
if (!container) {
  throw new Error('App root element is missing.');
}

createRoot(container).render(
  <React.StrictMode>
    <AppTheme>
      <HashRouter>
        <App />
      </HashRouter>
    </AppTheme>
  </React.StrictMode>,
);
