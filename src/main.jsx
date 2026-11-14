import {ThemeProvider} from './context/ThemeContext'
import ThemeToggle from './components/ThemeToggle'
import ErrorBoundary from './components/ErrorBoundary'
import '@fontsource-variable/space-grotesk'
import AppUpdate from './components/AppUpdate'
import React from 'react'; import {createRoot} from 'react-dom/client'; import App from './App'; import './index.css'; import './design/system.css'
createRoot(document.getElementById('root')).render(<React.StrictMode><ThemeProvider><ErrorBoundary><App/><AppUpdate/></ErrorBoundary><ThemeToggle/></ThemeProvider></React.StrictMode>)

import "./design/edition.css";

import "./member/member.css";
import "./admin/admin.css";
import "./design/premium.css";

import "./admin/workflow.css";
import "./design/light.generated.css";
import "./design/theme.css";
import "./design/readability.css";
