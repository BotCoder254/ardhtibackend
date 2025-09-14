const axios = require('axios');
const { db } = require('../config/firebase');
require('dotenv').config();

/**
 * Log SMS activity to Firestore
 * @param {Object} data - SMS log data
 */
const logSmsActivity = async (data) => {
  try {
    await db.collection('sms_logs').add({
      ...data,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error logging SMS activity:', error);
  }
};

/**
 * Send SMS notifications via the new SMS gateway
 * @param {string} phoneNumber - Recipient phone number
 * @param {string} message - SMS content
 * @returns {Promise<Object>} - API response
 */
const sendSMSNotification = async (phoneNumber, message) => {
  try {
    // Validate inputs
    if (!phoneNumber || !message) {
      console.error('Phone number and message are required for SMS notification');
      throw new Error('Phone number and message are required');
    }
    
    // Format phone number to ensure it starts with 254
    let formattedPhone = phoneNumber.toString().trim();
    formattedPhone = formattedPhone.replace(/^\+|^0+|\s+/g, "");
    if (!formattedPhone.startsWith("254")) {
      if (formattedPhone.startsWith("7") || formattedPhone.startsWith("1")) {
        formattedPhone = "254" + formattedPhone;
      } else if (formattedPhone.startsWith("07") || formattedPhone.startsWith("01")) {
        formattedPhone = "254" + formattedPhone.substring(1);
      }
    }
    
    console.log(`Sending SMS to ${formattedPhone}: ${message}`);

    const url = 'http://167.172.14.50:4002/v1/send-sms';
    const requestBody = {
      apiClientID: parseInt(process.env.SMS_API_CLIENT_ID || '845'),
      key: process.env.SMS_API_KEY || '',
      secret: process.env.SMS_API_SECRET || '',
      txtMessage: message,
      MSISDN: formattedPhone,
      serviceID: parseInt(process.env.SMS_SERVICE_ID || '5518'),
    };

    const response = await axios.post(url, requestBody, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('SMS API response:', response.data);
    
    // Log to Firestore
    await logSmsActivity({
      phoneNumber: formattedPhone,
      message,
      status: 'sent',
      responseData: response.data
    });
    
    return { success: true, response: response.data };
  } catch (error) {
    console.error('Error sending SMS:', error.message);
    
    // Log error to Firestore
    await logSmsActivity({
      phoneNumber: formattedPhone || 'unknown',
      message,
      status: 'error',
      error: error.message,
      responseData: error.response?.data
    });
    
    return { success: false, error: error.message };
  }
};

/**
 * Send ticket update notification SMS
 * @param {Object} options - Notification options
 * @param {string} options.phoneNumber - User's phone number
 * @param {string} options.name - User's name
 * @param {string} options.ticketId - Ticket ID
 * @param {string} options.status - New ticket status
 * @param {string} options.portalUrl - URL to the portal
 * @returns {Promise<Object>} - API response
 */
const sendTicketUpdateSms = async (options) => {
  const { phoneNumber, name, ticketId, status, portalUrl } = options;
  
  if (!phoneNumber) {
    console.error('Phone number is required for SMS notification');
    return { success: false, error: 'Phone number is required' };
  }
  
  const message = `Hello ${name || 'User'}, your ticket #${ticketId} has been ${status.toLowerCase()}. Please log in to view the response: ${portalUrl || 'https://ardhikenya.com'}`;
  
  try {
    return await sendSMSNotification(phoneNumber, message);
  } catch (error) {
    console.error('Failed to send ticket update SMS:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send request status update notification SMS
 * @param {Object} options - Notification options
 * @param {string} options.phoneNumber - User's phone number
 * @param {string} options.name - User's name
 * @param {string} options.requestId - Request ID
 * @param {string} options.status - New request status
 * @param {string} options.portalUrl - URL to the portal
 * @returns {Promise<Object>} - API response
 */
const sendRequestUpdateSms = async (options) => {
  const { phoneNumber, name, requestId, status, portalUrl } = options;
  
  if (!phoneNumber) {
    console.error('Phone number is required for SMS notification');
    return { success: false, error: 'Phone number is required' };
  }
  
  const message = `Hello ${name || 'User'}, your land verification request #${requestId} is now ${status.toLowerCase()}. Please log in to view details: ${portalUrl || 'https://ardhikenya.com'}`;
  
  try {
    return await sendSMSNotification(phoneNumber, message);
  } catch (error) {
    console.error('Failed to send request update SMS:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendSMSNotification,
  sendTicketUpdateSms,
  sendRequestUpdateSms
}; 