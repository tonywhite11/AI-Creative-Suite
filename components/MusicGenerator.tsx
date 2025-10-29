import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { enhanceMusicPrompt } from '../services/geminiService';
import Button from './ui/Button';
import Card from './ui/Card';
import Spinner from './ui/Spinner';
import Slider from './ui/Slider';

type Status = 'idle' | 'generating' | 'generated' | 'error';

interface GenrePreset {
    name: string;
    prompt: string;
    bpm: number;
    temperature: number;
}

const genres: GenrePreset[] = [
    { 
        name: 'Techno', 
        prompt: 'Minimal techno with deep bass, sparse percussion, and atmospheric synths, 4/4 beat',
        bpm: 125,
        temperature: 0.9,
    },
    { 
        name: 'Ambient', 
        prompt: 'Lush ambient soundscape with evolving pads, gentle drones, and no percussion',
        bpm: 70,
        temperature: 0.7,
    },
    {
        name: 'Classical',
        prompt: 'Emotional classical piece with piano and strings, melancholic and beautiful',
        bpm: 80,
        temperature: 0.8,
    },
    {
        name: 'Jazz',
        prompt: 'Smoky late-night jazz club, upright bass, gentle piano chords, and a soft saxophone solo',
        bpm: 90,
        temperature: 1.1,
    },
    {
        name: 'Hip Hop',
        prompt: 'Classic boom-bap hip hop beat with a prominent bassline, crisp snares, and a sampled melody, 90s style',
        bpm: 95,
        temperature: 1.0,
    },
    {
        name: 'R&B',
        prompt: 'Smooth, soulful R&B track with electric piano, a deep bass groove, and modern trap-style hi-hats',
        bpm: 110,
        temperature: 0.9,
    },
    {
        name: 'Rock',
        prompt: 'Driving alternative rock song with distorted electric guitars, a powerful drum beat, and an anthemic chorus feel',
        bpm: 130,
        temperature: 1.2,
    },
    {
        name: 'Pop',
        prompt: 'Upbeat, catchy synth-pop track with a four-on-the-floor beat, bright synthesizers, and an infectious melody line',
        bpm: 120,
        temperature: 1.0,
    },
    {
        name: 'Country',
        prompt: 'Modern country pop song with acoustic guitar strumming, a steady drum beat, slide guitar licks, and a heartfelt mood',
        bpm: 115,
        temperature: 0.8,
    }
];


// Helper function to decode base64 string to Uint8Array
const decode = (base64: string): Uint8Array => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
};

// Helper function to create a WAV file buffer from raw PCM data.
const createWavBuffer = (pcmData: Uint8Array, sampleRate: number, numChannels: number, bitsPerSample: number): ArrayBuffer => {
    const dataLength = pcmData.length;
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);

    const writeString = (view: DataView, offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');
    // "fmt " sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Sub-chunk size
    view.setUint16(20, 1, true); // Audio format (1 for PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true); // Byte rate
    view.setUint16(32, numChannels * (bitsPerSample / 8), true); // Block align
    view.setUint16(34, bitsPerSample, true);
    // "data" sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    // Write PCM data
    for (let i = 0; i < pcmData.length; i++) {
        view.setUint8(44 + i, pcmData[i]);
    }

    return buffer;
};

const loadingMessages = [
    "Tuning the synths...",
    "Composing the melody...",
    "Laying down the beat...",
    "Harmonizing the chords...",
    "Mixing the final track...",
    "Adding a touch of magic...",
];

type VisualizerType = 'combined' | 'bars' | 'wave';
type ColorScheme = 'default' | 'sunset' | 'ocean' | 'mono';

interface MusicGeneratorProps {
    exportedMusicPrompt?: string | null;
    onExportConsumed?: () => void;
}

