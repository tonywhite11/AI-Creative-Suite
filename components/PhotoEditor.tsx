
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AppTab, UploadedImage } from '../types';
import { editImage } from '../services/geminiService';
import ImageUpload from './ui/ImageUpload';
import Button from './ui/Button';
import Spinner from './ui/Spinner';
import Card from './ui/Card';

const artStyles = [
    { value: 'none', label: 'Default Style' },
    { value: 'impressionist', label: 'Impressionist' },
    { value: 'surreal', label: 'Surreal' },
    { value: 'cyberpunk', label: 'Cyberpunk' },
    { value: 'photorealistic', label: 'Photorealistic' },
    { value: 'anime', label: 'Anime' },
    { value: 'minimalist', label: 'Minimalist' },
];

const fontFamilies = [
    { value: 'Arial, sans-serif', label: 'Arial' },
    { value: 'Verdana, sans-serif', label: 'Verdana' },
    { value: 'Georgia, serif', label: 'Georgia' },
    { value: '"Courier New", monospace', label: 'Courier New' },
    { value: '"Brush Script MT", cursive', label: 'Brush Script' },
    { value: '"Impact", fantasy', label: 'Impact' },
];

interface PhotoEditorProps {
    exportedImage?: UploadedImage | null;
    onExportConsumed?: () => void;
    onExport?: (image: UploadedImage, targetTab: AppTab) => void;
}

