const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync('src/App.jsx','utf8');
function extract(fn){
  const m = code.match(new RegExp('function '+fn+'[^]*?\n}'));
  return m?m[0]:'';
}
const ctx = {console, MIN_CANVAS:256, MAX_CANVAS:16384, CENTER_SNAP_DIST:10};
vm.createContext(ctx);
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
console.log('walletError', ctx.isWalletErrorMessage('Failed to connect to MetaMask'));
