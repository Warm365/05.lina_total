import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: "lina-total.firebaseapp.com",
    projectId: "lina-total",
    storageBucket: "lina-total.firebasestorage.app",
    messagingSenderId: "517796044927",
    appId: "1:517796044927:web:a5255e985ffbeca74f1f4a",
    measurementId: "G-ERE3TMYJQ6"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
