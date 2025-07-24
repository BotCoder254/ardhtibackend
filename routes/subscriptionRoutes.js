const express = require('express');
const { processMpesaCallback, checkPaymentStatus } = require('../controllers/subscriptionController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Process M-Pesa callback (public route)
router.post('/mpesa/callback/:orderId', processMpesaCallback);

// Check payment status (protected route)
router.post('/payment/status', verifyToken, checkPaymentStatus);

module.exports = router; 