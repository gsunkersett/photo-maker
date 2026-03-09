const fileInput = document.getElementById('fileInput');
const downloadBtn = document.getElementById('downloadBtn');
const canvas = document.getElementById('printCanvas');
const ctx = canvas.getContext('2d', {alpha:false});

const DPI = 300;
// switched to landscape 6x4 inches
const IN_W = 6;
const IN_H = 4;
const CANVAS_W = IN_W * DPI;
const CANVAS_H = IN_H * DPI;
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;

const COLS = 3;
const ROWS = 2;
const CELL_W = Math.floor(CANVAS_W / COLS);
const CELL_H = Math.floor(CANVAS_H / ROWS);

const cropModal = document.getElementById('cropModal');
const cropCanvas = document.getElementById('cropCanvas');
const cropCtx = cropCanvas.getContext('2d');
const zoomRange = document.getElementById('zoomRange');
const applyCropBtn = document.getElementById('applyCropBtn');
const cancelCropBtn = document.getElementById('cancelCropBtn');
const resetBtn = document.getElementById('resetBtn');

let activeImage = null; // original Image
let croppedImage = null; // result Image after cropping

const CROP_VIEW = 800; // UI preview square (px)
cropCanvas.width = CROP_VIEW;
cropCanvas.height = CROP_VIEW;

let imgState = {
  scaleBase: 1,
  zoom: 1,
  scale: 1,
  x: 0,
  y: 0,
  dragging: false,
  lastX: 0,
  lastY: 0,
};

// handle dragging state
let handleState = {
  active: false,
  corner: null,
  startScale: 1,
  startDist: 0,
};

function clearCanvas(){
  ctx.fillStyle = '#fff';
  ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
}

clearCanvas();

fileInput.addEventListener('change', handleFile, false);
downloadBtn.addEventListener('click', downloadImage, false);
applyCropBtn.addEventListener('click', applyCrop, false);
cancelCropBtn.addEventListener('click', cancelCrop, false);
resetBtn.addEventListener('click', startOver, false);
zoomRange.addEventListener('input', ()=>{ imgState.zoom = parseFloat(zoomRange.value); imgState.scale = imgState.scaleBase * imgState.zoom; renderCrop(); });

cropCanvas.addEventListener('pointerdown', (e)=>{
  cropCanvas.setPointerCapture(e.pointerId);
  imgState.dragging = true;
  imgState.lastX = e.clientX;
  imgState.lastY = e.clientY;
});
cropCanvas.addEventListener('pointermove', (e)=>{
  if(!imgState.dragging) return;
  const dx = e.clientX - imgState.lastX;
  const dy = e.clientY - imgState.lastY;
  imgState.lastX = e.clientX;
  imgState.lastY = e.clientY;
  imgState.x += dx;
  imgState.y += dy;
  renderCrop();
});
cropCanvas.addEventListener('pointerup', (e)=>{
  imgState.dragging = false;
  try{ cropCanvas.releasePointerCapture(e.pointerId); }catch(e){}
});
cropCanvas.addEventListener('wheel', (e)=>{
  e.preventDefault();
  const delta = -e.deltaY * 0.001;
  let z = imgState.zoom + delta;
  z = Math.min(3, Math.max(0.5, z));
  zoomRange.value = z.toFixed(2);
  imgState.zoom = z;
  imgState.scale = imgState.scaleBase * imgState.zoom;
  renderCrop();
}, {passive:false});

// handle elements
const handles = Array.from(document.querySelectorAll('.handle'));
handles.forEach(h=>{
  h.addEventListener('pointerdown', (ev)=>{
    ev.preventDefault();
    h.setPointerCapture(ev.pointerId);
    handleState.active = true;
    handleState.corner = h.dataset.corner;
    handleState.startScale = imgState.scale;
    const rect = cropCanvas.getBoundingClientRect();
    const cx = rect.left + rect.width/2;
    const cy = rect.top + rect.height/2;
    const dx = ev.clientX - cx;
    const dy = ev.clientY - cy;
    handleState.startDist = Math.hypot(dx,dy);
  });
  h.addEventListener('pointermove', (ev)=>{
    if(!handleState.active) return;
    const rect = cropCanvas.getBoundingClientRect();
    const cx = rect.left + rect.width/2;
    const cy = rect.top + rect.height/2;
    const dx = ev.clientX - cx;
    const dy = ev.clientY - cy;
    const d = Math.hypot(dx,dy);
    if(handleState.startDist <= 0) return;
    const ratio = d / handleState.startDist;
    imgState.scale = Math.max(0.1, handleState.startScale * ratio);
    imgState.zoom = imgState.scale / imgState.scaleBase;
    zoomRange.value = imgState.zoom.toFixed(2);
    renderCrop();
  });
  h.addEventListener('pointerup', (ev)=>{ handleState.active = false; try{ h.releasePointerCapture(ev.pointerId);}catch(e){} });
  h.addEventListener('pointercancel', ()=>{ handleState.active = false; });
});

function handleFile(e){
  const f = e.target.files && e.target.files[0];
  if(!f) return;
  const url = URL.createObjectURL(f);
  const img = new Image();
  img.onload = ()=>{
    activeImage = img;
    URL.revokeObjectURL(url);
    openCropper(img);
    // enable reset while editing
    resetBtn.disabled = false;
  };
  img.src = url;
}