const PhotoEditor: React.FC<PhotoEditorProps> = ({ exportedImage = null, onExportConsumed, onExport }) => {
    const [originalImages, setOriginalImages] = useState<(UploadedImage | null)[]>([null, null, null]);
    const [prompt, setPrompt] = useState<string>('Make the photo look more professional and vibrant.');
    const [artStyle, setArtStyle] = useState<string>('none');
    const [editedImage, setEditedImage] = useState<string | null>(null);
    const [generatedText, setGeneratedText] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isUpscaling, setIsUpscaling] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Canvas and text overlay state
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isTextOverlayEnabled, setIsTextOverlayEnabled] = useState<boolean>(false);
    const [overlayText, setOverlayText] = useState<string>('Your Text Here');
    const [fontFamily, setFontFamily] = useState<string>(fontFamilies[0].value);
    const [fontSize, setFontSize] = useState<number>(48);
    const [fontColor, setFontColor] = useState<string>('#FFFFFF');
    const [textPosition, setTextPosition] = useState<{ x: number, y: number }>({ x: 50, y: 50 });
    const [textShadow, setTextShadow] = useState<boolean>(true);


    const handleImageUpload = useCallback((image: UploadedImage, index: number) => {
        setOriginalImages(prev => {
            const newImages = [...prev];
            newImages[index] = image;
            return newImages;
        });
        setEditedImage(null);
        setGeneratedText(null);
        setError(null);
    }, []);

    const handleClearImage = (index: number) => {
        setOriginalImages(prev => {
            const newImages = [...prev];
            newImages[index] = null;
            return newImages;
        });
    };

    const handleClearEditedImage = () => {
        setEditedImage(null);
        setGeneratedText(null);
    };

    useEffect(() => {
        if (exportedImage && onExportConsumed) {
            const firstEmptyIndex = originalImages.findIndex(img => img === null);
            const indexToUpdate = firstEmptyIndex !== -1 ? firstEmptyIndex : 0;
            
            handleImageUpload(exportedImage, indexToUpdate);
            onExportConsumed();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [exportedImage, onExportConsumed, handleImageUpload, originalImages]);

    // Effect to draw image and text overlay onto the canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');

        if (!canvas || !ctx || !editedImage) {
            if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = editedImage;

        img.onload = () => {
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            ctx.drawImage(img, 0, 0);

            if (isTextOverlayEnabled && overlayText) {
                ctx.font = `${fontSize}px ${fontFamily}`;
                ctx.fillStyle = fontColor;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                const x = (canvas.width * textPosition.x) / 100;
                const y = (canvas.height * textPosition.y) / 100;

                if (textShadow) {
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
                    ctx.shadowBlur = 5;
                    ctx.shadowOffsetX = 2;
                    ctx.shadowOffsetY = 2;
                }

                ctx.fillText(overlayText, x, y);

                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
            }
        };

        img.onerror = () => {
            setError("Failed to load the edited image onto the canvas.");
        };

    }, [editedImage, isTextOverlayEnabled, overlayText, fontFamily, fontSize, fontColor, textPosition, textShadow]);


    const handleGenerate = async () => {
        const validImages = originalImages.filter((img): img is UploadedImage => img !== null);
        
        if (validImages.length === 0 || !prompt) {
            setError("Please upload at least one image and provide a prompt.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setEditedImage(null);
        setGeneratedText(null);

        try {
            const finalPrompt = artStyle === 'none' ? prompt : `${prompt}, in a ${artStyle} art style.`;
            const result = await editImage(validImages, finalPrompt);
            setEditedImage(result.imageUrl);
            setGeneratedText(result.text);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpscale = async () => {
        const canvas = canvasRef.current;
        if (!canvas) {
            setError("There is no edited image to upscale.");
            return;
        }

        setIsUpscaling(true);
        setError(null);

        try {
            const imageWithTextDataUrl = canvas.toDataURL('image/png');
            const match = imageWithTextDataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
            if (!match) {
                throw new Error("Could not parse the edited image data from the canvas.");
            }
            const [, mimeType, base64] = match;

            const imageToUpscale: UploadedImage = {
                base64,
                mimeType,
                name: 'upscale_source.png'
            };
            
            const upscalePrompt = "Upscale this image to a higher resolution. Sharpen details, improve clarity, and enhance textures without altering the subject or composition. Aim for a photorealistic, 4K quality look.";

            const result = await editImage([imageToUpscale], upscalePrompt);
            setEditedImage(result.imageUrl);
            setGeneratedText("Image successfully upscaled and enhanced.");

        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'An unknown error occurred during upscaling.');
        } finally {
            setIsUpscaling(false);
        }
    };
    
    const handleDownload = () => {
        const canvas = canvasRef.current;
        if (!canvas || !editedImage) return;

        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');

        const firstOriginal = originalImages.find(img => img !== null);
        const baseName = firstOriginal ? firstOriginal.name.split('.').slice(0, -1).join('.') : 'generated';

        link.download = `${baseName}-edited-final.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportClick = (targetTab: AppTab) => {
        const canvas = canvasRef.current;
        if (!canvas || !onExport) return;

        const imageWithTextDataUrl = canvas.toDataURL('image/png');
        const match = imageWithTextDataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
        if (!match) {
            setError("Could not parse image data from canvas for export.");
            return;
        }
        const [, mimeType, base64] = match;

        const firstOriginal = originalImages.find(img => img !== null);
        const baseName = firstOriginal ? firstOriginal.name.split('.').slice(0, -1).join('.') : 'generated';

        const imageToExport: UploadedImage = {
            base64,
            mimeType,
            name: `${baseName}-edited.png`
        };

        onExport(imageToExport, targetTab);
    };

    const firstOriginalImage = originalImages.find(img => img !== null);
    const hasUploadedImage = originalImages.some(img => img !== null);
    const isBusy = isLoading || isUpscaling;

    return (
        <div className="space-y-6 animate-fade-in">
            <Card>
                <div className="space-y-6">
                    <div>
                        <h3 className="text-xl font-semibold mb-3">1. Upload Your Images (up to 3)</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {[0, 1, 2].map(index => (
                                <ImageUpload 
                                    key={index} 
                                    onImageUpload={(image) => handleImageUpload(image, index)} 
                                    existingImage={originalImages[index]}
                                    onImageClear={() => handleClearImage(index)}
                                />
                            ))}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-xl font-semibold mb-3">2. Describe Your Edit & Choose a Style</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="e.g., add a futuristic city in the background"
                                className="w-full h-24 md:h-full p-3 bg-base-300 border border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none resize-none md:col-span-2"
                                disabled={isBusy}
                            />
                            <select
                                value={artStyle}
                                onChange={(e) => setArtStyle(e.target.value)}
                                className="w-full p-3 bg-base-300 border border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none"
                                disabled={isBusy}
                                aria-label="Select art style"
                            >
                                {artStyles.map(style => (
                                    <option key={style.value} value={style.value}>{style.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                     <div>
                        <h3 className="text-xl font-semibold mb-3">3. Add Text Overlay <span className="text-sm text-gray-400">(Optional)</span></h3>
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isTextOverlayEnabled}
                                onChange={(e) => setIsTextOverlayEnabled(e.target.checked)}
                                className="h-5 w-5 text-brand-primary bg-base-300 border-gray-600 rounded focus:ring-brand-primary"
                                disabled={isBusy || !editedImage}
                                aria-label="Enable text overlay"
                            />
                            <span className="text-content">Enable Text Overlay</span>
                        </label>
                        
                        {isTextOverlayEnabled && editedImage && (
                            <div className="mt-4 space-y-4 animate-fade-in">
                                <textarea
                                    value={overlayText}
                                    onChange={(e) => setOverlayText(e.target.value)}
                                    placeholder="Your text here"
                                    className="w-full h-20 p-3 bg-base-300 border border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none resize-none"
                                    disabled={isBusy}
                                />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                     <select
                                        value={fontFamily}
                                        onChange={(e) => setFontFamily(e.target.value)}
                                        className="w-full p-3 bg-base-300 border border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none"
                                        disabled={isBusy}
                                        aria-label="Select font family"
                                    >
                                        {fontFamilies.map(font => (
                                            <option key={font.value} value={font.value} style={{fontFamily: font.value}}>{font.label}</option>
                                        ))}
                                    </select>
                                    <div className="flex items-center gap-4">
                                        <input
                                            type="color"
                                            value={fontColor}
                                            onChange={(e) => setFontColor(e.target.value)}
                                            className="p-1 h-10 w-10 block bg-base-300 border border-gray-600 rounded-lg cursor-pointer"
                                            title="Select font color"
                                            disabled={isBusy}
                                        />
                                         <label className="flex items-center space-x-2 cursor-pointer text-sm">
                                            <input
                                                type="checkbox"
                                                checked={textShadow}
                                                onChange={(e) => setTextShadow(e.target.checked)}
                                                className="h-4 w-4 text-brand-primary bg-base-300 border-gray-600 rounded focus:ring-brand-primary"
                                                disabled={isBusy}
                                            />
                                            <span>Shadow</span>
                                        </label>
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="font-size" className="block text-sm font-medium text-gray-300 mb-2">
                                        Font Size: <span className="font-bold text-brand-light">{fontSize}px</span>
                                    </label>
                                    <input
                                        id="font-size" type="range" min="12" max="256" step="2" value={fontSize}
                                        onChange={(e) => setFontSize(Number(e.target.value))}
                                        className="w-full h-2 bg-base-300 rounded-lg appearance-none cursor-pointer accent-brand-primary"
                                        disabled={isBusy}
                                    />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="text-pos-x" className="block text-sm font-medium text-gray-300 mb-2">
                                            Horizontal Position: <span className="font-bold text-brand-light">{textPosition.x}%</span>
                                        </label>
                                        <input
                                            id="text-pos-x" type="range" min="0" max="100" value={textPosition.x}
                                            onChange={(e) => setTextPosition(pos => ({ ...pos, x: Number(e.target.value) }))}
                                            className="w-full h-2 bg-base-300 rounded-lg appearance-none cursor-pointer accent-brand-primary"
                                            disabled={isBusy}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="text-pos-y" className="block text-sm font-medium text-gray-300 mb-2">
                                            Vertical Position: <span className="font-bold text-brand-light">{textPosition.y}%</span>
                                        </label>
                                        <input
                                            id="text-pos-y" type="range" min="0" max="100" value={textPosition.y}
                                            onChange={(e) => setTextPosition(pos => ({ ...pos, y: Number(e.target.value) }))}
                                            className="w-full h-2 bg-base-300 rounded-lg appearance-none cursor-pointer accent-brand-primary"
                                            disabled={isBusy}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <Button onClick={handleGenerate} disabled={!hasUploadedImage || isBusy || !prompt} className="mt-4 w-full">
                        {isLoading ? <Spinner /> : '✨ Generate Edit'}
                    </Button>
                </div>
                {error && <p className="mt-4 text-center text-red-400">{error}</p>}
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <h3 className="text-xl font-semibold text-center mb-4">Original</h3>
                    <div className="aspect-square bg-base-200 rounded-lg flex items-center justify-center">
                        {firstOriginalImage ? (
                            <img src={`data:${firstOriginalImage.mimeType};base64,${firstOriginalImage.base64}`} alt="Original" className="max-h-full max-w-full object-contain rounded-lg" />
                        ) : (
                            <p className="text-gray-500">Your first uploaded photo will appear here</p>
                        )}
                    </div>
                </Card>
                <Card>
                     <div className="flex justify-center items-center mb-4 relative">
                        <h3 className="text-xl font-semibold text-center">Edited</h3>
                        {editedImage && !isBusy && (
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center">
                                <button
                                    onClick={handleDownload}
                                    className="p-2 rounded-md hover:bg-base-300 transition-colors duration-200"
                                    aria-label="Download edited image"
                                    title="Download"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                </button>
                                <button
                                    onClick={handleClearEditedImage}
                                    className="p-2 rounded-md hover:bg-base-300 transition-colors duration-200"
                                    aria-label="Clear edited image"
                                    title="Clear"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="aspect-square bg-base-200 rounded-lg flex items-center justify-center relative">
                        {isLoading ? (
                            <div className="w-full h-full bg-base-300 rounded-lg shimmer-bg animate-shimmer" />
                        ) : editedImage ? (
                             <>
                                <canvas 
                                    ref={canvasRef}
                                    className="max-h-full max-w-full object-contain rounded-lg animate-fade-in"
                                    aria-label="Edited image with text overlay"
                                />
                                {isUpscaling && (
                                    <div className="absolute inset-0 bg-base-100/70 flex flex-col items-center justify-center rounded-lg">
                                        <Spinner />
                                        <p className="mt-2 text-sm text-content">Upscaling...</p>
                                    </div>
                                )}
                            </>
                        ) : (
                            <p className="text-gray-500">Your AI-edited photo will appear here</p>
                        )}
                    </div>
                    {generatedText && <p className="mt-4 text-sm text-gray-400 italic text-center">AI Comment: "{generatedText}"</p>}
                    {editedImage && !isBusy && (
                         <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Button onClick={handleUpscale} disabled={isUpscaling} className="w-full text-sm">
                                {isUpscaling ? <Spinner /> : '🚀 Upscale & Enhance'}
                            </Button>
                             <Button onClick={() => handleExportClick(AppTab.Video)} disabled={isBusy} className="w-full text-sm">
                                🎥 Create Video
                            </Button>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};

export default PhotoEditor;
