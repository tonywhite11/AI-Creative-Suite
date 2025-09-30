
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { UploadedImage } from '../../types';

interface ImageUploadProps {
    onImageUpload: (image: UploadedImage) => void;
    existingImage?: UploadedImage | null;
    onImageClear?: () => void;
}

const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]); // remove the "data:mime/type;base64," part
        };
        reader.onerror = (error) => reject(error);
    });


const ImageUpload: React.FC<ImageUploadProps> = ({ onImageUpload, existingImage = null, onImageClear }) => {
    const [preview, setPreview] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Effect to display an externally provided image
    useEffect(() => {
        if (existingImage) {
            const dataUrl = `data:${existingImage.mimeType};base64,${existingImage.base64}`;
            setPreview(dataUrl);
            setFileName(existingImage.name);
        } else {
             if (preview && preview.startsWith('blob:')) {
                URL.revokeObjectURL(preview);
            }
            setPreview(null);
            setFileName(null);
        }
    }, [existingImage]);


    // Clean up object URLs to prevent memory leaks
    useEffect(() => {
        return () => {
            if (preview && preview.startsWith('blob:')) {
                URL.revokeObjectURL(preview);
            }
        };
    }, [preview]);

    const processFile = useCallback(async (file: File) => {
        if (!file || !file.type.startsWith('image/')) {
            console.error("Invalid file type. Please upload an image.");
            // TODO: Provide user feedback for invalid file type
            return;
        }

        try {
            const base64 = await fileToBase64(file);
            // Revoke previous blob URL if it exists
            if (preview && preview.startsWith('blob:')) {
                URL.revokeObjectURL(preview);
            }
            setPreview(URL.createObjectURL(file));
            setFileName(file.name);
            onImageUpload({
                base64,
                mimeType: file.type,
                name: file.name
            });
        } catch (error) {
            console.error("Error processing file", error);
        }
    }, [onImageUpload, preview]);

    const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            await processFile(file);
            // Reset the input value to allow uploading the same file again
            if (inputRef.current) {
                inputRef.current.value = "";
            }
        }
    }, [processFile]);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDragIn = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDragging(true);
        }
    }, []);

    const handleDragOut = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) {
           await processFile(file);
        }
    }, [processFile]);

    const handleClick = () => {
        inputRef.current?.click();
    };

    const handleClearClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        if (onImageClear) {
            onImageClear();
        }
    };

    return (
        <div className="w-full">
            <div 
                role="button"
                tabIndex={0}
                aria-label="Upload an image by clicking or dragging and dropping"
                className={`relative w-full aspect-video border-2 border-dashed rounded-lg flex flex-col items-center justify-center hover:border-brand-primary transition-all duration-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-base-200 focus:ring-brand-primary ${isDragging ? 'border-brand-primary bg-brand-primary/10' : 'border-gray-600'}`}
                onClick={handleClick}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
                onDrop={handleDrop}
                onDragOver={handleDrag}
                onDragEnter={handleDragIn}
                onDragLeave={handleDragOut}
            >
                {preview && onImageClear && (
                    <button
                        onClick={handleClearClick}
                        className="absolute top-2 right-2 z-10 p-1 bg-black/50 rounded-full text-white hover:bg-black/75 transition-colors"
                        aria-label="Clear image"
                        title="Clear image"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
                {preview ? (
                    <img src={preview} alt="Preview" className="w-full h-full object-contain rounded-lg p-1" />
                ) : (
                    <div className="text-center text-gray-500 p-4 pointer-events-none">
                         <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="mt-2">Click or drag & drop</p>
                        <p className="text-xs">PNG, JPG, WEBP</p>
                    </div>
                )}
                 {isDragging && (
                    <div className="absolute inset-0 bg-base-100/70 flex items-center justify-center rounded-lg pointer-events-none">
                        <p className="text-lg font-semibold text-white">Drop image to upload</p>
                    </div>
                )}
            </div>
            
            <input 
                ref={inputRef}
                type="file" 
                className="sr-only" 
                accept="image/png, image/jpeg, image/webp" 
                onChange={handleFileChange} 
            />
            {fileName && <p className="text-sm text-center text-gray-400 mt-2 truncate">{fileName}</p>}
        </div>
    );
};

export default ImageUpload;
