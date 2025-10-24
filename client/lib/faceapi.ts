import { FaceDetection } from '../types';

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

let modelsLoaded = false;

export const loadModels = async (): Promise<void> => {
    if (modelsLoaded || typeof window.faceapi === 'undefined') return;

    try {
        await Promise.all([
            window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            window.faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            window.faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        modelsLoaded = true;
        console.log("FaceAPI models loaded successfully.");
    } catch (error) {
        console.error("Error loading FaceAPI models:", error);
    }
};

export const detectAllFaces = async (image: File): Promise<any[]> => {
    if (!modelsLoaded || typeof window.faceapi === 'undefined') {
        console.warn("FaceAPI models not loaded yet.");
        return [];
    }

    const input = await window.faceapi.bufferToImage(image);

    const detections = await window.faceapi
        .detectAllFaces(input, new window.faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptors();

    return detections;
};
