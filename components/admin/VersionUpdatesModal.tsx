import React, { useState, useEffect, useRef } from 'react';
import { 
    X, Sparkles, Heart, Compass, Zap, Boxes, 
    Smartphone, LayoutDashboard, BellRing, Printer,
    SlidersHorizontal, Layers, Store, Check, Calendar
} from 'lucide-react';
import { VersionRelease, LATEST_RELEASE } from '../../data/versionUpdates';

interface VersionUpdatesModalProps {
    isOpen: boolean;
    onClose: (dontShowAgain: boolean) => void;
    release?: VersionRelease;
}

export const VersionUpdatesModal: React.FC<VersionUpdatesModalProps> = ({
    isOpen,
    onClose,
    release = LATEST_RELEASE
}) => {
    const [dontShowAgain, setDontShowAgain] = useState(true);
    const dontShowAgainRef = useRef(dontShowAgain);
    dontShowAgainRef.current = dontShowAgain;

    // Bloqueo suave del scroll de fondo mientras esté abierto
    useEffect(() => {
        if (!isOpen) return;
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [isOpen]);

    // Cerrar con Escape
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose(dontShowAgainRef.current);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    // Iconos minimalistas y consistentes
    const renderIcon = (iconName: string) => {
        const props = { size: 16, className: "text-zinc-700 dark:text-zinc-200" };
        switch (iconName) {
            case 'Heart':
                return <Heart {...props} className="text-rose-500 fill-rose-500/20" />;
            case 'Compass':
                return <Compass {...props} className="text-blue-500" />;
            case 'Zap':
                return <Zap {...props} className="text-amber-500" />;
            case 'Boxes':
                return <Boxes {...props} className="text-zinc-600 dark:text-zinc-300" />;
            case 'Smartphone':
                return <Smartphone {...props} className="text-sky-500" />;
            case 'LayoutDashboard':
                return <LayoutDashboard {...props} className="text-indigo-500" />;
            case 'BellRing':
                return <BellRing {...props} className="text-emerald-500" />;
            case 'Printer':
                return <Printer {...props} className="text-zinc-600 dark:text-zinc-300" />;
            case 'SlidersHorizontal':
            case 'Layers':
                return <Layers {...props} className="text-purple-500" />;
            case 'Store':
                return <Store {...props} className="text-sky-500" />;
            default:
                return <Sparkles {...props} className="text-amber-500" />;
        }
    };

    return (
        <div 
            className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => onClose(dontShowAgain)}
            role="dialog"
            aria-modal="true"
        >
            <div 
                className="bg-white dark:bg-zinc-900 w-full max-w-md sm:max-w-lg rounded-3xl shadow-2xl border border-gray-200/80 dark:border-white/10 overflow-hidden flex flex-col max-h-[85vh] my-auto animate-toast-subtle"
                onClick={e => e.stopPropagation()}
            >
                {/* Encabezado minimalista */}
                <div className="px-5 pt-5 pb-3 border-b border-gray-100 dark:border-white/5 flex items-start justify-between gap-3 shrink-0">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                                <Sparkles size={11} className="text-amber-500" />
                                Versión {release.version}
                            </span>
                            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
                                <Calendar size={11} /> {release.releaseDate}
                            </span>
                        </div>
                        <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white leading-tight">
                            Novedades del sistema
                        </h2>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">
                            {release.subtitle || release.welcomeMessage}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => onClose(dontShowAgain)}
                        aria-label="Cerrar"
                        className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Lista de Novedades sin sobrecarga */}
                <div className="flex-1 overflow-y-auto px-5 py-3 divide-y divide-gray-100 dark:divide-white/5">
                    {release.features.map((item) => (
                        <div key={item.id} className="py-3 sm:py-3.5 first:pt-1 last:pb-1 flex items-start gap-3">
                            {/* Icono discreto */}
                            <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800/90 flex items-center justify-center shrink-0 mt-0.5">
                                {renderIcon(item.iconName)}
                            </div>

                            {/* Contenido conciso */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                    <h3 className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                        {item.title}
                                    </h3>
                                    <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                        {item.tag}
                                    </span>
                                </div>

                                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-normal">
                                    {item.description}
                                </p>

                                {item.highlight && (
                                    <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                        <Check size={12} className="shrink-0" />
                                        <span>{item.highlight}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Pie de modal compacto y discreto */}
                <div className="px-5 py-3.5 bg-zinc-50/80 dark:bg-zinc-900/90 border-t border-gray-100 dark:border-white/5 flex items-center justify-between gap-3 shrink-0">
                    <label className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 select-none cursor-pointer hover:text-zinc-800 dark:hover:text-zinc-200 transition">
                        <input
                            type="checkbox"
                            checked={dontShowAgain}
                            onChange={(e) => setDontShowAgain(e.target.checked)}
                            className="w-3.5 h-3.5 text-zinc-900 dark:text-white rounded border-zinc-300 dark:border-zinc-700 focus:ring-0 focus:ring-offset-0 transition cursor-pointer"
                        />
                        <span className="text-[11px] sm:text-xs">No volver a mostrar</span>
                    </label>

                    <button
                        type="button"
                        onClick={() => onClose(dontShowAgain)}
                        className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-black text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 font-semibold text-xs shadow-sm active:scale-95 transition-all"
                    >
                        Entendido
                    </button>
                </div>
            </div>
        </div>
    );
};
