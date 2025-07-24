const admin = require('firebase-admin');
const { db } = require('../config/firebase');

/**
 * Middleware to verify Firebase ID token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized: No token provided' 
      });
    }
    
    const token = authHeader.split('Bearer ')[1];
    
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    
    // Get additional user data from Firestore using Admin SDK
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    
    if (userDoc.exists) {
      req.userInfo = userDoc.data();
    }
    
    next();
  } catch (error) {
    console.error('Error verifying token:', error);
    return res.status(401).json({ 
      success: false, 
      message: 'Unauthorized: Invalid token', 
      error: error.message 
    });
  }
};

/**
 * Middleware to verify user is an admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const verifyAdmin = (req, res, next) => {
  if (!req.userInfo || req.userInfo.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Forbidden: Admin access required' 
    });
  }
  
  next();
};

/**
 * Middleware to verify user has a premium subscription
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const verifyPremium = (req, res, next) => {
  if (!req.userInfo || !req.userInfo.isSubscribed || req.userInfo.subscriptionPlan !== 'Pro') {
    return res.status(403).json({ 
      success: false, 
      message: 'Forbidden: Premium subscription required' 
    });
  }
  
  next();
};

/**
 * Middleware to verify user has any subscription
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const verifySubscribed = (req, res, next) => {
  if (!req.userInfo || !req.userInfo.isSubscribed) {
    return res.status(403).json({ 
      success: false, 
      message: 'Forbidden: Subscription required' 
    });
  }
  
  next();
};

module.exports = {
  verifyToken,
  verifyAdmin,
  verifyPremium,
  verifySubscribed
}; 