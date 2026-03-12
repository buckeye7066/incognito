import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { migrateFromBase44 } from '@/api/base44Client'

migrateFromBase44().then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <App />
  )
})

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => {
    console.clear();
  });
}
