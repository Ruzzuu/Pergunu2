import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './legacy/App';
import { synchronizeSession } from './legacy/services/cloudflare';
import './legacy/index.css';

await synchronizeSession();
ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>);
