const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const path = require('path');
require('dotenv').config();

// Service account path - use environment variable if available, otherwise use default path
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 
  path.join(__dirname, 'twitterclone-47ebf-firebase-adminsdk-fbsvc-c23c9e0019.json');

// Storage bucket - use environment variable if available
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || 'twitterclone-47ebf.appspot.com';

// Initialize Firebase Admin SDK with service account
const app = initializeApp({
  credential: cert(serviceAccountPath),
  storageBucket: storageBucket
});

// Initialize Firestore and Storage
const db = getFirestore();
const storage = getStorage();

console.log('Firebase Admin SDK initialized successfully');
console.log(`Using service account: ${serviceAccountPath}`);
console.log(`Using storage bucket: ${storageBucket}`);

module.exports = {
  app,
  db,
  storage
}; 