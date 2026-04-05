import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../supabase/supabaseClient';
import { auth, db } from '../../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { LogOut, Sun, Moon, Bell, RefreshCw } from "lucide-react";
import NotificationDropdown from './NotificationDropdown';
import { useTheme } from '../../context/ThemeContext';

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { darkMode, toggleDarkMode } = useTheme();

  const getPageTitle = () => {
    const path = location.pathname;
    
    if (path === '/home' || path === '/home/') return 'Home';
    if (path === '/home/account') return 'Account Settings';
    if (path === '/home/maps') return 'Maps';
    if (path === '/home/vegetables') return 'Vegetables Management';
    if (path === '/home/profile') return 'Profile';
    if (path === '/home/drawmap') return 'Draw Map';
    if (path === '/home/analysis') return 'Farmer Dashboard';
    if (path.startsWith('/home/farmer/')) return 'Farmer Profile';
    if (path === '/home/farmer') return 'Farmer Profile';
    if (path === '/home/usermanagement') return 'User Management';
    if (path === '/home/farmerregister') return 'Farmer Registration';
    if (path === '/home/reports') return 'Reports';
    if (path === '/home/suggest-farmer') return 'Farmer Listing';
    if (path === '/home/damagereport') return 'Damage Report';
    if (path === '/home/settings') return 'Settings';
    if (path === '/home/dashboard') return 'V&P Results';
    if (path === '/home/volume') return 'Volume Data';
    if (path === '/home/price') return 'Price Data';
    if (path === '/home/farmer-banking') return 'Farmer Banking';

    const segments = path.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    
    if (lastSegment) {
      return lastSegment
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
    
    return 'Dashboard';
  };

  const [profile, setProfile] = useState({
    name: 'Admin User',
    role: 'Loading...',
    avatarUrl: null
  });

  const [userId, setUserId] = useState(null);

  useEffect(() => {
    // Listen for auth state changes
    let unsubscribeProfile = () => {};
    
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUserId(currentUser.uid);
        
        // Use onSnapshot for REALTIME updates
        unsubscribeProfile = onSnapshot(doc(db, "users", currentUser.uid), (userDoc) => {
          if (userDoc.exists()) {
            const data = userDoc.data();
            setProfile({
              name: data.fullName || 'Admin User',
              role: data.position ? data.position.charAt(0).toUpperCase() + data.position.slice(1) : 'Admin',
              avatarUrl: data.avatarUrl || null,
            });
          }
        }, (error) => {
          console.error("Error listening to admin profile:", error);
        });
      } else {
        // Not logged in or logged out
        setUserId(null);
        setProfile({
          name: 'Guest',
          role: 'Not Authenticated',
          avatarUrl: null
        });
        unsubscribeProfile();
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeProfile();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Remove any leftover local mock data just in case
      localStorage.removeItem('admin_profile');
      navigate('/');
    } catch (error) {
      console.error('Error logging out:', error);
      alert("Failed to log out. Please try again.");
    }
  };

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => window.location.reload(), 400);
  };

  return (
    <header className="bg-white dark:bg-slate-900 shadow-sm sticky top-0 z-40 w-full h-16 flex items-center justify-between px-6 border-b border-gray-200 dark:border-slate-800 transition-colors duration-300">
      
      {/* Left side: branding or welcome message (optional) */}
      <div className="flex items-center">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100 hidden md:block">{getPageTitle()}</h1>
      </div>

      {/* Right side: Notifications, Profile, Logout */}
      <div className="flex items-center space-x-6">
        
        {/* Notification Icon Component */}
        <NotificationDropdown />

        {/* Refresh Button */}
        <button
          onClick={handleRefresh}
          className="p-2 rounded-lg bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all duration-200 border border-gray-200 dark:border-slate-700 shadow-sm active:scale-95"
          title="Refresh page"
        >
          <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin text-green-500' : ''}`} />
        </button>

        {/* Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-lg bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all duration-200 border border-gray-200 dark:border-slate-700 shadow-sm active:scale-95"
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {darkMode ? (
            <Sun className="w-5 h-5 text-yellow-500" />
          ) : (
            <Moon className="w-5 h-5 text-slate-700" />
          )}
        </button>

        {/* Vertical Divider */}
        <div className="h-8 w-px bg-gray-200 hidden sm:block"></div>

        {/* Admin Profile Area */}
        <div className="flex items-center">
          <Link to="/home/account" className="flex items-center focus:outline-none cursor-pointer">
            <div className="flex items-center gap-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-full py-1.5 px-3 shadow-sm hover:shadow-md transition-shadow">
              
              {/* Profile Image Component */}
              <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-gray-100 dark:border-slate-700 flex-shrink-0 bg-gray-50 dark:bg-slate-700 flex items-center justify-center">
                {profile.avatarUrl ? (
                  <img 
                    src={profile.avatarUrl} 
                    alt="Admin Profile" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  // Default SVG Avatar
                  <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                )}
              </div>

              {/* Text Layout Component */}
              <div className="flex flex-col text-left pr-2 hidden sm:flex">
                <span className="text-sm font-bold text-gray-800 dark:text-gray-100 leading-tight">{profile.name}</span>
                <span className="text-xs text-green-600 dark:text-green-500 font-medium leading-tight">{profile.role}</span>
              </div>
              
            </div>
          </Link>
        </div>

        {/* Logout Button */}
        <button 
          onClick={handleLogout}
          className="flex items-center space-x-1 text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-md transition-colors font-medium text-sm focus:outline-none"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="hidden lg:block">Logout</span>
        </button>

      </div>
    </header>
  );
};

export default Header;
