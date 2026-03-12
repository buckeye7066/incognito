import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => {
    console.clear();
  });
}
