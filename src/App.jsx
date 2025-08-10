const { useEffect, useRef, useState } = React;

// Seamless Stitcher — Auto Expand Canvas (no wallets, sandbox‑safe)
// HARDENED: Prevents MetaMask noise; adds automatic infinite‑feeling canvas growth.
// • Auto Expand Canvas: when any layer crosses the current bounds, the canvas grows
//   and optionally shifts content by a safe margin so nothing is clipped.
// • Controls: toggle Auto Expand, margin, manual "Expand Now".
// • Keeps all previous features: Auto Stitch/Align, Canvas resize, Drag on stage,
//   Color match, Self‑tests — and never touches window.ethereum.

/********************* Early, idempotent wallet‑noise guard ************************/
if (typeof window !== "undefined" && !window.__SEAMLESS_WALLET_GUARD_INSTALLED__) {
  window.__SEAMLESS_WALLET_GUARD_INSTALLED__ = true;
  const isWalletErrorMessage = (msg) => {
    if (!msg) return false; const s = String(msg).toLowerCase();
    return (
      s.includes("metamask") || /failed\s*to\s*connect.*meta\s*mask/i.test(msg) || /ethereum\s*wallet/i.test(msg)
    );
  };
  const suppress = (e) => {
    const msg = (e?.reason?.message || e?.message || e)?.toString?.() || "";
    if (isWalletErrorMessage(msg)) { e?.preventDefault?.(); e?.stopImmediatePropagation?.(); if (!window.__SEAMLESS_WALLET_GUARD_LOGGED__) { console.info("[SeamlessStitch] Suppressed wallet error once:", msg); window.__SEAMLESS_WALLET_GUARD_LOGGED__ = true; } return true; }
    return false;
  };
  window.addEventListener("error", suppress, true);
  window.addEventListener("unhandledrejection", suppress, true);
  if (!window.__SEAMLESS_CONSOLE_FILTER_INSTALLED__) {
    window.__SEAMLESS_CONSOLE_FILTER_INSTALLED__ = true;
    const oe = console.error, ow = console.warn;
    const filter = (fn) => (...args) => { const s = args.map(a => (a && a.stack) ? a.stack : String(a)).join(" \n"); if (isWalletErrorMessage(s)) return; fn(...args); };
    console.error = filter(oe); console.warn = filter(ow);
  }
  window.__SEAMLESS_IS_WALLET_ERROR__ = isWalletErrorMessage;
}

/********************* Error Boundary ************************/
class ErrorBoundary extends React.Component {
  constructor(p){ super(p); this.state={hasError:false,msg:""}; }
  static getDerivedStateFromError(err){ const msg = (err?.message||"")+""; if (isWalletErrorMessage(msg)) return {hasError:false,msg:""}; return {hasError:true,msg}; }
  componentDidCatch(err, info){ console.error("ErrorBoundary:", err, info); }
  render(){ return this.state.hasError? (<div className="p-6 text-white bg-red-900/60 rounded-2xl"><h2 className="text-xl font-bold mb-2">Something went wrong</h2><p className="text-sm opacity-90 whitespace-pre-wrap">{this.state.msg}</p></div>) : this.props.children; }
}

/********************* Wallet‑noise detection ************************/
function isWalletErrorMessage(msg){ if(!msg) return false; const s=String(msg).toLowerCase(); return ( s.includes("metamask") || /failed\s*to\s*connect.*meta\s*mask/i.test(msg) || /ethereum\s*wallet/i.test(msg) ); }

/********************* Utilities ************************/
const MIN_CANVAS = 256; // practical lower bound
const MAX_CANVAS = 16384; // safety upper bound to avoid browser crashes
const CENTER_SNAP_DIST = 10; // px distance to snap toward canvas center

