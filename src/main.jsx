import ErrorBoundary from './components/ErrorBoundary'
import '@fontsource-variable/space-grotesk'
import AppUpdate from './components/AppUpdate'
import React from 'react'; import {createRoot} from 'react-dom/client'; import App from './App'; import './index.css'; import './design/system.css'
createRoot(document.getElementById('root')).render(<React.StrictMode><ErrorBoundary><App/><AppUpdate/></ErrorBoundary></React.StrictMode>)

import "./design/edition.css";

import "./member/member.css";
import "./admin/admin.css";
import "./design/premium.css";