function openCropper(img){
  // compute base scale so image covers crop view
  const sw = img.naturalWidth;
  const sh = img.naturalHeight;
  imgState.scaleBase = Math.max(CROP_VIEW / sw, CROP_VIEW / sh);
  imgState.zoom = 1;
  imgState.scale = imgState.scaleBase * imgState.zoom;
  // center image
  const dispW = sw * imgState.scale;
  const dispH = sh * imgState.scale;
  imgState.x = (CROP_VIEW - dispW) / 2;
  imgState.y = (CROP_VIEW - dispH) / 2;

  zoomRange.value = '1';
  cropModal.setAttribute('aria-hidden','false');
  renderCrop();
}

function renderCrop(){
  const img = activeImage;
  if(!img) return;
  cropCtx.clearRect(0,0,CROP_VIEW,CROP_VIEW);
  const sw = img.naturalWidth;
  const sh = img.naturalHeight;
  const dispW = sw * imgState.scale;
  const dispH = sh * imgState.scale;
  cropCtx.drawImage(img, 0,0,sw,sh, imgState.x, imgState.y, dispW, dispH);
  // draw square guidelines: border + rule-of-thirds lines
  cropCtx.strokeStyle = 'rgba(255,255,255,0.95)';
  cropCtx.lineWidth = 4;
  cropCtx.strokeRect(0,0,CROP_VIEW,CROP_VIEW);
  cropCtx.lineWidth = 1;
  cropCtx.strokeStyle = 'rgba(255,255,255,0.6)';
  // vertical thirds
  cropCtx.beginPath();
  cropCtx.moveTo(CROP_VIEW/3,0); cropCtx.lineTo(CROP_VIEW/3,CROP_VIEW);
  cropCtx.moveTo(2*CROP_VIEW/3,0); cropCtx.lineTo(2*CROP_VIEW/3,CROP_VIEW);
  // horizontal thirds
  cropCtx.moveTo(0,CROP_VIEW/3); cropCtx.lineTo(CROP_VIEW,CROP_VIEW/3);
  cropCtx.moveTo(0,2*CROP_VIEW/3); cropCtx.lineTo(CROP_VIEW,2*CROP_VIEW/3);
  cropCtx.stroke();
}

function applyCrop(){
  const img = activeImage;
  if(!img) return;
  const sw = img.naturalWidth;
  const sh = img.naturalHeight;
  const srcSize = Math.floor(CROP_VIEW / imgState.scale);
  let srcX = Math.floor((-imgState.x) / imgState.scale);
  let srcY = Math.floor((-imgState.y) / imgState.scale);
  // clamp
  srcX = Math.max(0, Math.min(sw - srcSize, srcX));
  srcY = Math.max(0, Math.min(sh - srcSize, srcY));

  const off = document.createElement('canvas');
  off.width = srcSize;
  off.height = srcSize;
  const offCtx = off.getContext('2d');
  offCtx.drawImage(img, srcX, srcY, srcSize, srcSize, 0,0, srcSize, srcSize);

  const dataUrl = off.toDataURL('image/png');
  const newImg = new Image();
  newImg.onload = ()=>{
    croppedImage = newImg;
    cropModal.setAttribute('aria-hidden','true');
    generateGrid(croppedImage);
    downloadBtn.disabled = false;
    resetBtn.disabled = false;
  };
  newImg.src = dataUrl;
}

function cancelCrop(){
  // Close crop modal and do NOT modify the main canvas
  cropModal.setAttribute('aria-hidden','true');
}

function generateGrid(img){
  clearCanvas();
  const sw = img.naturalWidth;
  const sh = img.naturalHeight;
  // We'll use a "cover" strategy: pick a source rect that matches the
  // destination cell aspect ratio, so the image fills the cell without
  // stretching (it may crop a bit).
  const destAR = CELL_W / CELL_H;
  const s = Math.min(sw, sh);
  // If the source is not square, center-crop to square first
  const baseSX = Math.floor((sw - s) / 2);
  const baseSY = Math.floor((sh - s) / 2);

  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      const dx = c * CELL_W;
      const dy = r * CELL_H;

      // Determine source crop that matches dest aspect ratio
      let srcX = baseSX;
      let srcY = baseSY;
      let srcW = s;
      let srcH = s;

      const srcAR = srcW / srcH; // ==1 for square
      if (Math.abs(srcAR - destAR) > 0.001) {
        if (destAR > srcAR) {
          // destination is wider -> reduce source height
          srcH = Math.round(srcW / destAR);
          srcY = baseSY + Math.floor((s - srcH) / 2);
        } else {
          // destination is taller/narrower -> reduce source width
          srcW = Math.round(srcH * destAR);
          srcX = baseSX + Math.floor((s - srcW) / 2);
        }
      }

      ctx.drawImage(img, srcX, srcY, srcW, srcH, dx, dy, CELL_W, CELL_H);
      // enable reset when there is a generated result
      resetBtn.disabled = false;
    }
  }
}

function startOver(){
  // clear main canvas and reset in-memory state
  clearCanvas();
  // clear crop preview
  cropCtx.clearRect(0,0,CROP_VIEW,CROP_VIEW);
  // reset inputs and flags
  fileInput.value = '';
  activeImage = null;
  croppedImage = null;
  downloadBtn.disabled = true;
  resetBtn.disabled = true;
  cropModal.setAttribute('aria-hidden','true');
  // reset imgState
  imgState = { scaleBase:1, zoom:1, scale:1, x:0, y:0, dragging:false, lastX:0, lastY:0 };
  zoomRange.value = '1';
}

function downloadImage(){
  canvas.toBlob(function(blob){
    if(!blob) return;
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
      a.download = '4x6_3x2.jpg';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, 'image/jpeg', 0.95);
}
