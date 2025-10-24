export interface Photo {
  id: string;
  url: string; // This will be a Base64 Data URL in the generated file
  file?: File; // This is used in the admin panel before processing
}

export interface Album {
  id: string;
  name: string;
  description: string;
  photos: Photo[];
  photographer: PhotographerProfile;
  folderId: string; // The Google Drive folder ID for this album
  publicDataFileId: string; // The ID of the public JSON file with album data
}

export interface PhotographerProfile {
  name: string;
  profilePictureUrl: string; // This will be a Base64 Data URL
  donationLink: string;
  contactLink: string;
  zellePhoneNumber?: string;
}

// Augment the Window interface to include global variables from CDN scripts.
// This informs TypeScript that various libraries loaded via <script> tags are available.
declare global {
  interface Window {
    faceapi: any;
    gapi: any;
    google: any;
  }
}

// Type definition for face detection results used within the app
export type FaceDetection = {
    box: { x: number; y: number; width: number; height: number };
    descriptor: Float32Array;
};