const https = require('https');
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
 * Send SMS notifications via VasPro API
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

    const data = JSON.stringify({
      apiKey: process.env.VASPRO_API_KEY || '59f36122826e045b6080d11c60eaf36b',
      shortCode: process.env.VASPRO_SENDER_ID || 'VasPro',
      message: message,
      recipient: formattedPhone,
      callbackURL: '',
      enqueue: 1,
      isScheduled: false,
    });

    const options = {
      hostname: 'api.vaspro.co.ke',
      port: 443,
      path: '/v3/BulkSMS/api/create',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };

    return new Promise((resolve, reject) => {
      const smsReq = https.request(options, (smsRes) => {
        let responseData = '';

        smsRes.on('data', (chunk) => {
          responseData += chunk;
        });

        smsRes.on('end', () => {
          try {
            const parsedResponse = JSON.parse(responseData);
            console.log('SMS API response:', parsedResponse);
            
            // Log to Firestore
            logSmsActivity({
              phoneNumber: formattedPhone,
              message,
              status: 'sent',
              responseData: parsedResponse
            });
            
            resolve({ success: true, response: parsedResponse });
          } catch (parseError) {
            console.error('Error parsing SMS API response:', parseError, responseData);
            logSmsActivity({
              phoneNumber: formattedPhone,
              message,
              status: 'error',
              error: 'Failed to parse API response',
              rawResponse: responseData
            });
            resolve({ success: false, error: 'Invalid API response' });
          }
        });
      });

      smsReq.on('error', (error) => {
        console.error('Error sending SMS:', error);
        
        // Log failure to Firestore
        logSmsActivity({
          phoneNumber: formattedPhone,
          message,
          status: 'failed',
          error: error.message
        });
        
        resolve({ success: false, error: error.message });
      });

      smsReq.write(data);
      smsReq.end();
    });
  } catch (error) {
    console.error('SMS sending error:', error);
    
    // Log exception to Firestore
    await logSmsActivity({
      phoneNumber: phoneNumber || 'unknown',
      message: message || 'unknown',
      status: 'failed',
      error: error.message
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