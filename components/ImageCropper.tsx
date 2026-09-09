
import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Button } from './UIComponents';
import { type Area } from 'react-easy-crop';
import { X, Check } from 'lucide-react';

interface ImageCropperProps {
    imageSrc: string;
    onCropComplete: (croppedImage: Blob) => void;
    onCancel: () => void;
    aspectRatio?: number;
}

export const ImageCropper: React.FC<ImageCropperProps> = ({ imageSrc, onCropComplete, onCancel, aspectRatio = 1 }) => {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

    const onCropChange = (crop: { x: number; y: number }) => {
        setCrop(crop);
    };

    const onZoomChange = (zoom: number) => {
        setZoom(zoom);
    };

    const onCropCompleteHandler = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const createImage = (url: string): Promise<HTMLImageElement> =>
        new Promise((resolve, reject) => {
            const image = new Image();
            image.addEventListener('load', () => resolve(image));
            image.addEventListener('error', (error) => reject(error));
            image.setAttribute('crossOrigin', 'anonymous');
            image.src = url;
        });

    const getCroppedImg = async (imageSrc: string, pixelCrop: Area): Promise<Blob> => {
        const image = await createImage(imageSrc);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            throw new Error('No 2d context');
        }

        // Blindaje de resolución: limitar a un máximo de 1200px para garantizar ultra alta definición
        // sin generar archivos pesados que ralenticen la web o superen límites de PHP
        const MAX_DIMENSION = 1200;
        let targetWidth = pixelCrop.width;
        let targetHeight = pixelCrop.height;

        if (targetWidth > MAX_DIMENSION || targetHeight > MAX_DIMENSION) {
            if (targetWidth >= targetHeight) {
                targetHeight = Math.round((targetHeight * MAX_DIMENSION) / targetWidth);
                targetWidth = MAX_DIMENSION;
            } else {
                targetWidth = Math.round((targetWidth * MAX_DIMENSION) / targetHeight);
                targetHeight = MAX_DIMENSION;
            }
        }

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        // Rellenar fondo blanco (para áreas fuera de la imagen)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        // Suavizado e interpolación de alta calidad
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Escalar contexto si el tamaño objetivo es menor al crop original
        const scaleX = targetWidth / pixelCrop.width;
        const scaleY = targetHeight / pixelCrop.height;
        ctx.scale(scaleX, scaleY);

        const drawX = -pixelCrop.x;
        const drawY = -pixelCrop.y;

        ctx.drawImage(image, drawX, drawY);

        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Canvas is empty'));
                    return;
                }
                resolve(blob);
            }, 'image/jpeg', 0.88); // 88% de calidad para balance óptimo de nitidez y peso liviano (~150-250KB)
        });
    };

    const handleSave = async () => {
        if (croppedAreaPixels) {
            try {
                const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
                onCropComplete(croppedImage);
            } catch (e) {
                console.error(e);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col">
            <div className="relative flex-1 bg-black">
                <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    aspect={aspectRatio}
                    onCropChange={onCropChange}
                    onZoomChange={onZoomChange}
                    onCropComplete={onCropCompleteHandler}
                    restrictPosition={false} // PERMITIR MOVER LA IMAGEN FUERA DEL ÁREA => RELLENO BLANCO
                    minZoom={0.5} // PERMITIR ALEJAR
                    objectFit="contain"
                    style={{
                        containerStyle: { background: '#000' },
                        mediaStyle: { background: '#fff' } // Para ver los bordes de la imagen
                    }}
                />
            </div>

            <div className="p-4 bg-white dark:bg-zinc-900 flex flex-col gap-4">
                <div className="flex items-center gap-4">
                    <span className="text-xs font-bold text-gray-500">Zoom / Acomodar</span>
                    <input
                        type="range"
                        value={zoom}
                        min={0.5}
                        max={3}
                        step={0.1}
                        aria-labelledby="Zoom"
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                    />
                </div>

                <div className="flex gap-3 justify-end">
                    <Button variant="secondary" onClick={onCancel} className="gap-2">
                        <X size={16} /> Cancelar
                    </Button>
                    <Button onClick={handleSave} className="bg-ios-blue text-white gap-2">
                        <Check size={16} /> Guardar Imagen
                    </Button>
                </div>
            </div>
        </div>
    );
};
