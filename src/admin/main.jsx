import React from 'react';
import { createRoot } from 'react-dom/client';
import PlpAdminApp from './PlpAdminApp.jsx';

document.documentElement.dataset.adminExperience = 'plp-administration';
document.title = 'PLP Administration';

createRoot(document.getElementById('admin-root')).render(
  <React.StrictMode>
    <PlpAdminApp />
  </React.StrictMode>
);
