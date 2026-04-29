import React, { InputHTMLAttributes, ReactNode, useState, useRef, useEffect } from 'react';
import { Upload, X, Image as ImageIcon, Loader2, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

// --- HELPER: Compresión y Normalización de Imágenes ---
const compressImage = async (file: File): Promise<File> => {
  return new Promise((resolve) => {
    // Si no es imagen, retornar original
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    const img = new Image();
    const reader = new FileReader();

    // Si hay error leyendo, devolver archivo original sin comprimir
    reader.onerror = () => resolve(file);

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    img.onerror = () => resolve(file);

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        const MAX_WIDTH = 1000;
        const MAX_HEIGHT = 1000;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Intentar usar WEBP por defecto (soporta transparencia y es ligero)
        // Si no, usar PNG para preservar transparencia si el original la tenía
        const isTransparentFormat = ['image/png', 'image/webp', 'image/gif'].includes(file.type);
        const outputType = isTransparentFormat ? 'image/webp' : 'image/jpeg';
        const quality = 0.85;

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const extension = outputType.split('/')[1];
              const safeName = `img_${Date.now()}_${Math.floor(Math.random() * 1000)}.${extension}`;
              try {
                const newFile = new File([blob], safeName, {
                  type: outputType,
                  lastModified: Date.now(),
                });
                resolve(newFile);
              } catch (err) {
                resolve(file); // Fallback
              }
            } else {
              resolve(file);
            }
          },
          outputType,
          quality
        );
      } catch (e) {
        // En caso de cualquier error en canvas (ej. memoria), devolver original
        resolve(file);
      }
    };
    reader.readAsDataURL(file);
  });
};

// --- NUEVO COMPONENTE: LazyImage (UX Premium) ---
interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  aspectRatio?: 'square' | 'video' | 'portrait' | 'auto';
}

export const LazyImage: React.FC<LazyImageProps> = ({ src, alt, className = '', aspectRatio = 'square', ...props }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // Reset states if src changes
    setIsLoaded(false);
    setHasError(false);
  }, [src]);

  useEffect(() => {
    // Check immediate load state (critical for back navigation cache)
    if (imgRef.current && imgRef.current.complete) {
      if (imgRef.current.naturalWidth > 0) {
        setIsLoaded(true);
      }
    }
  }, []);

  const aspectClass =
    aspectRatio === 'square' ? 'aspect-square' :
      aspectRatio === 'video' ? 'aspect-video' :
        aspectRatio === 'portrait' ? 'aspect-[3/4]' : '';

  return (
    <div className={`relative overflow-hidden bg-gray-100 dark:bg-white/5 ${aspectClass} ${className}`}>
      {/* Skeleton Loader (Pulso) */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-white/10 animate-pulse z-10">
          <ImageIcon className="text-gray-300 dark:text-white/20 w-8 h-8" />
        </div>
      )}

      {/* Error State */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 dark:bg-white/5 text-gray-400 p-2 z-10">
          <AlertCircle size={24} className="mb-1 opacity-50" />
          <span className="text-[10px] font-bold uppercase text-center">Sin Imagen</span>
        </div>
      )}

      {/* Imagen Real con Fade-In */}
      {!hasError && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          className={`w-full h-full object-cover transition-all duration-700 ease-in-out ${isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
            }`}
          {...props}
        />
      )}
    </div>
  );
};

// iOS-style blurry button
export const Button = ({
  children,
  variant = 'primary',
  className = '',
  loading = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost', loading?: boolean }) => {

  const baseStyle = "active:scale-95 transition-all duration-200 ease-out font-medium rounded-2xl px-6 py-3 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-ios-blue text-white shadow-lg shadow-black/10 hover:brightness-110",
    secondary: "bg-white/50 dark:bg-white/10 backdrop-blur-md text-ios-text dark:text-white hover:bg-white/80 dark:hover:bg-white/20 border border-white/20 dark:border-white/5",
    danger: "bg-ios-red text-white hover:bg-red-600",
    ghost: "bg-transparent text-ios-blue hover:bg-ios-blue/10"
  };

  return (
    <button className={`${baseStyle} ${variants[variant]} ${className}`} disabled={loading} {...props}>
      {loading ? (
        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : null}
      {children}
    </button>
  );
};

export const Input = React.forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: string; icon?: ReactNode }>(
  ({ label, icon, className = '', ...props }, ref) => (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <label className="text-xs font-semibold text-ios-subtext uppercase tracking-wide ml-1">{label}</label>}
      <div className="relative">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-ios-subtext/70 pointer-events-none">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={`w-full bg-white/70 dark:bg-white/5 backdrop-blur-sm border border-transparent focus:border-ios-blue/50 focus:bg-white dark:focus:bg-zinc-800 focus:ring-4 focus:ring-ios-blue/10 rounded-2xl ${icon ? 'pl-11' : 'px-4'} py-3 outline-none transition-all duration-300 text-ios-text dark:text-white placeholder-ios-subtext/70 ${className}`}
          {...props}
        />
      </div>
    </div>
  )
);

