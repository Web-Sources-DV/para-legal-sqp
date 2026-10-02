import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload,
  Sparkles,
  Cpu,
  RefreshCw,
  AlertCircle,
  X,
  FileSearch,
  Image as ImageIcon,
  ShieldCheck,
  CheckCircle2,
  Camera,
  SwitchCamera,
  RotateCw,
  Sliders,
  Zap,
} from 'lucide-react';
import { ExtractionResult } from '../types';
import { extractWithTesseract } from '../services/ocrService';
import { preprocessDocumentForOCR, PreprocessedImages } from '../services/imagePreprocessing';

interface PassportScannerProps {
  onExtractionComplete: (result: ExtractionResult) => void;
  onCancel?: () => void;
}

export const PassportScanner: React.FC<PassportScannerProps> = ({
  onExtractionComplete,
  onCancel,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'camera'>('upload');
  const [opticalFilter, setOpticalFilter] = useState<'enhanced' | 'binarized' | 'original'>('enhanced');
  const [preprocessedPreview, setPreprocessedPreview] = useState<PreprocessedImages | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedFilePreview, setSelectedFilePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Camera states
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraStarting, setIsCameraStarting] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const cameraRequest = useRef(0);
  const processingRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  // Stop camera helper
  const stopCameraStream = useCallback(() => {
    cameraRequest.current++;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setCameraStream(null);
  }, []);

  // Start camera stream
  const startCamera = useCallback(async (facing: 'environment' | 'user' = 'environment') => {
    setIsCameraStarting(true);
    setCameraError(null);

    stopCameraStream();
    const request = cameraRequest.current;

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Tu navegador no soporta acceso directo a la cámara web.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      if (!mountedRef.current || request !== cameraRequest.current) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      if (!mountedRef.current || request !== cameraRequest.current) return;
      console.warn('Primary camera error, attempting fallback:', err);
      try {
        // Fallback without strict facing constraints
        const streamFallback = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        if (!mountedRef.current || request !== cameraRequest.current) { streamFallback.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = streamFallback;
        setCameraStream(streamFallback);
        if (videoRef.current) {
          videoRef.current.srcObject = streamFallback;
          videoRef.current.play().catch(() => {});
        }
      } catch (fallbackErr: any) {
        setCameraError(
          'No se pudo acceder a la cámara. Verifica que diste permisos de cámara en tu navegador.'
        );
      }
    } finally {
      setIsCameraStarting(false);
    }
  }, [stopCameraStream]);

  // Trigger camera start when camera tab is active
  useEffect(() => {
    if (activeTab === 'camera') {
      startCamera(cameraFacingMode);
    } else {
      stopCameraStream();
    }

    return () => {
      stopCameraStream();
    };
  }, [activeTab, cameraFacingMode, startCamera, stopCameraStream]);

  useEffect(() => {
    if (cameraStream && videoRef.current) { videoRef.current.srcObject = cameraStream; videoRef.current.play().catch(() => {}); }
  }, [cameraStream]);

  // Switch between front and back cameras
  const handleToggleCameraFacing = () => {
    const nextFacing = cameraFacingMode === 'environment' ? 'user' : 'environment';
    setCameraFacingMode(nextFacing);

  };

  // Capture snapshot from video stream
  const capturePhoto = () => {
    if (!videoRef.current || !videoRef.current.videoWidth || !videoRef.current.videoHeight) { setCameraError('Espera a que la cámara muestre la imagen antes de capturar.'); return; }

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const photoBase64 = canvas.toDataURL('image/jpeg', 0.95);

    // Stop video and process image
    stopCameraStream();
    processImage(photoBase64, 'image/jpeg');
  };

  // Resize / optimize image before sending to OCR local to guarantee first-try reading
  const optimizeImageIfNeeded = (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 2000;
        let width = img.width;
        let height = img.height;

        if (width <= maxDim && height <= maxDim) {
          resolve(dataUrl);
          return;
        }

        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.94));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  // Perform extraction on an image base64
  const processImage = async (imageBase64: string, mimeType: string = 'image/jpeg') => {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);
    setErrorMessage(null);
    setProgressPercent(15);
    setSelectedFilePreview(imageBase64);

    try {
      // 1. Optimize image resolution for crystal clear OCR
      const optimizedBase64 = await optimizeImageIfNeeded(imageBase64);

      // 2. Preprocess optical filters (Grayscale, Contrast stretch, Sharpen, Otsu Binarization)
      setProcessingStatus('Aplicando filtros ópticos: realce de bordes y binarización...');
      setProgressPercent(30);
      const preprocessed = await preprocessDocumentForOCR(optimizedBase64);
      setPreprocessedPreview(preprocessed);

      // Select active image based on optical filter
      const imageToScan =
        opticalFilter === 'binarized'
          ? preprocessed.binarized
          : opticalFilter === 'original'
          ? preprocessed.original
          : preprocessed.enhanced;

      setProcessingStatus('Iniciando OCR local (Tesseract spa+eng)...');
      const result = await extractWithTesseract(imageToScan, (prog, status) => {
        if (!mountedRef.current) return;
        setProgressPercent(Math.max(30, prog));
        setProcessingStatus(status);
      }, { ...preprocessed, enhanced: imageToScan });
      result.imagePreview = preprocessed.enhanced || optimizedBase64;
      if (mountedRef.current) {
        setProgressPercent(100);
        setProcessingStatus('Lectura OCR completada. Revisa los datos detectados.');
        onExtractionComplete(result);
      }
    } catch (err: any) {
      if (mountedRef.current) setErrorMessage(`Error en OCR local: ${err.message || 'No se pudo leer el documento. Intenta otra fotografía.'}`);
    } finally {
      processingRef.current = false;
      if (mountedRef.current) setIsProcessing(false);
    }
  };

  // Handle file input
  const handleFileUpload = (file: File) => {
    if (!file || processingRef.current) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/bmp'].includes(file.type)) { setErrorMessage('Sube una imagen JPG, PNG, WEBP o BMP. Convierte PDF o HEIC a imagen primero.'); return; }
    if (file.size > 15 * 1024 * 1024) { setErrorMessage('La imagen debe pesar menos de 15 MB.'); return; }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        processImage(base64, file.type || 'image/jpeg');
      }
    };
    reader.onerror = () => setErrorMessage('No se pudo leer el archivo.');
    reader.readAsDataURL(file);
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      {/* Header bar */}
      <div className="bg-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30">
            <Cpu className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif font-bold text-lg text-slate-100">
                Lector OCR de Pasaporte, Cédula y Carnet
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                JSON Estructurado
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Lectura óptica de caracteres (OCR) sin inventar texto: detecta datos para revisar y guardar en formato JSON para plasmar en tu documento Word
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs text-amber-300">
          <Cpu className="w-4 h-4" />
          <span>OCR local · Tesseract · Sin IA generativa</span>
        </div>

        {onCancel && (
          <button
            onClick={() => {
              stopCameraStream();
              onCancel();
            }}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Mode Switcher Tabs: Subir Archivo vs Tomar Foto */}
      {!isProcessing && (
        <div className="px-6 pt-4 pb-0 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <button
              id="tab-mode-upload"
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-t border-x ${
                activeTab === 'upload'
                  ? 'bg-white text-slate-900 border-slate-200 shadow-xs border-b-white translate-y-[1px]'
                  : 'bg-transparent text-slate-500 border-transparent hover:text-slate-800'
              }`}
            >
              <Upload className="w-4 h-4 text-amber-600" />
              <span>Subir o Arrastrar Archivo</span>
            </button>

            <button
              id="tab-mode-camera"
              type="button"
              onClick={() => setActiveTab('camera')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-t border-x ${
                activeTab === 'camera'
                  ? 'bg-white text-slate-900 border-slate-200 shadow-xs border-b-white translate-y-[1px]'
                  : 'bg-transparent text-slate-500 border-transparent hover:text-slate-800'
              }`}
            >
              <Camera className="w-4 h-4 text-amber-600" />
              <span>Tomar Foto con Cámara</span>
              <span className="text-[10px] bg-amber-500/20 text-amber-800 px-1.5 py-0.2 rounded-full font-bold">
                En vivo
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="p-6">
        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 text-sm">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Ocurrió un error al procesar el documento:</p>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-500 hover:text-red-800 text-xs font-semibold"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Processing overlay state */}
        {isProcessing && (
          <div className="py-12 px-6 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mb-4 relative shadow-md">
              <RefreshCw className="w-8 h-8 text-amber-600 animate-spin" />
              <Sparkles className="w-4 h-4 text-amber-500 absolute -top-1 -right-1 animate-pulse" />
            </div>
            <h4 className="font-serif font-bold text-lg text-slate-800 mb-1">
              Leyendo y extrayendo datos del pasaporte
            </h4>
            <p className="text-sm text-slate-500 max-w-md mb-6">{processingStatus}</p>

            <div className="w-full max-w-md bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
              <div
                className="bg-gradient-to-r from-amber-500 to-amber-600 h-full transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs text-slate-400 mt-2 font-mono">{progressPercent}% completado</span>
          </div>
        )}

        {/* Mode 1: File Upload */}
        {!isProcessing && activeTab === 'upload' && (
          <div className="space-y-5">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center transition-all ${
                isDragging
                  ? 'border-amber-500 bg-amber-50/60 scale-[1.01]'
                  : 'border-slate-300 hover:border-amber-500 bg-slate-50 hover:bg-amber-50/30'
              }`}
            >
              <label
                htmlFor="passport-file-input"
                className="cursor-pointer flex flex-col items-center justify-center w-full"
              >
                <div className="w-16 h-16 rounded-2xl bg-white shadow-md border border-slate-200 flex items-center justify-center mb-4 text-amber-600">
                  <Upload className="w-8 h-8" />
                </div>
                <h4 className="font-bold text-slate-800 text-base mb-1">
                  Arrastra o haz clic para subir la foto del pasaporte o cédula
                </h4>
                <p className="text-xs text-slate-500 max-w-md mb-4">
                  El sistema detectará automáticamente el <span className="font-semibold text-slate-700">nombre completo</span>, <span className="font-semibold text-slate-700">número de documento</span>, <span className="font-semibold text-slate-700">nacionalidad</span>, <span className="font-semibold text-slate-700">fecha de nacimiento</span> y <span className="font-semibold text-slate-700">condición (sexo/edad)</span> para que los revises antes de guardar.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-md hover:bg-slate-800 transition-colors">
                    <FileSearch className="w-4 h-4 text-amber-400" />
                    Seleccionar Archivo de Imagen
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveTab('camera');
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md transition-colors"
                  >
                    <Camera className="w-4 h-4 text-slate-950" />
                    Usar Cámara Web
                  </button>
                </div>
                <input
                  id="passport-file-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg,image/heic"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                  className="hidden"
                />
              </label>
            </div>

            {/* Optical Preprocessing Filter Selector */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-bold text-slate-800">Filtro de Preprocesamiento Óptico OCR:</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setOpticalFilter('enhanced')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    opticalFilter === 'enhanced'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Realce Óptico (Recomendado)
                </button>
                <button
                  type="button"
                  onClick={() => setOpticalFilter('binarized')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    opticalFilter === 'binarized'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Binarización B/N (Alto Contraste Otsu)
                </button>
                <button
                  type="button"
                  onClick={() => setOpticalFilter('original')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    opticalFilter === 'original'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Original
                </button>
              </div>
            </div>

            {/* Helpful instructions card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-xs font-bold text-slate-800">Mejora de legibilidad</h5>
                  <p className="text-[11px] text-slate-500">Optimización de imagen y contraste automático previo al escaneo.</p>
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-xs font-bold text-slate-800">Campos Legales Clave</h5>
                  <p className="text-[11px] text-slate-500">Extrae (nombre), (numero de identidad), (nacionalidad), (sexo/edad) y fechas.</p>
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2.5">
                <ImageIcon className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-xs font-bold text-slate-800">Formatos Compatibles</h5>
                  <p className="text-[11px] text-slate-500">Admite JPG, PNG, WEBP y fotos tomadas desde cualquier teléfono o escáner.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mode 2: Live Camera Capture */}
        {!isProcessing && activeTab === 'camera' && (
          <div className="space-y-4">
            {cameraError ? (
              <div className="p-8 rounded-2xl bg-amber-50 border border-amber-200 text-center space-y-4">
                <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-base mb-1">
                    Permiso de Cámara Requerido
                  </h4>
                  <p className="text-xs text-slate-600 max-w-md mx-auto">
                    {cameraError}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => startCamera(cameraFacingMode)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reintentar Acceso</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('upload')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Volver a Subir Archivo</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                {/* Camera Viewport Frame with Passport Guide */}
                <div className="relative w-full max-w-2xl bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border-2 border-slate-800 aspect-[4/3] sm:aspect-[16/10] flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />

                  {/* Viewfinder Passport Guide Overlay */}
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
                    {/* Outer darken frame */}
                    <div className="w-full max-w-lg aspect-[1.42/1] border-2 border-amber-400/80 rounded-xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                      {/* Corner accents */}
                      <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-amber-400 rounded-tl-sm" />
                      <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-amber-400 rounded-tr-sm" />
                      <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-amber-400 rounded-bl-sm" />
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-amber-400 rounded-br-sm" />

                      {/* MRZ Zone Target Line at bottom */}
                      <div className="absolute bottom-2 left-3 right-3 h-10 border border-dashed border-amber-300/60 rounded-md bg-amber-500/10 flex items-center justify-center">
                        <span className="text-[10px] text-amber-200 font-mono tracking-wider font-semibold">
                          Alinear Zona MRZ Inferior &lt;&lt;&lt;&lt;&lt;
                        </span>
                      </div>

                      {/* Guide Text */}
                      <div className="absolute top-3 left-3 right-3 text-center">
                        <span className="text-[11px] bg-slate-900/80 text-amber-300 px-3 py-1 rounded-full font-medium shadow-sm backdrop-blur-xs">
                          Coloca la página principal del pasaporte dentro del marco
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Camera Controls Overlay (Top Right) */}
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleToggleCameraFacing}
                      className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700 shadow-md backdrop-blur-xs transition-all"
                      title="Cambiar Cámara (Frontal / Trasera)"
                    >
                      <SwitchCamera className="w-4 h-4 text-amber-400" />
                    </button>
                  </div>
                </div>

                {/* Bottom Snapshot Trigger Button */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-6 w-full">
                  <button
                    id="btn-capture-photo"
                    type="button"
                    onClick={capturePhoto}
                    disabled={isCameraStarting}
                    className="inline-flex items-center justify-center gap-3 px-8 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm sm:text-base shadow-lg shadow-amber-500/25 transition-all w-full sm:w-auto"
                  >
                    <Camera className="w-5 h-5 text-slate-950" />
                    <span>📸 Capturar Foto y Extraer Datos</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('upload')}
                    className="px-4 py-3 rounded-2xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors w-full sm:w-auto text-center"
                  >
                    Volver a Subir Archivo
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
