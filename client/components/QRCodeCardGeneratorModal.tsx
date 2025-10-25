import React, { useState, useEffect, useCallback } from 'react';
import Modal from './Modal';
import { Album } from '../types';
import Spinner from './Spinner';
import { generateQRCodeCard } from '../lib/gemini';
import { urlToBase64, slugify } from '../lib/helpers';
import QRCode from 'qrcode';
import { AIBrainIcon, DownloadIcon, PhotoIcon } from './icons';

interface QRCodeCardGeneratorModalProps {
  album: Album;
  onClose: () => void;
}

const QRCodeCardGeneratorModal: React.FC<QRCodeCardGeneratorModalProps> = ({ album, onClose }) => {
    const [designs, setDesigns] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [status, setStatus] = useState('Generating initial designs...');
    const [error, setError] = useState<string | null>(null);
    const [customPrompt, setCustomPrompt] = useState('');
    const [selectedDesign, setSelectedDesign] = useState<string | null>(null);

    const generateDesigns = useCallback(async (prompt?: string) => {
        setIsLoading(true);
        setError(null);
        setDesigns([]);
        setSelectedDesign(null);

        try {
            setStatus('Preparing assets...');
            const publicUrl = `${window.location.origin}${window.location.pathname.replace('index.html', '')}#/album/${album.s3Key}`;
            const qrCodeDataUrl = await QRCode.toDataURL(publicUrl, { width: 256, margin: 1 });
            const qrCodeBase64 = qrCodeDataUrl.split(',')[1];
            const profilePicBase64 = await urlToBase64(album.photographer.profilePictureUrl);

            setStatus('Asking AI to create designs (this may take a moment)...');
            const generationPromises = [
                generateQRCodeCard(album.photographer.name, profilePicBase64, qrCodeBase64, prompt),
                generateQRCodeCard(album.photographer.name, profilePicBase64, qrCodeBase64, prompt),
                generateQRCodeCard(album.photographer.name, profilePicBase64, qrCodeBase64, prompt),
            ];

            const results = await Promise.all(generationPromises);
            const successfulDesigns = results.filter(d => d !== null) as string[];

            if (successfulDesigns.length === 0) {
                throw new Error("AI failed to generate designs. This could be a temporary issue. Please try again.");
            }
            
            setDesigns(successfulDesigns.map(d => `data:image/jpeg;base64,${d}`));
            if (successfulDesigns.length > 0) {
                setSelectedDesign(`data:image/jpeg;base64,${successfulDesigns[0]}`);
            }

        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setIsLoading(false);
            setStatus('');
        }
    }, [album]);

    useEffect(() => {
        generateDesigns();
    }, [generateDesigns]);

    const handleRegenerate = () => {
        if (!customPrompt.trim()) return;
        generateDesigns(customPrompt);
    };

    const handleDownload = () => {
        if (!selectedDesign) return;
        const link = document.createElement('a');
        link.href = selectedDesign;
        link.download = `qr-card-${slugify(album.name)}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Modal onClose={onClose} size="large">
            <div className="p-2">
                <h2 className="text-2xl font-bold text-brand-primary mb-4">AI QR Code Card Generator</h2>
                
                {isLoading && (
                    <div>
                        <div className="text-center p-4">
                            <p className="text-lg text-gray-600">{status}</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
                            {[...Array(3)].map((_, index) => (
                                <div key={index} className="aspect-video bg-gray-200 rounded-lg flex items-center justify-center">
                                    <PhotoIcon className="w-12 h-12 text-gray-400" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {error && !isLoading && (
                    <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg text-center">
                        <p className="font-bold">An Error Occurred</p>
                        <p>{error}</p>
                        <button onClick={() => generateDesigns(customPrompt)} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Try Again</button>
                    </div>
                )}

                {!isLoading && !error && (
                    <>
                        <div>
                            <p className="text-gray-600 mb-2">1. Select a design, or refine it with custom instructions.</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                {designs.map((design, index) => (
                                    <div 
                                        key={index}
                                        onClick={() => setSelectedDesign(design)}
                                        className={`cursor-pointer rounded-lg overflow-hidden border-4 transition-all duration-200 ${selectedDesign === design ? 'border-brand-accent shadow-2xl' : 'border-transparent hover:border-brand-accent/50'}`}
                                    >
                                        <img src={design} alt={`Design option ${index + 1}`} className="w-full h-auto object-cover"/>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                            <input
                                type="text"
                                value={customPrompt}
                                onChange={(e) => setCustomPrompt(e.target.value)}
                                placeholder="e.g., 'minimalist, black and gold theme'"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-accent text-gray-900"
                            />
                            <button
                                onClick={handleRegenerate}
                                disabled={!customPrompt}
                                className="w-full inline-flex items-center justify-center px-4 py-3 bg-brand-accent text-white font-bold rounded-lg shadow-md hover:bg-brand-accent-hover disabled:bg-gray-400"
                            >
                                <AIBrainIcon className="w-5 h-5 mr-2" />
                                Regenerate with Instructions
                            </button>
                        </div>

                        {selectedDesign && (
                            <div className="mt-8 pt-6 border-t border-gray-200 flex justify-center">
                                <button
                                    onClick={handleDownload}
                                    className="w-full max-w-sm inline-flex items-center justify-center px-6 py-3 bg-green-600 text-white font-bold rounded-lg shadow-lg hover:bg-green-700"
                                >
                                    <DownloadIcon className="w-5 h-5 mr-2" />
                                    Download Selected Card
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </Modal>
    );
};

export default QRCodeCardGeneratorModal;
