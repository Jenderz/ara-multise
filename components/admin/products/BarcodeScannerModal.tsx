import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, Flashlight, AlertCircle, Scan, Keyboard, CheckCircle2 } from 'lucide-react';

interface BarcodeScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (code: string) => void;
    title?: string;
    subtitle?: string;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
    isOpen,
    onClose,
    onScan,
    title = 'Escanear Código de Barras',
    subtitle = 'Apunta la cámara al código de barras del producto'
}) => {
    const [cameraError, setCameraError] = useState('');
    const [manualCode, setManualCode] = useState('');
    const [showManualInput, setShowManualInput] = useState(false);
    const [hasTorch, setHasTorch] = useState(false);
    const [torchOn, setTorchOn] = useState(false);
    const [scannedFeedback, setScannedFeedback] = useState<string | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scanLoopRef = useRef<number | null>(null);

    // Reproduce un sonido de confirmación estilo escáner profesional
    const playBeep = () => {
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContextClass) return;
            const ctx = new AudioContextClass();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1760, ctx.currentTime);
            gain.gain.setValueAtTime(0.25, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.12);
        } catch (_) {}
    };

    const triggerHaptic = () => {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
                navigator.vibrate([60, 40, 60]);
            } catch (_) {}
        }
    };

    const stopCamera = () => {
        if (scanLoopRef.current) {
            cancelAnimationFrame(scanLoopRef.current);
            scanLoopRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => {
                try {
                    track.stop();
                } catch (_) {}
            });
            streamRef.current = null;
        }
        setTorchOn(false);
        setHasTorch(false);
    };

    const handleSuccess = (code: string) => {
        playBeep();
        triggerHaptic();
        setScannedFeedback(code);
        stopCamera();

        setTimeout(() => {
            onScan(code.trim());
            onClose();
        }, 350);
    };

    const toggleTorch = async () => {
        const track = streamRef.current?.getVideoTracks()[0];
        if (!track) return;
        try {
            const nextTorch = !torchOn;
            await (track as any).applyConstraints({
                advanced: [{ torch: nextTorch }]
            });
            setTorchOn(nextTorch);
        } catch (err) {
            console.warn('Torch toggle error:', err);
        }
    };

    const startCamera = async () => {
        setCameraError('');
        setScannedFeedback(null);
        setShowManualInput(false);

        const hasBarcodeDetector = 'BarcodeDetector' in globalThis;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });

            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }

            // Detectar soporte para linterna (Flash)
            const track = stream.getVideoTracks()[0];
            const capabilities = track.getCapabilities?.() as any;
            if (capabilities && 'torch' in capabilities) {
                setHasTorch(true);
            }

            if (!hasBarcodeDetector) {
                // Navegador sin BarcodeDetector nativo -> activamos input manual directamente
                setShowManualInput(true);
                return;
            }

            // @ts-ignore — BarcodeDetector API nativa
            const detector = new (globalThis as any).BarcodeDetector({
                formats: [
                    'ean_13',
                    'ean_8',
                    'upc_a',
                    'upc_e',
                    'code_128',
                    'code_39',
                    'code_93',
                    'itf',
                    'qr_code'
                ]
            });

            const scan = async () => {
                if (!videoRef.current || videoRef.current.readyState < 2) {
                    scanLoopRef.current = requestAnimationFrame(scan);
                    return;
                }
                try {
                    const barcodes = await detector.detect(videoRef.current);
                    if (barcodes.length > 0 && barcodes[0]?.rawValue) {
                        const raw = barcodes[0].rawValue;
                        handleSuccess(raw);
                        return;
                    }
                } catch (_) {
                    // Continuar scanning frame a frame
                }
                scanLoopRef.current = requestAnimationFrame(scan);
            };

            scanLoopRef.current = requestAnimationFrame(scan);
        } catch (err: any) {
            console.error('Camera access error:', err);
            const isDenied = err?.name === 'NotAllowedError' || err?.message?.includes('Permission');
            setCameraError(
                isDenied
                    ? 'Permiso de cámara denegado. Permite el acceso a la cámara en el navegador o usa el ingreso manual.'
                    : 'No se pudo inicializar la cámara. Puedes escribir el código manualmente.'
            );
            setShowManualInput(true);
        }
    };

    useEffect(() => {
        if (isOpen) {
            startCamera();
        } else {
            stopCamera();
        }

        return () => {
            stopCamera();
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (manualCode.trim()) {
            handleSuccess(manualCode.trim());
        }
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
            <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col relative text-white animate-slide-up">
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-zinc-950/60">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-ios-blue/20 text-ios-blue flex items-center justify-center">
                            <Scan size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm text-white tracking-tight">{title}</h3>
                            <p className="text-[11px] text-zinc-400">{subtitle}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            stopCamera();
                            onClose();
                        }}
                        className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition-colors active:scale-95"
                        title="Cerrar escáner"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body / Camera Viewport */}
                <div className="relative p-4 flex flex-col items-center">
                    {/* Retroalimentación al detectar */}
                    {scannedFeedback ? (
                        <div className="w-full aspect-square bg-emerald-950/60 border-2 border-emerald-500 rounded-2xl flex flex-col items-center justify-center gap-3 animate-spring-scale text-center p-4">
                            <CheckCircle2 size={54} className="text-emerald-400 animate-bounce" />
                            <div>
                                <span className="text-xs uppercase tracking-wider text-emerald-400 font-bold block">Código Detectado</span>
                                <span className="text-xl font-mono font-black text-white">{scannedFeedback}</span>
                            </div>
                        </div>
                    ) : cameraError ? (
                        <div className="w-full aspect-video sm:aspect-square bg-red-950/30 border border-red-500/30 rounded-2xl p-5 flex flex-col items-center justify-center text-center gap-3">
                            <AlertCircle size={36} className="text-red-400" />
                            <p className="text-xs text-red-200 leading-relaxed max-w-xs">{cameraError}</p>
                        </div>
                    ) : (
                        <div className="relative w-full aspect-square max-h-[320px] bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center">
                            <video
                                ref={videoRef}
                                className="w-full h-full object-cover"
                                muted
                                playsInline
                                autoPlay
                            />

                            {/* Máscara de enfoque y esquinas neon iOS */}
                            <div className="absolute inset-0 border-[36px] border-black/50 pointer-events-none" />

                            <div className="absolute inset-[36px] pointer-events-none flex flex-col justify-between p-2">
                                {/* Esquinas superiores */}
                                <div className="flex justify-between">
                                    <div className="w-6 h-6 border-t-4 border-l-4 border-ios-blue rounded-tl-lg shadow-[0_0_12px_rgba(0,122,255,0.8)]" />
                                    <div className="w-6 h-6 border-t-4 border-r-4 border-ios-blue rounded-tr-lg shadow-[0_0_12px_rgba(0,122,255,0.8)]" />
                                </div>

                                {/* Láser animado rojo */}
                                <div className="w-full flex items-center justify-center">
                                    <div className="w-full h-[2.5px] bg-red-500 shadow-[0_0_12px_rgba(239,68,68,1)] animate-scan-line" />
                                </div>

                                {/* Esquinas inferiores */}
                                <div className="flex justify-between">
                                    <div className="w-6 h-6 border-b-4 border-l-4 border-ios-blue rounded-bl-lg shadow-[0_0_12px_rgba(0,122,255,0.8)]" />
                                    <div className="w-6 h-6 border-b-4 border-r-4 border-ios-blue rounded-br-lg shadow-[0_0_12px_rgba(0,122,255,0.8)]" />
                                </div>
                            </div>

                            {/* Controles flotantes sobre la cámara */}
                            <div className="absolute top-2 right-2 flex gap-1.5 z-20">
                                {hasTorch && (
                                    <button
                                        type="button"
                                        onClick={toggleTorch}
                                        className={`p-2.5 rounded-full backdrop-blur-md transition-all active:scale-90 ${
                                            torchOn
                                                ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/40'
                                                : 'bg-black/60 text-white/80 hover:bg-black/80'
                                        }`}
                                        title={torchOn ? 'Apagar linterna' : 'Encender linterna'}
                                    >
                                        <Flashlight size={16} />
                                    </button>
                                )}
                            </div>

                            <p className="absolute bottom-2 inset-x-0 text-center text-white/90 text-[11px] font-semibold tracking-wide drop-shadow-md z-20 pointer-events-none">
                                Centra el código de barras en el visor
                            </p>
                        </div>
                    )}

                    {/* Alternativa Manual */}
                    <div className="w-full mt-4">
                        {!showManualInput ? (
                            <button
                                type="button"
                                onClick={() => setShowManualInput(true)}
                                className="w-full py-2.5 px-4 text-xs font-semibold text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition flex items-center justify-center gap-2"
                            >
                                <Keyboard size={15} /> ¿No puedes escanear? Ingresar manualmente
                            </button>
                        ) : (
                            <form onSubmit={handleManualSubmit} className="space-y-2 animate-fade-in">
                                <label className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">
                                    Escribe o pega el código de fábrica:
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        autoFocus
                                        value={manualCode}
                                        onChange={e => setManualCode(e.target.value)}
                                        placeholder="Ej: 7501234567890"
                                        className="flex-1 bg-black/40 border border-white/15 focus:border-ios-blue rounded-xl px-3.5 py-2.5 text-sm font-mono text-white outline-none transition"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!manualCode.trim()}
                                        className="px-4 py-2.5 bg-ios-blue hover:bg-blue-600 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-blue-500/20 active:scale-95"
                                    >
                                        Listo
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-3 bg-zinc-950/80 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-400">
                    <span className="flex items-center gap-1.5">
                        <Camera size={13} className="text-zinc-500" />
                        Detecta EAN-13, UPC, Code-128
                    </span>
                    <button
                        onClick={() => {
                            stopCamera();
                            onClose();
                        }}
                        className="text-zinc-400 hover:text-white font-medium px-2 py-1 rounded"
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
};
