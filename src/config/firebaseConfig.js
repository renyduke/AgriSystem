// Import Firebase SDK
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Firebase configuration (Replace with your actual config)
const firebaseConfig = {
    apiKey: "AIzaSyBmS_gLpf_xqM-NZ7TbU2GWcuU2rLFPfrA",
    authDomain: "joemarie-app.firebaseapp.com",
    projectId: "joemarie-app",
    storageBucket: "joemarie-app.appspot.com", // Fix incorrect storage bucket URL
    messagingSenderId: "594533900991",
    appId: "1:594533900991:web:b15326ab4d2e6e30b55c0a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore Database
const db = getFirestore(app);   

export { db };



