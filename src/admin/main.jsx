import React from 'react';
import { createRoot } from 'react-dom/client';
import { Clock } from 'lucide-react';
import AdminApp from './AdminApp.jsx';
import '../index.css';

globalThis.Clock = Clock;

createRoot(document.getElementById('admin-root')).render(
  <React.StrictMode>
    <AdminApp />
  </React.StrictMode>
);
