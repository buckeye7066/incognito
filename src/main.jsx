import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import incognito, { vault, generateTOTP } from '@/api/client'
import { initExtensionHost } from '@/lib/extensionHost'

// Answer the companion browser extension (if installed) with live vault data.
// No-op until a request arrives; secrets only leave on an explicit fill while
// the vault is unlocked. See src/lib/extensionHost.js + docs/EXTENSION_BRIDGE.md.
initExtensionHost({ client: incognito, vault, generateTOTP })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => {
    if (import.meta.env.DEV) console.clear();
  });
}
