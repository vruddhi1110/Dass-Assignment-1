import React, { useRef, useEffect, useState } from 'react';
import jsQR from 'jsqr';
import API from '../api';

// Props: eventId, onScanned(payload), onClose
const QRScanner = ({ eventId, onScanned, onClose }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let stream = null;
    let rafId = null;
    let isScanning = true;

    const markAttendance = async (ticketId) => {
      try {
        const resp = await API.post(`/registrations/events/${eventId}/attendance`, { ticketId });
        if (onScanned) onScanned({ success: true, msg: resp.data?.msg, ticketId });
      } catch (err) {
        console.error('Scan POST failed', err.response || err);
        if (onScanned) onScanned({ success: false, msg: err.response?.data?.msg || 'Scan failed', ticketId });
      }
    };

    const tick = () => {
      if (!isScanning) return;
      if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code && code.data) {
        // Stop further scanning
        isScanning = false;
        if (stream) {
          stream.getTracks().forEach(t => t.stop());
        }
        // Post to backend
        markAttendance(code.data);
        return;
      }
      rafId = requestAnimationFrame(tick);
    };

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          isScanning = true;
          tick();
        }
      } catch (err) {
        console.warn('Camera access failed, falling back to file upload', err);
        setError('Camera not available or permission denied. Use upload fallback.');
      }
    };

    startCamera();

    return () => {
      isScanning = false;
      if (stream) {
          // eslint-disable-next-line react-hooks/exhaustive-deps
          try { stream.getTracks().forEach(t => t.stop()); } catch(e){}
      }
      if (rafId) cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // Upload fallback handler
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('image', file);
    try {
      const resp = await API.post(`/registrations/events/${eventId}/attendance/scan-image`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (onScanned) onScanned({ success: true, msg: resp.data?.msg });
    } catch (err) {
      console.error('Image scan failed', err.response || err);
      if (onScanned) onScanned({ success: false, msg: err.response?.data?.msg || 'Image scan failed' });
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <video ref={videoRef} style={{ width: 360, height: 270, background: '#000' }} muted playsInline />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
        <div style={{ maxWidth: 300 }}>
          <p style={{ marginTop: 0 }}>Point the camera at the ticket's QR code. If camera isn't available, upload an image below.</p>
          {error && <div style={{ color: 'darkorange' }}>{error}</div>}
          <div style={{ marginTop: 8 }}>
            <input type="file" accept="image/*" onChange={handleFile} />
          </div>
          <div style={{ marginTop: 12 }}>
            <button onClick={onClose} style={{ padding: '8px 12px' }}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRScanner;
