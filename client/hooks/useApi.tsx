import { useCallback } from 'react';
import { useAuth } from './useAuth';
import { Album, PhotographerProfile, PresignedUrlResponse } from '../types';

export const useApi = () => {
    const { token, logout } = useAuth();

    const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}) => {
        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        };

        const response = await fetch(url, { ...options, headers });

        if (response.status === 401 || response.status === 403) {
            logout();
            throw new Error('Authentication error');
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        // Handle no-content responses
        if (response.status === 204) {
            return null;
        }

        return response.json();
    }, [token, logout]);

    const getProfile = useCallback(async (): Promise<PhotographerProfile> => {
        return fetchWithAuth('/api/profile');
    }, [fetchWithAuth]);

    const saveProfile = useCallback(async (profile: PhotographerProfile) => {
        return fetchWithAuth('/api/profile', {
            method: 'POST',
            body: JSON.stringify(profile),
        });
    }, [fetchWithAuth]);

    const getAlbums = useCallback(async (): Promise<Album[]> => {
        return fetchWithAuth('/api/albums');
    }, [fetchWithAuth]);

    const saveAlbums = useCallback(async (albums: Album[]) => {
        return fetchWithAuth('/api/albums', {
            method: 'POST',
            body: JSON.stringify(albums),
        });
    }, [fetchWithAuth]);
    
    const getPresignedUrl = useCallback(async (fileName: string, contentType: string): Promise<PresignedUrlResponse> => {
        const response = await fetchWithAuth(`/api/s3/presigned-url?fileName=${encodeURIComponent(fileName)}&contentType=${encodeURIComponent(contentType)}`);
        return response;
    }, [fetchWithAuth]);

    const uploadFile = useCallback(async (file: File, fileName: string): Promise<{ key: string }> => {
        const { url, key } = await getPresignedUrl(fileName, file.type);
        
        await fetch(url, {
            method: 'PUT',
            body: file,
            headers: {
                'Content-Type': file.type,
            },
        });
        
        return { key };
    }, [getPresignedUrl]);
    
    const savePublicAlbumData = useCallback(async (albumData: Omit<Album, 's3Key'>, key: string) => {
        await fetchWithAuth('/api/s3/public-album', {
            method: 'POST',
            body: JSON.stringify({ albumData, key }),
        });
    }, [fetchWithAuth]);

    const deleteS3Object = useCallback(async (key: string) => {
        await fetchWithAuth(`/api/s3/object/${encodeURIComponent(key)}`, {
            method: 'DELETE',
        });
    }, [fetchWithAuth]);


    return {
        getProfile,
        saveProfile,
        getAlbums,
        saveAlbums,
        uploadFile,
        savePublicAlbumData,
        deleteS3Object
    };
};
