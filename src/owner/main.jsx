import React from 'react';
import { createRoot } from 'react-dom/client';
import OwnerApp from './OwnerApp.jsx';
import './owner.css';
createRoot(document.getElementById('plp-owner-root')).render(<React.StrictMode><OwnerApp/></React.StrictMode>);
