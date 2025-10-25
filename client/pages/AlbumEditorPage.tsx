import React, { useState, useEffect } from 'react';
import { Photo, PhotographerProfile, Album, FaceDetection } from '../types';
import { blobToBase64, slugify } from '../lib/helpers';
import { generateAlbumDescriptionWithGemini } from '../lib/gemini';
import Spinner from '../components/Spinner';
import { UploadIcon, UserIcon, AIBrainIcon, XIcon, PhotoIcon, HeartIcon, ContactIcon, PhoneIcon } from '../components/icons';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import PhotoPreviewModal from '../components/PhotoPreviewModal';
import { loadModels, detectAllFaces } from '../lib/faceapi';


type LocalPhoto = {
  id: string;
  file: File;
  previewUrl: string;
};

const AlbumEditorPage: React.FC = () => {
  const { uploadFile, getAlbums, saveAlbums, getProfile, deleteS3Object } = useApi();
  const { albumId } = useParams<{ albumId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const isNewAlbum = albumId === 'new';

  const [photographerProfile, setPhotographerProfile] = useState<PhotographerProfile | null>(null);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [albumName, setAlbumName] = useState('');
  const [existingAlbumData, setExistingAlbumData] = useState<Album | null>(location.state?.album || null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('');
  const [viewingPhotoIndex, setViewingPhotoIndex] = useState<number | null>(null);
  const viewingPhoto = viewingPhotoIndex !== null ? photos[viewingPhotoIndex] : null;
  
  const [isFaceApiReady, setIsFaceApiReady] = useState(false);
  const [faceData, setFaceData] = useState<Record<string, FaceDetection[]>>({});
  const [searchTarget, setSearchTarget] = useState<Float32Array | null>(null);
  const [faceSearchResults, setFaceSearchResults] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    getProfile().then(setPhotographerProfile).catch(err => {
        console.error("Failed to load photographer profile", err);
        alert("Could not load photographer profile. Please set it up first.");
        navigate('/admin/profile');
    });
    if (!isNewAlbum && existingAlbumData) {
      setAlbumName(existingAlbumData.name);
    }
  }, [isNewAlbum, existingAlbumData, getProfile, navigate]);

  useEffect(() => {
    const initFaceApi = async () => {
      const checkInterval = setInterval(async () => {
        if (window.faceapi) {
          clearInterval(checkInterval);
          await loadModels();
          setIsFaceApiReady(true);
        }
      }, 100);
    };
    initFaceApi();
  }, []);

  useEffect(() => {
    if (!searchTarget) {
      setFaceSearchResults(new Set());
      return;
    }
    if (!window.faceapi) return;
    const MATCH_THRESHOLD = 0.5;
    const results = new Set<string>();
    for (const photoId in faceData) {
        const descriptors = faceData[photoId].map(d => d.descriptor);
        for (const descriptor of descriptors) {
            const distance = window.faceapi.euclideanDistance(searchTarget, descriptor);
            if (distance < MATCH_THRESHOLD) {
                results.add(photoId);
                break; 
            }
        }
    }
    setFaceSearchResults(results);
  }, [searchTarget, faceData]);

  const processNewPhotosForFaces = async (newPhotos: LocalPhoto[]) => {
    if (!isFaceApiReady) return;
    setStatus('Detecting faces in new photos...');
    const newFaceData: Record<string, FaceDetection[]> = {};
    for (const photo of newPhotos) {
      try {
        const detections = await detectAllFaces(photo.file);
        newFaceData[photo.id] = detections.map(d => ({ box: d.detection.box, descriptor: d.descriptor }));
      } catch (error) {
        console.error(`Failed to process faces for ${photo.file.name}:`, error);
      }
    }
    setFaceData(prev => ({ ...prev, ...newFaceData }));
    setStatus('');
  };

  const handlePhotosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newPhotos = Array.from(e.target.files).map((file, index) => ({
        id: `${slugify(file.name)}-${Date.now()}-${index}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      setPhotos(prev => [...prev, ...newPhotos]);
      e.target.value = '';
      if (isFaceApiReady) {
        processNewPhotosForFaces(newPhotos);
      }
    }
  };

  const removePhoto = (id: string) => {
    setPhotos(prev => prev.filter(photo => photo.id !== id));
    setFaceData(prev => {
        const newData = { ...prev };
        delete newData[id];
        return newData;
    });
  };

  const handleGenerateAlbum = async () => {
    if (!albumName || photos.length === 0 || !photographerProfile) {
      alert("Please provide an Album Name, upload at least one photo, and ensure your profile is set up.");
      return;
    }

    setIsProcessing(true);
    try {
      setStatus('Analyzing images with Gemini AI...');
      const photoBase64sForDesc = await Promise.all(photos.slice(0, 5).map(p => blobToBase64(p.file)));
      const { description } = await generateAlbumDescriptionWithGemini(photoBase64sForDesc);
      
      const finalPhotos: Photo[] = [];
      for(let i=0; i < photos.length; i++) {
        const photo = photos[i];
        setStatus(`Uploading photo ${i + 1} of ${photos.length}...`);
        const uniqueFileName = `${slugify(albumName)}/${photo.id}.${photo.file.name.split('.').pop()}`;
        const { key } = await uploadFile(photo.file, uniqueFileName);
        const s3Url = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
        finalPhotos.push({ id: photo.id, s3Key: key, url: s3Url });
      }
      
      const albumS3Key = `public-data/${slugify(albumName)}-${Date.now()}.json`;

      const newAlbumData: Album = {
        id: existingAlbumData?.id || slugify(albumName),
        name: albumName,
        description: description,
        photos: finalPhotos,
        photographer: photographerProfile,
        s3Key: albumS3Key,
      };
      
      if (existingAlbumData?.s3Key) {
        setStatus('Replacing existing public data file...');
        await deleteS3Object(existingAlbumData.s3Key);
      }

      setStatus('Publishing album data...');
      await fetch('/api/albums/public', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify({ key: albumS3Key, data: newAlbumData })
      });


      setStatus('Updating album manifest...');
      const allAlbums = await getAlbums();
      const existingIndex = allAlbums.findIndex(a => a.id === newAlbumData.id);
      if (existingIndex > -1) {
        allAlbums[existingIndex] = newAlbumData;
      } else {
        allAlbums.push(newAlbumData);
      }
      await saveAlbums(allAlbums);
      
      setStatus('Album generated successfully! Redirecting...');
      setTimeout(() => navigate('/admin'), 2000);

    } catch (error) {
      console.error('Failed to generate album:', error);
      setStatus(`An error occurred: ${error instanceof Error ? error.message : String(error)}`);
      setTimeout(() => {
        setIsProcessing(false);
        setStatus('');
      }, 5000);
    }
  };

  return (
     <>
      {isProcessing && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center z-50">
          <Spinner size="lg" />
          <p className="text-white text-xl mt-4 font-medium animate-pulse">{status}</p>
        </div>
      )}
      
      <div className="container mx-auto p-4 md:p-8">
        <div className="mb-6">
            <h1 className="text-3xl font-bold text-brand-primary">{isNewAlbum ? 'Create New Album' : `Editing: ${albumName}`}</h1>
            <p className="text-gray-600">Fill in the details below to generate your album.</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold text-brand-primary mb-4 flex items-center"><PhotoIcon className="w-6 h-6 mr-2" />Album Content</h2>
            <div className="space-y-4">
                <div>
                    <label htmlFor="albumName" className="block text-sm font-medium text-gray-700">Album Name <span className="text-red-500">*</span></label>
                    <input type="text" name="albumName" id="albumName" value={albumName} onChange={(e) => setAlbumName(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Album Photos <span className="text-red-500">*</span></label>
                    <div className="mt-2 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                        <div className="space-y-1 text-center">
                            <UploadIcon className="mx-auto h-12 w-12 text-gray-400" />
                            <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-brand-accent hover:text-brand-accent-hover">
                                <span>Upload files</span>
                                <input id="file-upload" name="file-upload" type="file" multiple className="sr-only" accept="image/*" onChange={handlePhotosChange} />
                            </label>
                        </div>
                    </div>
                </div>
                {photos.length > 0 && (
                      <div>
                        <h3 className="text-lg font-medium text-gray-800 mb-2">{photos.length} photos uploaded</h3>
                          {searchTarget && (
                          <div className="my-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex justify-between items-center">
                              <p className="text-sm font-medium text-blue-800">
                                  Found this person in <strong>{faceSearchResults.size}</strong> photo{faceSearchResults.size !== 1 ? 's' : ''}.
                              </p>
                              <button 
                                  onClick={() => setSearchTarget(null)}
                                  className="flex items-center text-sm text-blue-600 hover:text-blue-800 font-semibold"
                              >
                                  <XIcon className="w-4 h-4 mr-1" />
                                  Clear Search
                              </button>
                          </div>
                        )}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {photos.map((photo, index) => {
                                const isSearchResult = faceSearchResults.has(photo.id);
                                const isSearchActive = !!searchTarget;
                                return (
                                  <div 
                                      key={photo.id} 
                                      className={`relative group cursor-pointer transition-all duration-300 rounded-md shadow-sm ${isSearchActive ? (isSearchResult ? 'ring-4 ring-offset-2 ring-brand-accent' : 'opacity-40 grayscale') : 'hover:scale-105'}`}
                                      onClick={() => setViewingPhotoIndex(index)}
                                  >
                                      <img 
                                          src={photo.previewUrl} 
                                          alt={photo.file.name} 
                                          className="w-full h-32 object-cover rounded-md" 
                                      />
                                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all duration-300 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100">
                                          <button onClick={(e) => { e.stopPropagation(); removePhoto(photo.id); }} className="p-2 bg-white/80 rounded-full text-red-500 hover:bg-white" aria-label="Remove photo">
                                              <XIcon className="w-5 h-5" />
                                          </button>
                                      </div>
                                  </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
          <div className="bg-white p-6 rounded-lg shadow mt-8">
            <h2 className="text-xl font-bold text-brand-primary mb-4 flex items-center"><AIBrainIcon className="w-6 h-6 mr-2" />Generate Album</h2>
            <p className="text-sm text-gray-600 mb-4">This will upload photos to your S3 bucket and create a public, shareable link.</p>
            <button onClick={handleGenerateAlbum} disabled={isProcessing} className="w-full inline-flex items-center justify-center px-6 py-3 bg-brand-accent text-white font-bold rounded-lg shadow-lg hover:bg-brand-accent-hover transition-transform transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed">
                {isProcessing ? status : 'Generate Public Album'}
            </button>
        </div>
      </div>

      {viewingPhoto && (
        <PhotoPreviewModal
          photo={viewingPhoto}
          onClose={() => setViewingPhotoIndex(null)}
          onDelete={() => { removePhoto(viewingPhoto.id); setViewingPhotoIndex(null); }}
          onNext={() => setViewingPhotoIndex(p => p === null ? null : Math.min(p + 1, photos.length - 1))}
          onPrev={() => setViewingPhotoIndex(p => p === null ? null : Math.max(p - 1, 0))}
          hasNext={viewingPhotoIndex !== null && viewingPhotoIndex < photos.length - 1}
          hasPrev={viewingPhotoIndex !== null && viewingPhotoIndex > 0}
          faceDetections={faceData[viewingPhoto.id] || []}
          onFindFaces={(descriptor) => { setSearchTarget(descriptor); setViewingPhotoIndex(null); }}
        />
      )}
    </>
  );
};

export default AlbumEditorPage;