
import React, { useState } from 'react';
import { generateImages, enhancePrompt } from '../services/geminiService';
import Button from './ui/Button';
import Spinner from './ui/Spinner';
import Card from './ui/Card';
import { UploadedImage, AppTab } from '../types';

const aspectRatios = [
    { value: '1:1', label: 'Square (1:1)' },
    { value: '16:9', label: 'Widescreen (16:9)' },
    { value: '9:16', label: 'Portrait (9:16)' },
    { value: '4:3', label: 'Landscape (4:3)' },
    { value: '3:4', label: 'Tall (3:4)' },
];

interface ImageGeneratorProps {
    onExport: (image: UploadedImage, targetTab: AppTab) => void;
}

const ImageGenerator: React.FC<ImageGeneratorProps> = ({ onExport }) => {
    const [prompt, setPrompt] = useState<string>('A photorealistic image of a majestic lion wearing a crown, cinematic lighting.');
    const [aspectRatio, setAspectRatio] = useState<string>('1:1');
    const [generatedImageData, setGeneratedImageData] = useState<UploadedImage | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isEnhancing, setIsEnhancing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!prompt) {
            setError("Please provide a prompt to generate an image.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setGeneratedImageData(null);

        try {
            const base64Image = await generateImages(prompt, aspectRatio);
            const newImage: UploadedImage = {
                base64: base64Image,
                mimeType: 'image/jpeg',
                name: `generated-${prompt.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}.jpeg`
            };
            setGeneratedImageData(newImage);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEnhancePrompt = async () => {
        if (!prompt) {
            setError("Please enter a prompt to enhance.");
            return;
        }
        setIsEnhancing(true);
        setError(null);
        try {
            const enhanced = await enhancePrompt(prompt);
            setPrompt(enhanced);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'An unknown error occurred.');
        } finally {
            setIsEnhancing(false);
        }
    };

    const handleSurpriseMe = async () => {
        setIsEnhancing(true);
        setError(null);
        setPrompt(''); // Clear existing prompt
        try {
            const surprise = await enhancePrompt();
            setPrompt(surprise);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'An unknown error occurred.');
        } finally {
            setIsEnhancing(false);
        }
    };

    const handleDownload = () => {
        if (!generatedImageData) return;

        const link = document.createElement('a');
        link.href = `data:${generatedImageData.mimeType};base64,${generatedImageData.base64}`;
        link.download = generatedImageData.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const handleExportClick = (targetTab: AppTab) => {
        if (generatedImageData) {
            onExport(generatedImageData, targetTab);
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
            <Card className="md:col-span-1">
                <div className="space-y-6">
                    <div>
                        <h3 className="text-xl font-semibold mb-3">1. Describe Your Vision</h3>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="e.g., A majestic lion wearing a crown..."
                            className="w-full h-36 p-3 bg-base-300 border border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none resize-none"
                            disabled={isLoading || isEnhancing}
                            aria-label="Image generation prompt"
                        />
                        <div className="mt-2 flex items-center justify-between gap-2">
                            <button
                                onClick={handleEnhancePrompt}
                                disabled={!prompt || isLoading || isEnhancing}
                                className="flex-1 text-sm px-3 py-2 font-semibold text-brand-light rounded-lg bg-base-300 hover:bg-opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-base-200 focus:ring-brand-primary transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isEnhancing && !isLoading ? <Spinner /> : '✨ Enhance Prompt'}
                            </button>
                            <button
                                onClick={handleSurpriseMe}
                                disabled={isLoading || isEnhancing}
                                className="flex-1 text-sm px-3 py-2 font-semibold text-brand-light rounded-lg bg-base-300 hover:bg-opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-base-200 focus:ring-brand-primary transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isEnhancing && !isLoading ? <Spinner /> : '🎁 Surprise Me'}
                            </button>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-xl font-semibold mb-3">2. Choose Aspect Ratio</h3>
                        <select
                            value={aspectRatio}
                            onChange={(e) => setAspectRatio(e.target.value)}
                            className="w-full p-3 bg-base-300 border border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none"
                            disabled={isLoading || isEnhancing}
                            aria-label="Select aspect ratio"
                        >
                            {aspectRatios.map(ratio => (
                                <option key={ratio.value} value={ratio.value}>{ratio.label}</option>
                            ))}
                        </select>
                    </div>

                    <Button onClick={handleGenerate} disabled={isLoading || isEnhancing || !prompt} className="w-full">
                        {isLoading ? <Spinner /> : '🎨 Generate Image'}
                    </Button>
                    
                    {error && <p className="mt-4 text-center text-red-400">{error}</p>}
                </div>
            </Card>

            <Card className="md:col-span-1">
                <div className="flex justify-center items-center mb-4 relative">
                    <h3 className="text-xl font-semibold text-center">Generated Image</h3>
                    {generatedImageData && !isLoading && (
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center">
                            <button
                                onClick={handleDownload}
                                className="p-2 rounded-md hover:bg-base-300 transition-colors duration-200"
                                aria-label="Download generated image"
                                title="Download"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                            </button>
                            <button
                                onClick={() => setGeneratedImageData(null)}
                                className="p-2 rounded-md hover:bg-base-300 transition-colors duration-200"
                                aria-label="Clear generated image"
                                title="Clear"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    )}
                </div>
                <div className="aspect-square bg-base-200 rounded-lg flex items-center justify-center">
                    {isLoading ? (
                        <div className="w-full h-full bg-base-300 rounded-lg shimmer-bg animate-shimmer" />
                    ) : generatedImageData ? (
                        <img src={`data:${generatedImageData.mimeType};base64,${generatedImageData.base64}`} alt="Generated by AI" className="max-h-full max-w-full object-contain rounded-lg animate-fade-in" />
                    ) : (
                        <p className="text-gray-500 text-center">Your AI-generated image will appear here</p>
                    )}
                </div>
                {generatedImageData && !isLoading && (
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
                        <Button onClick={() => handleExportClick(AppTab.Photo)} className="text-sm">
                            🖌️ Edit Photo
                        </Button>
                        <Button onClick={() => handleExportClick(AppTab.Video)} className="text-sm">
                            🎥 Create Video
                        </Button>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default ImageGenerator;
