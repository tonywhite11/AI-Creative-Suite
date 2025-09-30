import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UploadedImage } from '../types';
import { generateVideo } from '../services/geminiService';
import ImageUpload from './ui/ImageUpload';
import Button from './ui/Button';
import Spinner from './ui/Spinner';
import Card from './ui/Card';

const loadingMessages = [
    "Warming up the AI's creative engine...",
    "Analyzing pixels and possibilities...",
    "Choreographing digital actors...",
    "Rendering scene by scene...",
    "This can take a few minutes. Great art needs patience!",
    "Almost there, adding the final touches...",
];

const videoStyles = [
    { value: 'cinematic', label: 'Cinematic' },
    { value: 'documentary', label: 'Documentary' },
    { value: 'animation', label: 'Animation' },
    { value: 'vintage', label: 'Vintage Film' },
    { value: 'time-lapse', label: 'Time-lapse' },
    { value: 'slow-motion', label: 'Slow Motion' },
];

const videoModels = [
    { value: 'veo-2.0-generate-001', label: 'Veo 2' },
    { value: 'veo-3.0-generate-001', label: 'Veo 3 (Experimental)' },
];

interface VideoGeneratorProps {
    exportedImage?: UploadedImage | null;
    onExportConsumed?: () => void;
}

const VideoGenerator: React.FC<VideoGeneratorProps> = ({ exportedImage = null, onExportConsumed }) => {
    const [sourceImages, setSourceImages] = useState<(UploadedImage | null)[]>([null, null, null]);
    const [prompt, setPrompt] = useState<string>('Animate this image with a gentle breeze blowing.');
    const [videoStyle, setVideoStyle] = useState<string>('cinematic');
    const [videoModel, setVideoModel] = useState<string>(videoModels[0].value);
    const [videoDuration, setVideoDuration] = useState<number>(5);
    const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [loadingMessage, setLoadingMessage] = useState<string>(loadingMessages[0]);
    const intervalRef = useRef<number | null>(null);

    useEffect(() => {
        if (isLoading) {
            intervalRef.current = window.setInterval(() => {
                setLoadingMessage(prev => {
                    const currentIndex = loadingMessages.indexOf(prev);
                    const nextIndex = (currentIndex + 1) % loadingMessages.length;
                    return loadingMessages[nextIndex];
                });
            }, 4000);
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isLoading]);

    const handleImageUpload = useCallback((image: UploadedImage, index: number) => {
        setSourceImages(prev => {
            const newImages = [...prev];
            newImages[index] = image;
            return newImages;
        });
        setGeneratedVideoUrl(null);
        setError(null);
    }, []);

    const handleClearImage = (index: number) => {
        setSourceImages(prev => {
            const newImages = [...prev];
            newImages[index] = null;
            return newImages;
        });
        setGeneratedVideoUrl(null);
    };

    useEffect(() => {
        if (exportedImage && onExportConsumed) {
            const firstEmptyIndex = sourceImages.findIndex(img => img === null);
            const indexToUpdate = firstEmptyIndex !== -1 ? firstEmptyIndex : 0;
            
            handleImageUpload(exportedImage, indexToUpdate);
            onExportConsumed();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [exportedImage, onExportConsumed, handleImageUpload, sourceImages]);


    const handleGenerate = async () => {
        const firstImage = sourceImages.find(img => img !== null);

        if (!firstImage || !prompt) {
            setError("Please upload at least one image and provide a prompt.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setGeneratedVideoUrl(null);
        setLoadingMessage(loadingMessages[0]);

        try {
            const finalPrompt = `${prompt}, in a ${videoStyle} style.`;
            const url = await generateVideo(firstImage.base64, firstImage.mimeType, finalPrompt, videoDuration, videoModel);
            setGeneratedVideoUrl(url);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadVideo = () => {
        if (!generatedVideoUrl) return;

        const link = document.createElement('a');
        link.href = generatedVideoUrl;

        const firstImage = sourceImages.find(img => img !== null);
        const baseName = firstImage ? firstImage.name.split('.').slice(0, -1).join('.') : 'generated-video';
        
        link.download = `${baseName}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const hasUploadedImage = sourceImages.some(img => img !== null);

    return (
        <div className="space-y-6 animate-fade-in">
            <Card>
                <div className="space-y-6">
                    <div>
                        <h3 className="text-xl font-semibold mb-3">1. Upload Source Images (up to 3)</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                             {[0, 1, 2].map(index => (
                                <ImageUpload 
                                    key={index} 
                                    onImageUpload={(image) => handleImageUpload(image, index)} 
                                    existingImage={sourceImages[index]}
                                    onImageClear={() => handleClearImage(index)}
                                />
                            ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-2 text-center">Note: The first uploaded image will be the primary subject for the video generation.</p>
                    </div>
                    <div>
                        <h3 className="text-xl font-semibold mb-3">2. Describe the Video & Choose a Style</h3>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="e.g., a bustling city scene with flying cars"
                            className="w-full h-24 p-3 bg-base-300 border border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none resize-none"
                            disabled={isLoading}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <select
                                value={videoStyle}
                                onChange={(e) => setVideoStyle(e.target.value)}
                                className="w-full p-3 bg-base-300 border border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none"
                                disabled={isLoading}
                                aria-label="Select video style"
                            >
                                {videoStyles.map(style => (
                                    <option key={style.value} value={style.value}>{style.label}</option>
                                ))}
                            </select>
                             <select
                                value={videoModel}
                                onChange={(e) => setVideoModel(e.target.value)}
                                className="w-full p-3 bg-base-300 border border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none"
                                disabled={isLoading}
                                aria-label="Select video model"
                            >
                                {videoModels.map(model => (
                                    <option key={model.value} value={model.value}>{model.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="mt-4">
                            <label htmlFor="video-duration" className="block text-sm font-medium text-gray-300 mb-2">
                                Video Duration: <span className="font-bold text-brand-light">{videoDuration}s</span>
                            </label>
                            <input
                                id="video-duration"
                                type="range"
                                min="3"
                                max="8"
                                step="1"
                                value={videoDuration}
                                onChange={(e) => setVideoDuration(Number(e.target.value))}
                                className="w-full h-2 bg-base-300 rounded-lg appearance-none cursor-pointer accent-brand-primary"
                                disabled={isLoading}
                                aria-label="Select video duration"
                            />
                        </div>
                        <Button onClick={handleGenerate} disabled={!hasUploadedImage || isLoading || !prompt} className="mt-6 w-full">
                            {isLoading ? <Spinner /> : '🎬 Generate Video'}
                        </Button>
                    </div>
                </div>
                 {error && <p className="mt-4 text-center text-red-400">{error}</p>}
            </Card>

            <Card>
                <div className="flex justify-center items-center mb-4 relative">
                    <h3 className="text-xl font-semibold text-center">Generated Video</h3>
                    {generatedVideoUrl && !isLoading && (
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center">
                            <button
                                onClick={handleDownloadVideo}
                                className="p-2 rounded-md hover:bg-base-300 transition-colors"
                                aria-label="Download video"
                                title="Download"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                            </button>
                            <button
                                onClick={() => setGeneratedVideoUrl(null)}
                                className="p-2 rounded-md hover:bg-base-300 transition-colors"
                                aria-label="Clear video"
                                title="Clear"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    )}
                </div>
                <div className="aspect-video bg-base-200 rounded-lg flex items-center justify-center overflow-hidden">
                    {isLoading ? (
                        <div className="text-center">
                            <Spinner />
                            <p className="mt-4 text-lg text-gray-400">{loadingMessage}</p>
                        </div>
                    ) : generatedVideoUrl ? (
                        <video src={generatedVideoUrl} controls autoPlay loop className="w-full h-full object-contain animate-fade-in" />
                    ) : (
                        <p className="text-gray-500">Your AI-generated video will appear here</p>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default VideoGenerator;