import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Album, Photo } from '../types';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import GeminiImageEditor from '../components/GeminiImageEditor';
import { ContactIcon, HeartIcon, PhoneIcon } from '../components/icons';

const PublicAlbumPage: React.FC = () => {
    const { publicDataFileId } = useParams<{ publicDataFileId: string }>();
    const [album, setAlbum] = useState<Album | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

    useEffect(() => {
        const fetchAlbumData = async () => {
            if (!publicDataFileId) {
                setError("Album ID is missing.");
                setLoading(false);
                return;
            }
            setLoading(true);
            setError(null);
            try {
                // Fix: Cast import.meta to any to resolve TypeScript error for 'env' property
                const apiKey = (import.meta as any).env.VITE_GOOGLE_API_KEY;
                if (!apiKey) {
                    throw new Error("Configuration Error: The Google API Key is missing. Please check the application's environment variables.");
                }
                
                const response = await fetch(`https://www.googleapis.com/drive/v3/files/${publicDataFileId}?alt=media&key=${apiKey}`);
                
                if (!response.ok) {
                    const errorBody = await response.json();
                    console.error("API Error:", errorBody);
                    throw new Error(`Failed to fetch album data. Status: ${response.status}. Is the link correct and public?`);
                }
                const data: Album = await response.json();
                setAlbum(data);
            } catch (err) {
                console.error(err);
                setError(err instanceof Error ? err.message : "Could not load the album.");
            } finally {
                setLoading(false);
            }
        };

        fetchAlbumData();
    }, [publicDataFileId]);
    
    if (loading) {
        return (
            <div className="bg-brand-secondary min-h-screen flex flex-col items-center justify-center">
                <Spinner size="lg" />
                <p className="text-gray-700 text-xl mt-4 font-medium">Loading Album...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-brand-secondary min-h-screen flex items-center justify-center p-4">
                <div className="w-full max-w-2xl bg-white p-8 rounded-lg shadow-xl text-center">
                    <h2 className="text-2xl font-bold text-red-600 mb-4">Error Loading Album</h2>
                    <p className="text-gray-600 bg-red-50 p-4 rounded-md">{error}</p>
                </div>
            </div>
        );
    }

    if (!album) {
        return (
             <div className="bg-brand-secondary min-h-screen flex items-center justify-center p-4">
                <div className="w-full max-w-2xl bg-white p-8 rounded-lg shadow-xl text-center">
                    <h2 className="text-2xl font-bold text-gray-800">Album Not Found</h2>
                    <p className="text-gray-600">The requested album could not be found.</p>
                </div>
            </div>
        )
    }

    return (
      <div className="bg-brand-secondary min-h-screen text-brand-primary">
        <header className="bg-white shadow-md p-6 text-center">
          <img src={album.photographer.profilePictureUrl} alt={album.photographer.name} className="w-24 h-24 rounded-full mx-auto mb-4 shadow-lg" />
          <h1 className="text-4xl font-serif font-bold">{album.name}</h1>
          <p className="text-gray-600 mt-2 max-w-2xl mx-auto">{album.description}</p>
          <p className="text-sm text-gray-500 mt-4">by {album.photographer.name}</p>
          <div className="flex justify-center items-center space-x-4 mt-4">
            {album.photographer.contactLink && (
              <a href={album.photographer.contactLink} target="_blank" rel="noopener noreferrer" className="flex items-center text-blue-600 hover:underline">
                <ContactIcon className="w-5 h-5 mr-1" /> Contact
              </a>
            )}
            {album.photographer.donationLink && (
              <a href={album.photographer.donationLink} target="_blank" rel="noopener noreferrer" className="flex items-center text-pink-600 hover:underline">
                <HeartIcon className="w-5 h-5 mr-1" /> Support
              </a>
            )}
            {album.photographer.zellePhoneNumber && (
              <span className="flex items-center text-purple-600">
                <PhoneIcon className="w-5 h-5 mr-1" /> Zelle: {album.photographer.zellePhoneNumber}
              </span>
            )}
          </div>
        </header>

        <main className="container mx-auto p-4 md:p-8">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {album.photos.map(photo => (
                <div key={photo.id} className="group cursor-pointer" onClick={() => setSelectedPhoto(photo)}>
                <img 
                    src={photo.url} 
                    alt={`Photo ${photo.id}`} 
                    className="w-full h-full object-cover rounded-lg shadow-md transform group-hover:scale-105 transition-transform duration-300"
                />
                </div>
            ))}
            </div>
        </main>
        
        {selectedPhoto && (
            <Modal onClose={() => setSelectedPhoto(null)} size="large">
                <GeminiImageEditor photo={selectedPhoto} albumName={album.name} />
            </Modal>
        )}
      </div>
    );
};

export default PublicAlbumPage;
