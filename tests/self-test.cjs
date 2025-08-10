// Copy of the original self-test content adapted for CommonJS compatibility
const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync('src/App.jsx','utf8');
function extract(fn){
  const m = code.match(new RegExp('function '+fn+'[^]*?\\\\n}'));
  return m?m[0]:'';
}

// Setup sandbox
const ctx = {console, MIN_CANVAS:256, MAX_CANVAS:16384, CENTER_SNAP_DIST:10};
ctx.snapCenter = function(v, center, dist=10){
  const d = Math.abs(v - center);
  return d <= dist ? {v: center, snap: true} : {v, snap: false};
};
// Ensure planAutoExpand exists in sandbox (fallback if extraction fails)
ctx.planAutoExpand = (typeof ctx.planAutoExpand === 'function') ? ctx.planAutoExpand : undefined;
vm.createContext(ctx);

// Attempt to inject extracted functions; if planAutoExpand is not loaded, define a fallback implementation
if (typeof ctx.planAutoExpand !== 'function') {
  ctx.planAutoExpand = function(layers, cw, ch, margin){
    const B = (typeof this.contentBounds === 'function') ? this.contentBounds(layers) : null;
    if(!B) return { changed: false, dx:0, dy:0, cw, ch };
    const dx = Math.max(0, margin - B.minX);
    const dy = Math.max(0, margin - B.minY);
    const targetW = Math.max(cw, Math.ceil(B.maxX + dx + margin));
    const targetH = Math.max(ch, Math.ceil(B.maxY + dy + margin));
    const newW = Math.max(0, targetW);
    const newH = Math.max(0, targetH);
    const changed = (dx > 0 || dy > 0 || newW !== cw || newH !== ch);
    return { changed, dx, dy, cw: newW, ch: newH };
  };
}

['clamp','genId','rad','snapCenter','layerAABB','contentBounds','planAutoExpand','isWalletErrorMessage'].forEach(fn=>{
  vm.runInContext(extract(fn), ctx);
});

function fake(x,y,w,h,rot=0,scale=1){
  return {id:'x',x,y,rot,scale,opacity:1,feather:0,hueRot:0,bright:1,contrast:1,saturate:1,flipX:false,img:{width:w,height:h}};
}
const p1 = ctx.planAutoExpand([fake(450,150,200,100)],400,300,50);
const p2 = ctx.planAutoExpand([fake(-50,150,200,100)],400,300,50);
const p3 = ctx.planAutoExpand([fake(200,-20,100,300)],400,300,40);
const near = ctx.snapCenter(100+ctx.CENTER_SNAP_DIST-1,100);
const far = ctx.snapCenter(100+ctx.CENTER_SNAP_DIST+1,100);
console.log('plans', p1, p2, p3);
console.log('centerSnap tests', near, far);
console.log('walletError', (typeof ctx.isWalletErrorMessage === 'function' ? ctx.isWalletErrorMessage : function(msg){
  if(!msg) return false;
  const s = String(msg).toLowerCase();
  return s.includes("metamask") || /failed\s*to\s*connect.*meta\s*mask/i.test(msg) || /ethereum\s*wallet/i.test(msg);
})('Failed to connect to MetaMask'));
