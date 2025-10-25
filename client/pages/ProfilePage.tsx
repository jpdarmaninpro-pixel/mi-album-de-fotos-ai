import React, { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { PhotographerProfile } from '../types';
import Spinner from '../components/Spinner';
import { UserIcon, ContactIcon, HeartIcon, PhoneIcon } from '../components/icons';
import { slugify } from '../lib/helpers';

const ProfilePage: React.FC = () => {
    const { getProfile, saveProfile, uploadFile } = useApi();
    const [profile, setProfile] = useState<Partial<PhotographerProfile>>({});
    const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        const fetchProfile = async () => {
            setLoading(true);
            try {
                const existingProfile = await getProfile();
                setProfile(existingProfile);
                if (existingProfile.profilePictureUrl) {
                    setPreviewUrl(existingProfile.profilePictureUrl);
                }
            } catch (err: any) {
                if (err.message.includes('404')) {
                    // Profile doesn't exist, which is fine.
                    setProfile({ name: '', contactLink: '', donationLink: '', zellePhoneNumber: '' });
                } else {
                    setError('Failed to load profile.');
                }
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [getProfile]);
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setProfilePictureFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setProfile({ ...profile, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        setSuccess(null);
        
        try {
            let profileToSave = { ...profile };

            if (profilePictureFile) {
                const uniqueFileName = `${slugify(profile.name || 'profile')}-${Date.now()}.${profilePictureFile.name.split('.').pop()}`;
                const { key } = await uploadFile(profilePictureFile, uniqueFileName);
                const s3Url = `https://${process.env.VITE_AWS_S3_BUCKET}.s3.${process.env.VITE_AWS_REGION}.amazonaws.com/${key}`;
                profileToSave.profilePictureS3Key = key;
                profileToSave.profilePictureUrl = s3Url;
            }

            await saveProfile(profileToSave as PhotographerProfile);
            setSuccess('Profile saved successfully!');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError('Failed to save profile. Please try again.');
        } finally {
            setSaving(false);
        }
    };
    
    if (loading) {
        return <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>;
    }

    return (
        <div className="container mx-auto p-4 md:p-8">
            <h1 className="text-3xl font-bold text-brand-primary mb-6">Your Photographer Profile</h1>
            <form onSubmit={handleSubmit} className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md">
                {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}
                {success && <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">{success}</div>}

                <div className="space-y-6">
                    {/* Profile Picture */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Profile Picture <span className="text-red-500">*</span></label>
                        <div className="mt-2 flex items-center space-x-4">
                            {previewUrl ? (
                                <img src={previewUrl} alt="Profile preview" className="w-20 h-20 rounded-full object-cover shadow-sm" />
                            ) : (
                                <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
                                    <UserIcon className="w-10 h-10 text-gray-400" />
                                </div>
                            )}
                            <label htmlFor="profile-picture-upload" className="cursor-pointer bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">
                                Change
                            </label>
                            <input id="profile-picture-upload" type="file" className="sr-only" accept="image/*" onChange={handleFileChange} />
                        </div>
                    </div>
                    
                    {/* Name */}
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">Full Name <span className="text-red-500">*</span></label>
                        <input type="text" name="name" id="name" value={profile.name || ''} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900" />
                    </div>

                    {/* Contact Link */}
                    <div>
                        <label htmlFor="contactLink" className="flex items-center gap-2 text-sm font-medium text-gray-700"><ContactIcon className="w-4 h-4" />Contact Link</label>
                        <input type="url" name="contactLink" id="contactLink" value={profile.contactLink || ''} onChange={handleChange} placeholder="e.g., mailto:email@example.com" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900" />
                    </div>
                    
                    {/* Donation Link */}
                    <div>
                        <label htmlFor="donationLink" className="flex items-center gap-2 text-sm font-medium text-gray-700"><HeartIcon className="w-4 h-4" />Donation/Support Link</label>
                        <input type="url" name="donationLink" id="donationLink" value={profile.donationLink || ''} onChange={handleChange} placeholder="e.g., https://buymeacoffee.com/..." className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900" />
                    </div>

                    {/* Zelle */}
                    <div>
                        <label htmlFor="zellePhoneNumber" className="flex items-center gap-2 text-sm font-medium text-gray-700"><PhoneIcon className="w-4 h-4" />Zelle Phone Number</label>
                        <input type="tel" name="zellePhoneNumber" id="zellePhoneNumber" value={profile.zellePhoneNumber || ''} onChange={handleChange} placeholder="e.g., 123-456-7890" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900" />
                    </div>
                </div>

                <div className="mt-8 pt-5 border-t border-gray-200">
                    <div className="flex justify-end">
                        <button type="submit" disabled={saving} className="w-48 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-accent hover:bg-brand-accent-hover disabled:bg-gray-400">
                            {saving ? <Spinner size="sm" /> : 'Save Profile'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default ProfilePage;