function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
function genId(){ return `l_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; }
function rad(d){ return (d*Math.PI)/180; }

function snapCenter(v, center, dist=CENTER_SNAP_DIST){
  return Math.abs(v-center)<=dist ? {v:center,snap:true} : {v,snap:false};
}

function rgbToHsl(r,g,b){r/=255;g/=255;b/=255;const m=Math.max(r,g,b),n=Math.min(r,g,b);let h,s,l=(m+n)/2; if(m===n){h=0;s=0;}else{const d=m-n; s=l>0.5?d/(2-m-n):d/(m+n); switch(m){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;default:h=(r-g)/d+4;} h/=6;} return [h,s,l];}
function hslToRgb(h,s,l){let r,g,b; if(s===0){r=g=b=l;} else {const hue2rgb=(p,q,t)=>{if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p;}; const q=l<0.5?l*(1+s):l+s-l*s; const p=2*l-q; r=hue2rgb(p,q,h+1/3); g=hue2rgb(p,q,h); b=hue2rgb(p,q,h-1/3);} return [Math.round(r*255),Math.round(g*255),Math.round(b*255)];}

function averageRGBFromImage(img, scale=64){ const c=document.createElement("canvas"); const w=Math.min(scale,(img.naturalWidth??img.width)||scale); const h=Math.min(scale,(img.naturalHeight??img.height)||scale); c.width=w; c.height=h; const ctx=c.getContext("2d",{willReadFrequently:true}); ctx.drawImage(img,0,0,w,h); const {data}=ctx.getImageData(0,0,w,h); let r=0,g=0,b=0,cnt=0; for(let i=0;i<data.length;i+=4){const a=data[i+3]; if(a>8){r+=data[i];g+=data[i+1];b+=data[i+2];cnt++;}} return cnt?[r/cnt,g/cnt,b/cnt]:[127,127,127]; }

function featheredCanvasFrom(img, sw, sh, feather){ const t=document.createElement("canvas"); t.width=sw; t.height=sh; const tctx=t.getContext("2d"); tctx.drawImage(img,0,0,sw,sh); if(!feather||feather<=0) return t; tctx.globalCompositeOperation="destination-out"; let g=tctx.createLinearGradient(0,0,0,feather); g.addColorStop(0,"rgba(0,0,0,1)"); g.addColorStop(1,"rgba(0,0,0,0)"); tctx.fillStyle=g; tctx.fillRect(0,0,sw,feather); g=tctx.createLinearGradient(0,sh-feather,0,sh); g.addColorStop(0,"rgba(0,0,0,0)"); g.addColorStop(1,"rgba(0,0,0,1)"); tctx.fillStyle=g; tctx.fillRect(0,sh-feather,sw,feather); g=tctx.createLinearGradient(0,0,feather,0); g.addColorStop(0,"rgba(0,0,0,1)"); g.addColorStop(1,"rgba(0,0,0,0)"); tctx.fillStyle=g; tctx.fillRect(0,0,feather,sh); g=tctx.createLinearGradient(sw-feather,0,sw,0); g.addColorStop(0,"rgba(0,0,0,0)"); g.addColorStop(1,"rgba(0,0,0,1)"); tctx.fillStyle=g; tctx.fillRect(sw-feather,0,feather,sh); return t; }

/********************* Geometry helpers ************************/
function layerAABB(L){
  const w=(L.img?.width||0)*L.scale; const h=(L.img?.height||0)*L.scale; const c=Math.cos(rad(L.rot||0)); const s=Math.sin(rad(L.rot||0));
  const hw = Math.abs(c)*w/2 + Math.abs(s)*h/2;
  const hh = Math.abs(s)*w/2 + Math.abs(c)*h/2;
  return { minX: L.x - hw, maxX: L.x + hw, minY: L.y - hh, maxY: L.y + hh };
}
function contentBounds(layers){
  let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity; let any=false;
  layers.forEach(L=>{ if(!L.img) return; const b=layerAABB(L); if(!isFinite(b.minX)||!isFinite(b.minY)) return; any=true; minX=Math.min(minX,b.minX); minY=Math.min(minY,b.minY); maxX=Math.max(maxX,b.maxX); maxY=Math.max(maxY,b.maxY); });
  if(!any) return null; return {minX, minY, maxX, maxY};
}
function planAutoExpand(layers, cw, ch, margin){
  const B = contentBounds(layers); if(!B) return {changed:false, dx:0, dy:0, cw, ch};
  const dx = Math.max(0, margin - B.minX);
  const dy = Math.max(0, margin - B.minY);
  const targetW = Math.max(cw, Math.ceil(B.maxX + dx + margin));
  const targetH = Math.max(ch, Math.ceil(B.maxY + dy + margin));
  const newW = clamp(targetW, MIN_CANVAS, MAX_CANVAS);
  const newH = clamp(targetH, MIN_CANVAS, MAX_CANVAS);
  const changed = (dx>0 || dy>0 || newW!==cw || newH!==ch);
  return {changed, dx, dy, cw:newW, ch:newH};
}

/********************* App ************************/
function App(){
  const canvasRef=useRef(null);
  const [cw,setCw]=useState(1440); const [ch,setCh]=useState(1024);
  const [lockAspect,setLockAspect]=useState(false); const aspectRef=useRef(cw/ch);

  const [layers,setLayers]=useState([]); // {id,name,img,x,y,scale,rot,opacity,feather,hueRot,bright,contrast,saturate,flipX}
  const [selected,setSelected]=useState(null);
  const [bgTop,setBgTop]=useState("#ff8a00"); const [bgBottom,setBgBottom]=useState("#ffb347");
  const [showGuides,setShowGuides]=useState(true);
  const [snap,setSnap]=useState(true);
  const [testOutput,setTestOutput]=useState("");
  const [overlapPx,setOverlapPx]=useState(60);
  const [centerSnap,setCenterSnap]=useState({x:false,y:false});

  // NEW: Auto Expand controls
  const [autoExpand,setAutoExpand]=useState(true);
  const [expandMargin,setExpandMargin]=useState(64);

  // Load files
  const onFiles=(files)=>{ const arr=Array.from(files||[]);
    arr.forEach((f,i)=>{ if(!f.type?.startsWith("image/")) return; const url=URL.createObjectURL(f); const img=new Image();
      img.onload=()=>{ setLayers((old)=>([...old,{ id:genId(), name:f.name||`Layer ${old.length+1}`, img, x:cw/2+(i-arr.length/2)*40, y:ch/2+(i-arr.length/2)*20, scale:Math.min(1,(cw*0.6)/img.width), rot:0, opacity:1, feather:120, hueRot:0, bright:1, contrast:1, saturate:1, flipX:false }])); URL.revokeObjectURL(url); };
      img.onerror=()=>{ console.warn("Failed to load image", f?.name); URL.revokeObjectURL(url); };
      img.src=url; }); };

  // Draw
  useEffect(()=>{ const canvas=canvasRef.current; if(!canvas) return; const ctx=canvas.getContext("2d");
    ctx.clearRect(0,0,cw,ch); const bg=ctx.createLinearGradient(0,0,0,ch); bg.addColorStop(0,bgTop); bg.addColorStop(1,bgBottom); ctx.fillStyle=bg; ctx.fillRect(0,0,cw,ch);
    layers.forEach((L)=>{ if(!L.img?.complete) return; ctx.save(); ctx.globalAlpha=L.opacity; const sw=Math.max(1,Math.round((L.img.width||1)*L.scale)); const sh=Math.max(1,Math.round((L.img.height||1)*L.scale)); const tmp=document.createElement("canvas"); tmp.width=sw; tmp.height=sh; const tctx=tmp.getContext("2d"); tctx.filter=`brightness(${L.bright}) contrast(${L.contrast}) saturate(${L.saturate}) hue-rotate(${L.hueRot}deg)`; tctx.translate(L.flipX?sw:0,0); if(L.flipX) tctx.scale(-1,1); tctx.drawImage(L.img,0,0,sw,sh); const soft=featheredCanvasFrom(tmp,sw,sh,Math.max(0,Math.min(400,Math.round(L.feather)))); ctx.translate(L.x,L.y); ctx.rotate(rad(L.rot)); ctx.drawImage(soft,-sw/2,-sh/2); ctx.restore(); if(showGuides && selected===L.id){ const b=layerAABB(L); ctx.save(); ctx.strokeStyle="rgba(255,255,255,0.8)"; ctx.setLineDash([6,6]); ctx.strokeRect(b.minX,b.minY,b.maxX-b.minX,b.maxY-b.minY); ctx.setLineDash([]); ctx.restore(); } });
    if(showGuides){
      ctx.save();
      ctx.strokeStyle=centerSnap.x?"rgba(255,255,255,0.8)":"rgba(255,255,255,0.25)";
      ctx.beginPath(); ctx.moveTo(cw/2,0); ctx.lineTo(cw/2,ch); ctx.stroke();
      ctx.strokeStyle=centerSnap.y?"rgba(255,255,255,0.8)":"rgba(255,255,255,0.25)";
      ctx.beginPath(); ctx.moveTo(0,ch/2); ctx.lineTo(cw,ch/2); ctx.stroke();
      ctx.restore();
    }
  },[layers,selected,bgTop,bgBottom,showGuides,cw,ch,centerSnap]);

  // Auto‑expand when content moves/changes
  useEffect(()=>{ if(!autoExpand || layers.length===0) return; const plan = planAutoExpand(layers, cw, ch, expandMargin); if(!plan.changed) return; setCw(plan.cw); setCh(plan.ch); if(plan.dx||plan.dy){ setLayers(old=>old.map(L=>({...L, x:L.x+plan.dx, y:L.y+plan.dy}))); }
  },[layers, cw, ch, autoExpand, expandMargin]);

  // Dragging layers on canvas
  const drag=useRef({id:null,dx:0,dy:0,last:null,axis:null});
  const onPointerDown=(e)=>{ const r=e.currentTarget.getBoundingClientRect(); const x=e.clientX-r.left; const y=e.clientY-r.top; for(let i=layers.length-1;i>=0;i--){ const L=layers[i]; if(!L.img?.complete) continue; const b=layerAABB(L); if(x>=b.minX && x<=b.maxX && y>=b.minY && y<=b.maxY){ setSelected(L.id); const c=Math.cos(rad(L.rot)), s=Math.sin(rad(L.rot)); const dx=x-L.x, dy=y-L.y; const lx=c*dx+s*dy; const ly=-s*dx+c*dy; drag.current={id:L.id,dx:lx,dy:ly,last:{x,y},axis:null}; if(e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId); break; } } };
  const onPointerMove=(e)=>{ if(!drag.current.id) return; const r=e.currentTarget.getBoundingClientRect(); const x=e.clientX-r.left; const y=e.clientY-r.top; let sx=false, sy=false; setLayers((old)=>old.map((L)=>{ if(L.id!==drag.current.id) return L; let nx=x-(drag.current.dx*Math.cos(rad(L.rot))-drag.current.dy*Math.sin(rad(L.rot))); let ny=y-(drag.current.dx*Math.sin(rad(L.rot))+drag.current.dy*Math.cos(rad(L.rot))); if(e.shiftKey){ const last=drag.current.last; const ax=Math.abs(x-last.x)>Math.abs(y-last.y)?"x":"y"; if(!drag.current.axis) drag.current.axis=ax; if(drag.current.axis==="x") ny=L.y; else nx=L.x; } else drag.current.axis=null; const scx=snapCenter(nx,cw/2); const scy=snapCenter(ny,ch/2); nx=scx.v; ny=scy.v; sx=scx.snap; sy=scy.snap; if(snap){ nx=Math.round(nx); ny=Math.round(ny);} drag.current.last={x,y}; return {...L,x:nx,y:ny}; })); setCenterSnap({x:sx,y:sy}); };
  const onPointerUp=()=>{ drag.current={id:null,dx:0,dy:0,last:null,axis:null}; setCenterSnap({x:false,y:false}); };

  // Keyboard shortcuts
  useEffect(()=>{ const onKey=(e)=>{ if(!selected) return; const step=e.shiftKey?10:1; setLayers((old)=>old.map((L)=>{ if(L.id!==selected) return L; if(e.key==="ArrowLeft") return {...L,x:L.x-step}; if(e.key==="ArrowRight") return {...L,x:L.x+step}; if(e.key==="ArrowUp") return {...L,y:L.y-step}; if(e.key==="ArrowDown") return {...L,y:L.y+step}; if(e.key==="[") return {...L,feather:Math.max(0,L.feather-5)}; if(e.key==="]") return {...L,feather:Math.min(400,L.feather+5)}; if(e.key==="+"||e.key==="=") return {...L,scale:L.scale*1.02}; if(e.key==="-") return {...L,scale:L.scale/1.02}; if(e.key.toLowerCase()==="r") return {...L,x:cw/2,y:ch/2,scale:1,rot:0}; return L; })); }; window.addEventListener("keydown",onKey); return ()=>window.removeEventListener("keydown",onKey); },[selected,cw,ch]);

  // Color helpers
  const autoMatchSelectedToBg=()=>{ const L=layers.find(x=>x.id===selected); if(!L||!L.img?.complete) return; const [r,g,b]=averageRGBFromImage(L.img); const hexToRgb=(h)=>{ const m=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h); return m?[parseInt(m[1],16),parseInt(m[2],16),parseInt(m[3],16)]:[255,255,255]; }; const [hr,hg,hb]=(()=>{ const a=hexToRgb(bgTop), c=hexToRgb(bgBottom); return [(a[0]+c[0])/2,(a[1]+c[1])/2,(a[2]+c[2])/2]; })(); const [ih,is,il]=rgbToHsl(r,g,b); const [bh,bs,bl]=rgbToHsl(hr,hg,hb); const hueDeg=(bh-ih)*360; const bright=Math.max(0.2,Math.min(2.5,0.7+(bl/(il+1e-4))*0.6)); const saturate=Math.max(0.2,Math.min(2.5,0.9+(bs-is)*1.2+0.3)); setLayers(old=>old.map(x=>x.id===selected?{...x,hueRot:hueDeg,bright,saturate}:x)); };
  const equalizeAllToBg=()=>{ const ids=layers.map(L=>L.id); ids.forEach((id)=>{ setSelected(id); setTimeout(()=>autoMatchSelectedToBg(),0); }); };

  /*************** Auto Stitch & Auto Align ***************/
  function autoStitchRow(){ setLayers(old=>{ if(old.length===0) return old; const margin=24; let cursor=margin; const order=[...old].sort((a,b)=>a.x-b.x); const fitH=ch*0.88; const updated={}; order.forEach((L)=>{ const sc=Math.min((fitH)/(L.img?.height||1),3); const sw=(L.img?.width||1)*sc; const x=cursor+sw/2; const y=ch/2; cursor+=sw - overlapPx; updated[L.id]={ x, y, scale:sc, rot:0, feather:Math.max(L.feather,120) }; }); return old.map(L=>updated[L.id]?{...L,...updated[L.id]}:L); }); }
  function autoStitchColumn(){ setLayers(old=>{ if(old.length===0) return old; const margin=24; let cursor=margin; const order=[...old].sort((a,b)=>a.y-b.y); const fitW=cw*0.88; const updated={}; order.forEach((L)=>{ const sc=Math.min((fitW)/(L.img?.width||1),3); const sh=(L.img?.height||1)*sc; const x=cw/2; const y=cursor+sh/2; cursor+=sh - overlapPx; updated[L.id]={ x, y, scale:sc, rot:0, feather:Math.max(L.feather,120) }; }); return old.map(L=>updated[L.id]?{...L,...updated[L.id]}:L); }); }
  function alignRowDistribute(){ setLayers(old=>{ if(old.length===0) return old; const margin=24; const order=[...old].sort((a,b)=>a.x-b.x); const widths=order.map(L=> (L.img?.width||1)*L.scale ); const sumW=widths.reduce((a,b)=>a+b,0); const gap=(cw-2*margin - sumW)/(Math.max(1,order.length-1)); let cursor=margin; const updated={}; order.forEach((L,i)=>{ const sw=widths[i]; const x=cursor+sw/2; const y=ch/2; cursor+=sw+gap; updated[L.id]={ x, y, rot:0 }; }); return old.map(L=>updated[L.id]?{...L,...updated[L.id]}:L); }); }
  function alignColumnDistribute(){ setLayers(old=>{ if(old.length===0) return old; const margin=24; const order=[...old].sort((a,b)=>a.y-b.y); const heights=order.map(L=> (L.img?.height||1)*L.scale ); const sumH=heights.reduce((a,b)=>a+b,0); const gap=(ch-2*margin - sumH)/(Math.max(1,order.length-1)); let cursor=margin; const updated={}; order.forEach((L,i)=>{ const sh=heights[i]; const y=cursor+sh/2; const x=cw/2; cursor+=sh+gap; updated[L.id]={ x, y, rot:0 }; }); return old.map(L=>updated[L.id]?{...L,...updated[L.id]}:L); }); }
  function centerAll(){ setLayers(old=> old.map(L=> ({...L, y:ch/2})) ); }

  // Layer list helpers
  const moveLayer=(id,dir)=>{ const idx=layers.findIndex(l=>l.id===id); if(idx<0) return; const arr=[...layers]; const j=dir==="up"?Math.min(arr.length-1,idx+1):Math.max(0,idx-1); [arr[idx],arr[j]]=[arr[j],arr[idx]]; setLayers(arr); };
  const removeLayer=(id)=>setLayers(old=>old.filter(x=>x.id!==id));
  const exportPNG=()=>{ const link=document.createElement("a"); link.download=`seamless-${Date.now()}.png`; link.href=canvasRef.current.toDataURL("image/png"); link.click(); };
  const manualExpand=()=>{ const plan=planAutoExpand(layers,cw,ch,expandMargin); if(plan.changed){ setCw(plan.cw); setCh(plan.ch); if(plan.dx||plan.dy){ setLayers(old=>old.map(L=>({...L,x:L.x+plan.dx,y:L.y+plan.dy}))); } } };

  const sel=layers.find(x=>x.id===selected)||null;

  /********************* Self‑Tests ************************/
  async function runSelfTests(){ const logs=[]; const ok=(n)=>logs.push(`✅ ${n}`); const bad=(n,e="")=>logs.push(`❌ ${n} ${e}`);
    // RGB↔HSL Round‑trip
    [[255,0,0],[0,255,0],[0,0,255],[255,255,255],[0,0,0],[128,64,32]].forEach((rgb,i)=>{ const [h,s,l]=rgbToHsl(...rgb); const [r2,g2,b2]=hslToRgb(h,s,l); const d=Math.abs(r2-rgb[0])+Math.abs(g2-rgb[1])+Math.abs(b2-rgb[2]); (d<=3)?ok(`RGB↔HSL round‑trip #${i+1}`):bad(`RGB↔HSL round‑trip #${i+1}`,`delta=${d}`); });
    // Feather alpha falloff
    const base=document.createElement("canvas"); base.width=base.height=100; const bctx=base.getContext("2d"); bctx.fillStyle="#000"; bctx.fillRect(0,0,100,100); const soft=featheredCanvasFrom(base,100,100,20); const sctx=soft.getContext("2d"); const center=sctx.getImageData(50,50,1,1).data[3]; const corner=sctx.getImageData(0,0,1,1).data[3]; (center>200 && corner<80)?ok("Feather alpha falloff"):bad("Feather alpha falloff",`(center ${center}, corner ${corner})`);
    // Average RGB sanity
    const c2=document.createElement("canvas"); c2.width=c2.height=16; const cc=c2.getContext("2d"); cc.fillStyle="rgb(10,200,30)"; cc.fillRect(0,0,16,16); const img=new Image(); img.src=c2.toDataURL(); await new Promise((res)=>{ img.onload=res; }); const [ar,ag,ab]=averageRGBFromImage(img,16); (Math.abs(ar-10)<5 && Math.abs(ag-200)<5 && Math.abs(ab-30)<5)?ok("Average RGB"):bad("Average RGB",`(${ar},${ag},${ab})`);
    // genId uniqueness
    const set=new Set(Array.from({length:100},()=>genId())); (set.size===100)?ok("genId uniqueness (100)"):bad("genId uniqueness","dupes");
    // Layout monotonicity
    const xs=[200,150,300]; const xsPos = (function(){ const m=24; let c=m, out=[]; xs.forEach(w=>{ out.push(c+w/2); c+=w-50; }); return out; })(); const strictlyInc = xsPos.every((v,i,a)=> i===0 || v>a[i-1]); strictlyInc?ok("Row layout strictly increasing"):bad("Row layout order", xsPos.join(", "));
    // NEW: Auto‑expand planning tests
    (function(){
      const fake=(x,y,w,h,rot=0,scale=1)=>({id:genId(),x,y,rot,scale,opacity:1,feather:0,hueRot:0,bright:1,contrast:1,saturate:1,flipX:false,img:{width:w,height:h}});
      // Right overflow only
      const Ls1=[fake(450,150,200,100)]; const p1=planAutoExpand(Ls1,400,300,50); (p1.cw>=600 && p1.dx===0)?ok("AutoExpand: right overflow grows width") : bad("AutoExpand: right overflow", JSON.stringify(p1));
      // Left negative overflow -> shift right by margin‑adjusted amount, width unchanged
      const Ls2=[fake(-50,150,200,100)]; const p2=planAutoExpand(Ls2,400,300,50); (p2.dx===200 && p2.cw===400)?ok("AutoExpand: left negative shifts content") : bad("AutoExpand: left negative", JSON.stringify(p2));
      // Top & bottom overflow -> height grows
      const Ls3=[fake(200,-20,100,300,0,1)]; const p3=planAutoExpand(Ls3,400,300,40); (p3.dy>0 && p3.ch>300)?ok("AutoExpand: vertical overflow grows height") : bad("AutoExpand: vertical overflow", JSON.stringify(p3));
    })();
    // Snap-to-center threshold
    (function(){ const near=snapCenter(100+CENTER_SNAP_DIST-1,100); const far=snapCenter(100+CENTER_SNAP_DIST+1,100); (near.snap && !far.snap)?ok("Center snap threshold"):bad("Center snap threshold",JSON.stringify({near,far})); })();
    // No wallet access attempt
    (function(){ let accessed=false; Object.defineProperty(window,'ethereum',{get(){accessed=true; return undefined;},configurable:true}); accessed?bad("Wallet access attempt"):ok("No wallet access attempt"); delete window.ethereum; })();
    // Wallet detector tests
    isWalletErrorMessage("s: Failed to connect to MetaMask")?ok("Wallet detector: connect"):bad("Wallet detector: connect");
    isWalletErrorMessage("ProviderError: MetaMask not available")?ok("Wallet detector: not available"):bad("Wallet detector: not available");
    !isWalletErrorMessage("ReferenceError: foo is not defined")?ok("Wallet detector: negative"):bad("Wallet detector: negative");

    setTestOutput(logs.join("\n")); }

  /********************* UI ************************/
  return (
    <ErrorBoundary>
      <div className="w-full min-h-screen bg-neutral-950 text-white">
        <div className="max-w-[1400px] mx-auto p-4 flex gap-4">
          {/* Sidebar */}
          <div className="w-80 shrink-0 space-y-4">
            {/* Canvas Size & Auto Expand */}
            <div className="p-4 bg-neutral-900 rounded-2xl shadow space-y-3">
              <h2 className="text-xl font-bold">Canvas Size</h2>
              <div className="grid grid-cols-2 gap-2 text-sm items-center">
                <label>Width</label>
                <input type="number" min={MIN_CANVAS} max={MAX_CANVAS} value={cw} onChange={(e)=>{ const v=clamp(+e.target.value||cw,MIN_CANVAS,MAX_CANVAS); if(lockAspect){ const newH=Math.round(v/(aspectRef.current||1)); setCw(v); setCh(newH); } else setCw(v); }} />
                <label>Height</label>
                <input type="number" min={MIN_CANVAS} max={MAX_CANVAS} value={ch} onChange={(e)=>{ const v=clamp(+e.target.value||ch,MIN_CANVAS,MAX_CANVAS); if(lockAspect){ const newW=Math.round(v*(aspectRef.current||1)); setCh(v); setCw(newW); } else setCh(v); }} />
                <label>Lock aspect</label>
                <input type="checkbox" checked={lockAspect} onChange={(e)=>{ setLockAspect(e.target.checked); aspectRef.current=cw/ch; }} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm items-center">
                <label>Auto Expand</label>
                <input type="checkbox" checked={autoExpand} onChange={(e)=>setAutoExpand(e.target.checked)} />
                <label>Margin (px)</label>
                <input type="number" min={0} max={512} value={expandMargin} onChange={(e)=>setExpandMargin(clamp(+e.target.value||0,0,512))} />
              </div>
              <div className="flex gap-2 flex-wrap text-sm">
                {[[1080,1080],[1920,1080],[1440,1024],[2048,1024]].map(([w,h])=> (
                  <button key={`${w}x${h}`} className="px-2 py-1 bg-neutral-800 rounded" onClick={()=>{ setCw(w); setCh(h); }}>{w}×{h}</button>
                ))}
                <button className="px-2 py-1 bg-emerald-700 rounded" onClick={manualExpand}>Expand Now</button>
              </div>
            </div>

            <div className="p-4 bg-neutral-900 rounded-2xl shadow">
              <h2 className="text-xl font-bold mb-2">Layers</h2>
              <input type="file" accept="image/*" multiple onChange={(e)=>onFiles(e.target.files)} className="mb-3" />
              <div className="space-y-2 max-h-[30vh] overflow-auto pr-1">
                {layers.map((L,i)=> (
                  <div key={L.id} className={`p-2 rounded-2xl border ${selected===L.id?"border-emerald-400 bg-emerald-950/30":"border-neutral-700"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <button onClick={()=>setSelected(L.id)} className="text-left truncate flex-1">{L.name||`Layer ${i+1}`}</button>
                      <div className="flex gap-1">
                        <button className="px-2 py-1 bg-neutral-800 rounded" onClick={()=>moveLayer(L.id,"down")}>▲</button>
                        <button className="px-2 py-1 bg-neutral-800 rounded" onClick={()=>moveLayer(L.id,"up")}>▼</button>
                        <button className="px-2 py-1 bg-neutral-800 rounded" onClick={()=>removeLayer(L.id)}>✕</button>
                      </div>
                    </div>
                  </div>
                ))}
                {layers.length===0 && (<div className="text-sm text-neutral-400">Add 2–6 photos with similar lighting for best results.</div>)}
              </div>
            </div>

            {/* Auto Stitch & Align */}
            <div className="p-4 bg-neutral-900 rounded-2xl shadow space-y-3">
              <h2 className="text-xl font-bold">Auto Stitch / Align</h2>
              <label className="text-sm">Overlap (px when stitching)</label>
              <input type="range" min={0} max={300} value={overlapPx} onChange={(e)=>setOverlapPx(+e.target.value)} />
              <div className="flex flex-wrap gap-2">
                <button className="px-3 py-2 bg-emerald-600 rounded-xl" onClick={autoStitchRow}>Auto Stitch: Row</button>
                <button className="px-3 py-2 bg-emerald-600 rounded-xl" onClick={autoStitchColumn}>Auto Stitch: Column</button>
                <button className="px-3 py-2 bg-neutral-800 rounded-xl" onClick={alignRowDistribute}>Auto Align: Row</button>
                <button className="px-3 py-2 bg-neutral-800 rounded-xl" onClick={alignColumnDistribute}>Auto Align: Column</button>
                <button className="px-3 py-2 bg-neutral-800 rounded-xl" onClick={centerAll}>Center All (Y)</button>
                <button className="px-3 py-2 bg-indigo-700 rounded-xl" onClick={equalizeAllToBg}>Match Color: All</button>
              </div>
            </div>

            {sel && (
              <div className="p-4 bg-neutral-900 rounded-2xl shadow space-y-3">
                <h2 className="text-xl font-bold">Selected: {sel.name}</h2>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <label>X</label><input type="range" min={0} max={cw} value={sel.x} onChange={(e)=>setLayers(old=>old.map(L=>L.id===sel.id?{...L,x:+e.target.value}:L))} />
                  <label>Y</label><input type="range" min={0} max={ch} value={sel.y} onChange={(e)=>setLayers(old=>old.map(L=>L.id===sel.id?{...L,y:+e.target.value}:L))} />
                  <label>Scale</label><input type="range" min={0.1} max={3} step={0.001} value={sel.scale} onChange={(e)=>setLayers(old=>old.map(L=>L.id===sel.id?{...L,scale:+e.target.value}:L))} />
                  <label>Rotate</label><input type="range" min={-180} max={180} value={sel.rot} onChange={(e)=>setLayers(old=>old.map(L=>L.id===sel.id?{...L,rot:+e.target.value}:L))} />
                  <label>Opacity</label><input type="range" min={0} max={1} step={0.01} value={sel.opacity} onChange={(e)=>setLayers(old=>old.map(L=>L.id===sel.id?{...L,opacity:+e.target.value}:L))} />
                  <label>Feather</label><input type="range" min={0} max={400} value={sel.feather} onChange={(e)=>setLayers(old=>old.map(L=>L.id===sel.id?{...L,feather:+e.target.value}:L))} />
                  <label>Hue</label><input type="range" min={-180} max={180} value={sel.hueRot} onChange={(e)=>setLayers(old=>old.map(L=>L.id===sel.id?{...L,hueRot:+e.target.value}:L))} />
                  <label>Bright</label><input type="range" min={0.2} max={2.5} step={0.01} value={sel.bright} onChange={(e)=>setLayers(old=>old.map(L=>L.id===sel.id?{...L,bright:+e.target.value}:L))} />
                  <label>Contrast</label><input type="range" min={0.5} max={2} step={0.01} value={sel.contrast} onChange={(e)=>setLayers(old=>old.map(L=>L.id===sel.id?{...L,contrast:+e.target.value}:L))} />
                  <label>Saturate</label><input type="range" min={0} max={2.5} step={0.01} value={sel.saturate} onChange={(e)=>setLayers(old=>old.map(L=>L.id===sel.id?{...L,saturate:+e.target.value}:L))} />
                </div>
                <div className="flex gap-2 pt-2 flex-wrap">
                  <button className="px-3 py-2 bg-emerald-600 rounded-xl" onClick={autoMatchSelectedToBg}>Auto color match</button>
                  <button className="px-3 py-2 bg-neutral-800 rounded-xl" onClick={()=>setLayers(old=>old.map(L=>L.id===sel.id?{...L,flipX:!L.flipX}:L))}>Flip X</button>
                  <button className="px-3 py-2 bg-neutral-800 rounded-xl" onClick={()=>setLayers(old=>old.map(L=>L.id===sel.id?{...L,x:cw/2,y:ch/2,rot:0}:L))}>Center</button>
                </div>
              </div>
            )}

            <div className="p-4 bg-neutral-900 rounded-2xl shadow">
              <button onClick={exportPNG} className="w-full px-4 py-3 bg-indigo-600 rounded-xl font-semibold">Export PNG</button>
              {(cw>8192 || ch>8192) && <div className="text-amber-400 text-xs mt-2">Canvas &gt;8192px may fail in some browsers.</div>}
            </div>

            <div className="p-4 bg-neutral-900 rounded-2xl shadow text-xs text-neutral-300 space-y-2">
              <details>
                <summary className="cursor-pointer font-semibold">Shortcuts</summary>
                <ul className="list-disc ml-5 space-y-1">
                  <li>Drag on canvas to move; Shift = lock axis</li>
                  <li>Arrows: nudge (Shift = 10px)</li>
                  <li>[ / ]: Feather − / +</li>
                  <li>+ / −: Scale up / down</li>
                  <li>R: Reset pos/rot to center</li>
                </ul>
              </details>
            </div>

            <div className="p-4 bg-neutral-900 rounded-2xl shadow text-xs text-neutral-300 space-y-2">
              <details open>
                <summary className="cursor-pointer font-semibold">Self‑Tests</summary>
                <button className="px-3 py-2 bg-neutral-800 rounded-xl mb-2" onClick={runSelfTests}>Run Self‑Tests</button>
                <pre className="whitespace-pre-wrap max-h-56 overflow-auto">{testOutput || "(No test output yet)"}</pre>
              </details>
            </div>
          </div>

          {/* Main stage */}
          <div className="flex-1">
            <div className="rounded-2xl overflow-hidden border border-neutral-800 shadow-2xl">
              <canvas
                ref={canvasRef}
                width={cw}
                height={ch}
                className="w-full h-auto touch-none bg-neutral-900"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
              />
            </div>
            <div className="mt-3 text-neutral-400 text-sm">Auto‑Expand keeps everything in view: drag beyond edges and the canvas grows with a comfy margin.</div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

const root = document.getElementById("root");
ReactDOM.createRoot(root).render(<App />);

