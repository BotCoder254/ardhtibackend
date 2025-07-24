const { sendTicketUpdateEmail, sendRequestUpdateEmail } = require('../services/emailService');
const { sendTicketUpdateSms, sendRequestUpdateSms } = require('../services/smsService');
const { db } = require('../config/firebase');

/**
 * Create in-app notification
 * @param {Object} data - Notification data
 * @returns {Promise<string>} - Notification ID
 */
const createInAppNotification = async (data) => {
  try {
    // Use Admin SDK for Firestore operations
    const notificationRef = await db.collection('notifications').add({
      ...data,
      isRead: false,
      createdAt: new Date()
    });
    
    return notificationRef.id;
  } catch (error) {
    console.error('Error creating in-app notification:', error);
    throw error;
  }
};

/**
 * Check if user has a premium subscription
 * @param {string} subscriptionPlan - User's subscription plan
 * @returns {boolean} - Whether user is premium
 */
const isPremiumUser = (subscriptionPlan) => {
  if (!subscriptionPlan) return false;
  
  // Check for various premium plan names
  const premiumPlans = ['Pro', 'Pro Plan', 'Premium', 'Premium Plan'];
  return premiumPlans.some(plan => 
    subscriptionPlan.toLowerCase().includes(plan.toLowerCase())
  );
};

/**
 * Send notifications for ticket updates
 * @param {Object} options - Notification options
 * @param {string} options.ticketId - Ticket ID
 * @param {string} options.userId - User ID
 * @param {string} options.status - New ticket status
 * @param {string} options.adminMessage - Admin's response message
 * @param {boolean} options.isPremium - Whether user is premium
 * @returns {Promise<Object>} - Notification results
 */
const sendTicketNotifications = async (options) => {
  const { ticketId, userId, status, adminMessage, isPremium: isPremiumParam } = options;
  
  try {
    // Get user details using Admin SDK
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new Error(`User ${userId} not found`);
    }
    
    const userData = userDoc.data();
    const { name, email, phoneNumber, subscriptionPlan } = userData;
    
    // Determine if user is premium (either from param or from user data)
    const isPremium = isPremiumParam !== undefined ? isPremiumParam : isPremiumUser(subscriptionPlan);
    
    console.log(`Sending ticket notifications to user ${userId}:`, { 
      name, 
      email, 
      phoneNumber: phoneNumber || 'none',
      isPremium,
      subscriptionPlan,
      premiumDetectionMethod: isPremiumParam !== undefined ? 'param' : 'subscriptionPlan'
    });
    
    // Get ticket details using Admin SDK
    const ticketDoc = await db.collection('tickets').doc(ticketId).get();
    if (!ticketDoc.exists) {
      throw new Error(`Ticket ${ticketId} not found`);
    }
    
    const ticketData = ticketDoc.data();
    const { title } = ticketData;
    
    // Create in-app notification
    const notificationId = await createInAppNotification({
      userId,
      type: 'ticket',
      title: `Ticket #${ticketId} Update`,
      message: `Your ticket "${title}" has been ${status.toLowerCase()}.`,
      status,
      ticketId,
      link: `/support/my-tickets?id=${ticketId}`
    });
    
    // Prepare results object
    const results = {
      inApp: { success: true, id: notificationId },
      email: { success: false },
      sms: { success: false }
    };
    
    // For premium users, send email and SMS
    if (isPremium) {
      // Send email notification if email exists
      if (email) {
        try {
          const emailResult = await sendTicketUpdateEmail({
            email,
            name: name || 'User',
            ticketId,
            ticketTitle: title,
            status,
            adminMessage,
            ticketUrl: `https://ardhikenya.com/support/my-tickets?id=${ticketId}`
          });
          
          results.email = { success: emailResult };
          console.log(`Email notification for ticket ${ticketId} sent:`, emailResult);
        } catch (emailError) {
          console.error(`Error sending email for ticket ${ticketId}:`, emailError);
          results.email = { success: false, error: emailError.message };
        }
      } else {
        console.log(`No email available for user ${userId}, skipping email notification`);
      }
      
      // Send SMS notification if status is resolved or denied and phone number exists
      if (['resolved', 'denied'].includes(status.toLowerCase()) && phoneNumber) {
        try {
          const smsResult = await sendTicketUpdateSms({
            phoneNumber,
            name: name || 'User',
            ticketId,
            status,
            portalUrl: 'https://ardhikenya.com/support/my-tickets'
          });
          
          results.sms = smsResult;
          console.log(`SMS notification for ticket ${ticketId} sent:`, smsResult);
        } catch (smsError) {
          console.error(`Error sending SMS for ticket ${ticketId}:`, smsError);
          results.sms = { success: false, error: smsError.message };
        }
      } else {
        console.log(`SMS notification not sent: status=${status}, phoneNumber=${phoneNumber ? 'exists' : 'missing'}`);
      }
    } else {
      console.log(`User ${userId} is not premium (${subscriptionPlan}), skipping email and SMS notifications`);
    }
    
    // Update ticket with notification status using Admin SDK
    await db.collection('tickets').doc(ticketId).update({
      notificationSent: true,
      notificationDetails: results,
      updatedAt: new Date()
    });
    
    return results;
  } catch (error) {
    console.error('Error sending ticket notifications:', error);
    throw error;
  }
};

