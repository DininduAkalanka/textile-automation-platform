'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useModalStore } from '@/store/useModalStore';
import { api } from '@/lib/api';
import { Product } from '@/types';

interface DemoItem {
  id: string;
  name: string;
  image: string;
  keywords: string[];
}

const DEMO_PRESETS: DemoItem[] = [
  { id: '1', name: 'Denim Style', image: '/images/products/teen-denim.png', keywords: ['denim', 'jacket', 'vintage'] },
  { id: '2', name: 'Evening Gown', image: '/images/products/women-gown.png', keywords: ['gown', 'evening', 'silk', 'elegant'] },
  { id: '3', name: 'Formal Shirt', image: '/images/products/men-shirt.png', keywords: ['shirt', 'formal', 'oxford'] },
  { id: '4', name: 'Summer Dress', image: '/images/products/women-summer-dress.png', keywords: ['dress', 'summer', 'floral', 'maxi'] },
  { id: '5', name: 'Textured Polo', image: '/images/products/men-polo.png', keywords: ['polo', 'tee', 'textured'] },
];

export default function VisualSearchModal() {
  const { visualSearchOpen, closeVisualSearch, openQuickView } = useModalStore();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisLogs, setAnalysisLogs] = useState<string[]>([]);
  const [results, setResults] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<'upload' | 'camera'>('upload');
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Camera stream states
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close and clean up stream
  const handleClose = () => {
    stopCamera();
    setSelectedImage(null);
    setAnalyzing(false);
    setResults([]);
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
    closeVisualSearch();
  };

  // Prevent scroll when modal is open
  useEffect(() => {
    if (visualSearchOpen) {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = 'hidden';
      }
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
      }
    };
  }, [visualSearchOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Web camera activation
  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera access failed:', err);
      setCameraError('Unable to access device camera. Please upload an image instead.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setSelectedImage(dataUrl);
        stopCamera();
        runAiAnalysis(dataUrl, 'camera-capture.jpg');
      }
    }
  };

  useEffect(() => {
    if (activeTab === 'camera' && visualSearchOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [activeTab, visualSearchOpen]);

  if (!visualSearchOpen) return null;

  // File Upload Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setSelectedImage(dataUrl);
      runAiAnalysis(dataUrl, file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handlePresetClick = (preset: DemoItem) => {
    setSelectedImage(preset.image);
    runAiAnalysis(preset.image, preset.name, preset.keywords);
  };

  // Simulated Intelligent AI Analysis Flow
  const runAiAnalysis = async (imageSrc: string, filename: string, presetKeywords?: string[]) => {
    setAnalyzing(true);
    setResults([]);
    setAnalysisLogs([]);

    const logSteps = [
      'Initializing AI vision pipeline...',
      'Isolating garment from background bounding box...',
      'Extracting color hex codes & texture density...',
      'Matching fabric features with Smart Textile inventory...',
      'Finalizing search rankings...'
    ];

    // Trigger log updates sequentially to make it feel extremely realistic
    for (let i = 0; i < logSteps.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 380));
      setAnalysisLogs((prev) => [...prev, logSteps[i]]);
    }

    // Now execute search based on keywords
    try {
      const allProductsRes = await api.getProducts({ limit: 50 });
      const products = allProductsRes.products || [];

      let matched: Product[] = [];
      const query = filename.toLowerCase();

      // Check keywords
      const keywords = presetKeywords || [];
      if (keywords.length === 0) {
        // Extract keywords from filename
        if (query.includes('denim') || query.includes('jacket') || query.includes('jean')) {
          keywords.push('denim', 'jacket');
        } else if (query.includes('gown') || query.includes('dress') || query.includes('maxi') || query.includes('evening')) {
          keywords.push('gown', 'dress');
        } else if (query.includes('shirt') || query.includes('formal') || query.includes('school')) {
          keywords.push('shirt');
        } else if (query.includes('polo')) {
          keywords.push('polo');
        } else if (query.includes('chino') || query.includes('pant') || query.includes('trouser')) {
          keywords.push('chino', 'trouser');
        } else if (query.includes('blouse') || query.includes('silk')) {
          keywords.push('blouse');
        }
      }

      // Filter products by keywords
      if (keywords.length > 0) {
        matched = products.filter((p) => {
          const name = p.name.toLowerCase();
          const desc = (p.description || '').toLowerCase();
          const cat = p.category?.name?.toLowerCase() || '';
          
          return keywords.some((kw) => name.includes(kw) || desc.includes(kw) || cat.includes(kw));
        });
      }

      // Fallback: If no keyword matches, return a slice of products that look trendy
      if (matched.length === 0) {
        matched = products.slice(0, 4);
      }

      setResults(matched);
    } catch (err) {
      console.error('Visual search API error:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
      className="animate-fade-in"
    >
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(5px)',
        }}
      />

      {/* Modal Box */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '750px',
          maxHeight: '90vh',
          background: 'var(--clr-surface)',
          boxShadow: 'var(--shadow-xl)',
          overflowY: 'auto',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          animation: 'scaleIn 0.3s var(--ease-spring) both',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.5rem 2rem',
            borderBottom: '1px solid var(--clr-border-2)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', fontWeight: 600 }}>
              AI Visual Search
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--clr-text-3)', fontFamily: 'var(--font-mono)' }}>
              Upload or snap a garment photo to find smart matches
            </p>
          </div>
          <button
            onClick={handleClose}
            style={{
              width: '2rem',
              height: '2rem',
              borderRadius: '50%',
              border: '1px solid var(--clr-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--clr-text)',
            }}
          >
            ×
          </button>
        </div>

        {/* Inner Content */}
        <div style={{ padding: '2rem' }}>
          {!selectedImage ? (
            <div>
              {/* Tab Selector */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--clr-border-2)', marginBottom: '1.5rem' }}>
                <button
                  onClick={() => setActiveTab('upload')}
                  style={{
                    padding: '0.75rem 1.5rem',
                    fontSize: '0.8rem',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: activeTab === 'upload' ? '2.5px solid var(--clr-brand)' : 'none',
                    color: activeTab === 'upload' ? 'var(--clr-brand)' : 'var(--clr-text-2)',
                    cursor: 'pointer',
                  }}
                >
                  Upload File
                </button>
                <button
                  onClick={() => setActiveTab('camera')}
                  style={{
                    padding: '0.75rem 1.5rem',
                    fontSize: '0.8rem',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: activeTab === 'camera' ? '2.5px solid var(--clr-brand)' : 'none',
                    color: activeTab === 'camera' ? 'var(--clr-brand)' : 'var(--clr-text-2)',
                    cursor: 'pointer',
                  }}
                >
                  Use Camera
                </button>
              </div>

              {/* Tab Panels */}
              {activeTab === 'upload' ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    height: '220px',
                    border: isDragOver ? '2px dashed var(--clr-brand)' : '1.5px dashed var(--clr-border)',
                    background: isDragOver ? 'var(--clr-brand-tint)' : 'var(--clr-surface-2)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textAlign: 'center',
                    padding: '1rem',
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  <div
                    style={{
                      width: '3.5rem',
                      height: '3.5rem',
                      borderRadius: '50%',
                      background: 'white',
                      boxShadow: 'var(--shadow-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '1rem',
                      color: 'var(--clr-brand)',
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--clr-text)', marginBottom: '0.25rem' }}>
                    Drag & Drop image here
                  </h4>
                  <p style={{ fontSize: '0.78rem', color: 'var(--clr-text-3)' }}>
                    Or click to browse files from your device
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    height: '260px',
                    background: 'black',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {cameraError ? (
                    <div style={{ color: 'white', padding: '2rem', textAlign: 'center', fontSize: '0.85rem' }}>
                      {cameraError}
                    </div>
                  ) : (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <button
                        onClick={capturePhoto}
                        style={{
                          position: 'absolute',
                          bottom: '1.25rem',
                          width: '3.5rem',
                          height: '3.5rem',
                          borderRadius: '50%',
                          background: 'white',
                          border: '4px solid rgba(255,255,255,0.4)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: 'var(--shadow-lg)',
                          transition: 'transform 0.15s ease',
                        }}
                        onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.9)')}
                        onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                      >
                        <div style={{ width: '1.75rem', height: '1.75rem', borderRadius: '50%', background: 'var(--clr-brand)' }} />
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Presets Row */}
              <div style={{ marginTop: '2.5rem' }}>
                <h5
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.65rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--clr-text-3)',
                    marginBottom: '0.875rem',
                  }}
                >
                  Or click one of these presets to test instantly:
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
                  {DEMO_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handlePresetClick(preset)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                        background: 'none',
                        border: 'none',
                        textAlign: 'center',
                      }}
                      className="preset-btn"
                    >
                      <div
                        style={{
                          position: 'relative',
                          width: '100%',
                          aspectRatio: '3/4',
                          border: '1px solid var(--clr-border)',
                          overflow: 'hidden',
                          background: 'var(--obsidian-50)',
                          borderRadius: '2px',
                        }}
                      >
                        <Image
                          src={preset.image}
                          alt={preset.name}
                          fill
                          style={{ objectFit: 'cover' }}
                          sizes="100px"
                          unoptimized
                        />
                      </div>
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--clr-text-2)', fontFamily: 'var(--font-sans)' }}>
                        {preset.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div>
              {/* Scan Screen */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '2rem' }}>
                {/* Left image display with scanning overlay */}
                <div
                  style={{
                    position: 'relative',
                    aspectRatio: '3/4',
                    overflow: 'hidden',
                    background: 'var(--obsidian-950)',
                    border: '1px solid var(--clr-border)',
                  }}
                >
                  <Image src={selectedImage} alt="Search Query" fill style={{ objectFit: 'cover' }} unoptimized />

                  {/* Horizontal scanner beam */}
                  {analyzing && (
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        height: '3px',
                        background: 'linear-gradient(to right, transparent, var(--clr-brand), transparent)',
                        boxShadow: '0 0 10px var(--clr-brand), 0 0 4px var(--clr-brand)',
                        zIndex: 3,
                        animation: 'scanBeam 1.8s ease-in-out infinite',
                      }}
                    />
                  )}
                </div>

                {/* Right analysis console or search results */}
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '300px' }}>
                  {analyzing ? (
                    <div
                      style={{
                        background: 'var(--clr-surface-2)',
                        border: '1px solid var(--clr-border-2)',
                        padding: '1.5rem',
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                      }}
                    >
                      <h4
                        style={{
                          fontSize: '0.82rem',
                          fontFamily: 'var(--font-mono)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          color: 'var(--clr-brand)',
                          marginBottom: '1rem',
                        }}
                      >
                        AI Scanning Diagnostics
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {analysisLogs.map((log, idx) => (
                          <div
                            key={idx}
                            style={{
                              fontSize: '0.75rem',
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--clr-text-2)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                            }}
                          >
                            <span style={{ color: '#16a34a' }}>✔</span> {log}
                          </div>
                        ))}
                        <div
                          style={{
                            fontSize: '0.75rem',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--clr-text-3)',
                            animation: 'pulse 1s infinite alternate',
                          }}
                        >
                          ⚡ Processing embeddings...
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '1rem',
                        }}
                      >
                        <h4 style={{ fontSize: '0.875rem', fontWeight: 700 }}>
                          Matching Results ({results.length})
                        </h4>
                        <button
                          onClick={() => {
                            setSelectedImage(null);
                            setResults([]);
                          }}
                          style={{
                            fontSize: '0.75rem',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--clr-brand)',
                            cursor: 'pointer',
                          }}
                        >
                          ← New Search
                        </button>
                      </div>

                      {results.length === 0 ? (
                        <div
                          style={{
                            textAlign: 'center',
                            padding: '3rem 1rem',
                            background: 'var(--clr-surface-2)',
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                          }}
                        >
                          <p style={{ fontSize: '1.5rem', margin: 0 }}>🔍</p>
                          <p style={{ fontSize: '0.8rem', color: 'var(--clr-text-2)', marginTop: '0.5rem' }}>
                            No high-similarity items found.
                          </p>
                        </div>
                      ) : (
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, 1fr)',
                            gap: '0.875rem',
                            overflowY: 'auto',
                            maxHeight: '340px',
                            paddingRight: '0.25rem',
                          }}
                        >
                          {results.map((product) => (
                            <div
                              key={product.id}
                              onClick={() => {
                                handleClose();
                                openQuickView(product);
                              }}
                              style={{
                                display: 'flex',
                                border: '1px solid var(--clr-border-2)',
                                cursor: 'pointer',
                                background: 'white',
                                transition: 'all 0.15s ease',
                              }}
                              className="result-item"
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = 'var(--clr-brand)';
                                e.currentTarget.style.boxShadow = 'var(--shadow-xs)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'var(--clr-border-2)';
                                e.currentTarget.style.boxShadow = 'none';
                              }}
                            >
                              <div style={{ position: 'relative', width: '55px', height: '75px', flexShrink: 0 }}>
                                <Image
                                  src={product.images && product.images.length > 0 ? product.images[0] : '/images/prod1.png'}
                                  alt={product.name}
                                  fill
                                  style={{ objectFit: 'cover' }}
                                  sizes="55px"
                                  unoptimized
                                />
                              </div>
                              <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <h5
                                  style={{
                                    fontSize: '0.78rem',
                                    fontWeight: 600,
                                    margin: 0,
                                    lineHeight: 1.3,
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                  }}
                                >
                                  {product.name}
                                </h5>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--clr-brand)', marginTop: '0.25rem' }}>
                                  Rs. {Number(product.price).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <style jsx global>{`
          @keyframes scanBeam {
            0% { top: 0%; }
            50% { top: 100%; }
            100% { top: 0%; }
          }
          @keyframes pulse {
            from { opacity: 0.5; }
            to { opacity: 1; }
          }
          .preset-btn:hover img {
            transform: scale(1.08);
          }
          .preset-btn img {
            transition: transform 0.25s ease;
          }
        `}</style>
      </div>
    </div>
  );
}
