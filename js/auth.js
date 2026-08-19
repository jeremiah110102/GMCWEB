import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
const isLogin =
  location.pathname.endsWith("/") || location.pathname.endsWith("index.html");
export async function getUserProfile(user) {
  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists())
    throw new Error(
      "Your account has no user profile. Ask an administrator to create one.",
    );
  return { id: snap.id, ...snap.data() };
}
export function requireAuth() {
  return new Promise((resolve, reject) =>
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        location.replace("index.html");
        return reject(new Error("Not signed in"));
      }
      try {
        resolve({ user, profile: await getUserProfile(user) });
      } catch (e) {
        await signOut(auth);
        alert(e.message);
        location.replace("index.html");
        reject(e);
      }
    }),
  );
}
if (isLogin) {
  onAuthStateChanged(auth, (user) => {
    if (user) location.replace("dashboard.html");
  });
  const form = document.querySelector("#loginForm");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.querySelector("#loginMessage"),
      button = form.querySelector("button[type=submit]");
    msg.textContent = "";
    button.disabled = true;
    button.textContent = "Signing in…";
    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        document.querySelector("#email").value.trim(),
        document.querySelector("#password").value,
      );
      await getUserProfile(credential.user);
      location.replace("dashboard.html");
    } catch (err) {
      msg.textContent =
        err.code === "auth/invalid-credential"
          ? "Incorrect email or password."
          : err.message;
      button.disabled = false;
      button.textContent = "Sign in";
    }
  });
  document.querySelector("#togglePassword")?.addEventListener("click", (e) => {
    const field = document.querySelector("#password");
    field.type = field.type === "password" ? "text" : "password";
    e.currentTarget.textContent = field.type === "password" ? "Show" : "Hide";
  });
}
