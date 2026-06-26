import React from 'react';
import { createRoot } from 'react-dom/client';
import OpsAdminApp from './OpsAdminApp.jsx';
import '../index.css';

document.documentElement.dataset.adminExperience = 'plp-resort-command-v3';

createRoot(document.getElementById('admin-root')).render(
  <React.StrictMode>
    <OpsAdminApp />
  </React.StrictMode>
);
