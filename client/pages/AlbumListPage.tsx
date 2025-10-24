import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleDrive } from '../hooks/useGoogleDrive';
import { Album, Photo } from '../types';
import Spinner from '../components/Spinner';
import { PlusIcon, PhotoIcon, TrashIcon, PencilIcon, OpenIcon, ClipboardIcon, QRIcon } from '../components/icons';
import EditAlbumModal from '../components/EditAlbumModal';
import QRCodeCardGeneratorModal from '../components/QRCodeCardGeneratorModal';
import { urlToFile, blobToBase64, slugify } from '../lib/helpers';
import { generateAlbumDescriptionWithGemini } from '../lib/gemini';

const AlbumListPage: React.FC = () => {
  const { 
    getAlbumManifest, 
    saveAlbumManifest, 
    renameAlbumFolder, 
    deleteAlbumFolder, 
    isReady,
    user,
    createAlbumFolder,
    uploadAlbumAssets,
    uploadPublicJsonData
  } = useGoogleDrive();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [qrAlbum, setQrAlbum] = useState<Album | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const navigate = useNavigate();

  // State for sample album creation
  const [isCreatingSample, setIsCreatingSample] = useState(false);
  const [sampleCreationStatus, setSampleCreationStatus] = useState('');
  const [hasCheckedForSample, setHasCheckedForSample] = useState(false);

  const createSampleAlbum = useCallback(async () => {
    if (!user || !isReady) return;

    setIsCreatingSample(true);
    setSampleCreationStatus('Warming up the AI...');

    try {
        const albumName = "My First AI Album (Sample)";
        const sampleImageInfos = [
            { url: 'https://images.pexels.com/photos/3777943/pexels-photo-3777943.jpeg?auto=compress&cs=tinysrgb&w=600', filename: 'sample-portrait.jpg' },
            { url: 'https://images.pexels.com/photos/3225517/pexels-photo-3225517.jpeg?auto=compress&cs=tinysrgb&w=600', filename: 'sample-landscape.jpg' },
            { url: 'https://images.pexels.com/photos/2253275/pexels-photo-2253275.jpeg?auto=compress&cs=tinysrgb&w=600', filename: 'sample-animal.jpg' },
            { url: 'https://images.pexels.com/photos/1090638/pexels-photo-1090638.jpeg?auto=compress&cs=tinysrgb&w=600', filename: 'sample-object.jpg' },
        ];
        
        setSampleCreationStatus('Downloading sample images...');
        const samplePhotoFiles = await Promise.all(
            sampleImageInfos.map(info => urlToFile(info.url, info.filename, 'image/jpeg'))
        );

        const profilePicFile = await urlToFile(user.getImageUrl(), 'profile.jpg', 'image/jpeg');

        setSampleCreationStatus('Asking AI to write a description...');
        const photoBase64sForDesc = await Promise.all(samplePhotoFiles.map(f => blobToBase64(f)));
        const { description } = await generateAlbumDescriptionWithGemini(photoBase64sForDesc);
        
        setSampleCreationStatus('Creating album in Google Drive...');
        const folderId = await createAlbumFolder(albumName);

        const { profilePictureUrl, photoUrls } = await uploadAlbumAssets(
            folderId,
            profilePicFile,
            samplePhotoFiles,
            (progress) => setSampleCreationStatus(progress.message)
        );
      
        const finalPhotos: Photo[] = samplePhotoFiles.map((p, i) => ({ 
            id: `${slugify(p.name)}-${i}`, 
            url: photoUrls[i] 
        }));

        const albumId = slugify(albumName);
        const newAlbumData: Omit<Album, 'publicDataFileId'> = {
            id: albumId,
            name: albumName,
            description: description,
            photos: finalPhotos,
            photographer: { 
                name: user.getName(), 
                profilePictureUrl,
                contactLink: `mailto:${user.getEmail()}`,
                donationLink: '',
                zellePhoneNumber: '',
            },
            folderId: folderId,
        };
      
        setSampleCreationStatus('Publishing album...');
        const publicDataFileId = await uploadPublicJsonData(
            folderId,
            newAlbumData, 
            `${albumId}-public.json`
        );

        const finalAlbum: Album = { ...newAlbumData, publicDataFileId };

        setSampleCreationStatus('Saving everything...');
        await saveAlbumManifest([finalAlbum]);
        
        setAlbums([finalAlbum]);
        
    } catch (err) {
        setError(`Failed to create sample album: ${err instanceof Error ? err.message : String(err)}. Please try refreshing the page or create an album manually.`);
    } finally {
        setIsCreatingSample(false);
        setSampleCreationStatus('');
    }
}, [user, isReady, createAlbumFolder, uploadAlbumAssets, uploadPublicJsonData, saveAlbumManifest]);

  const fetchAlbums = useCallback(async () => {
    if (!isReady || hasCheckedForSample) return;

    setPageLoading(true);
    setError(null);
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Loading albums timed out. The request to Google Drive is taking too long. Please check your network connection and refresh the page.")), 15000)
    );

    try {
      const manifestAlbums = await Promise.race([ getAlbumManifest(), timeoutPromise ]) as Album[];
      setHasCheckedForSample(true);

      if (manifestAlbums.length > 0) {
        setAlbums(manifestAlbums);
        setPageLoading(false);
      } else {
        await createSampleAlbum();
        setPageLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load albums from Google Drive.');
      console.error(err);
      setPageLoading(false);
    }
  }, [getAlbumManifest, isReady, hasCheckedForSample, createSampleAlbum]);

  useEffect(() => {
    if (isReady && !hasCheckedForSample) {
        fetchAlbums();
    } else if (!isReady) {
        setPageLoading(true); // Ensure loading is true until ready
    }
  }, [isReady, hasCheckedForSample, fetchAlbums]);

  const handleCreateNew = () => {
    navigate('/admin/album/new');
  };
  
  const handleEditAlbum = async (album: Album, newName: string) => {
    if (!newName.trim()) return;

    setIsRenaming(true);
    try {
        await renameAlbumFolder(album.folderId, newName);
        const updatedAlbums = albums.map(a => 
            a.id === album.id ? { ...a, name: newName } : a
        );
        setAlbums(updatedAlbums);
        await saveAlbumManifest(updatedAlbums);
    } catch (err) {
        setError(`Failed to rename album: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
        setIsRenaming(false);
        setEditingAlbum(null);
    }
  };
  
  const handleDeleteAlbum = async (albumToDelete: Album) => {
    if (!window.confirm(`Are you sure you want to permanently delete the album "${albumToDelete.name}"? This action cannot be undone.`)) {
        return;
    }
    
    setDeletingId(albumToDelete.id);
    try {
        await deleteAlbumFolder(albumToDelete.folderId);
        const updatedAlbums = albums.filter(a => a.id !== albumToDelete.id);
        setAlbums(updatedAlbums);
        await saveAlbumManifest(updatedAlbums);
    } catch (err) {
        setError(`Failed to delete album: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
        setDeletingId(null);
    }
  };

  const handleCopyLink = (album: Album) => {
    const publicUrl = `${window.location.origin}${window.location.pathname.replace('index.html', '')}#/album/${album.publicDataFileId}`;
    navigator.clipboard.writeText(publicUrl);
    setCopiedLink(album.id);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  return (
    <>
      {(pageLoading || isCreatingSample) && (
        <div className="fixed inset-0 bg-white bg-opacity-75 flex flex-col items-center justify-center z-50">
          <Spinner size="lg" />
          <p className="text-gray-700 text-xl mt-4 font-medium">
            {isCreatingSample ? (sampleCreationStatus || 'Creating sample album...') : 'Loading Albums...'}
          </p>
        </div>
      )}
      
      <div className="container mx-auto p-4 md:p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-brand-primary">Your Albums</h1>
          <button onClick={handleCreateNew} className="inline-flex items-center justify-center px-5 py-2.5 bg-brand-accent text-white font-bold rounded-lg shadow-md hover:bg-brand-accent-hover transition-transform transform hover:scale-105">
            <PlusIcon className="w-5 h-5 mr-2" />
            Create New Album
          </button>
        </div>
        
        {error && (
            <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg" role="alert">
                <p className="font-bold">An Error Occurred</p>
                <p>{error}</p>
            </div>
        )}

        {!pageLoading && !isCreatingSample && albums.length === 0 && !error && (
            <div className="text-center py-16 px-6 border-2 border-dashed border-gray-300 rounded-lg">
                <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-xl font-medium text-gray-900">Welcome to your AI Photo Album!</h3>
                <p className="mt-1 text-gray-500">Your space is ready. Get started by creating your first album.</p>
            </div>
        )}
        
        {albums.length > 0 && (
          <div className="space-y-4">
            {albums.map(album => (
              <div 
                key={album.id} 
                className={`bg-white p-4 rounded-lg shadow-md transition-opacity duration-300 flex flex-col sm:flex-row sm:items-center sm:justify-between ${deletingId === album.id ? 'opacity-50' : ''}`}
              >
                <div className="flex-grow mb-4 sm:mb-0">
                    <h2 className="text-xl font-bold text-brand-primary truncate">{album.name}</h2>
                    <p className="text-sm text-gray-500 mt-1">{album.photos.length} photos</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                  {album.publicDataFileId ? (
                    <>
                      <button 
                        onClick={() => handleCopyLink(album)} 
                        className="inline-flex items-center text-sm font-semibold px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md disabled:text-gray-400 w-32 justify-center"
                        disabled={!!deletingId}
                      >
                        {copiedLink === album.id ? 'Copied!' : <><ClipboardIcon className="w-4 h-4 mr-1.5" /> Copy Link</>}
                      </button>
                       <button 
                        onClick={() => setQrAlbum(album)}
                        className="inline-flex items-center text-sm font-semibold px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md disabled:text-gray-400"
                        disabled={!!deletingId}
                      >
                        <QRIcon className="w-4 h-4 mr-1.5" /> QR Card
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-gray-400 px-3">Generate album to get link</span>
                  )}
                  
                  <div className="flex items-center border-l border-gray-200 ml-2 pl-2">
                    <button 
                      onClick={() => navigate(`/admin/album/${album.id}`, { state: { album } })} 
                      className="p-2 text-gray-500 hover:text-blue-600 rounded-full hover:bg-gray-100 disabled:text-gray-300" 
                      aria-label="Open editor"
                      title="Open Editor"
                      disabled={!!deletingId}
                    >
                      <OpenIcon className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => setEditingAlbum(album)} 
                      className="p-2 text-gray-500 hover:text-gray-800 rounded-full hover:bg-gray-100 disabled:text-gray-300" 
                      aria-label="Edit album name"
                      title="Edit album name"
                      disabled={!!deletingId}
                    >
                      <PencilIcon className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleDeleteAlbum(album)} 
                      className="p-2 text-red-500 hover:text-red-700 rounded-full hover:bg-red-50 disabled:text-gray-300" 
                      aria-label="Delete album"
                      title="Delete album"
                      disabled={!!deletingId}
                    >
                      {deletingId === album.id ? <Spinner size="sm" /> : <TrashIcon className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {editingAlbum && (
        <EditAlbumModal
            album={editingAlbum}
            onClose={() => setEditingAlbum(null)}
            onSave={handleEditAlbum}
            isSaving={isRenaming}
        />
      )}

      {qrAlbum && (
        <QRCodeCardGeneratorModal
            album={qrAlbum}
            onClose={() => setQrAlbum(null)}
        />
      )}
    </>
  );
};

export default AlbumListPage;