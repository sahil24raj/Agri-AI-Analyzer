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
        <div className="header-logo">🌾</div>
        <div style={{ flex: 1 }}>
          <div className="header-title">{t('app_title')}</div>
          <div className="header-sub">{t('app_subtitle')}</div>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <select 
            value={language} 
            onChange={(e) => setLanguage(e.target.value)}
            style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', background: '#1e293b', color: '#fff', border: '1px solid #334155', outline: 'none', cursor: 'pointer', fontWeight: 500 }}
          >
            {languages.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
        </div>
      </header>

      <main className="app-container">

        {/* TABS */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid #334155', paddingBottom: '1rem' }}>
          <button 
            className={`btn ${activeTab === 'crop' ? 'btn-primary' : 'btn-outline'}`} 
            onClick={() => { setActiveTab('crop'); resetApp(); }}
            style={{ flex: 1 }}
          >
            🌱 Crop Analyzer
          </button>
          <button 
            className={`btn ${activeTab === 'field' ? 'btn-primary' : 'btn-outline'}`} 
            onClick={() => { setActiveTab('field'); resetApp(); }}
            style={{ flex: 1 }}
          >
            🗺️ Field Analyzer
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
                        onClick={() => fileRef.current?.click()}
                        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={onDrop}
                        id="dropzone"
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
                            <button className="btn btn-danger" style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', borderRadius: '8px' }} onClick={() => { setImagePreview(''); setImageFile(null); setImageBase64(''); }}>✕ {t('remove')}</button>
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
                        <input className="form-input" value={editedCrop.crop_type} onChange={e => setEditedCrop(p => ({ ...p!, crop_type: e.target.value }))} placeholder="e.g., Wheat, Rice, Tomato" id="edit-crop_type" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">🪸 Soil Type</label>
                        <input className="form-input" value={editedCrop.soil_type} onChange={e => setEditedCrop(p => ({ ...p!, soil_type: e.target.value }))} placeholder="e.g., Loamy, Sandy, Clay" id="edit-soil_type" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">🌡️ Temperature Range</label>
                        <input className="form-input" value={editedCrop.temperature} onChange={e => setEditedCrop(p => ({ ...p!, temperature: e.target.value }))} placeholder="e.g., 25–30°C" id="edit-temperature" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">🦠 Disease or Pest</label>
                        <input className="form-input" value={editedCrop.disease || ''} onChange={e => setEditedCrop(p => ({ ...p!, disease: e.target.value }))} placeholder="e.g., None, Leaf Miner" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">📉 Affected Area</label>
                        <input className="form-input" value={editedCrop.affected_area || ''} onChange={e => setEditedCrop(p => ({ ...p!, affected_area: e.target.value }))} placeholder="e.g., 30%" />
                      </div>
                    </div>
                  ) : null}

                  <div className="btn-group">
                    <button className="btn btn-primary" onClick={doStep3Report} id="confirm-btn">
                      ✅ {t('confirm_btn')}
                    </button>
                    <button className="btn btn-outline" onClick={() => setEditMode(p => !p)} id="edit-toggle-btn">
                      {editMode ? `❌ ${t('cancel_edit')}` : `✏️ ${t('edit_details')}`}
                    </button>
                    <button className="btn btn-danger" onClick={resetApp}>↩ {t('start_over')}</button>
                  </div>

                  {loading && (
                    <div className="loader-wrap" style={{ padding: '2rem' }}>
                      <div className="loader-spinner" />
                      <div className="loader-text">{loadingMsg}</div>
                      <div className="loader-sub">Generating detailed health analysis <span className="pulse-dots"><span /><span /><span /></span></div>
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
                      <div className="insight-box-text" style={{ color: '#93c5fd', marginTop: '0.5rem' }}>{report.irrigation_advice}</div>
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
                      onClick={() => fieldFileRef.current?.click()}
                      onDragOver={e => { e.preventDefault(); setIsFieldDragging(true); }}
                      onDragLeave={() => setIsFieldDragging(false)}
                      onDrop={onFieldDrop}
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
                          <button className="btn btn-danger" style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', borderRadius: '8px' }} onClick={() => { setFieldImagePreview(''); setFieldImageFile(null); setFieldImageBase64(''); }}>✕ Remove</button>
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
                    <button className="btn btn-primary" onClick={doFieldAnalyze} disabled={!fieldImageBase64} id="analyze-field-btn">
                      🗺️ Analyze Field Area
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* FIELD ANALYSIS RESULTS */}
            {step === 'results' && fieldReport && (
              <div className="card" style={{ marginBottom: '1rem', border: '2px solid #3b82f6', background: 'linear-gradient(to bottom, #1e293b, rgba(15, 23, 42, 0.95))' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div style={{ background: '#3b82f6', color: '#fff', padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>PRECISION AI</div>
                  <div className="card-title" style={{ margin: 0 }}>🗺️ Field Analyzer & Minimap</div>
                </div>
                <div className="card-desc">Visual mapping of infection based on your wide-field shot to calculate cost-saving Spot Treatments.</div>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', marginTop: '1.5rem' }}>
                  {/* Grid */}
                  <div style={{ flex: '0 0 auto' }}>
                    <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '12px', border: '1px solid #334155' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {fieldReport.minimap?.grid?.map((row, r) => (
                          <div key={r} style={{ display: 'flex', gap: '4px' }}>
                            {row.map((cell, c) => (
                              <div key={c} style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', background: cell.includes('🟥') ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)', borderRadius: '4px', border: `1px solid ${cell.includes('🟥') ? '#ef4444' : '#22c55e'}` }}>
                                {cell}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-dim)', textAlign: 'center', maxWidth: '140px' }}>
                        {fieldReport.minimap?.location_desc}
                      </div>
                    </div>
                  </div>

                  {/* Spot Treatment Info */}
                  <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                       <div className="insight-box info" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', flex: 1 }}>
                         <div className="insight-box-label" style={{ color: '#60a5fa' }}>Pattern Detection</div>
                         <div className="insight-box-text" style={{ marginTop: '0.5rem' }}>{fieldReport.infection_pattern}</div>
                       </div>
                       <div className="insight-box info" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', flex: 1 }}>
                         <div className="insight-box-label" style={{ color: '#34d399' }}>Total Affected</div>
                         <div className="insight-box-text" style={{ marginTop: '0.5rem', fontSize: '1.25rem', fontWeight: 'bold' }}>{fieldReport.total_affected_percent}</div>
                       </div>
                    </div>

                    {fieldReport.spot_treatment?.is_spot_treatment ? (
                      <div style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid #4ade80', borderRadius: '12px', padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#4ade80', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                          🎯 Spot Treatment Recommended
                        </div>
                        <div style={{ color: '#bbf7d0', marginBottom: '0.5rem' }}>{fieldReport.spot_treatment.instruction}</div>
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: '1rem' }}>{fieldReport.spot_treatment.reason}</div>
                        
                        <div style={{ display: 'flex', gap: '1rem' }}>
                          <span style={{ background: '#22c55e', color: '#000', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.9rem' }}>Savings: {fieldReport.spot_treatment.cost_saved_percent}</span>
                          <span style={{ background: '#064e3b', color: '#34d399', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.9rem' }}>{fieldReport.spot_treatment.money_saved_per_acre} Saved/Acre</span>
                        </div>
                      </div>
                    ) : (
                       <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #f87171', borderRadius: '12px', padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f87171', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                          ⚠️ Full Field Treatment Required
                        </div>
                        <div style={{ color: '#fecaca' }}>{fieldReport.spot_treatment?.instruction || 'No spot treatment available for this spread pattern.'}</div>
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginTop: '0.5rem' }}>{fieldReport.spot_treatment?.reason}</div>
                      </div>
                    )}
                  </div>
                </div>

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