const MusicGenerator: React.FC<MusicGeneratorProps> = ({ exportedMusicPrompt, onExportConsumed }) => {
    const [prompt, setPrompt] = useState(genres[0].prompt);
    const [bpm, setBpm] = useState(genres[0].bpm);
    const [temperature, setTemperature] = useState(genres[0].temperature);
    const [duration, setDuration] = useState(30);
    const [status, setStatus] = useState<Status>('idle');
    const [error, setError] = useState<string | null>(null);
    const [generatedAudioBlob, setGeneratedAudioBlob] = useState<Blob | null>(null);
    const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);

    // New state for progress UI
    const [progress, setProgress] = useState(0);
    const [loadingMessage, setLoadingMessage] = useState(loadingMessages[0]);
    
    const sessionRef = useRef<any>(null);
    const generationTimeoutRef = useRef<number | null>(null);
    const progressIntervalRef = useRef<number | null>(null);
    const messageIntervalRef = useRef<number | null>(null);
    const generationStartRef = useRef<number | null>(null);

    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserNodeRef = useRef<AnalyserNode | null>(null);
    const audioElRef = useRef<HTMLAudioElement>(null);
    const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
    const [isAudioPlaying, setIsAudioPlaying] = useState(false);

    // State for visualizer controls
    const [visualizerType, setVisualizerType] = useState<VisualizerType>('combined');
    const [colorScheme, setColorScheme] = useState<ColorScheme>('default');
    const [sensitivity, setSensitivity] = useState(0.8);

    const isGenerating = status === 'generating';
    const isBusy = isGenerating || isEnhancingPrompt;
    
    useEffect(() => {
        if (exportedMusicPrompt && onExportConsumed) {
            setPrompt(exportedMusicPrompt);
            onExportConsumed();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [exportedMusicPrompt, onExportConsumed]);


    const handleGenreSelect = (genre: GenrePreset) => {
        setPrompt(genre.prompt);
        setBpm(genre.bpm);
        setTemperature(genre.temperature);
    };

    const cleanupGenerationIntervals = useCallback(() => {
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
        }
        if (messageIntervalRef.current) {
            clearInterval(messageIntervalRef.current);
            messageIntervalRef.current = null;
        }
        generationStartRef.current = null;
    }, []);
    
    const handleEnhancePrompt = async () => {
        if (!prompt) {
            setError("Please enter a prompt to enhance.");
            return;
        }
        setIsEnhancingPrompt(true);
        setError(null);
        try {
            const enhanced = await enhanceMusicPrompt(prompt);
            setPrompt(enhanced);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'An unknown error occurred while enhancing the prompt.');
        } finally {
            setIsEnhancingPrompt(false);
        }
    };

    const handleSurpriseMe = async () => {
        setIsEnhancingPrompt(true);
        setError(null);
        setPrompt(''); // Clear existing prompt
        try {
            const surprise = await enhanceMusicPrompt();
            setPrompt(surprise);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'An unknown error occurred while generating a surprise prompt.');
        } finally {
            setIsEnhancingPrompt(false);
        }
    };

    const handleStop = useCallback(async () => {
        if (generationTimeoutRef.current) {
            clearTimeout(generationTimeoutRef.current);
            generationTimeoutRef.current = null;
        }
        cleanupGenerationIntervals();
        if (sessionRef.current) {
            await sessionRef.current.close();
            // onclose callback will handle final state
        } else {
            setStatus('idle');
        }
    }, [cleanupGenerationIntervals]);

    const handleGenerate = async () => {
        if (isGenerating) {
            await handleStop();
            return;
        }

        setError(null);
        setGeneratedAudioBlob(null);
        setStatus('generating');
        setProgress(0);
        setLoadingMessage(loadingMessages[0]);

        // Start progress and message intervals
        generationStartRef.current = Date.now();
        progressIntervalRef.current = window.setInterval(() => {
            if (generationStartRef.current) {
                const elapsedTime = Date.now() - generationStartRef.current;
                const calculatedProgress = Math.min(100, (elapsedTime / (duration * 1000)) * 100);
                setProgress(calculatedProgress);
            }
        }, 100);

        messageIntervalRef.current = window.setInterval(() => {
            setLoadingMessage(prev => {
                const currentIndex = loadingMessages.indexOf(prev);
                const nextIndex = (currentIndex + 1) % loadingMessages.length;
                return loadingMessages[nextIndex];
            });
        }, 3000);

        const audioChunks: Uint8Array[] = [];

        try {
            const client = new GoogleGenAI({
                apiKey: process.env.API_KEY,
                apiVersion: "v1alpha",
            });

            const processAndSetAudio = () => {
                if (audioChunks.length === 0) {
                    setError("No audio data was generated. The prompt may have been refused.");
                    setStatus('error');
                    return;
                }
                let totalLength = 0;
                audioChunks.forEach(chunk => { totalLength += chunk.length; });
                const concatenated = new Uint8Array(totalLength);
                let offset = 0;
                audioChunks.forEach(chunk => {
                    concatenated.set(chunk, offset);
                    offset += chunk.length;
                });

                const wavBuffer = createWavBuffer(concatenated, 44100, 2, 16);
                const blob = new Blob([wavBuffer], { type: 'audio/wav' });

                setGeneratedAudioBlob(blob);
                setStatus('generated');
            };

            const session = await client.live.music.connect({
                model: "models/lyria-realtime-exp",
                callbacks: {
                    onmessage: (message: any) => {
                        if (message.serverContent?.audioChunks) {
                            for (const chunk of message.serverContent.audioChunks) {
                                audioChunks.push(decode(chunk.data));
                            }
                        }
                    },
                    onerror: (err: any) => {
                        console.error("Music session error:", err);
                        setError("An error occurred during music generation. Please check the console.");
                        setStatus('error');
                        cleanupGenerationIntervals();
                    },
                    onclose: () => {
                        processAndSetAudio();
                        sessionRef.current = null;
                        if (generationTimeoutRef.current) {
                            clearTimeout(generationTimeoutRef.current);
                            generationTimeoutRef.current = null;
                        }
                        cleanupGenerationIntervals();
                        setProgress(100);
                    },
                },
            });
            sessionRef.current = session;

            await session.setWeightedPrompts({
                weightedPrompts: [{ text: prompt, weight: 1.0 }],
            });

            // FIX: Removed `sampleRateHz` as it does not exist in type 'LiveMusicGenerationConfig'.
            await session.setMusicGenerationConfig({
                musicGenerationConfig: {
                    bpm: bpm,
                    temperature: temperature,
                },
            });

            await session.play();
            
            generationTimeoutRef.current = window.setTimeout(() => {
                handleStop();
            }, duration * 1000);

        } catch (e: unknown) {
            console.error(e);
            setError(e instanceof Error ? e.message : "An unknown error occurred.");
            setStatus('error');
            cleanupGenerationIntervals();
        }
    };
    
    useEffect(() => {
        return () => { // Cleanup on unmount
            if (sessionRef.current) {
                sessionRef.current.close();
            }
            if (generationTimeoutRef.current) {
                clearTimeout(generationTimeoutRef.current);
            }
            cleanupGenerationIntervals();
        };
    }, [cleanupGenerationIntervals]);

    const handleDownload = () => {
        if (!generatedAudioBlob) return;
        const url = URL.createObjectURL(generatedAudioBlob);
        const a = document.createElement('a');
        a.href = url;
        const safeFilename = prompt.substring(0, 30).replace(/[^a-z0-9]/gi, '_').toLowerCase();
        a.download = `${safeFilename || 'generated_music'}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Effect to connect visualizer when audio player is ready and plays
    useEffect(() => {
        const audioEl = audioElRef.current;

        const connectVisualizer = () => {
            if (!audioEl || (sourceNodeRef.current && audioContextRef.current?.state === 'running')) {
                 return;
            }
            if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            const audioContext = audioContextRef.current;
            sourceNodeRef.current = audioContext.createMediaElementSource(audioEl);
            analyserNodeRef.current = audioContext.createAnalyser();
            sourceNodeRef.current.connect(analyserNodeRef.current);
            analyserNodeRef.current.connect(audioContext.destination);
            setIsAudioPlaying(true);
        };

        const onPlay = () => {
             if (audioContextRef.current?.state === 'suspended') {
                audioContextRef.current.resume();
            }
            connectVisualizer();
            setIsAudioPlaying(true);
        };
        const onPause = () => setIsAudioPlaying(false);

        if (audioEl && generatedAudioBlob) {
            audioEl.addEventListener('play', onPlay);
            audioEl.addEventListener('pause', onPause);
            audioEl.addEventListener('ended', onPause);
        }

        return () => {
            if (audioEl) {
                audioEl.removeEventListener('play', onPlay);
                audioEl.removeEventListener('pause', onPause);
                audioEl.removeEventListener('ended', onPause);
            }
            if (sourceNodeRef.current) {
                sourceNodeRef.current.disconnect();
                sourceNodeRef.current = null;
            }
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close();
                audioContextRef.current = null;
            }
        };
    }, [generatedAudioBlob]);

    return (
        <Card className="animate-fade-in">
            <div className="space-y-6">
                 <div>
                    <h3 className="text-xl font-semibold mb-3">1. Start with a Genre</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {genres.map((genre) => (
                            <button
                                key={genre.name}
                                onClick={() => handleGenreSelect(genre)}
                                disabled={isBusy}
                                className={`
                                    w-full text-center px-3 py-2 font-semibold rounded-lg border-2
                                    transition-all duration-200
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                    ${prompt === genre.prompt && bpm === genre.bpm ? 
                                        'bg-brand-primary border-brand-primary text-white' : 
                                        'bg-base-300 border-base-300 text-gray-300 hover:border-brand-light'
                                    }
                                `}
                            >
                                {genre.name}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <h3 className="text-xl font-semibold mb-3">2. Describe the Music</h3>
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., Chill lofi hip hop beat for studying"
                        className="w-full h-24 p-3 bg-base-300 border border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none resize-none"
                        disabled={isBusy}
                    />
                    <div className="mt-2 flex items-center justify-between gap-2">
                        <button
                            onClick={handleEnhancePrompt}
                            disabled={!prompt || isBusy}
                            className="flex-1 text-sm px-3 py-2 font-semibold text-brand-light rounded-lg bg-base-300 hover:bg-opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-base-200 focus:ring-brand-primary transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isEnhancingPrompt ? <Spinner /> : '✨ Enhance'}
                        </button>
                        <button
                            onClick={handleSurpriseMe}
                            disabled={isBusy}
                            className="flex-1 text-sm px-3 py-2 font-semibold text-brand-light rounded-lg bg-base-300 hover:bg-opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-base-200 focus:ring-brand-primary transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isEnhancingPrompt ? <Spinner /> : '🎁 Surprise Me'}
                        </button>
                    </div>
                </div>
                <div>
                    <h3 className="text-xl font-semibold mb-3">3. Configure Generation</h3>
                    <div className="space-y-4">
                         <Slider
                            label="Duration"
                            min={15} max={60} step={5}
                            value={duration}
                            onChange={(e) => setDuration(Number(e.target.value))}
                            disabled={isBusy}
                            displayValue={`${duration}s`}
                        />
                        <Slider
                            label="BPM (Beats Per Minute)"
                            min={60} max={180} step={1}
                            value={bpm}
                            onChange={(e) => setBpm(Number(e.target.value))}
                            disabled={isBusy}
                            displayValue={`${bpm} BPM`}
                        />
                        <Slider
                            label="Temperature (Creativity)"
                            min={0.1} max={1.5} step={0.1}
                            value={temperature}
                            onChange={(e) => setTemperature(Number(e.target.value))}
                            disabled={isBusy}
                            displayValue={temperature.toFixed(1)}
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex justify-center">
                        <Button 
                            onClick={isGenerating ? handleStop : handleGenerate} 
                            disabled={isGenerating ? false : (isEnhancingPrompt || !prompt)} 
                            className="w-48"
                        >
                            {isGenerating ? <><Spinner />&nbsp;Stop</> : '🎵 Generate Music'}
                        </Button>
                    </div>
                    {error && <p className="text-center text-red-400">{error}</p>}
                </div>
                
                 {status === 'generated' && generatedAudioBlob && (
                    <div className="space-y-4 animate-fade-in">
                         <div className="flex justify-center items-center relative">
                            <h3 className="text-xl font-semibold text-center">Your Generated Track</h3>
                        </div>
                        <audio
                            ref={audioElRef}
                            src={URL.createObjectURL(generatedAudioBlob)}
                            controls
                            className="w-full"
                        />
                         <Button onClick={handleDownload} className="w-full">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download .WAV File
                        </Button>
                        <div className="bg-base-300 rounded-lg p-4 space-y-4">
                            <div className="h-24 bg-base-200 rounded-lg overflow-hidden">
                                {isAudioPlaying ? (
                                    <AudioVisualizer
                                        analyserNode={analyserNodeRef.current}
                                        visualizerType={visualizerType}
                                        colorScheme={colorScheme}
                                        sensitivity={sensitivity}
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full">
                                        <p className="text-gray-500">Play audio to see visualization</p>
                                    </div>
                                )}
                            </div>
                             <div>
                                <h4 className="text-lg font-semibold mb-3 text-center">Visualizer Settings</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="vis-type" className="block text-sm font-medium text-gray-300 mb-1">Style</label>
                                        <select
                                            id="vis-type"
                                            value={visualizerType}
                                            onChange={(e) => setVisualizerType(e.target.value as VisualizerType)}
                                            disabled={!isAudioPlaying}
                                            className="w-full p-2 bg-base-100 border border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none disabled:opacity-50"
                                        >
                                            <option value="combined">Combined</option>
                                            <option value="bars">Frequency Bars</option>
                                            <option value="wave">Waveform</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="vis-color" className="block text-sm font-medium text-gray-300 mb-1">Color Scheme</label>
                                        <select
                                            id="vis-color"
                                            value={colorScheme}
                                            onChange={(e) => setColorScheme(e.target.value as ColorScheme)}
                                            disabled={!isAudioPlaying}
                                            className="w-full p-2 bg-base-100 border border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none disabled:opacity-50"
                                        >
                                            <option value="default">Default</option>
                                            <option value="sunset">Sunset</option>
                                            <option value="ocean">Ocean</option>
                                            <option value="mono">Monochrome</option>
                                        </select>
                                    </div>
                                </div>
                                 <div className="mt-4">
                                    <Slider
                                        label="Responsiveness"
                                        min={0.1} max={0.95} step={0.05}
                                        value={sensitivity}
                                        onChange={(e) => setSensitivity(Number(e.target.value))}
                                        disabled={!isAudioPlaying}
                                        displayValue={((1 - sensitivity) * 100).toFixed(0) + '%'}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                 {isGenerating && (
                    <div className="space-y-4 animate-fade-in text-center p-6 bg-base-300 rounded-lg">
                        <div className="flex items-center justify-center gap-3">
                            <Spinner />
                            <p className="text-lg font-medium text-content">{loadingMessage}</p>
                        </div>
                        <div className="w-full bg-base-100 rounded-full h-3 overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                            <div
                                className="bg-gradient-to-r from-brand-primary to-brand-secondary h-3 rounded-full transition-all duration-100 ease-linear"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                        <div className="flex justify-between items-center text-sm text-gray-400">
                            <span>Generating...</span>
                            <span className="font-semibold text-brand-light">{Math.round(progress)}%</span>
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
};

interface AudioVisualizerProps {
    analyserNode: AnalyserNode | null;
    visualizerType: VisualizerType;
    colorScheme: ColorScheme;
    sensitivity: number;
}

const colorSchemes = {
    default: { from: '#4f46e5', to: '#a5b4fc' },
    sunset: { from: '#f97316', to: '#fde047' },
    ocean: { from: '#06b6d4', to: '#10b981' },
    mono: { from: '#e5e7eb', to: '#9ca3af' },
};

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ analyserNode, visualizerType, colorScheme, sensitivity }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!analyserNode || !canvasRef.current) return;

        analyserNode.smoothingTimeConstant = sensitivity;

        const canvas = canvasRef.current;
        const canvasCtx = canvas.getContext('2d');
        if (!canvasCtx) return;

        analyserNode.fftSize = 2048;
        const bufferLength = analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const timeDataArray = new Uint8Array(bufferLength);
        
        let animationFrameId: number;

        const draw = () => {
            animationFrameId = requestAnimationFrame(draw);
            analyserNode.getByteFrequencyData(dataArray);
            analyserNode.getByteTimeDomainData(timeDataArray);

            const { width, height } = canvas;
            canvasCtx.fillStyle = '#374151'; // base-200
            canvasCtx.fillRect(0, 0, width, height);

            const activeColors = colorSchemes[colorScheme];

            const drawBars = () => {
                const barWidth = (width / bufferLength) * 2.5;
                let barHeight;
                let x = 0;
                for (let i = 0; i < bufferLength; i++) {
                    barHeight = dataArray[i] * (height / 255);
                    const gradient = canvasCtx.createLinearGradient(0, height, 0, height - barHeight);
                    gradient.addColorStop(0, activeColors.from);
                    gradient.addColorStop(1, activeColors.to);
                    canvasCtx.fillStyle = gradient;
                    canvasCtx.fillRect(x, height - barHeight, barWidth, barHeight);
                    x += barWidth + 1;
                }
            }

            const drawWave = () => {
                canvasCtx.lineWidth = 2;
                canvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                canvasCtx.beginPath();
                const sliceWidth = width * 1.0 / bufferLength;
                let x = 0;
                for (let i = 0; i < bufferLength; i++) {
                    const v = timeDataArray[i] / 128.0;
                    const y = v * height / 2;
                    if (i === 0) {
                        canvasCtx.moveTo(x, y);
                    } else {
                        canvasCtx.lineTo(x, y);
                    }
                    x += sliceWidth;
                }
                canvasCtx.lineTo(canvas.width, canvas.height / 2);
                canvasCtx.stroke();
            }

            if (visualizerType === 'bars' || visualizerType === 'combined') {
                drawBars();
            }
            if (visualizerType === 'wave' || visualizerType === 'combined') {
                drawWave();
            }

        };

        draw();

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [analyserNode, visualizerType, colorScheme, sensitivity]);

    return <canvas ref={canvasRef} width="600" height="96" className="w-full h-full" />;
};


export default MusicGenerator;