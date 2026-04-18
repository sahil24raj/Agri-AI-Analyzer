import { useState, useRef, useCallback } from 'react';
import './index.css';
import { analyzeImage, generateFullReport, analyzeFieldImage } from './geminiService';
import type { AppStep, CropAnalysis, FullReport, AppTab, FieldReport } from './types';
import { languages, getTranslation } from './translations';

// ─── Score Ring Component ──────────────────

function ScoreRing({ value, label, name, color, inverted = false }: {
  value: number; label?: string; name: string; color: string; inverted?: boolean;
}) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const raw = inverted ? 100 - value : value;
  const offset = circ - (raw / 100) * circ;
  const textColor = inverted
    ? value > 60 ? '#ef4444' : value > 30 ? '#f59e0b' : '#22c55e'
    : value > 60 ? '#22c55e' : value > 30 ? '#f59e0b' : '#ef4444';

  return (
    <div className="score-card">
      <div className="score-ring-wrap">
        <svg className="score-ring-svg" viewBox="0 0 80 80" width="80" height="80">
          <circle className="score-ring-bg" cx="40" cy="40" r={r} />
          <circle
            className="score-ring-fg"
            cx="40" cy="40" r={r}
            stroke={color}
            strokeDasharray={circ}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="score-ring-text" style={{ color: textColor }}>
          {value}
        </div>
      </div>
      <div className="score-name">{name}</div>
      {label && <div className="score-label">{label}</div>}
    </div>
  );
}

// ─── Main App ────────────────────────────

