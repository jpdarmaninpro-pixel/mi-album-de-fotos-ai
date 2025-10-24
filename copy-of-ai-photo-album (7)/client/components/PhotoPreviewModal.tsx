import React, { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import { TrashIcon, ChevronLeftIcon, ChevronRightIcon } from './icons';
import { FaceDetection } from '../types';

type LocalPhoto = {
  id: string;
  file: File;
  previewUrl: string;
};

interface PhotoPreviewModalProps {
  photo: LocalPhoto;
  onClose: () => void;
  onDelete: (id: string) => void;
  onNext: () => void;
  onPrev: () => void;
  hasNext: boolean;
  hasPrev: boolean;
  faceDetections: FaceDetection[];
  onFindFaces: (descriptor: Float32Array) => void;
}

const PhotoPreviewModal: React.FC<PhotoPreviewModalProps> = ({
  photo,
  onClose,
  onDelete,
  onNext,
  onPrev,
  hasNext,
  hasPrev,
  faceDetections,
  onFindFaces
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgDimensions, setImgDimensions] = useState({
      width: 0, height: 0, naturalWidth: 0, naturalHeight: 0
  });

  const handleImageLoad = () => {
    if (imgRef.current) {
      setImgDimensions({
        width: imgRef.current.offsetWidth,
        height: imgRef.current.offsetHeight,
        naturalWidth: imgRef.current.naturalWidth,
        naturalHeight: imgRef.current.naturalHeight,
      });
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && hasNext) onNext();
      if (e.key === 'ArrowLeft' && hasPrev) onPrev();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNext, onPrev, onClose, hasNext, hasPrev]);
  
  useEffect(() => {
      window.addEventListener('resize', handleImageLoad);
      return () => window.removeEventListener('resize', handleImageLoad);
  }, []);

  const scaleX = imgDimensions.naturalWidth > 0 ? imgDimensions.width / imgDimensions.naturalWidth : 0;
  const scaleY = imgDimensions.naturalHeight > 0 ? imgDimensions.height / imgDimensions.naturalHeight : 0;

  return (
    <Modal onClose={onClose} size="large">
      <div className="flex flex-col h-full">
        <div className="relative flex-grow flex items-center justify-center">
            <div className="relative">
                <img
                    ref={imgRef}
                    src={photo.previewUrl}
                    alt="Preview"
                    className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-xl"
                    onLoad={handleImageLoad}
                />
                <div className="absolute top-0 left-0 pointer-events-none" style={{ width: `${imgDimensions.width}px`, height: `${imgDimensions.height}px` }}>
                    {faceDetections.map((detection, i) => (
                        <div
                            key={i}
                            className="absolute border-2 border-brand-accent hover:bg-brand-accent/30 transition-colors duration-200 pointer-events-auto cursor-pointer"
                            style={{
                                left: `${detection.box.x * scaleX}px`,
                                top: `${detection.box.y * scaleY}px`,
                                width: `${detection.box.width * scaleX}px`,
                                height: `${detection.box.height * scaleY}px`,
                            }}
                            onClick={() => onFindFaces(detection.descriptor)}
                            title="Find this person in other photos"
                        />
                    ))}
                </div>
            </div>
          
          {hasPrev && (
            <button
              onClick={onPrev}
              className="absolute left-0 sm:-left-12 top-1/2 -translate-y-1/2 p-2 bg-white/50 hover:bg-white rounded-full text-gray-800 transition-all duration-300"
              aria-label="Previous photo"
            >
              <ChevronLeftIcon className="w-8 h-8" />
            </button>
          )}
          {hasNext && (
            <button
              onClick={onNext}
              className="absolute right-0 sm:-right-12 top-1/2 -translate-y-1/2 p-2 bg-white/50 hover:bg-white rounded-full text-gray-800 transition-all duration-300"
              aria-label="Next photo"
            >
              <ChevronRightIcon className="w-8 h-8" />
            </button>
          )}
        </div>
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600 truncate pr-4" title={photo.file.name}>
            {photo.file.name}
          </p>
          <button
            onClick={() => onDelete(photo.id)}
            className="flex items-center justify-center px-4 py-2 bg-red-600 text-white font-bold rounded-lg shadow-md hover:bg-red-700 transition-colors"
            aria-label="Delete this photo"
          >
            <TrashIcon className="w-5 h-5 mr-2" />
            Delete
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default PhotoPreviewModal;
