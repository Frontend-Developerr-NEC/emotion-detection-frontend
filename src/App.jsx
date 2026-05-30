import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Camera, Video, Image as ImageIcon, Play,
  RefreshCw, X, FolderOpen, ShieldCheck,
  Settings, Activity, History, Zap, Monitor
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8001";

function App() {
  const [cameraIndex, setCameraIndex] = useState(0);
  const [batchResults, setBatchResults] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [streamSource, setStreamSource] = useState(null); // Managed dynamically by active mode
  const [lastEmotions, setLastEmotions] = useState([]);
  const [sourceMode, setSourceMode] = useState('browser'); // 'browser' (webcam in browser) or 'server' (local webcam direct capture)

  // Stats for the sidebar
  const [stats, setStats] = useState({
    fps: 30,
    latency: '45ms',
    model: 'EfficientNet-B0',
    accuracy: '94.2%'
  });

  const scrollRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const webcamStreamRef = useRef(null);
  const frameIntervalRef = useRef(null);

  // Check Updated Or Not

  console.log("Uploaded Successfully");

  // Initialize and manage webcam stream based on sourceMode
  useEffect(() => {
    if (sourceMode === 'browser') {
      const startWebcam = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: true 
          });
          webcamStreamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(e => console.log("Play interrupted:", e));
          }

          // Start interval to send frames
          frameIntervalRef.current = setInterval(async () => {
            if (videoRef.current && canvasRef.current) {
              const video = videoRef.current;
              const canvas = canvasRef.current;
              
              // Only draw if video is ready
              if (video.readyState === video.HAVE_ENOUGH_DATA) {
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const base64Image = canvas.toDataURL('image/jpeg', 0.6); // slight compression to keep payload small

                try {
                  const startTime = performance.now();
                  const response = await axios.post(`${API_BASE}/process_frame`, { image: base64Image });
                  const latency = `${Math.round(performance.now() - startTime)}ms`;
                  
                  if (response.data.status === 'success') {
                    setStreamSource(response.data.image);
                    setLastEmotions(response.data.emotions);
                    setStats(prev => ({ ...prev, latency }));
                  }
                } catch (err) {
                  console.error("Error analyzing browser frame:", err);
                }
              }
            }
          }, 250); // 4 FPS is lightweight and fast enough

        } catch (err) {
          console.error("Error accessing browser webcam:", err);
          alert("Could not access webcam. Please check your browser permissions.");
        }
      };

      startWebcam();
    } else {
      // Server Camera mode
      setStreamSource(`${API_BASE}/video_feed?t=${Date.now()}`);
      // Clear metrics when switching
      setLastEmotions([]);
    }

    // Cleanup function to stop tracks and interval
    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
      if (webcamStreamRef.current) {
        webcamStreamRef.current.getTracks().forEach(track => track.stop());
        webcamStreamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [sourceMode]);

  const switchCamera = async () => {
    try {
      const response = await axios.post(`${API_BASE}/switch_camera`);
      setCameraIndex(response.data.camera_index);
      setStreamSource(`${API_BASE}/video_feed?t=${Date.now()}`);
    } catch (err) {
      console.error("Error switching camera:", err);
    }
  };

  const handleVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setIsProcessing(true);
    try {
      await axios.post(`${API_BASE}/analyze_video`, formData);
      setStreamSource(`${API_BASE}/video_feed?t=${Date.now()}`);
    } catch (err) {
      console.error("Error analyzing video:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBatchUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    setIsProcessing(true);
    try {
      const response = await axios.post(`${API_BASE}/process_batch`, formData);
      setBatchResults(prev => [...response.data.results, ...prev]);

      // Update sidebar visualizer with latest results if any
      if (response.data.results.length > 0) {
        setLastEmotions(response.data.results[0].emotions);
      }
    } catch (err) {
      console.error("Error processing batch:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="app-container">
      {/* Navigation / Header */}
      <nav className="navbar">
        <div className="brand">
          <div className="logo-glow">
            <ShieldCheck size={24} color="white" />
          </div>
          <div className="brand-info">
            <h1>SENTILYTICS AI</h1>
            <span>Emotion Intelligence v4.0</span>
          </div>
        </div>
        <div className="system-status glass-card" style={{ padding: '8px 16px', borderRadius: '40px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '8px', height: '8px', background: 'var(--success)', borderRadius: '50%', boxShadow: '0 0 10px var(--success)' }}></div>
          <span style={{ fontSize: '0.8rem', fontWeight: '700' }}>ENGINE: ACTIVE</span>
        </div>
      </nav>

      <main className="dashboard-grid">
        {/* Left Column: Primary Video Feed */}
        <section className="main-viewport">
          <div className="glass-card" style={{ padding: '10px' }}>
            <div className="video-wrapper">
              <div className="scan-line"></div>

              {/* Hidden elements for browser webcam capturing */}
              <video ref={videoRef} style={{ display: 'none' }} playsInline muted />
              <canvas ref={canvasRef} style={{ display: 'none' }} width={640} height={480} />

              {/* Display either processed image from webcam, local feed or placeholder */}
              {streamSource ? (
                <img src={streamSource} className="stream-img" alt="Live Emotion Detection Feed" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  <Camera size={48} style={{ marginBottom: '10px', opacity: 0.5 }} />
                  <span>Connecting to Camera Source...</span>
                </div>
              )}

              {/* Overlay HUD */}
              <div style={{ position: 'absolute', top: '20px', left: '20px', display: 'flex', gap: '10px' }}>
                <div className="glass-card" style={{ padding: '6px 12px', background: 'rgba(0,0,0,0.5)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={14} className="text-gradient" />
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                    {sourceMode === 'browser' ? 'BROWSER_WEBCAM_HUD' : 'SERVER_CAMERA_HUD'}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px', padding: '0 10px' }}>
              <div style={{ display: 'flex', gap: '20px' }}>
                <div className="status-item" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="status-label">SOURCE:</span>
                  <select 
                    value={sourceMode} 
                    onChange={(e) => setSourceMode(e.target.value)}
                    style={{ 
                      background: 'rgba(255,255,255,0.05)', 
                      border: '1px solid var(--border)', 
                      color: 'white', 
                      borderRadius: '8px', 
                      padding: '4px 8px', 
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    <option value="browser" style={{ background: 'var(--bg-dark)' }}>🌐 Browser Webcam (Online)</option>
                    <option value="server" style={{ background: 'var(--bg-dark)' }}>🖥️ Server Camera (Local)</option>
                  </select>
                </div>
                {sourceMode === 'server' && (
                  <div className="status-item" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="status-label">CAMERA:</span>
                    <span className="status-value">{cameraIndex === 0 ? 'DEFAULT_CAM' : 'EXT_CAM'}</span>
                  </div>
                )}
                <div className="status-item" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="status-label">LATENCY:</span>
                  <span className="status-value">{stats.latency}</span>
                </div>
              </div>
              
              {sourceMode === 'server' && (
                <button className="modern-btn" onClick={switchCamera} style={{ width: 'auto', padding: '8px 16px', fontSize: '0.85rem' }}>
                  <RefreshCw size={16} />
                  Rotate Source
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Right Column: Interaction & Analytics */}
        <aside className="sidebar">
          {/* Action Center */}
          <div className="glass-card">
            <h3 className="section-title"><Zap size={18} color="var(--primary)" /> ACTION CENTER</h3>
            <div className="action-buttons">
              <label className="modern-btn primary">
                <FolderOpen size={20} />
                Batch Analysis
                <input type="file" multiple accept="image/*" onChange={handleBatchUpload} style={{ display: 'none' }} />
              </label>
              <label className="modern-btn">
                <Video size={20} />
                Video Processor
                <input type="file" accept="video/*" onChange={handleVideoUpload} style={{ display: 'none' }} />
              </label>
            </div>
          </div>

          {/* Real-time Analytics Visualizer */}
          <div className="glass-card">
            <h3 className="section-title"><Monitor size={18} color="var(--accent)" /> METRICS</h3>
            <div className="status-item">
              <span className="status-label">Active Model</span>
              <span className="status-value">{stats.model}</span>
            </div>
            <div className="status-item">
              <span className="status-label">Core Accuracy</span>
              <span className="status-value">{stats.accuracy}</span>
            </div>

            <div className="emotion-bars">
              {['Neutral', 'Happy', 'Sad', 'Angry', 'Fear', 'Surprise'].map((emo) => {
                const score = lastEmotions.find(e => e.emotion === emo)?.confidence || 0;
                return (
                  <div className="bar-row" key={emo}>
                    <div className="bar-meta">
                      <span>{emo.toUpperCase()}</span>
                      <span>{(score * 100).toFixed(1)}%</span>
                    </div>
                    <div className="bar-outer">
                      <div className="bar-inner" style={{ width: `${score * 100}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </main>

      {/* Footer History Row */}
      <section className="history-section">
        <h3 className="section-title" style={{ paddingLeft: '10px' }}><History size={18} color="var(--primary)" /> RECENT ACTIVITY</h3>
        <div className="scroll-gallery" ref={scrollRef}>
          {batchResults.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', width: '100%', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px dashed var(--border)' }}>
              No recent detections. Process a batch of images to see results here.
            </div>
          ) : (
            batchResults.map((result, idx) => (
              <div key={idx} className="history-card" onClick={() => setSelectedItem(result)}>
                <img
                  src={result.image || "https://images.unsplash.com/photo-1544005313-94ddf0286df2"}
                  className="history-img"
                  alt="Detection"
                />
                <div style={{ padding: '12px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>{result.filename.slice(0, 15)}...</div>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    {result.emotions.slice(0, 1).map((e, i) => (
                      <span key={i} style={{ background: 'var(--primary)', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                        {e.emotion}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {isProcessing && (
        <div style={{ position: 'fixed', bottom: '30px', right: '30px', background: 'var(--primary)', color: 'white', padding: '12px 24px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 10px 20px var(--primary-glow)', zIndex: 2000 }}>
          <RefreshCw size={20} className="spin" />
          <span style={{ fontWeight: 'bold' }}>AI ENGINE PROCESSING...</span>
        </div>
      )}

      {/* Lightbox for full view */}
      {selectedItem && (
        <div className="modal-overlay" onClick={() => setSelectedItem(null)} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.9)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
          <div className="glass-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '90%', maxHeight: '90%', padding: '10px' }}>
            <img src={selectedItem.image} style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '16px' }} alt="Full View" />
            <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>{selectedItem.filename}</h3>
              <button className="modern-btn" onClick={() => setSelectedItem(null)}><X size={20} /></button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .scroll-gallery::-webkit-scrollbar { height: 6px; }
        .scroll-gallery::-webkit-scrollbar-thumb { background: var(--primary); border-radius: 10px; }
        .scroll-gallery::-webkit-scrollbar-track { background: transparent; }
      `}</style>
    </div>
  );
}

export default App;
