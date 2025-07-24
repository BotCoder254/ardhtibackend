const { db } = require('../config/firebase');

/**
 * Process M-Pesa callback
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const processMpesaCallback = async (req, res) => {
  try {
    const { Body } = req.body;
    const { orderId } = req.params;
    
    console.log(`Received M-Pesa callback for order ${orderId}:`, JSON.stringify(req.body));
    
    if (!Body || !Body.stkCallback) {
      console.error('Invalid callback format');
      return res.json({
        ResponseCode: "0",
        ResponseDesc: "Success"
      });
    }
    
    const { ResultCode, ResultDesc, CheckoutRequestID } = Body.stkCallback;
    
    // Find the order in Firestore
    const orderRef = db.collection('subscription_orders').doc(orderId);
    const orderDoc = await orderRef.get();
    
    if (!orderDoc.exists) {
      console.error(`Order ${orderId} not found`);
      return res.json({
        ResponseCode: "0",
        ResponseDesc: "Success"
      });
    }
    
    const orderData = orderDoc.data();
    
    // Update order status based on callback result
    if (ResultCode === 0) {
      // Payment successful
      await updateSubscriptionStatus(orderRef, orderData, CheckoutRequestID);
    } else {
      // Payment failed
      await orderRef.update({
        status: 'failed',
        resultCode: ResultCode,
        resultDesc: ResultDesc,
        updatedAt: new Date()
      });
    }
    
    // Always respond with success to M-Pesa
    return res.json({
      ResponseCode: "0",
      ResponseDesc: "Success"
    });
  } catch (error) {
    console.error('Error processing M-Pesa callback:', error);
    
    // Always respond with success to M-Pesa
    return res.json({
      ResponseCode: "0",
      ResponseDesc: "Success"
    });
  }
};

/**
 * Update subscription status after successful payment
 * @param {Object} orderRef - Firestore document reference
 * @param {Object} orderData - Order data
 * @param {string} checkoutRequestID - M-Pesa checkout request ID
 */
const updateSubscriptionStatus = async (orderRef, orderData, checkoutRequestID) => {
  try {
    const { userId, planId, planName, amount } = orderData;
    
    // Calculate expiration date (30 days from now)
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 30);
    
    // Update order status
    await orderRef.update({
      status: 'completed',
      completedAt: new Date(),
      transactionId: checkoutRequestID
    });
    
    // Update user subscription status
    const userRef = db.collection('users').doc(userId);
    await userRef.update({
      isSubscribed: true,
      subscriptionPlan: planName,
      subscriptionDate: new Date().toISOString(),
      subscriptionExpiresAt: expirationDate.toISOString()
    });
    
    // Add subscription record
    await db.collection('subscriptions').add({
      userId,
      planId,
      planName,
      amount,
      currency: 'KES',
      status: 'active',
      paymentMethod: 'M-Pesa',
      paymentReference: checkoutRequestID,
      orderId: orderRef.id,
      createdAt: new Date().toISOString(),
      expiresAt: expirationDate.toISOString()
    });
    
    console.log(`Subscription activated for user ${userId}, plan: ${planName}`);
    return true;
  } catch (error) {
    console.error('Error updating subscription status:', error);
    return false;
  }
};

/**
 * Check payment status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const checkPaymentStatus = async (req, res) => {
  try {
    const { queryCode } = req.body;
    
    if (!queryCode) {
      return res.status(400).json({
        success: false,
        message: 'Checkout request ID is required'
      });
    }
    
    // Find the order with this checkout request ID
    const ordersSnapshot = await db.collection('subscription_orders')
      .where('checkoutRequestId', '==', queryCode)
      .limit(1)
      .get();
    
    if (ordersSnapshot.empty) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    const orderDoc = ordersSnapshot.docs[0];
    const orderData = orderDoc.data();
    
    // Return order status
    return res.status(200).json({
      success: true,
      status: orderData.status,
      orderId: orderDoc.id,
      userId: orderData.userId,
      planName: orderData.planName,
      amount: orderData.amount
    });
  } catch (error) {
    console.error('Error checking payment status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check payment status'
    });
  }
};

module.exports = {
  processMpesaCallback,
  checkPaymentStatus
}; 