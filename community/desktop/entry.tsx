import React from 'react';
import {createRoot} from 'react-dom/client';
import Dashboard from '../app/dashboard';
import '../app/globals.css';
import '../app/simple-workspace.css';
import '../app/project-progress.css';
createRoot(document.getElementById('root')!).render(<Dashboard storageScope="desktop_local"/>);
