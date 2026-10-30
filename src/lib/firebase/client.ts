"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getDatabase } from "firebase/database";

export function firebaseClient() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  const required = {
    NEXT_PUBLIC_FIREBASE_API_KEY: config.apiKey,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: config.authDomain,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: config.projectId,
    NEXT_PUBLIC_FIREBASE_DATABASE_URL: config.databaseURL,
  };
  const missing = Object.entries(required).filter(([, value]) => !value || value.startsWith("your-")).map(([key]) => key);
  if (missing.length) {
    throw new Error(`Missing Firebase config: ${missing.join(", ")}. Set these in .env.local and restart Next.js.`);
  }
  if (config.projectId?.includes("://") || config.databaseURL?.includes("console.firebase.google.com")) {
    throw new Error("Use the Firebase project ID (not a URL) and the Realtime Database endpoint (not the console page URL).");
  }
  const app = getApps().length ? getApp() : initializeApp(config);
  return { auth: getAuth(app), db: getDatabase(app) };
}

let signingIn: Promise<import("firebase/auth").User> | undefined;
export async function sessionUser() {
  const { auth } = firebaseClient();
  await auth.authStateReady();
  if (auth.currentUser) return auth.currentUser;
  signingIn ??= signInAnonymously(auth).then(result => result.user).finally(() => { signingIn = undefined; });
  return signingIn;
}
