import React from 'react';
import { createRoot } from 'react-dom/client';
import OpsAdminApp from './OpsAdminApp.jsx';
import '../index.css';

createRoot(document.getElementById('admin-root')).render(
  <React.StrictMode>
    <OpsAdminApp />
  </React.StrictMode>
);
