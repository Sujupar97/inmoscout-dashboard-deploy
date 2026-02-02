import React from 'react';
import ReactDOM from 'react-dom/client';
// FIX: Changed to a named import for App to resolve module error.
import { App } from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("No se pudo encontrar el elemento raíz para montar la aplicación");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);