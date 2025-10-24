import React, { useState } from 'react';
import Modal from './Modal';
import { Album } from '../types';
import Spinner from './Spinner';

interface EditAlbumModalProps {
  album: Album;
  onClose: () => void;
  onSave: (album: Album, newName: string) => void;
  isSaving: boolean;
}

const EditAlbumModal: React.FC<EditAlbumModalProps> = ({ album, onClose, onSave, isSaving }) => {
  const [newName, setNewName] = useState(album.name);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    onSave(album, newName);
  };

  return (
    <Modal onClose={onClose}>
      <form onSubmit={handleSave}>
        <h2 className="text-xl font-bold text-brand-primary mb-4">Edit Album Name</h2>
        <div>
          <label htmlFor="albumName" className="block text-sm font-medium text-gray-700">
            Album Name
          </label>
          <input
            type="text"
            id="albumName"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-accent focus:border-brand-accent text-gray-900"
            required
            disabled={isSaving}
          />
        </div>
        <div className="mt-6 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 disabled:bg-gray-100"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 w-32 flex justify-center bg-brand-accent text-white font-bold rounded-md hover:bg-brand-accent-hover disabled:bg-gray-400"
            disabled={isSaving}
          >
            {isSaving ? <Spinner size="sm" /> : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default EditAlbumModal;
