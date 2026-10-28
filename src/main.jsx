import AppUpdate from './components/AppUpdate'
import React from 'react'; import {createRoot} from 'react-dom/client'; import App from './App'; import './index.css'; import './design/system.css'
createRoot(document.getElementById('root')).render(<React.StrictMode><App/><AppUpdate/></React.StrictMode>)