/**
 * Send notifications for request updates
 * @param {Object} options - Notification options
 * @param {string} options.requestId - Request ID
 * @param {string} options.userId - User ID
 * @param {string} options.status - New request status
 * @param {string} options.adminMessage - Admin's message
 * @param {string} options.reportUrl - URL to download report (if available)
 * @param {boolean} options.isPremium - Whether user is premium
 * @returns {Promise<Object>} - Notification results
 */
const sendRequestNotifications = async (options) => {
  const { requestId, userId, status, adminMessage, reportUrl, isPremium: isPremiumParam } = options;
  
  try {
    // Get user details using Admin SDK
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new Error(`User ${userId} not found`);
    }
    
    const userData = userDoc.data();
    const { name, email, phoneNumber, subscriptionPlan } = userData;
    
    // Determine if user is premium (either from param or from user data)
    const isPremium = isPremiumParam !== undefined ? isPremiumParam : isPremiumUser(subscriptionPlan);
    
    console.log(`Sending request notifications to user ${userId}:`, { 
      name, 
      email, 
      phoneNumber: phoneNumber || 'none',
      isPremium,
      subscriptionPlan,
      premiumDetectionMethod: isPremiumParam !== undefined ? 'param' : 'subscriptionPlan'
    });
    
    // Get request details using Admin SDK
    const requestDoc = await db.collection('requests').doc(requestId).get();
    if (!requestDoc.exists) {
      throw new Error(`Request ${requestId} not found`);
    }
    
    const requestData = requestDoc.data();
    const { parcelNumber } = requestData;
    
    // Create in-app notification
    const notificationId = await createInAppNotification({
      userId,
      type: 'request',
      title: `Request #${requestId} Update`,
      message: `Your land verification request for ${parcelNumber} is now ${status.toLowerCase()}.`,
      status,
      requestId,
      link: `/my-requests?id=${requestId}`
    });
    
    // Prepare results object
    const results = {
      inApp: { success: true, id: notificationId },
      email: { success: false },
      sms: { success: false }
    };
    
    // For premium users, send email and SMS
    if (isPremium) {
      // Send email notification if email exists
      if (email) {
        try {
          const emailResult = await sendRequestUpdateEmail({
            email,
            name: name || 'User',
            requestId,
            parcelNumber,
            status,
            adminMessage,
            requestUrl: `https://ardhikenya.com/my-requests?id=${requestId}`,
            reportUrl
          });
          
          results.email = { success: emailResult };
          console.log(`Email notification for request ${requestId} sent:`, emailResult);
        } catch (emailError) {
          console.error(`Error sending email for request ${requestId}:`, emailError);
          results.email = { success: false, error: emailError.message };
        }
      } else {
        console.log(`No email available for user ${userId}, skipping email notification`);
      }
      
      // Send SMS notification if status is completed or rejected and phone number exists
      if (['completed', 'rejected'].includes(status.toLowerCase()) && phoneNumber) {
        try {
          const smsResult = await sendRequestUpdateSms({
            phoneNumber,
            name: name || 'User',
            requestId,
            status,
            portalUrl: 'https://ardhikenya.com/my-requests'
          });
          
          results.sms = smsResult;
          console.log(`SMS notification for request ${requestId} sent:`, smsResult);
        } catch (smsError) {
          console.error(`Error sending SMS for request ${requestId}:`, smsError);
          results.sms = { success: false, error: smsError.message };
        }
      } else {
        console.log(`SMS notification not sent: status=${status}, phoneNumber=${phoneNumber ? 'exists' : 'missing'}`);
      }
    } else {
      console.log(`User ${userId} is not premium (${subscriptionPlan}), skipping email and SMS notifications`);
    }
    
    // Update request with notification status using Admin SDK
    await db.collection('requests').doc(requestId).update({
      notificationSent: true,
      notificationDetails: results,
      updatedAt: new Date()
    });
    
    return results;
  } catch (error) {
    console.error('Error sending request notifications:', error);
    throw error;
  }
};

/**
 * Mark notification as read
 * @param {string} notificationId - Notification ID
 * @returns {Promise<boolean>} - Success status
 */
const markNotificationAsRead = async (notificationId) => {
  try {
    // Update notification using Admin SDK
    await db.collection('notifications').doc(notificationId).update({
      isRead: true,
      readAt: new Date()
    });
    
    return true;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
};

module.exports = {
  sendTicketNotifications,
  sendRequestNotifications,
  createInAppNotification,
  markNotificationAsRead
}; 