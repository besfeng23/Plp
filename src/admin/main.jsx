import React from 'react';
import { createRoot } from 'react-dom/client';
import { Clock } from 'lucide-react';
import AdminApp from './AdminApp.jsx';
import '../index.css';

// Hotfix for the Admin v2 dashboard while the large shell is being split into modules.
// AdminApp currently references <Clock /> without a local import.
globalThis.Clock = Clock;

createRoot(document.getElementById('admin-root')).render(
  <React.StrictMode>
    <AdminApp />
  </React.StrictMode>
);
