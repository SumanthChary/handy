import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <>
    <div className="fixed top-0 left-0 bg-red-600 text-white z-[9999] p-1 text-[10px] font-mono">
      MOUNT_SUCCESS
    </div>
    <App />
  </>
);
