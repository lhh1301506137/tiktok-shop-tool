import React from 'react';
import { createRoot } from 'react-dom/client';
import { PopupApp } from './PopupApp';
import '../styles/globals.css';

const root = createRoot(document.getElementById('root')!);
root.render(<PopupApp />);
