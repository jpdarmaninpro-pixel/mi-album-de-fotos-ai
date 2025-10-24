import React from 'react';
import { XIcon } from './icons';

interface ModalProps {
  onClose: () => void;
  children: React.ReactNode;
  size?: 'normal' | 'large';
}

const Modal: React.FC<ModalProps> = ({ onClose, children, size = 'normal' }) => {
  const sizeClasses = {
    normal: 'max-w-lg',
    large: 'max-w-5xl'
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className={`bg-white rounded-lg shadow-2xl p-6 relative w-full ${sizeClasses[size]} transform transition-all duration-300 ease-out animate-fade-in-up`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-2 rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition-colors"
          aria-label="Close modal"
        >
          <XIcon className="w-6 h-6" />
        </button>
        {children}
      </div>
      <style>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.3s forwards;
        }
      `}</style>
    </div>
  );
};

export default Modal;