import React from 'react';
import {createRoot} from 'react-dom/client';
import CommunityEntry from '../app/community-entry';
import '../app/globals.css';
import '../app/simple-workspace.css';
import '../app/project-progress.css';
createRoot(document.getElementById('root')!).render(<CommunityEntry/>);
