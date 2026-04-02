import React from 'react';
import { createRoot } from 'react-dom/client';
import { SidePanelApp } from './SidePanelApp';
import '../styles/globals.css';

const root = createRoot(document.getElementById('root')!);
root.render(<SidePanelApp />);
