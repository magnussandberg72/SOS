// qrcore.js – minimal QR encode/decode
// kräver <script src="scripts/qrcore.js"></script> i rescue.html

async function makeQRCanvas(text, targetId) {
  if (!window.QRCode) {
    await new Promise(res=>{
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';
      s.onload=res; document.head.appendChild(s);
    });
  }
  const canvas=document.createElement('canvas');
  QRCode.toCanvas(canvas,text,{width:220,margin:1,color:{dark:"#000",light:"#fff"}});
  const box=document.getElementById(targetId);
  box.innerHTML=''; box.appendChild(canvas);
}

async function scanQRFromCamera(onResult){
  const video=document.createElement('video');
  video.autoplay=true; video.style.width='100%';
  const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});
  video.srcObject=stream;
  const box=document.createElement('div');
  box.appendChild(video);
  document.body.appendChild(box);
  const codeReader=await import('https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js');
  const canvas=document.createElement('canvas');
  const ctx=canvas.getContext('2d');
  const loop=()=>{
    if(video.readyState===video.HAVE_ENOUGH_DATA){
      canvas.width=video.videoWidth;
      canvas.height=video.videoHeight;
      ctx.drawImage(video,0,0,canvas.width,canvas.height);
      const imageData=ctx.getImageData(0,0,canvas.width,canvas.height);
      const code=jsQR(imageData.data,canvas.width,canvas.height);
      if(code){
        stream.getTracks().forEach(t=>t.stop());
        box.remove();
        onResult(code.data);
        return;
      }
    }
    requestAnimationFrame(loop);
  };
  loop();
}
