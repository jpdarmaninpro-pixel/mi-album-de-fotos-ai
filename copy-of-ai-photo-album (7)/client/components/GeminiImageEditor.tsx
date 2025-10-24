import React, { useState } from 'react';
import { Photo } from '../types';
import { DownloadIcon, AIBrainIcon } from './icons';
import Spinner from './Spinner';
import { editImageWithGemini } from '../lib/gemini';
import { blobToBase64 } from '../lib/helpers';

interface GeminiImageEditorProps {
  photo: Photo;
  albumName: string;
}

const GeminiImageEditor: React.FC<GeminiImageEditorProps> = ({ photo, albumName }) => {
  const [prompt, setPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleEdit = async () => {
    if (!prompt.trim()) {
      setError('Please enter an editing instruction.');
      return;
    }
    setIsEditing(true);
    setError(null);
    setEditedImage(null);

    try {
      const response = await fetch(photo.url);
      const blob = await response.blob();
      const base64Image = await blobToBase64(blob);

      const result = await editImageWithGemini(base64Image, prompt);
      if (result) {
        setEditedImage(`data:image/jpeg;base64,${result}`);
      } else {
        throw new Error('The AI could not edit the image. Please try a different prompt.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsEditing(false);
    }
  };

  return (
    <div className="flex flex-col items-center p-2 sm:p-4 text-brand-primary w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-6xl">
        <div className="relative w-full flex flex-col items-center">
            <h3 className="text-lg font-semibold mb-2 text-gray-600">Original</h3>
            <img 
                src={photo.url} 
                alt="Original" 
                className="rounded-lg shadow-lg w-full h-auto object-contain max-h-[60vh]" 
            />
        </div>
        <div className="relative w-full flex flex-col items-center">
            <h3 className="text-lg font-semibold mb-2 text-gray-600">Edited</h3>
            <div className="w-full h-full min-h-[200px] bg-gray-200 rounded-lg shadow-lg flex items-center justify-center">
                {isEditing && <Spinner />}
                {error && !isEditing && <p className="text-red-500 p-4 text-center">{error}</p>}
                {editedImage && !isEditing && (
                    <img 
                        src={editedImage} 
                        alt="Edited" 
                        className="rounded-lg w-full h-auto object-contain max-h-[60vh]" 
                    />
                )}
                {!editedImage && !isEditing && !error && <p className="text-gray-500">AI edits will appear here</p>}
            </div>
        </div>
      </div>
      
      <div className="mt-6 w-full max-w-2xl">
        <div className="relative">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., 'make it black and white', 'add a cinematic feel'"
            className="w-full pl-4 pr-32 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
            disabled={isEditing}
          />
          <button
            onClick={handleEdit}
            disabled={isEditing || !prompt}
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center px-4 py-2 bg-brand-accent text-white font-bold rounded-md shadow-md hover:bg-brand-accent-hover disabled:bg-gray-400"
          >
            <AIBrainIcon className="w-5 h-5 mr-2" />
            {isEditing ? 'Editing...' : 'Edit'}
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-4">
        <a 
          href={photo.url} 
          download={`original-${photo.id}.jpg`}
          className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 transition-colors"
        >
          <DownloadIcon className="w-5 h-5 mr-2" />
          Download Original
        </a>
        {editedImage && (
             <a 
                href={editedImage} 
                download={`edited-${photo.id}.jpg`}
                className="inline-flex items-center justify-center px-6 py-3 bg-green-600 text-white font-bold rounded-lg shadow-md hover:bg-green-700 transition-colors"
            >
                <DownloadIcon className="w-5 h-5 mr-2" />
                Download Edited
            </a>
        )}
      </div>
    </div>
  );
};

export default GeminiImageEditor;
