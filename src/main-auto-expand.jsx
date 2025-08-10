import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../seamless_stitcher_auto_expand_canvas_react_canvas.jsx';

const root = document.getElementById('root');
if (root) {
  const element = React.createElement(App);
  createRoot(root).render(element);
} else {
  console.error('Root element not found for auto-expand app');
}
