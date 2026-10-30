import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";

export function firebaseAdmin() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
  if (!projectId || !clientEmail || !privateKey || !databaseURL) {
    throw new Error("Firebase server credentials are missing");
  }
  const app = getApps().find(app => app.name === "pixit-server") ?? initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }), databaseURL,
  }, "pixit-server");
  return { auth: getAuth(app), db: getDatabase(app) };
}
