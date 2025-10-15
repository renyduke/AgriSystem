import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // Import Firestore

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
export const auth = getAuth(app);
export const db = getFirestore(app); // Export Firestore
export default app; 
