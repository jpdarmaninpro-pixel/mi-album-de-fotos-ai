import { useState, useEffect, useCallback, useRef } from 'react';
import { Album } from '../types';

// Use environment variables for API keys and Client ID
// Fix: Cast import.meta to any to resolve TypeScript error for 'env' property
const CLIENT_ID = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID;
const API_KEY = (import.meta as any).env.VITE_GOOGLE_API_KEY;

// Updated DISCOVERY_DOCS and SCOPES to include Google Docs API
const DISCOVERY_DOCS = [
  'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
  'https://docs.googleapis.com/$discovery/rest?version=v1'
];
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/documents';


const ROOT_FOLDER_NAME = 'AI Photo Albums Root';
const MANIFEST_FILE_NAME = 'albums-manifest.json';

export interface GDriveUser {
  getName: () => string;
  getEmail: () => string;
  getImageUrl: () => string;
}

export const useGoogleDrive = () => {
  const [isGapiLoaded, setIsGapiLoaded] = useState(false);
  const [gapi, setGapi] = useState<any>(null);
  const [google, setGoogle] = useState<any>(null);
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [user, setUser] = useState<GDriveUser | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [rootFolderId, setRootFolderId] = useState<string | null>(null);
  const [manifestFileId, setManifestFileId] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const findOrCreateRootFolder = useCallback(async (gapiClient: any): Promise<string> => {
    // Search for the folder first
    const response = await gapiClient.client.drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${ROOT_FOLDER_NAME}' and trashed=false`,
      fields: 'files(id, name)',
    });
    
    if (response.result.files && response.result.files.length > 0) {
      return response.result.files[0].id;
    } else {
      // If not found, create it
      const folderResponse = await gapiClient.client.drive.files.create({
        resource: {
          name: ROOT_FOLDER_NAME,
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id',
      });
      return folderResponse.result.id;
    }
  }, []);

  useEffect(() => {
    if (document.getElementById('gsi-script')) {
        return; // Scripts already loaded or loading
    }
    
    if (!CLIENT_ID || !API_KEY) {
        setInitError("Configuration Incomplete: VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_API_KEY must be set in your .env file.");
        return;
    }
    
    // Set a timeout to prevent infinite loading state
    timeoutRef.current = window.setTimeout(() => {
        setInitError(
          `Connection to Google is taking too long. This is the most common issue and is almost always caused by one of these problems:\n\n` +
          `1. **Google Cloud Configuration:** The 'Authorized JavaScript origins' in your OAuth credentials do not exactly match your app's URL (${window.location.origin}). Please double-check this setting.\n\n` +
          `2. **Browser Issues:** Your browser might be blocking third-party cookies, or a browser extension (like an ad-blocker) is interfering with the Google sign-in scripts.\n\n` +
          `Please verify your Google Cloud setup and try refreshing the page or using a different browser profile.`
        );
    }, 15000); // 15-second timeout

    const initializeGapiClient = async () => {
        try {
            await window.gapi.client.init({
                apiKey: API_KEY,
                discoveryDocs: DISCOVERY_DOCS,
            });

            // If initialization is successful, clear the timeout
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            setGapi(window.gapi);
            setGoogle(window.google);
            
            const client = window.google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: SCOPES,
                callback: async (tokenResponse: any) => {
                    if (tokenResponse.error) {
                      console.error('OAuth Error:', tokenResponse.error, tokenResponse.error_description);
                      setInitError(`Google Sign-In Error: ${tokenResponse.error_description || tokenResponse.error}. This may be due to a popup blocker or disabled third-party cookies.`);
                      return;
                    }
                    if (tokenResponse.access_token) {
                      window.gapi.client.setToken(tokenResponse);
                      try {
                        const response = await window.gapi.client.request({ path: 'https://www.googleapis.com/oauth2/v3/userinfo' });
                        const profileData = response.result;
                        const userProfile: GDriveUser = {
                          getName: () => profileData.name,
                          getEmail: () => profileData.email,
                          getImageUrl: () => profileData.picture,
                        };
                        setUser(userProfile);
                        const folderId = await findOrCreateRootFolder(window.gapi);
                        setRootFolderId(folderId);
                      } catch (error) {
                        console.error('Error fetching user profile:', error);
                        setInitError(`Failed to fetch user profile after sign-in. ${error instanceof Error ? error.message : ''}`);
                      }
                    }
                },
            });
            setTokenClient(client);
            setIsGapiLoaded(true);
        } catch (error) {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            console.error("Failed to initialize GAPI client:", error);
            const errorMessage = error instanceof Error ? error.message : (error as any).details || JSON.stringify(error);
            setInitError(`Failed to initialize Google API client. This can be caused by an incorrect API Key, network issues, or third-party cookie restrictions in your browser. Details: ${errorMessage}`);
        }
    };

    const gapiScript = document.createElement('script');
    gapiScript.src = 'https://apis.google.com/js/api.js';
    gapiScript.id = 'gapi-script';
    gapiScript.async = true;
    gapiScript.defer = true;
    gapiScript.onload = () => window.gapi.load('client', initializeGapiClient);
    
    const gsiScript = document.createElement('script');
    gsiScript.src = 'https://accounts.google.com/gsi/client';
    gsiScript.id = 'gsi-script';
    gsiScript.async = true;
    gsiScript.defer = true;
    gsiScript.onload = () => document.body.appendChild(gapiScript);
    
    document.body.appendChild(gsiScript);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      const gapiElem = document.getElementById('gapi-script');
      const gsiElem = document.getElementById('gsi-script');
      if (gapiElem?.parentNode) gapiElem.parentNode.removeChild(gapiElem);
      if (gsiElem?.parentNode) gsiElem.parentNode.removeChild(gsiElem);
    }
  }, [findOrCreateRootFolder]);

  const signIn = useCallback(() => {
    if (tokenClient) {
      tokenClient.requestAccessToken({ prompt: 'consent select_account' });
    } else {
       const message = initError
        ? `Cannot sign in due to an initialization error:\n\n${initError}`
        : "Google authentication client is not ready. Please wait a moment and try again.";
      alert(message);
    }
  }, [tokenClient, initError]);

  const signOut = useCallback(() => {
    const token = gapi?.client?.getToken();
    if (token) {
      google?.accounts.oauth2.revoke(token.access_token, () => {
        gapi.client.setToken(null);
        setUser(null);
        setRootFolderId(null);
      });
    }
  }, [gapi, google]);

  const getAlbumManifest = useCallback(async (): Promise<Album[]> => {
    if (!gapi || !rootFolderId) return [];

    try {
        const response = await gapi.client.drive.files.list({
            q: `'${rootFolderId}' in parents and name='${MANIFEST_FILE_NAME}' and trashed=false`,
            fields: 'files(id)',
        });
        if (response.result.files && response.result.files.length > 0) {
            const fileId = response.result.files[0].id;
            setManifestFileId(fileId);
            const fileContent = await gapi.client.drive.files.get({ fileId, alt: 'media' });
            return JSON.parse(fileContent.body);
        }
        return [];
    } catch (error) {
        console.error("Error fetching album manifest:", error);
        return [];
    }
  }, [gapi, rootFolderId]);

  const saveAlbumManifest = useCallback(async (albums: Album[]) => {
    if (!gapi || !rootFolderId) return;

    const manifestContent = JSON.stringify(albums, null, 2);
    const blob = new Blob([manifestContent], { type: 'application/json' });
    const fileMetadata = { name: MANIFEST_FILE_NAME, mimeType: 'application/json' };
    
    const path = manifestFileId ? `/upload/drive/v3/files/${manifestFileId}` : '/upload/drive/v3/files';
    const method = manifestFileId ? 'PATCH' : 'POST';
    if (!manifestFileId) {
        (fileMetadata as any).parents = [rootFolderId];
    }
    
    const reader = new FileReader();
    reader.readAsBinaryString(blob);
    reader.onload = async () => {
      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const close_delim = `\r\n--${boundary}--`;
      
      const body =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(fileMetadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        reader.result +
        close_delim;

      const response = await gapi.client.request({
          path: path,
          method: method,
          params: { uploadType: 'multipart' },
          headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
          body: body
      });
      if (!manifestFileId) {
          setManifestFileId(response.result.id);
      }
    };
  }, [gapi, rootFolderId, manifestFileId]);

  const createAlbumFolder = useCallback(async (albumName: string): Promise<string> => {
      if (!gapi || !rootFolderId) throw new Error("Google Drive not ready.");
      const folderResponse = await gapi.client.drive.files.create({
          resource: {
              name: albumName,
              mimeType: 'application/vnd.google-apps.folder',
              parents: [rootFolderId]
          },
          fields: 'id',
      });
      return folderResponse.result.id;
  }, [gapi, rootFolderId]);
  
  const renameAlbumFolder = useCallback(async (folderId: string, newName: string) => {
    if (!gapi) return;
    await gapi.client.drive.files.update({
      fileId: folderId,
      resource: { name: newName },
    });
  }, [gapi]);

  const deleteAlbumFolder = useCallback(async (folderId: string) => {
    if (!gapi) return;
    await gapi.client.drive.files.delete({ fileId: folderId });
  }, [gapi]);
  
  const deleteFile = useCallback(async (fileId: string) => {
    if (!gapi) return;
    try {
      await gapi.client.drive.files.delete({ fileId });
    } catch (error) {
      console.error(`Failed to delete file ${fileId}:`, error);
      // Don't throw, as the process can continue.
    }
  }, [gapi]);

  const uploadPublicJsonData = useCallback(async (parentFolderId: string, jsonData: object, fileName: string): Promise<string> => {
    if (!gapi) throw new Error("GAPI client not loaded.");
    const content = JSON.stringify(jsonData);
    const blob = new Blob([content], { type: 'application/json' });
    const file = new File([blob], fileName, { type: 'application/json' });
    
    const fileMetadata = { name: file.name, parents: [parentFolderId] };
    const media = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string).split(',')[1]);
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
    });

    const boundary = 'boundary';
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(fileMetadata)}\r\n\r\n--${boundary}\r\nContent-Type: ${file.type}\r\nContent-Transfer-Encoding: base64\r\n\r\n${media}\r\n\r\n--${boundary}--`;
    
    const uploadResponse = await gapi.client.request({
        path: '/upload/drive/v3/files',
        method: 'POST',
        params: { uploadType: 'multipart' },
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body,
    });
    const fileId = uploadResponse.result.id;

    await gapi.client.drive.permissions.create({
        fileId: fileId,
        resource: { role: 'reader', type: 'anyone' },
    });

    return fileId;
  }, [gapi]);

  const uploadAlbumAssets = async (
    parentFolderId: string,
    profilePictureFile: File,
    photoFiles: File[],
    onProgress: (progress: { message: string }) => void
  ): Promise<{ profilePictureUrl: string; photoUrls: string[] }> => {
    if (!gapi) throw new Error("GAPI client not loaded.");

    const uploadAndShareFile = async (file: File): Promise<string> => {
      const fileMetadata = { name: file.name, parents: [parentFolderId] };
      const media = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string).split(',')[1]);
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
      });

      const boundary = 'boundary';
      const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(fileMetadata)}\r\n\r\n--${boundary}\r\nContent-Type: ${file.type}\r\nContent-Transfer-Encoding: base64\r\n\r\n${media}\r\n\r\n--${boundary}--`;
      
      const uploadResponse = await gapi.client.request({
        path: '/upload/drive/v3/files',
        method: 'POST',
        params: { uploadType: 'multipart' },
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body,
      });
      const fileId = uploadResponse.result.id;

      await gapi.client.drive.permissions.create({
        fileId: fileId,
        resource: { role: 'reader', type: 'anyone' },
      });

      return `https://drive.google.com/uc?id=${fileId}`;
    };

    onProgress({ message: 'Uploading profile picture...' });
    const profilePictureUrl = await uploadAndShareFile(profilePictureFile);

    const photoUrls: string[] = [];
    for (let i = 0; i < photoFiles.length; i++) {
      const file = photoFiles[i];
      onProgress({ message: `Uploading photo ${i + 1} of ${photoFiles.length}: ${file.name}` });
      const url = await uploadAndShareFile(file);
      photoUrls.push(url);
    }

    onProgress({ message: 'All files uploaded successfully!' });
    return { profilePictureUrl, photoUrls };
  };

  const createQrCardSheetInDocs = useCallback(async (
    albumName: string,
    parentFolderId: string,
    cardImageUri: string, // data:image/jpeg;base64,...
    pageSize: 'LETTER' | 'A4'
  ): Promise<string> => {
    if (!gapi || !gapi.client.docs) throw new Error("Google Docs API client not loaded.");

    const docTitle = `Printable QR Cards - ${albumName}`;
    const createDocResponse = await gapi.client.docs.documents.create({
        title: docTitle,
    });
    const documentId = createDocResponse.result.documentId;

    // Move the document to the correct folder and remove from root
    await gapi.client.drive.files.update({
        fileId: documentId,
        addParents: parentFolderId,
        removeParents: 'root', // Crucial fix to prevent cluttering "My Drive"
        fields: 'id, parents'
    });
    
    const POINTS_PER_INCH = 72;
    const CARD_WIDTH = 3.5 * POINTS_PER_INCH;
    const CARD_HEIGHT = 2 * POINTS_PER_INCH;

    const pageConfig = pageSize === 'LETTER' 
        ? { width: 8.5 * POINTS_PER_INCH, height: 11 * POINTS_PER_INCH }
        : { width: 8.27 * POINTS_PER_INCH, height: 11.69 * POINTS_PER_INCH };

    const MARGIN = 0.5 * POINTS_PER_INCH;
    const usableWidth = pageConfig.width - (2 * MARGIN);
    const usableHeight = pageConfig.height - (2 * MARGIN);
    
    const cols = Math.floor(usableWidth / CARD_WIDTH);
    const rows = Math.floor(usableHeight / CARD_HEIGHT);

    const requests = [];

    requests.push({
        updateDocumentStyle: {
            documentStyle: {
                marginLeft: { magnitude: MARGIN, unit: 'PT' },
                marginRight: { magnitude: MARGIN, unit: 'PT' },
                marginTop: { magnitude: MARGIN, unit: 'PT' },
                marginBottom: { magnitude: MARGIN, unit: 'PT' },
            },
            fields: 'marginLeft,marginRight,marginTop,marginBottom',
        },
    });

    requests.push({
        insertTable: {
            rows,
            columns: cols,
            location: { index: 1 },
        },
    });

    requests.push({
        updateTableStyle: {
            tableStyle: {
                tableBorderProperties: {
                    width: { magnitude: 1, unit: 'PT' },
                    dashStyle: 'DASH',
                    color: { color: { rgbColor: { red: 0.7, green: 0.7, blue: 0.7 } } },
                },
            },
            fields: 'tableBorderProperties',
        },
    });

    let locationIndex = 4;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            requests.push({
                insertInlineImage: {
                    location: { index: locationIndex },
                    uri: cardImageUri,
                    objectSize: {
                        width: { magnitude: CARD_WIDTH, unit: 'PT' },
                        height: { magnitude: CARD_HEIGHT, unit: 'PT' },
                    },
                },
            });
            locationIndex += 3; 
        }
    }

    await gapi.client.docs.documents.batchUpdate({
        documentId,
        requests,
    });

    return documentId;
  }, [gapi]);

  return { 
    isGapiLoaded, 
    isSignedIn: !!user, 
    user, 
    signIn, 
    signOut, 
    uploadAlbumAssets, 
    initError,
    getAlbumManifest,
    saveAlbumManifest,
    createAlbumFolder,
    renameAlbumFolder,
    deleteAlbumFolder,
    deleteFile,
    uploadPublicJsonData,
    createQrCardSheetInDocs,
    isReady: isGapiLoaded && !!user && !!rootFolderId
  };
};