export default function App() {
  const [language, setLanguage] = useState<string>('en');
  const [activeTab, setActiveTab] = useState<AppTab>('crop');
  const [step, setStep] = useState<AppStep>('upload');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageBase64, setImageBase64] = useState('');
  const [imageMime, setImageMime] = useState('image/jpeg');
  const [imagePreview, setImagePreview] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [fieldImageFile, setFieldImageFile] = useState<File | null>(null);
  const [fieldImageBase64, setFieldImageBase64] = useState('');
  const [fieldImageMime, setFieldImageMime] = useState('image/jpeg');
  const [fieldImagePreview, setFieldImagePreview] = useState('');
  const [isFieldDragging, setIsFieldDragging] = useState(false);
  const fieldFileRef = useRef<HTMLInputElement>(null);
  const [fieldReport, setFieldReport] = useState<FieldReport | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);
  const [cropData, setCropData] = useState<CropAnalysis | null>(null);
  const [editedCrop, setEditedCrop] = useState<CropAnalysis | null>(null);
  const [report, setReport] = useState<FullReport | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [locationName, setLocationName] = useState<string>('');
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [weatherData, setWeatherData] = useState<{temp: number, humidity: number, rainfall: number} | null>(null);

  const t = (key: string) => getTranslation(language, key);

  function showToast(msg: string, error = false) {
    setToast({ msg, error });
    setTimeout(() => setToast(null), 4000);
  }



  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_DIM = 1280;
          if (width > height) {
            if (width > MAX_DIM) {
              height *= MAX_DIM / width;
              width = MAX_DIM;
            }
          } else {
            if (height > MAX_DIM) {
              width *= MAX_DIM / height;
              height = MAX_DIM;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataUrl.split(',')[1]);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file.', true);
      return;
    }
    setImageFile(file);
    setImageMime(file.type);
    setImagePreview(URL.createObjectURL(file));
    const b64 = await compressImage(file);
    setImageBase64(b64);
    setImageMime('image/jpeg'); // Always JPEG after compression

    if (navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
            const data = await res.json();
            if (data && data.address) {
               const addr = data.address;
               const shortLoc = [addr.village || addr.town || addr.city, addr.state, addr.country].filter(Boolean).join(', ');
               setLocationName(shortLoc || data.display_name);
            }

            // Fetch Weather
            try {
               const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,precipitation`);
               const weatherJson = await weatherRes.json();
               if (weatherJson && weatherJson.current) {
                 setWeatherData({
                   temp: weatherJson.current.temperature_2m,
                   humidity: weatherJson.current.relative_humidity_2m,
                   rainfall: weatherJson.current.precipitation
                 });
               }
            } catch (we) {
               console.error("Weather fetch failed", we);
            }

          } catch (e) {
            console.error("Geocoding failed", e);
          } finally {
             setIsLocating(false);
          }
        },
        (error) => {
          console.error("Geolocation error", error);
          setIsLocating(false);
        }
      );
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFieldFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file.', true);
      return;
    }
    setFieldImageFile(file);
    setFieldImageMime(file.type);
    setFieldImagePreview(URL.createObjectURL(file));
    const b64 = await compressImage(file);
    setFieldImageBase64(b64);
    setFieldImageMime('image/jpeg'); // Always JPEG after compression
  }, []);

  const onFieldDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsFieldDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFieldFile(file);
  }, [handleFieldFile]);

  async function doStep1Analyze() {
    if (!imageBase64) { showToast('Please upload a crop image first.', true); return; }
    setLoading(true);
    setLoadingMsg('🔍 Analyzing crop image with AI...');
    try {
      let locationContext = locationName;
      if (weatherData) {
        locationContext += ` | Current Weather: Temp ${weatherData.temp}°C, Humidity ${weatherData.humidity}%, Rainfall ${weatherData.rainfall}mm`;
      }
      const result = await analyzeImage(imageBase64, imageMime, locationContext, language);
      setCropData(result);
      setEditedCrop({ ...result });
      setStep('verifying');
    } catch (e: unknown) {
      showToast(`AI Error: ${(e as Error).message}`, true);
    } finally {
      setLoading(false);
    }
  }

  async function doStep3Report() {
    const confirmed = editMode ? editedCrop! : cropData!;
    setLoading(true);
    setLoadingMsg('🌱 Generating full crop health report...');
    try {
      let locationContext = locationName;
      if (weatherData) {
        locationContext += ` | Current Weather: Temp ${weatherData.temp}°C, Humidity ${weatherData.humidity}%, Rainfall ${weatherData.rainfall}mm`;
      }
      const full = await generateFullReport(imageBase64, imageMime, confirmed, locationContext, weatherData, language);
      setReport(full);
      setStep('results');
    } catch (e: unknown) {
      showToast(`Report Error: ${(e as Error).message}`, true);
    } finally {
      setLoading(false);
    }
  }

  async function doFieldAnalyze() {
    if (!fieldImageBase64) { showToast('Please upload a field image first.', true); return; }
    setLoading(true);
    setLoadingMsg('🗺️ Analyzing field with Precision AI...');
    try {
      const result = await analyzeFieldImage(fieldImageBase64, fieldImageMime, language);
      setFieldReport(result);
      setStep('results');
    } catch (e: unknown) {
      showToast(`Field Analysis Error: ${(e as Error).message}`, true);
    } finally {
      setLoading(false);
    }
  }

  function resetApp() {
    setStep('upload');
    setImageFile(null);
    setImageBase64('');
    setImagePreview('');
    setFieldImageFile(null);
    setFieldImageBase64('');
    setFieldImagePreview('');
    setCropData(null);
    setEditedCrop(null);
    setReport(null);
    setFieldReport(null);
    setEditMode(false);
    setLocationName('');
    setWeatherData(null);
    setIsLocating(false);
  }

  function getStepIndex() {
    return ['upload', 'verifying', 'confirmed', 'analyzing', 'results'].indexOf(step);
  }

  return (
    <>
      {/* HEADER */}
      <header className="header">
        <div className="header-logo"><img src="/logo.png" alt="Agri AI Analyzer" /></div>
        <div style={{ flex: 1 }}>
          <div className="header-title-wrap">
            <div className="header-title">{t('app_title')}</div>
            <div className="header-sub" style={{ color: '#fff', opacity: 0.8 }}>{t('app_subtitle')}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <select 
            value={language} 
            onChange={(e) => setLanguage(e.target.value)}
            className="language-selector"
            style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', background: 'var(--bg-card)', color: '#fff', border: '1px solid var(--border)', outline: 'none', cursor: 'pointer', fontWeight: 500 }}
          >
            {languages.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
        </div>
      </header>

      <main className="app-container">

        {/* TABS */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
          <button 
            className={`btn ${activeTab === 'crop' ? 'btn-primary' : 'btn-outline'}`} 
            onClick={() => { setActiveTab('crop'); resetApp(); }}
            style={{ flex: 1 }}
          >
            🌾 {t('crop_analyzer_tab') || 'Crop Analyzer'}
          </button>
          <button 
            className={`btn ${activeTab === 'field' ? 'btn-primary' : 'btn-outline'}`} 
            onClick={() => { setActiveTab('field'); resetApp(); }}
            style={{ flex: 1 }}
          >
            🚜 {t('field_analyzer_tab') || 'Field Analyzer'}
          </button>
        </div>

        {/* CROP ANALYZER TAB */}
        {activeTab === 'crop' && (
          <>
            {/* STEP INDICATOR */}
            <div className="step-bar">
              {['Upload', 'Verify', 'Analysis', 'Results'].map((_, i) => (
                <div key={i} className={`step-dot ${getStepIndex() === i ? 'active' : getStepIndex() > i ? 'done' : ''}`} title={_} />
              ))}
            </div>

            {/* ── STEP 1: UPLOAD ── */}
            {step === 'upload' && (
              <div className="card">
                <div className="card-title">🌿 Upload Crop Image</div>
                <div className="card-desc">Upload a clear photo of your crop for AI analysis — leaves, soil, or full plant view work best.</div>

                <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text-bright)' }}>Close-up Leaf Image <span style={{color: '#f87171'}}>*</span></div>
                    {!imagePreview ? (
                      <div
                        className={`dropzone ${isDragging ? 'active' : ''}`}
                        onClick={() => !loading && fileRef.current?.click()}
                        onDragOver={e => { e.preventDefault(); if(!loading) setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={onDrop}
                        id="dropzone"
                        style={{ pointerEvents: loading ? 'none' : 'auto', opacity: loading ? 0.6 : 1 }}
                      >
                        <div className="dropzone-icon">📸</div>
                        <div className="dropzone-text">{t('dropzone_title')}</div>
                        <div className="dropzone-sub">{t('dropzone_sub')}</div>
                        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if(e.target.files?.[0]) handleFile(e.target.files[0]); }} />
                      </div>
                    ) : (
                      <div>
                        <div className="img-preview-wrap">
                          <img className="img-preview" src={imagePreview} alt="Crop preview" />
                          <div className="img-overlay">
                            <span className="img-badge">✅ {t('image_ready')}</span>
                            <button className="btn btn-danger" style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', borderRadius: '8px' }} onClick={() => { setImagePreview(''); setImageFile(null); setImageBase64(''); }} disabled={loading}>✕ {t('remove')}</button>
                          </div>
                        </div>
                        <div style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                          {imageFile?.name} · {(imageFile!.size / 1024).toFixed(0)} KB
                        </div>
                      </div>
                    )}
                </div>

                {/* ENVIRONMENTAL STATS */}
                {(locationName || weatherData || isLocating) && (
                  <div className="env-dashboard">
                    {isLocating && <div className="env-detecting"><span className="loader-spinner-small"></span> Detecting environmental data...</div>}
                    
                    {locationName && !isLocating && (
                      <div className="env-location">
                        <div className="env-icon">📍</div>
                        <div className="env-info">
                          <div className="env-label">Detected Location</div>
                          <div className="env-value">{locationName}</div>
                        </div>
                      </div>
                    )}
                    
                    {weatherData && !isLocating && (
                      <div className="env-weather-grid">
                        <div className="env-stat">
                            <div className="env-stat-icon">🌡️</div>
                            <div className="env-stat-details">
                              <div className="env-stat-label">Temperature</div>
                              <div className="env-stat-val">{weatherData.temp}°C</div>
                            </div>
                        </div>
                        <div className="env-stat">
                            <div className="env-stat-icon">💧</div>
                            <div className="env-stat-details">
                              <div className="env-stat-label">Humidity</div>
                              <div className="env-stat-val">{weatherData.humidity}%</div>
                            </div>
                        </div>
                        <div className="env-stat">
                            <div className="env-stat-icon">🌧️</div>
                            <div className="env-stat-details">
                              <div className="env-stat-label">Rainfall</div>
                              <div className="env-stat-val">{weatherData.rainfall}mm</div>
                            </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ACTION BUTTON */}
                {loading ? (
                  <div className="loader-wrap" style={{ padding: '2rem' }}>
                    <div className="loader-spinner" />
                    <div className="loader-text">{loadingMsg}</div>
                    <div className="loader-sub">Please wait, this may take a few seconds <span className="pulse-dots"><span /><span /><span /></span></div>
                  </div>
                ) : (
                  <div className="btn-group">
                    <button className="btn btn-primary" onClick={doStep1Analyze} disabled={!imageBase64} id="analyze-btn">
                      🔍 Analyze Crop
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 2: VERIFY ── */}
            {step === 'verifying' && cropData && (
              <div>
                <div className="card" style={{ marginBottom: '1rem' }}>
                  <div className="card-title">{t('step1_title')}</div>
                  <div className="card-desc">{t('step1_desc')}</div>
                  <div className="result-grid">
                    {[
                      { icon: '🌾', label: 'Crop Type', value: cropData.crop_type },
                      { icon: '🪸', label: 'Soil Type', value: cropData.soil_type },
                      { icon: '🌡️', label: 'Temperature', value: cropData.temperature },
                      { icon: '🦠', label: 'Disease/Pest', value: cropData.disease || 'None' },
                      { icon: '📉', label: 'Affected Area', value: cropData.affected_area || '0%' },
                    ].map(({ icon, label, value }) => (
                      <div className="result-chip" key={label}>
                        <div className="result-chip-icon">{icon}</div>
                        <div className="result-chip-label">{label}</div>
                        <div className="result-chip-value">{value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="confidence-badge">⚡ {t('confidence')}: {cropData.confidence}</span>
                  </div>
                </div>

                <div className="card" style={{ marginBottom: '1rem' }}>
                  <img src={imagePreview} alt="Uploaded crop" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '12px' }} />
                </div>

                <div className="card">
                  <div className="card-title">{t('details_correct')}</div>
                  <div className="card-desc">{t('edit_desc')}</div>

                  {editMode && editedCrop ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div className="form-group">
                        <label className="form-label">🌾 Crop Type</label>
                        <input className="form-input" value={editedCrop.crop_type} onChange={e => setEditedCrop(p => ({ ...p!, crop_type: e.target.value }))} placeholder="e.g., Wheat, Rice, Tomato" id="edit-crop_type" disabled={loading} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">🪸 Soil Type</label>
                        <input className="form-input" value={editedCrop.soil_type} onChange={e => setEditedCrop(p => ({ ...p!, soil_type: e.target.value }))} placeholder="e.g., Loamy, Sandy, Clay" id="edit-soil_type" disabled={loading} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">🌡️ Temperature Range</label>
                        <input className="form-input" value={editedCrop.temperature} onChange={e => setEditedCrop(p => ({ ...p!, temperature: e.target.value }))} placeholder="e.g., 25–30°C" id="edit-temperature" disabled={loading} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">🦠 Disease or Pest</label>
                        <input className="form-input" value={editedCrop.disease || ''} onChange={e => setEditedCrop(p => ({ ...p!, disease: e.target.value }))} placeholder="e.g., None, Leaf Miner" disabled={loading} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">📉 Affected Area</label>
                        <input className="form-input" value={editedCrop.affected_area || ''} onChange={e => setEditedCrop(p => ({ ...p!, affected_area: e.target.value }))} placeholder="e.g., 30%" disabled={loading} />
                      </div>
                    </div>
                  ) : null}

                  {loading ? (
                    <div className="loader-wrap" style={{ padding: '2rem' }}>
                      <div className="loader-spinner" />
                      <div className="loader-text">{loadingMsg}</div>
                      <div className="loader-sub">Generating detailed health analysis <span className="pulse-dots"><span /><span /><span /></span></div>
                    </div>
                  ) : (
                    <div className="btn-group">
                      <button className="btn btn-primary" onClick={doStep3Report} id="confirm-btn">
                        ✅ {t('confirm_btn')}
                      </button>
                      <button className="btn btn-outline" onClick={() => setEditMode(p => !p)} id="edit-toggle-btn">
                        {editMode ? `❌ ${t('cancel_edit')}` : `✏️ ${t('edit_details')}`}
                      </button>
                      <button className="btn btn-danger" onClick={resetApp}>↩ {t('start_over')}</button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── STEP 4-6: CROP RESULTS ── */}
            {step === 'results' && report && (
              <div>
                <div className="card" style={{ marginBottom: '1rem' }}>
                  <div className="card-title">📊 Crop Health Dashboard</div>
                  <div className="card-desc">AI-generated health scores based on your crop image and the 14-step analysis.</div>
                  
                  <div style={{ margin: '1rem 0', padding: '1rem', background: '#1e293b', borderRadius: '12px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-bright)' }}>{report.crop}</div>
                      <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginTop: '0.25rem' }}>🌱 Stage: {report.stage}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: report.health_score > 79 ? '#22c55e' : report.health_score > 49 ? '#f59e0b' : '#ef4444' }}>{report.health_score}/100</div>
                      <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Overall Health</div>
                    </div>
                  </div>

                  <div className="scores-grid">
                    <ScoreRing value={report.health_score} name="Overall Health" color="#22c55e" />
                    <ScoreRing value={report.farm_score} name="Farm Score" color="#0ea5e9" />
                    <ScoreRing value={report.metrics.leaf_health} name="Leaf Health" color="#10b981" />
                    <ScoreRing value={report.metrics.soil_health} name="Soil Health" color="#8b5cf6" />
                    <ScoreRing value={report.metrics.water_score} name="Water Score" color="#3b82f6" />
                    <ScoreRing value={report.metrics.environment_score} name="Environment" color="#f59e0b" />
                    <ScoreRing value={report.metrics.disease_impact} name="Disease Impact" color="#ef4444" inverted={true} />
                  </div>
                </div>

                <div className="card" style={{ marginBottom: '1rem' }}>
                  <div className="card-title">⚠️ Detected Issues & Disease Analysis</div>
                  <div className="card-desc">Based on visual symptoms, location, and weather conditions.</div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                    <div className="insight-box bad">
                      <div className="insight-box-label">🚨 Issues Detected</div>
                      <ul style={{ margin: '0.5rem 0 0 1.25rem', color: '#fca5a5' }}>
                        {report.issues_detected.map((issue, i) => <li key={i}>{issue}</li>)}
                      </ul>
                    </div>

                    <div className="insight-box info" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)' }}>
                      <div className="insight-box-label" style={{ color: '#fcd34d' }}>🦠 Disease & Pest Status</div>
                      <div style={{ marginTop: '0.5rem', color: '#fcd34d', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div><strong>Name:</strong> {report.disease_pest.name}</div>
                        <div><strong>Severity:</strong> {report.disease_pest.severity}</div>
                        <div><strong>Spread Risk:</strong> {report.disease_pest.spread_risk}</div>
                        <div style={{ marginTop: '0.5rem', borderTop: '1px solid rgba(252, 211, 77, 0.2)', paddingTop: '0.5rem' }}>
                          <strong>📈 Progress:</strong> {report.progress}
                        </div>
                      </div>
                    </div>

                    <div className="insight-box info" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                      <div className="insight-box-label" style={{ color: '#f87171' }}>⚠️ Early Warning & Risk</div>
                      <div className="insight-box-text" style={{ color: '#fca5a5', marginTop: '0.5rem' }}>
                        <strong>Risk Level:</strong> {report.risk_meter.level} ({report.risk_meter.probability})<br/>
                        <span style={{ display: 'block', marginTop: '0.5rem' }}>{report.early_warning}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card" style={{ marginBottom: '1rem' }}>
                  <div className="card-title">🧠 Root Cause Analysis</div>
                  <div className="card-desc" style={{ color: '#fbbf24', marginTop: '0.5rem', fontWeight: 500 }}>
                    {report.root_cause}
                  </div>
                </div>

                <div className="card" style={{ marginBottom: '1rem' }}>
                  <div className="card-title">🔬 Detailed Environment Analysis</div>
                  <div className="card-desc">In-depth reasoning behind the scores and recommendations.</div>
                  <div className="insights-grid">
                    <div className="insight-box info">
                      <div className="insight-box-label">🌍 Environment</div>
                      <div className="insight-box-text">{report.analysis.environment}</div>
                    </div>
                    <div className="insight-box info" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
                      <div className="insight-box-label">💧 Water</div>
                      <div className="insight-box-text">{report.analysis.water}</div>
                    </div>
                    <div className="insight-box info" style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)' }}>
                      <div className="insight-box-label">🌱 Soil</div>
                      <div className="insight-box-text">{report.analysis.soil}</div>
                    </div>
                  </div>
                </div>

                <div className="card" style={{ marginBottom: '1rem' }}>
                  <div className="card-title">💡 Smart Recommendations</div>
                  <div className="card-desc">Practical, localized, and actionable advice to improve crop health.</div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                     <div className="action-plan" style={{ background: 'rgba(34, 197, 94, 0.05)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                       <div className="action-plan-header" style={{ color: '#4ade80' }}>🌿 Organic Solutions</div>
                       {report.smart_solutions?.organic?.map((rec, i) => (
                         <div className="action-step" key={i}>
                            <div className="action-step-num" style={{ background: '#4ade80', color: '#000' }}>✓</div>
                            <div className="action-step-text" style={{ padding: '0.5rem 0' }}>{rec}</div>
                         </div>
                       ))}
                     </div>
                     
                     <div className="action-plan" style={{ background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                       <div className="action-plan-header" style={{ color: '#38bdf8' }}>🧪 Chemical Solutions</div>
                       {report.smart_solutions?.chemical?.map((rec, i) => (
                         <div className="action-step" key={i}>
                            <div className="action-step-num" style={{ background: '#38bdf8', color: '#000' }}>⚠</div>
                            <div className="action-step-text" style={{ padding: '0.5rem 0' }}>{rec}</div>
                         </div>
                       ))}
                     </div>
                  </div>

                  {report.recommendations && report.recommendations.length > 0 && (
                     <div className="action-plan" style={{ marginTop: '1rem' }}>
                       <div className="action-plan-header">📝 General Advice</div>
                       {report.recommendations.map((rec, i) => (
                         <div className="action-step" key={i}>
                            <div className="action-step-num">👉</div>
                            <div className="action-step-text" style={{ padding: '0.5rem 0' }}>{rec}</div>
                         </div>
                       ))}
                     </div>
                  )}
                </div>

                <div className="card" style={{ marginBottom: '1rem' }}>
                  <div className="card-title">💰 Farm Operations & Cost Analysis</div>
                  <div className="card-desc">Estimated financial impacts and action requirements per acre.</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                    <div className="insight-box info" style={{ backgroundColor: 'rgba(251, 191, 36, 0.1)' }}>
                      <div className="insight-box-label" style={{ color: '#fbbf24' }}>⏳ Recovery Time Prediction</div>
                      <div className="insight-box-text" style={{ color: '#fde68a', marginTop: '0.5rem' }}>{report.recovery_time}</div>
                    </div>
                    <div className="insight-box info" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                      <div className="insight-box-label" style={{ color: '#34d399' }}>💵 Cost vs Benefit</div>
                      <div className="insight-box-text" style={{ color: '#6ee7b7', marginTop: '0.5rem' }}>{report.cost_benefit}</div>
                    </div>
                    <div className="insight-box info" style={{ backgroundColor: 'rgba(56, 189, 248, 0.1)' }}>
                      <div className="insight-box-label" style={{ color: '#38bdf8' }}>🚜 Spray & Fertilizer Calculator</div>
                      <div className="insight-box-text" style={{ color: '#bae6fd', marginTop: '0.5rem' }}>{report.spray_plan}</div>
                    </div>
                  </div>
                </div>

                <div className="card" style={{ marginBottom: '1rem' }}>
                  <div className="card-title">🌐 External Insights</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                    <div className="insight-box info" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
                      <div className="insight-box-label" style={{ color: '#60a5fa' }}>⏰ Irrigation Timing</div>
                      <div className="insight-box-text" style={{ color: '#93c5fd', marginTop: '0.5rem' }}>
                        {typeof report.irrigation_advice === 'string'
                          ? report.irrigation_advice
                          : `${report.irrigation_advice?.method || ''} | ${report.irrigation_advice?.quantity_liters_per_acre_per_day || ''} | ${report.irrigation_advice?.frequency || ''}`
                        }
                      </div>
                    </div>
                    <div className="insight-box info" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                      <div className="insight-box-label" style={{ color: '#34d399' }}>📊 Similar Case Insight</div>
                      <div className="insight-box-text" style={{ color: '#6ee7b7', marginTop: '0.5rem' }}>{report.similar_case}</div>
                    </div>
                  </div>
                </div>

                <div className="card" style={{ marginBottom: '1rem' }}>
                  <div className="card-title">🗓️ Severity Action Plan</div>
                  <div className="card-desc">Step-by-step treatment schedule.</div>
                  
                  <div className="timeline-container" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                     {report.action_plan.today && (
                       <div className="timeline-item" style={{ borderLeft: '4px solid #a855f7', paddingLeft: '1rem' }}>
                          <h4 style={{ color: '#a855f7', margin: '0 0 0.5rem 0' }}>🚨 Today: Immediate</h4>
                          <p style={{ margin: 0, color: 'var(--text-dim)' }}>{report.action_plan.today}</p>
                       </div>
                     )}
                     <div className="timeline-item" style={{ borderLeft: '4px solid #ef4444', paddingLeft: '1rem' }}>
                        <h4 style={{ color: '#ef4444', margin: '0 0 0.5rem 0' }}>Day 1-2: Immediate Action</h4>
                        <p style={{ margin: 0, color: 'var(--text-dim)' }}>{report.action_plan.day_1_2}</p>
                     </div>
                     <div className="timeline-item" style={{ borderLeft: '4px solid #f59e0b', paddingLeft: '1rem' }}>
                        <h4 style={{ color: '#f59e0b', margin: '0 0 0.5rem 0' }}>Day 3-5: Treatment</h4>
                        <p style={{ margin: 0, color: 'var(--text-dim)' }}>{report.action_plan.day_3_5}</p>
                     </div>
                     <div className="timeline-item" style={{ borderLeft: '4px solid #22c55e', paddingLeft: '1rem' }}>
                        <h4 style={{ color: '#22c55e', margin: '0 0 0.5rem 0' }}>Day 7+: Monitoring</h4>
                        <p style={{ margin: 0, color: 'var(--text-dim)' }}>{report.action_plan.day_7_plus}</p>
                     </div>
                  </div>
                </div>

                {/* ── NEW: Farmer Checklist ── */}
                {report.farmer_checklist && report.farmer_checklist.length > 0 && (
                  <div className="card" style={{ marginBottom: '1rem', border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.05)' }}>
                    <div className="card-title">✅ Farmer's Priority Checklist</div>
                    <div className="card-desc">Do these tasks in order — today.</div>
                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {report.farmer_checklist.map((item, i) => (
                        <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.6rem 0.75rem', background: 'rgba(168,85,247,0.08)', borderRadius: '10px', border: '1px solid rgba(168,85,247,0.2)' }}>
                          <div style={{ background: '#a855f7', color: '#fff', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold', flexShrink: 0 }}>{i + 1}</div>
                          <div style={{ color: '#e9d5ff', fontSize: '0.9rem' }}>{item}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── NEW: Nutrient Panel ── */}
                {report.nutrient_panel && (
                  <div className="card" style={{ marginBottom: '1rem' }}>
                    <div className="card-title">🧪 Nutrient Status Panel</div>
                    <div className="card-desc">Soil nutrient levels and correction recommendations.</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
                      {Object.entries(report.nutrient_panel).map(([key, val]) => val && (
                        <div key={key} style={{ background: '#0f172a', padding: '0.75rem', borderRadius: '10px', border: '1px solid #334155' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{key}</div>
                          <div style={{ fontSize: '0.85rem', color: '#e2e8f0', marginTop: '0.3rem' }}>{val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── NEW: Yield Loss Forecast ── */}
                {report.yield_loss_forecast && (
                  <div className="card" style={{ marginBottom: '1rem' }}>
                    <div className="card-title">📉 Yield Loss Forecast (If Untreated)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
                      {[['7 Days', report.yield_loss_forecast.if_untreated_7days, '#f87171'], ['14 Days', report.yield_loss_forecast.if_untreated_14days, '#ef4444'], ['30 Days', report.yield_loss_forecast.if_untreated_30days, '#b91c1c'], ['With Treatment', report.yield_loss_forecast.with_treatment, '#22c55e']].map(([label, val, color]) => val && (
                        <div key={String(label)} style={{ background: '#0f172a', padding: '0.75rem', borderRadius: '10px', border: '1px solid #334155', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>{label}</div>
                          <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: String(color), marginTop: '0.25rem' }}>{val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── NEW: Spray Schedule ── */}
                {report.spray_schedule && report.spray_schedule.length > 0 && (
                  <div className="card" style={{ marginBottom: '1rem' }}>
                    <div className="card-title">🗓️ Spray Schedule</div>
                    <div className="card-desc">Precision spray calendar with products, doses, and timing.</div>
                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {report.spray_schedule.map((s, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr', gap: '0.5rem', padding: '0.6rem 0.75rem', background: '#0f172a', borderRadius: '10px', border: '1px solid #334155', fontSize: '0.82rem' }}>
                          <div style={{ color: '#60a5fa', fontWeight: 'bold' }}>{s.day}</div>
                          <div style={{ color: '#e2e8f0' }}>{s.product}</div>
                          <div style={{ color: '#94a3b8' }}>{s.dose || s.dose_per_acre}</div>
                          <div style={{ color: '#fbbf24' }}>{s.timing}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── NEW: Financial Impact ── */}
                {report.financial_impact && (
                  <div className="card" style={{ marginBottom: '1rem', border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.04)' }}>
                    <div className="card-title">💰 Financial Impact (per Acre)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
                      {[['Loss Without Treatment', report.financial_impact.estimated_loss_per_acre_inr, '#f87171'], ['Recovery After Treatment', report.financial_impact.potential_recovery_after_treatment_inr, '#4ade80'], ['Treatment Cost', report.financial_impact.treatment_cost_estimate_inr, '#fbbf24'], ['Net Benefit', report.financial_impact.net_benefit_of_treatment_inr, '#22c55e']].map(([label, val, color]) => val && (
                        <div key={String(label)} style={{ background: '#0f172a', padding: '0.75rem', borderRadius: '10px', border: '1px solid #334155', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{label}</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: String(color), marginTop: '0.25rem' }}>{val}</div>
                        </div>
                      ))}
                    </div>
                    {report.market_price_outlook && (
                      <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#0f172a', borderRadius: '10px', border: '1px solid #334155', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                        <div><span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Mandi Price: </span><span style={{ color: '#4ade80', fontWeight: 'bold' }}>{report.market_price_outlook.expected_price_per_quintal_inr}/quintal</span></div>
                        <div><span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Trend: </span><span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{report.market_price_outlook.market_trend}</span></div>
                        <div><span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Best Time to Sell: </span><span style={{ color: '#93c5fd' }}>{report.market_price_outlook.best_time_to_sell}</span></div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── NEW: Long-Term Prevention ── */}
                {report.long_term_prevention && report.long_term_prevention.length > 0 && (
                  <div className="card" style={{ marginBottom: '1rem' }}>
                    <div className="card-title">🛡️ Long-Term Prevention Strategy</div>
                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {report.long_term_prevention.map((item, i) => (
                        <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.5rem 0.75rem', background: '#0f172a', borderRadius: '10px', border: '1px solid #334155' }}>
                          <div style={{ color: '#22c55e', fontWeight: 'bold', flexShrink: 0 }}>→</div>
                          <div style={{ color: '#a7f3d0', fontSize: '0.88rem' }}>{item}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="btn-group" style={{ justifyContent: 'center' }}>
                  <button className="btn btn-primary" onClick={resetApp} id="new-analysis-btn">
                    🌱 {t('analyze_another')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* FIELD ANALYZER TAB */}
        {activeTab === 'field' && (
          <>
            {/* ── FIELD UPLOAD ── */}
            {step === 'upload' && (
              <div className="card">
                <div className="card-title">🗺️ Upload Field Area</div>
                <div className="card-desc">Upload a wide shot of your farm layout for Spot Treatment insights.</div>

                <div style={{ marginBottom: '1rem' }}>
                  {!fieldImagePreview ? (
                    <div
                      className={`dropzone ${isFieldDragging ? 'active' : ''}`}
                      onClick={() => !loading && fieldFileRef.current?.click()}
                      onDragOver={e => { e.preventDefault(); if(!loading) setIsFieldDragging(true); }}
                      onDragLeave={() => setIsFieldDragging(false)}
                      onDrop={onFieldDrop}
                      style={{ pointerEvents: loading ? 'none' : 'auto', opacity: loading ? 0.6 : 1 }}
                    >
                      <div className="dropzone-icon">🗺️</div>
                      <div className="dropzone-text">Click or Drag to Upload Field Photo</div>
                      <div className="dropzone-sub">High-angle field view works best.</div>
                      <input ref={fieldFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if(e.target.files?.[0]) handleFieldFile(e.target.files[0]); }} />
                    </div>
                  ) : (
                    <div>
                      <div className="img-preview-wrap">
                        <img className="img-preview" src={fieldImagePreview} alt="Field preview" />
                        <div className="img-overlay">
                          <span className="img-badge">✅ Field Ready</span>
                          <button className="btn btn-danger" style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', borderRadius: '8px' }} onClick={() => { setFieldImagePreview(''); setFieldImageFile(null); setFieldImageBase64(''); }} disabled={loading}>✕ Remove</button>
                        </div>
                      </div>
                      <div style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                        {fieldImageFile?.name} · {(fieldImageFile!.size / 1024).toFixed(0)} KB
                      </div>
                    </div>
                  )}
                </div>

                {loading ? (
                  <div className="loader-wrap" style={{ padding: '2rem' }}>
                    <div className="loader-spinner" />
                    <div className="loader-text">{loadingMsg}</div>
                    <div className="loader-sub">Please wait, this may take a few seconds <span className="pulse-dots"><span /><span /><span /></span></div>
                  </div>
                ) : (
                  <div className="btn-group">
                    <button className="btn btn-primary" onClick={doFieldAnalyze} disabled={!fieldImageBase64 || loading} id="analyze-field-btn">
                      🗺️ Analyze Field Area
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* FIELD ANALYSIS RESULTS */}
            {step === 'results' && fieldReport && (
              <div className="results-wrapper">
                <div className="card" style={{ marginBottom: '1rem', border: '2px solid #3b82f6', background: 'linear-gradient(to bottom, #1e293b, rgba(15, 23, 42, 0.95))' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                      <div style={{ background: '#3b82f6', color: '#fff', padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '900' }}>ADVANCED AI</div>
                      <div className="card-title" style={{ margin: 0 }}>🗺️ Field Health Dashboard</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>Crop Analyzed</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#3b82f6' }}>{fieldReport.crop}</div>
                    </div>
                  </div>

                  <div className="insight-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                    <div className="insight-box info" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', textAlign: 'center' }}>
                      <div className="insight-box-label" style={{ color: '#60a5fa' }}>Overall Condition</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: fieldReport.field_health.overall_condition.toLowerCase().includes('good') ? '#22c55e' : fieldReport.field_health.overall_condition.toLowerCase().includes('poor') ? '#ef4444' : '#f59e0b', marginTop: '0.5rem' }}>
                        {fieldReport.field_health.overall_condition}
                      </div>
                    </div>
                    <div className="insight-box info" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', textAlign: 'center' }}>
                      <div className="insight-box-label" style={{ color: '#f87171' }}>Total Affected</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#f87171', marginTop: '0.5rem' }}>
                        {fieldReport.field_health.total_affected_percent}
                      </div>
                    </div>
                    <div className="insight-box info" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', textAlign: 'center' }}>
                      <div className="insight-box-label" style={{ color: '#4ade80' }}>Expected Profit / SqFt</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#4ade80', marginTop: '0.5rem' }}>
                        {fieldReport.financial_projections?.expected_profit_per_sqft || fieldReport.savings_insight.expected_profit_per_sqft}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
                    {/* Minimap Section */}
                    <div style={{ flex: '1 1 250px' }}>
                      <div className="card-subtitle" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>📍 Field Zoning Map</div>
                      <div style={{ background: '#0f172a', padding: '1.5rem', borderRadius: '16px', border: '1px solid #334155', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                          {fieldReport.minimap.grid.map((row, r) => (
                            <div key={r} style={{ display: 'flex', gap: '8px' }}>
                              {row.map((cell, c) => {
                                const isDanger = cell.includes('🟥');
                                const isWarning = cell.includes('🟨');
                                return (
                                  <div key={c} style={{ 
                                    width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                    fontSize: '1.5rem', 
                                    background: isDanger ? 'rgba(239, 68, 68, 0.15)' : isWarning ? 'rgba(245, 158, 11, 0.15)' : 'rgba(34, 197, 94, 0.15)', 
                                    borderRadius: '8px', 
                                    border: `2px solid ${isDanger ? '#ef4444' : isWarning ? '#f59e0b' : '#22c55e'}`,
                                    transition: 'all 0.2s ease'
                                  }}>
                                    {cell}
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                        <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-dim)', textAlign: 'center', lineHeight: '1.4' }}>
                           {fieldReport.minimap.location_desc}
                        </div>
                      </div>
                    </div>

                    {/* Action Strategy Section */}
                    <div style={{ flex: '2 1 400px' }}>
                      <div className="card-subtitle" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>🎯 Treatment Strategy</div>
                      <div style={{ 
                        background: fieldReport.treatment_strategy.type.toLowerCase().includes('spot') ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)', 
                        border: `1px solid ${fieldReport.treatment_strategy.type.toLowerCase().includes('spot') ? '#22c55e' : '#ef4444'}`, 
                        borderRadius: '16px', padding: '1.25rem' 
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                          <div>
                             <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: fieldReport.treatment_strategy.type.toLowerCase().includes('spot') ? '#4ade80' : '#f87171' }}>
                               {fieldReport.treatment_strategy.type}
                             </div>
                             <div style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>Recommendation</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                             <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-bright)' }}>{fieldReport.treatment_strategy.area_to_treat_percent}</div>
                             <div style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>Area to Treat</div>
                          </div>
                        </div>
                        <div style={{ fontSize: '1rem', color: 'var(--text-bright)', background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px', borderLeft: '4px solid #3b82f6' }}>
                          <strong>Next Action:</strong> {fieldReport.treatment_strategy.short_instruction}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginTop: '1rem' }}>
                         <div style={{ background: '#1e293b', padding: '0.75rem', borderRadius: '12px', textAlign: 'center', border: '1px solid #334155' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Chem Saved</div>
                            <div style={{ color: '#4ade80', fontWeight: 'bold' }}>{fieldReport.savings_insight.chemical_saved_percent}</div>
                         </div>
                         <div style={{ background: '#1e293b', padding: '0.75rem', borderRadius: '12px', textAlign: 'center', border: '1px solid #334155' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Water Saved</div>
                            <div style={{ color: '#60a5fa', fontWeight: 'bold' }}>{fieldReport.savings_insight.water_saved_percent}</div>
                         </div>
                         <div style={{ background: '#1e293b', padding: '0.75rem', borderRadius: '12px', textAlign: 'center', border: '1px solid #334155' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Cost Saved</div>
                            <div style={{ color: '#fbbf24', fontWeight: 'bold' }}>{fieldReport.savings_insight.cost_saved_rupees}</div>
                         </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                   {/* Zone Analysis Table */}
                   <div className="card">
                     <div className="card-title" style={{ fontSize: '1.1rem' }}>📍 Zone Breakdown</div>
                     <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {fieldReport.zone_analysis.map((zone, i) => (
                          <div key={i} style={{ 
                            display: 'flex', gap: '0.75rem', padding: '0.75rem', background: '#0f172a', borderRadius: '12px', border: '1px solid #334155',
                            borderLeft: `4px solid ${zone.condition.toLowerCase().includes('healthy') ? '#22c55e' : zone.condition.toLowerCase().includes('severe') ? '#ef4444' : '#f59e0b'}`
                          }}>
                             <div style={{ fontWeight: 'bold', minWidth: '2rem' }}>{zone.id}</div>
                             <div style={{ flex: 1 }}>
                               <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-bright)' }}>{zone.condition}</div>
                               <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{zone.issue}</div>
                               <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.4rem', fontStyle: 'italic' }}>→ {zone.action}</div>
                             </div>
                          </div>
                        ))}
                     </div>
                   </div>

                   {/* Priority System */}
                   <div className="card">
                      <div className="card-title" style={{ fontSize: '1.1rem' }}>⚡ Treatment Priority Plan</div>
                      <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                         <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f87171', fontWeight: 'bold', marginBottom: '0.25rem' }}>🔴 High Priority</div>
                            <div style={{ color: '#fecaca', fontSize: '0.9rem' }}>{fieldReport.priority_plan.high}</div>
                         </div>
                         <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '0.75rem', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b', fontWeight: 'bold', marginBottom: '0.25rem' }}>🟠 Medium Priority</div>
                            <div style={{ color: '#ffedd5', fontSize: '0.9rem' }}>{fieldReport.priority_plan.medium}</div>
                         </div>
                         <div style={{ background: 'rgba(34, 197, 94, 0.1)', padding: '0.75rem', borderRadius: '12px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#4ade80', fontWeight: 'bold', marginBottom: '0.25rem' }}>🟢 Low Priority</div>
                            <div style={{ color: '#dcfce7', fontSize: '0.9rem' }}>{fieldReport.priority_plan.low}</div>
                         </div>
                      </div>
                   </div>
                </div>

                {/* ── NEW: Field Financial Projections ── */}
                {fieldReport.financial_projections && (
                  <div className="card" style={{ marginBottom: '1rem', border: '1px solid rgba(34,197,94,0.3)' }}>
                    <div className="card-title">💰 Financial Projections (per Acre)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
                      {[['Estimated Yield', fieldReport.financial_projections.estimated_yield_quintals_per_acre ? fieldReport.financial_projections.estimated_yield_quintals_per_acre + ' qtl' : null, '#60a5fa'],
                        ['Yield Loss', fieldReport.financial_projections.yield_loss_percent, '#f87171'],
                        ['Revenue w/o Treatment', fieldReport.financial_projections.revenue_without_treatment_inr, '#f87171'],
                        ['Revenue After Treatment', fieldReport.financial_projections.revenue_after_treatment_inr, '#4ade80'],
                        ['Treatment Cost', fieldReport.financial_projections.treatment_cost_inr, '#fbbf24'],
                        ['Net Gain', fieldReport.financial_projections.net_gain_from_treatment_inr, '#22c55e'],
                        ['ROI', fieldReport.financial_projections.roi_percent, '#a78bfa']
                      ].map(([label, val, color]) => val && (
                        <div key={String(label)} style={{ background: '#0f172a', padding: '0.75rem', borderRadius: '10px', border: '1px solid #334155', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{label}</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: String(color), marginTop: '0.25rem' }}>{val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── NEW: Field Farmer Checklist ── */}
                {fieldReport.farmer_checklist && fieldReport.farmer_checklist.length > 0 && (
                  <div className="card" style={{ marginBottom: '1rem', border: '1px solid rgba(168,85,247,0.3)' }}>
                    <div className="card-title">✅ Priority Action Checklist</div>
                    <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {fieldReport.farmer_checklist.map((item, i) => (
                        <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.5rem 0.75rem', background: 'rgba(168,85,247,0.08)', borderRadius: '8px' }}>
                          <div style={{ color: '#a855f7', fontWeight: 'bold', flexShrink: 0 }}>{i + 1}.</div>
                          <div style={{ color: '#e9d5ff', fontSize: '0.88rem' }}>{item}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="btn-group" style={{ justifyContent: 'center', marginTop: '1.5rem' }}>
                  <button className="btn btn-primary" onClick={resetApp} id="new-field-analysis-btn">
                    🗺️ Analyze Another Field
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* TOAST */}
      {toast && (
        <div className={`toast ${toast.error ? 'error' : ''}`}>
          {toast.error ? '❌' : '✅'} {toast.msg}
        </div>
      )}
    </>
  );
}
