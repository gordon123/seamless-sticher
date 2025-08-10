import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
/* eslint-disable no-unused-vars */

// Minimal helper functions for tests to load from App.jsx
function clamp(v, lo, hi){
  return Math.max(lo, Math.min(hi, v));
}
function genId(){
  return `l_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
}
function rad(d){
  return (d * Math.PI) / 180;
}
function snapCenter(v, center, dist=10){
  return Math.abs(v - center) <= dist ? {v: center, snap: true} : {v, snap: false};
}
function layerAABB(L){
  const w = (L.img?.width||0) * (L.scale||1);
  const h = (L.img?.height||0) * (L.scale||1);
  const c = Math.cos(rad(L.rot||0));
  const s = Math.sin(rad(L.rot||0));
  const hw = Math.abs(c) * w/2 + Math.abs(s) * h/2;
  const hh = Math.abs(s) * w/2 + Math.abs(c) * h/2;
  return { minX: L.x - hw, maxX: L.x + hw, minY: L.y - hh, maxY: L.y + hh };
}
function contentBounds(layers){
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let any = false;
  layers.forEach(L => {
    if(!L?.img) return;
    const b = layerAABB(L);
    if(!isFinite(b?.minX) || !isFinite(b?.minY)) return;
    any = true;
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  });
  if(!any) return null;
  return { minX, minY, maxX, maxY };
}
function planAutoExpand(layers, cw, ch, margin){
  const B = contentBounds(layers);
  if(!B) return { changed: false, dx:0, dy:0, cw, ch };
  const dx = Math.max(0, margin - B.minX);
  const dy = Math.max(0, margin - B.minY);
  const targetW = Math.max(cw, Math.ceil(B.maxX + dx + margin));
  const targetH = Math.max(ch, Math.ceil(B.maxY + dy + margin));
  const newW = Math.max(0, targetW);
  const newH = Math.max(0, targetH);
  const changed = (dx > 0 || dy > 0 || newW !== cw || newH !== ch);
  return { changed, dx, dy, cw: newW, ch: newH };
}
function isWalletErrorMessage(msg){
  if(!msg) return false;
  const s = String(msg).toLowerCase();
  return (
    s.includes("metamask") ||
    /failed\s*to\s*connect.*meta\s*mask/i.test(msg) ||
    /ethereum\s*wallet/i.test(msg)
  );
}

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

App.clamp = clamp;
App.genId = genId;
App.rad = rad;
App.snapCenter = snapCenter;
App.layerAABB = layerAABB;
App.contentBounds = contentBounds;
App.planAutoExpand = planAutoExpand;
App.isWalletErrorMessage = isWalletErrorMessage;
export default App