interface ImageUploaderProps {
  label?: string;
  value: string;
  onChange: (url: string, file?: File) => void;
  className?: string;
  placeholder?: ReactNode;
  aspectRatio?: 'video' | 'square' | 'none';
  onFileUpload?: (file: File) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ label, value, onChange, className = '', placeholder, aspectRatio = 'video', onFileUpload }) => {
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file) return;

    // Validación básica de tipo
    if (!file.type.match(/^image\/(jpeg|png|gif|webp)$/)) {
      alert("Formato no soportado. Usa JPG, PNG, WEBP o GIF.");
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    setUploading(true);
    setProcessing(true);

    try {
      // Si se proporciona un manejador externo (ej: para recortar), lo usamos y detenemos el flujo automático
      if (onFileUpload) {
        onFileUpload(file);
        setUploading(false);
        setProcessing(false);
        return;
      }

      // Intentamos comprimir, si falla devuelve el original
      const fileToUpload = await compressImage(file);
      setProcessing(false);

      const url = await api.uploadImage(fileToUpload);
      onChange(url, fileToUpload);
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Error al subir la imagen. Intenta con otro archivo.");
    } finally {
      if (!onFileUpload) { // Solo limpiamos estados si no delegamos
        setUploading(false);
        setProcessing(false);
      }
      // SIEMPRE limpiar el input para permitir reintentos con el mismo archivo
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const aspectClass = aspectRatio === 'video' ? 'aspect-video' : aspectRatio === 'square' ? 'aspect-square' : '';

  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      {label && <label className="text-xs font-semibold text-ios-subtext uppercase tracking-wide ml-1">{label}</label>}

      <div
        className={`relative w-full rounded-2xl border-2 border-dashed transition-all overflow-hidden ${dragActive
          ? 'border-ios-blue bg-ios-blue/5'
          : 'border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5'
          } ${!label ? 'h-full' : ''}`}
        onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDrop={handleDrop}
      >
        {value ? (
          <div className={`relative group ${aspectClass} w-full h-full`}>
            <LazyImage src={value} alt="Uploaded" className="w-full h-full object-contain relative z-10" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-20">
              <button
                onClick={() => window.open(value, '_blank')}
                className="p-2 bg-white/20 backdrop-blur rounded-full text-white hover:bg-white/40"
                type="button"
              >
                <ImageIcon size={18} />
              </button>
              <button
                onClick={() => onChange('')}
                className="p-2 bg-red-500/80 backdrop-blur rounded-full text-white hover:bg-red-600"
                type="button"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => inputRef.current?.click()}
            className={`flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10 transition-colors h-full ${placeholder ? 'p-2' : 'py-8'}`}
          >
            {uploading ? (
              <div className="flex flex-col items-center">
                <Loader2 size={32} className="text-ios-blue animate-spin mb-2" />
                <p className="text-xs font-bold text-ios-blue">
                  {processing ? 'Optimizando...' : 'Subiendo...'}
                </p>
              </div>
            ) : (
              placeholder ? placeholder : (
                <>
                  <Upload size={32} className="text-gray-400 mb-2" />
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Click para subir
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Soporta JPG, PNG, WEBP (WhatsApp)
                  </p>
                </>
              )
            )}
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleChange}
        />
      </div>
    </div>
  );
};

interface CardProps {
  children?: ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => (
  <div onClick={onClick} className={`bg-white dark:bg-zinc-900 rounded-[2rem] shadow-sm border border-white/40 dark:border-white/5 overflow-hidden ${onClick ? 'cursor-pointer active:scale-[0.98] transition-transform duration-300' : ''} ${className}`}>
    {children}
  </div>
);

interface BadgeProps {
  children?: ReactNode;
  color?: 'blue' | 'green' | 'red' | 'gray';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, color = 'blue', className = '' }) => {
  const colors = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    red: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    gray: 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${colors[color]} ${className}`}>
      {children}
    </span>
  );
};