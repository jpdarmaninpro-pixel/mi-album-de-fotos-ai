import React, { useState, useEffect } from 'react';
import { Photo, PhotographerProfile, Album, FaceDetection } from '../types';
import { blobToBase64, slugify } from '../lib/helpers';
import { generateAlbumDescriptionWithGemini } from '../lib/gemini';
import Spinner from '../components/Spinner';
import { UploadIcon, UserIcon, AIBrainIcon, XIcon, PhotoIcon, HeartIcon, ContactIcon, PhoneIcon } from '../components/icons';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useGoogleDrive } from '../hooks/useGoogleDrive';
import PhotoPreviewModal from '../components/PhotoPreviewModal';
import { loadModels, detectAllFaces } from '../lib/faceapi';


type LocalPhoto = {
  id: string;
  file: File;
  previewUrl: string;
};

const AlbumEditorPage: React.FC = () => {
  const { uploadAlbumAssets, createAlbumFolder, getAlbumManifest, saveAlbumManifest, isReady, uploadPublicJsonData, deleteFile } = useGoogleDrive();
  const { albumId } = useParams<{ albumId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const isNewAlbum = albumId === 'new';

  // State initialization
  const [photographerProfile, setPhotographerProfile] = useState<Omit<PhotographerProfile, 'profilePictureUrl'>>({
    name: '',
    donationLink: '',
    contactLink: '',
    zellePhoneNumber: '',
  });
  const [profilePicture, setProfilePicture] = useState<LocalPhoto | null>(null);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [albumName, setAlbumName] = useState('');
  const [existingAlbumData, setExistingAlbumData] = useState<Album | null>(location.state?.album || null);
  
  // UI State
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('');
  const [viewingPhotoIndex, setViewingPhotoIndex] = useState<number | null>(null);
  const viewingPhoto = viewingPhotoIndex !== null ? photos[viewingPhotoIndex] : null;
  
  // Face Recognition State
  const [isFaceApiReady, setIsFaceApiReady] = useState(false);
  const [faceData, setFaceData] = useState<Record<string, FaceDetection[]>>({});
  const [processingFaces, setProcessingFaces] = useState(false);
  const [searchTarget, setSearchTarget] = useState<Float32Array | null>(null);
  const [faceSearchResults, setFaceSearchResults] = useState<Set<string>>(new Set());
  
  // Load existing album data if not a new album
  useEffect(() => {
    if (!isNewAlbum && existingAlbumData) {
      setAlbumName(existingAlbumData.name);
      setPhotographerProfile({
        name: existingAlbumData.photographer.name,
        donationLink: existingAlbumData.photographer.donationLink,
        contactLink: existingAlbumData.photographer.contactLink,
        zellePhoneNumber: existingAlbumData.photographer.zellePhoneNumber,
      })
      // NOTE: For simplicity, editing existing photos is not implemented. 
      // This editor primarily serves to CREATE new albums or RE-GENERATE public data for existing ones.
    }
  }, [isNewAlbum, existingAlbumData]);

  // Load face-api models on mount
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

  // Face search logic
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

  // Handlers
  const processNewPhotosForFaces = async (newPhotos: LocalPhoto[]) => {
    if (!isFaceApiReady) return;
    setProcessingFaces(true);
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
    setProcessingFaces(false);
    setStatus('');
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotographerProfile(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProfilePicture({ id: 'profile-pic', file, previewUrl: URL.createObjectURL(file) });
    }
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
    if (!isReady) {
      alert("Google Drive is not ready. Please wait or sign in again.");
      return;
    }
    
    if (!albumName || photos.length === 0 || !photographerProfile.name || !profilePicture) {
      alert("Please fill all required fields: Album Name, Photographer Name, Profile Picture, and upload at least one photo.");
      return;
    }

    setIsProcessing(true);
    try {
      setStatus('Analyzing images with Gemini AI...');
      const photoBase64sForDesc = await Promise.all(photos.slice(0, 5).map(p => blobToBase64(p.file)));
      const { description } = await generateAlbumDescriptionWithGemini(photoBase64sForDesc);
      
      setStatus('Checking for existing album folder...');
      const folderId = existingAlbumData?.folderId || await createAlbumFolder(albumName);

      setStatus('Uploading assets to Google Drive...');
      const { profilePictureUrl, photoUrls } = await uploadAlbumAssets(
        folderId,
        profilePicture.file,
        photos.map(p => p.file),
        (progress) => setStatus(progress.message)
      );
      
      const finalPhotos: Photo[] = photos.map((p, i) => ({ id: p.id, url: photoUrls[i] }));

      const newAlbumData: Omit<Album, 'publicDataFileId'> = {
        id: existingAlbumData?.id || slugify(albumName),
        name: albumName,
        description: description,
        photos: finalPhotos,
        photographer: { ...photographerProfile, profilePictureUrl },
        folderId: folderId,
      };
      
      // Clean up old public file to prevent orphans in Drive
      if (existingAlbumData?.publicDataFileId) {
        setStatus('Replacing existing public data file...');
        await deleteFile(existingAlbumData.publicDataFileId);
      }

      setStatus('Creating public album data file...');
      const publicDataFileId = await uploadPublicJsonData(
        folderId,
        newAlbumData, 
        `${slugify(albumName)}-public.json`
      );

      const finalAlbum: Album = { ...newAlbumData, publicDataFileId };

      setStatus('Updating album manifest...');
      const allAlbums = await getAlbumManifest();
      const existingIndex = allAlbums.findIndex(a => a.id === finalAlbum.id);
      if (existingIndex > -1) {
        allAlbums[existingIndex] = finalAlbum;
      } else {
        allAlbums.push(finalAlbum);
      }
      await saveAlbumManifest(allAlbums);
      
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-8">
            {/* Photographer Profile Section */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-bold text-brand-primary mb-4 flex items-center"><UserIcon className="w-6 h-6 mr-2" />Photographer Profile</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">Full Name <span className="text-red-500">*</span></label>
                  <input type="text" name="name" id="name" value={photographerProfile.name} onChange={handleProfileChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-accent focus:border-brand-accent text-gray-900" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Profile Picture <span className="text-red-500">*</span></label>
                  <div className="mt-1 flex items-center space-x-4">
                    {profilePicture ? (
                      <img src={profilePicture.previewUrl} alt="Profile preview" className="w-16 h-16 rounded-full object-cover" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                        <UserIcon className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    <label htmlFor="profile-picture-upload" className="cursor-pointer bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">Change</label>
                    <input id="profile-picture-upload" name="profile-picture-upload" type="file" className="sr-only" accept="image/*" onChange={handleProfilePictureChange} />
                  </div>
                </div>
                  <div>
                    <label htmlFor="contactLink" className="block text-sm font-medium text-gray-700 flex items-center gap-2"><ContactIcon className="w-4 h-4"/>Contact Link</label>
                    <input type="url" name="contactLink" id="contactLink" value={photographerProfile.contactLink} onChange={handleProfileChange} placeholder="e.g., mailto:email@example.com" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900" />
                </div>
                <div>
                    <label htmlFor="donationLink" className="block text-sm font-medium text-gray-700 flex items-center gap-2"><HeartIcon className="w-4 h-4"/>Donation/Support Link</label>
                    <input type="url" name="donationLink" id="donationLink" value={photographerProfile.donationLink} onChange={handleProfileChange} placeholder="e.g., https://buymeacoffee.com/..." className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900" />
                </div>
                <div>
                    <label htmlFor="zellePhoneNumber" className="block text-sm font-medium text-gray-700 flex items-center gap-2"><PhoneIcon className="w-4 h-4"/>Zelle Phone Number</label>
                    <input type="tel" name="zellePhoneNumber" id="zellePhoneNumber" value={photographerProfile.zellePhoneNumber || ''} onChange={handleProfileChange} placeholder="e.g., 123-456-7890" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900" />
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-8">
              {/* Album Content Section */}
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
                <div className="bg-white p-6 rounded-lg shadow">
                  <h2 className="text-xl font-bold text-brand-primary mb-4 flex items-center"><AIBrainIcon className="w-6 h-6 mr-2" />Generate Album</h2>
                  <p className="text-sm text-gray-600 mb-4">This will upload photos to a new folder in your Google Drive and create a public, shareable link.</p>
                  <button onClick={handleGenerateAlbum} disabled={isProcessing} className="w-full inline-flex items-center justify-center px-6 py-3 bg-brand-accent text-white font-bold rounded-lg shadow-lg hover:bg-brand-accent-hover transition-transform transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed">
                      {isProcessing ? status : 'Generate Public Album'}
                  </button>
              </div>
          </div>
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
