export interface Photo {
  id: string;
  s3Key: string; // The key for the object in the S3 bucket
  url: string; // The public URL for the image
}

export interface Album {
  id: string;
  name: string;
  description: string;
  photos: Photo[];
  photographer: PhotographerProfile;
  s3Key: string; // The key for the public album data JSON file in S3
}

export interface PhotographerProfile {
  name: string;
  profilePictureUrl: string; // Public URL to the S3 object
  profilePictureS3Key: string; // S3 key for the profile picture
  donationLink: string;
  contactLink: string;
  zellePhoneNumber?: string;
}

// Augment the Window interface to include global variables from CDN scripts.
// This informs TypeScript that various libraries loaded via <script> tags are available.
declare global {
  interface Window {
    faceapi: any;
  }
}

// Type definition for face detection results used within the app
export type FaceDetection = {
    box: { x: number; y: number; width: number; height: number };
    descriptor: Float32Array;
};

// API types
export interface PresignedUrlResponse {
  url: string;
  key: string;
}
