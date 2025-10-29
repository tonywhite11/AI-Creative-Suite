import React, { useState } from 'react';
import { AppTab, UploadedImage } from './types';
import PhotoEditor from './components/PhotoEditor';
import VideoGenerator from './components/VideoGenerator';
import ImageGenerator from './components/ImageGenerator';
import MusicGenerator from './components/MusicGenerator';
import SoundDesigner from './components/SoundDesigner';
import Tabs from './components/ui/Tabs';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.Image);
  const [exportedImage, setExportedImage] = useState<UploadedImage | null>(null);
  const [exportedMusicPrompt, setExportedMusicPrompt] = useState<string | null>(null);

  const tabs = [
    { id: AppTab.Image, label: 'AI Image Generator' },
    { id: AppTab.Photo, label: 'AI Photo Editor' },
    { id: AppTab.Video, label: 'AI Video Generator' },
    { id: AppTab.Sound, label: 'AI Sound Designer' },
    { id: AppTab.Music, label: 'AI Music Generator' },
  ];

  const handleExportImage = (image: UploadedImage, targetTab: AppTab) => {
    setExportedImage(image);
    setActiveTab(targetTab);
  };

  const handleExportMusicPrompt = (prompt: string, targetTab: AppTab) => {
    setExportedMusicPrompt(prompt);
    setActiveTab(targetTab);
  };

  const clearExportedImage = () => {
    setExportedImage(null);
  };

  const clearExportedMusicPrompt = () => {
    setExportedMusicPrompt(null);
  };

  return (
    <div className="min-h-screen bg-base-100 text-content font-sans">
      <header className="py-6 px-4 md:px-8 text-center bg-base-200 border-b border-base-300">
        <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-primary to-brand-secondary">
          AI Creative Suite
        </h1>
        <p className="mt-2 text-lg text-gray-400">Powered by Imagen, Nano Banana, Veo & Lyria</p>
      </header>

      <main className="p-4 md:p-8">
        <Tabs tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />
        <div className="mt-8">
          <div className={activeTab === AppTab.Image ? '' : 'hidden'}>
            <ImageGenerator onExport={handleExportImage} />
          </div>
          <div className={activeTab === AppTab.Photo ? '' : 'hidden'}>
            <PhotoEditor exportedImage={exportedImage} onExportConsumed={clearExportedImage} onExport={handleExportImage} />
          </div>
          <div className={activeTab === AppTab.Video ? '' : 'hidden'}>
            <VideoGenerator exportedImage={exportedImage} onExportConsumed={clearExportedImage} />
          </div>
          <div className={activeTab === AppTab.Sound ? '' : 'hidden'}>
            <SoundDesigner onExport={handleExportMusicPrompt} />
          </div>
          <div className={activeTab === AppTab.Music ? '' : 'hidden'}>
            <MusicGenerator exportedMusicPrompt={exportedMusicPrompt} onExportConsumed={clearExportedMusicPrompt} />
          </div>
        </div>
      </main>
      
      <footer className="text-center p-4 text-gray-500 text-sm">
        Built by a World-Class Senior Frontend React Engineer.
      </footer>
    </div>
  );
};

export default App;