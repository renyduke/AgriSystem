import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabase/supabaseClient';
import { auth, db } from '../../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const Account = () => {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    role: '',
    jobTitle: '',
    avatarUrl: null
  });
  const [showPreview, setShowPreview] = useState(false);

  const [userId, setUserId] = useState(null);
  const [availableTitles, setAvailableTitles] = useState([]);

  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetchTitles = async () => {
      try {
        const docRef = doc(db, "settings", "jobTitles");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().titles) {
          setAvailableTitles(docSnap.data().titles);
        }
      } catch (err) {
        console.error("Error fetching job titles:", err);
      }
    };
    fetchTitles();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setProfile({
              name: data.fullName || '',
              email: data.email || user.email || '',
              role: data.position ? data.position.charAt(0).toUpperCase() + data.position.slice(1) : '',
              jobTitle: data.jobTitle || '',
              avatarUrl: data.avatarUrl || null
            });
          }
        } catch (error) {
          console.error("Error loading account profile:", error);
          setMessage({ text: 'Failed to load profile data.', type: 'error' });
        }
      } else {
        setUserId(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!userId) {
      setMessage({ text: 'You must be logged in to save.', type: 'error' });
      return;
    }
    
    setLoading(true);
    setMessage({ text: '', type: '' });
    
    try {
      // Update actual Firestore document
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        fullName: profile.name,
        email: profile.email,
        jobTitle: profile.jobTitle || ""
      });
      
      setMessage({ text: 'Profile updated successfully!', type: 'success' });
      
      // Clear success message after 3 seconds
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (error) {
      console.error('Error saving profile:', error);
      setMessage({ text: 'Failed to update profile. Please try again.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (event) => {
    try {
      setUploading(true);
      setMessage({ text: '', type: '' });

      if (!userId) {
        throw new Error('You must be logged in to upload a photo.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      // Uniquely identify the file by the user's uid so we don't overwrite other admins
      const fileName = `admin-avatar-${userId}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload to Supabase bucket
      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(filePath, file, {
          upsert: true // allow overwriting the user's old image if it exists
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get Public URL
      const { data } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(filePath);

      const publicUrl = data.publicUrl;

      // Update state
      const updatedProfile = { ...profile, avatarUrl: publicUrl };
      setProfile(updatedProfile);
      
      // Save avatarUrl to Firestore
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        avatarUrl: publicUrl
      });
      
      setMessage({ text: 'Profile picture updated successfully!', type: 'success' });
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
      
    } catch (error) {
      setMessage({ text: error.message || 'Error uploading image.', type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!profile.avatarUrl) return;
    
    try {
      setUploading(true);
      
      if (!userId) {
        throw new Error('Not authenticated.');
      }
      
      // Extract filename from the public URL to delete from bucket
      const urlParts = profile.avatarUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      
      const { error } = await supabase.storage
        .from('profile-pictures')
        .remove([fileName]);

      if (error) throw error;

      const updatedProfile = { ...profile, avatarUrl: null };
      setProfile(updatedProfile);
      
      // Remove avatarUrl from Firestore
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        avatarUrl: null
      });
      
      setMessage({ text: 'Profile picture removed.', type: 'success' });
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);

    } catch (error) {
       console.error("Failed to delete image:", error);
       setMessage({ text: 'Failed to remove picture from storage.', type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 px-6 pt-2 pb-8 w-full font-sans transition-colors duration-300">
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-2">Account Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Manage your account details and profile picture.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors duration-300">
        
        {message.text && (
          <div className={`p-4 ${message.type === 'error' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
            {message.text}
          </div>
        )}

        <div className="p-6 sm:p-8">
          
          <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-6 sm:space-y-0 sm:space-x-8 mb-8 pb-8 border-b border-slate-100 dark:border-slate-800">
            
            <div className="flex-shrink-0">
               <div 
                 className="relative w-32 h-32 rounded-full border-4 border-slate-50 dark:border-slate-800 shadow-sm bg-slate-50 dark:bg-slate-800 flex items-center justify-center group cursor-pointer"
                 onClick={() => profile.avatarUrl && setShowPreview(true)}
               >
                  <div className="w-full h-full rounded-full overflow-hidden">
                    {profile.avatarUrl ? (
                      <img 
                        src={profile.avatarUrl} 
                        alt="Profile" 
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-700">
                        <svg className="h-20 w-20 text-slate-300 dark:text-slate-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Camera Icon Overlay */}
                  <div 
                    className="absolute bottom-1 right-1 bg-green-600 p-2 rounded-full border-2 border-white shadow-md text-white hover:bg-green-700 transition-colors cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current.click();
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>

                  {uploading && (
                    <div className="absolute inset-0 rounded-full bg-black bg-opacity-40 flex items-center justify-center">
                       <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                       </svg>
                    </div>
                  )}
               </div>
            </div>

            <div className="flex-1 text-center sm:text-left">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Profile picture</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Click the image to view, or the camera icon to upload.
              </p>
              
              <div className="mt-4 flex flex-wrap justify-center sm:justify-start gap-3">
                <input
                  type="file"
                  id="avatar-upload"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  disabled={uploading}
                  className="hidden"
                  ref={fileInputRef}
                />
                
                {profile.avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setShowPreview(true)}
                    className="inline-flex items-center px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-all text-sm"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    View
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => fileInputRef.current.click()}
                  disabled={uploading}
                  className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all text-sm disabled:opacity-50"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Edit
                </button>

                {profile.avatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    disabled={uploading}
                    className="inline-flex items-center px-4 py-2 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/10 text-red-600 dark:text-red-400 rounded-lg font-medium transition-all text-sm disabled:opacity-50"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Form Section */}
          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div className="grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-8">
              
              <div className="sm:col-span-2">
                <label htmlFor="name" className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">Full Name</label>
                <input
                  type="text"
                  name="name"
                  id="name"
                  value={profile.name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all text-slate-700 dark:text-slate-200"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">Email Address</label>
                <input
                  type="email"
                  name="email"
                  id="email"
                  value={profile.email}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all text-slate-700 dark:text-slate-200"
                />
              </div>

              <div>
                <label htmlFor="jobTitle" className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">Position / Job Title</label>
                <select
                  name="jobTitle"
                  id="jobTitle"
                  value={profile.jobTitle}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all text-slate-700 dark:text-slate-200"
                >
                  <option value="">Select a title</option>
                  {availableTitles.map(title => (
                    <option key={title} value={title}>{title}</option>
                  ))}
                  {profile.jobTitle && !availableTitles.includes(profile.jobTitle) && (
                    <option value={profile.jobTitle}>{profile.jobTitle}</option>
                  )}
                </select>
              </div>

              <div>
                <label htmlFor="role" className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">Role (System Access)</label>
                <input
                  type="text"
                  name="role"
                  id="role"
                  value={profile.role}
                  readOnly
                  className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none transition-all text-slate-500 dark:text-slate-400 cursor-not-allowed"
                />
              </div>

            </div>

            <div className="pt-8 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-all shadow-md shadow-green-100 active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Details'}
              </button>
            </div>
          </form>

        </div>
      </div>

      {/* Image Preview Modal */}
      {showPreview && profile.avatarUrl && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowPreview(false)}
        >
          <div 
            className="relative max-w-2xl w-full bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Profile Picture Preview</h2>
              <button 
                onClick={() => setShowPreview(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <svg className="w-6 h-6 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="aspect-square w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950">
              <img 
                src={profile.avatarUrl} 
                alt="Full Profile" 
                className="max-w-full max-h-full object-contain"
              />
            </div>
            <div className="p-6 bg-white dark:bg-slate-900 flex justify-end gap-3">
              <button
                onClick={() => setShowPreview(false)}
                className="px-6 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-all"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowPreview(false);
                  fileInputRef.current.click();
                }}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-all shadow-md shadow-green-100"
              >
                Update Image
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Account;
