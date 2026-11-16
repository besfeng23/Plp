import React from 'react';
import { createRoot } from 'react-dom/client';
import PlpEnterpriseAdminApp from './PlpEnterpriseAdminApp.jsx';

document.documentElement.dataset.adminExperience = 'plp-enterprise-admin';
document.title = 'PLP Enterprise Administration';

createRoot(document.getElementById('admin-root')).render(
  <React.StrictMode>
    <PlpEnterpriseAdminApp />
  </React.StrictMode>
);
