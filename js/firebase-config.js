// Replace only these values with those shown in Firebase Console > Project settings.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
const firebaseConfig = {
apiKey: "AIzaSyCW0gw9ZKehZpInXXVKwrciwr_hpNeaQ-U",
  authDomain: "gmcapplication.firebaseapp.com",
  projectId: "gmcapplication",
  storageBucket: "gmcapplication.firebasestorage.app",
  messagingSenderId: "899798002303",
  appId: "1:899798002303:web:b2212ff2c6dd215e09ed4a"
};
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
