
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

        // Usamos el tamaño del crop como tamaño del canvas final
        canvas.width = pixelCrop.width;
        canvas.height = pixelCrop.height;

        // Rellenar fondo blanco (para cuando la imagen es más pequeña que el cuadro)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Calcular posición relativa y dibujo
        // Cuando restrictPosition=false, x/y pueden ser negativos (imagen movida a la derecha/abajo)
        // O positivos mayores al tamaño (imagen movida a la izquierda/arriba fuera del canvas, aunque esto no suele pasar si no se sale)

        // La librería nos da pixelCrop.x/y relativos a la imagen original, 
        // pero necesitamos dibujar la imagen EN EL CANVAS.
        // La lógica correcta para 'acomodar' es compleja con react-easy-crop estándar, 
        // pero podemos usar una aproximación simple: dibujar la imagen completa transformada.

        // SIN EMBARGO, pixelCrop son las coordenadas DE LA IMAGEN que corresponden al top-left del crop area.
        // Si pixelCrop.x es negativo, significa que el crop area empieza "antes" de la imagen (hay vacío a la izquierda).
        // Entonces debemos dibujar la imagen en el canvas desplazada hacia la derecha por -pixelCrop.x

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
            }, 'image/jpeg', 0.95);
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
