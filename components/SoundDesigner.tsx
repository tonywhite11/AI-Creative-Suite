import React, { useState, useRef, useCallback } from 'react';
import { AppTab } from '../types';
import { analyzeVideoForSound, VideoAnalysisResult, suggestDialogue } from '../services/geminiService';
import Card from './ui/Card';
import Button from './ui/Button';
import Spinner from './ui/Spinner';

const MAX_FRAMES = 16;
const FRAME_CAPTURE_INTERVAL = 1; // seconds

interface SoundDesignerProps {
    onExport: (prompt: string, targetTab: AppTab) => void;
}

const SoundDesigner: React.FC<SoundDesignerProps> = ({ onExport }) => {
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [videoPreview, setVideoPreview] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<VideoAnalysisResult | null>(null);
    const [progress, setProgress] = useState(0);
    const [capturedFrames, setCapturedFrames] = useState<string[]>([]);
    const [suggestedDialogue, setSuggestedDialogue] = useState<string | null>(null);
    const [isSuggestingDialogue, setIsSuggestingDialogue] = useState<boolean>(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.type.startsWith('video/')) {
            setVideoFile(file);
            const url = URL.createObjectURL(file);
            setVideoPreview(url);
            setAnalysisResult(null);
            setCapturedFrames([]);
            setSuggestedDialogue(null);
            setError(null);
        } else {
            setError('Please select a valid video file.');
        }
    };

    const handleClearVideo = () => {
        if (videoPreview) {
            URL.revokeObjectURL(videoPreview);
        }
        setVideoFile(null);
        setVideoPreview(null);
        setAnalysisResult(null);
        setCapturedFrames([]);
        setSuggestedDialogue(null);
        setError(null);
        if (inputRef.current) {
            inputRef.current.value = "";
        }
    };

    const captureFrames = useCallback((): Promise<string[]> => {
        return new Promise((resolve, reject) => {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (!video || !canvas) {
                return reject(new Error("Video or canvas element not found."));
            }

            const frames: string[] = [];
            video.currentTime = 0;
            let captureCount = 0;

            video.onseeked = () => {
                if (captureCount < MAX_FRAMES && video.currentTime < video.duration) {
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
                        // Get base64 data URL and remove the data URL prefix
                        const base64Data = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
                        frames.push(base64Data);
                        setProgress(Math.round(((captureCount + 1) / MAX_FRAMES) * 100));
                    }
                    captureCount++;
                    video.currentTime += FRAME_CAPTURE_INTERVAL;
                } else {
                    video.onseeked = null; // Clean up listener
                    video.onloadeddata = null;
                    resolve(frames);
                }
            };

             video.onloadeddata = () => {
                video.currentTime = 0.1; // Start seeking
            };

            // If video is already loaded, trigger the process
            if (video.readyState >= 2) {
                video.onloadeddata = null;
                video.currentTime = 0.1;
            }
        });
    }, []);

    const handleAnalyze = async () => {
        if (!videoFile) {
            setError("Please upload a video first.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setAnalysisResult(null);
        setSuggestedDialogue(null);
        setProgress(0);

        try {
            const frames = await captureFrames();
            if (frames.length === 0) {
                throw new Error("Could not capture any frames from the video.");
            }
            setCapturedFrames(frames);
            const result = await analyzeVideoForSound(frames);
            setAnalysisResult(result);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'An unknown error occurred during analysis.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSuggestDialogue = async () => {
        if (capturedFrames.length === 0) {
            setError("No video frames available. Please analyze the video first.");
            return;
        }
        setIsSuggestingDialogue(true);
        setSuggestedDialogue(null);
        setError(null);
        try {
            const dialogue = await suggestDialogue(capturedFrames);
            setSuggestedDialogue(dialogue);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'An unknown error occurred while suggesting dialogue.');
        } finally {
            setIsSuggestingDialogue(false);
        }
    };
    
    const handleExport = () => {
        if (analysisResult) {
            onExport(analysisResult.musicPrompt, AppTab.Music);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
            <Card>
                <div className="space-y-6">
                    <div>
                        <h3 className="text-xl font-semibold mb-3">1. Upload Your Video</h3>
                        <div className="w-full aspect-video border-2 border-dashed rounded-lg flex flex-col items-center justify-center bg-base-300 relative overflow-hidden">
                            {videoPreview ? (
                                <>
                                    <video
                                        ref={videoRef}
                                        src={videoPreview}
                                        className="max-h-full max-w-full"
                                        muted
                                        playsInline
                                    />
                                    <button
                                        onClick={handleClearVideo}
                                        className="absolute top-2 right-2 z-10 p-1.5 bg-black/50 rounded-full text-white hover:bg-black/75 transition-colors"
                                        aria-label="Clear video"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </>
                            ) : (
                                <div className="text-center text-gray-500 p-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    <p className="mt-2 font-semibold">Upload a video to begin</p>
                                    <p className="text-xs">MP4, MOV, WEBM</p>
                                </div>
                            )}
                        </div>
                         <Button onClick={() => inputRef.current?.click()} disabled={isLoading} className="w-full mt-4">
                            {videoFile ? 'Change Video' : 'Select Video'}
                        </Button>
                        <input
                            ref={inputRef}
                            type="file"
                            className="sr-only"
                            accept="video/mp4,video/webm,video/quicktime"
                            onChange={handleFileChange}
                        />
                        <canvas ref={canvasRef} className="hidden"></canvas>
                    </div>

                    <Button onClick={handleAnalyze} disabled={isLoading || !videoFile} className="w-full">
                        {isLoading ? <Spinner /> : '🎬 Analyze Video & Design Sound'}
                    </Button>

                    {error && <p className="mt-4 text-center text-red-400">{error}</p>}

                    {isLoading && (
                        <div className="space-y-3 text-center">
                            <p className="text-lg text-gray-400">Analyzing video frames...</p>
                            <div className="w-full bg-base-100 rounded-full h-2.5">
                                <div className="bg-brand-primary h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            {analysisResult && !isLoading && (
                <Card className="animate-fade-in">
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-2xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-brand-primary to-brand-secondary mb-4">
                                AI Analysis Complete
                            </h3>
                        </div>
                        <div>
                            <h4 className="text-xl font-semibold mb-2">Scene Description</h4>
                            <p className="p-4 bg-base-300 rounded-lg text-gray-300 italic">
                                {analysisResult.sceneDescription}
                            </p>
                        </div>
                        
                        <div className="border-t border-base-300"></div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="text-xl font-semibold">Dialogue / Narration</h4>
                                <Button onClick={handleSuggestDialogue} disabled={isSuggestingDialogue || isLoading} className="text-sm !py-2 !px-4">
                                    {isSuggestingDialogue ? <Spinner /> : '💡 Suggest Dialogue'}
                                </Button>
                            </div>
                            <div className="p-4 bg-base-300 rounded-lg min-h-[8rem] flex items-center justify-center">
                                {isSuggestingDialogue ? (
                                    <Spinner />
                                ) : suggestedDialogue ? (
                                    <p className="text-gray-300 italic whitespace-pre-wrap">{suggestedDialogue}</p>
                                ) : (
                                    <p className="text-gray-500 text-center">Click "Suggest Dialogue" to get ideas for your scene.</p>
                                )}
                            </div>
                        </div>

                        <div className="border-t border-base-300"></div>

                        <div>
                            <h4 className="text-xl font-semibold mb-2">Suggested Music Prompt</h4>
                            <textarea
                                value={analysisResult.musicPrompt}
                                // Allow user to edit the prompt if they wish
                                onChange={(e) => setAnalysisResult(prev => prev ? { ...prev, musicPrompt: e.target.value } : null)}
                                className="w-full h-36 p-4 bg-base-300 border border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none resize-y"
                            />
                        </div>
                        <Button onClick={handleExport} className="w-full">
                            🎵 Send to Music Generator
                        </Button>
                    </div>
                </Card>
            )}
        </div>
    );
};

export default SoundDesigner;
