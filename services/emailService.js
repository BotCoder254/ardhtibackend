const nodemailer = require('nodemailer');
const path = require('path');
const nodemailerHbs = require('nodemailer-express-handlebars');
const fs = require('fs');
const { db } = require('../config/firebase');
require('dotenv').config();

// Verify email credentials are present
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.error('Missing email credentials in environment variables');
  console.error('EMAIL_USER:', process.env.EMAIL_USER ? 'Present' : 'Missing');
  console.error('EMAIL_PASS:', process.env.EMAIL_PASS ? 'Present' : 'Missing');
}

// Create a transporter using Gmail SMTP with secure connection
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // use SSL
  auth: {
    user: process.env.EMAIL_USER || 'telvivaztelvin@gmail.com',
    pass: process.env.EMAIL_PASS || 'ozze yvja fqup wuvm'
  },
  debug: process.env.NODE_ENV !== 'production' // Enable debug logs in non-production
});

// Create Mailtrap transporter (fallback)
const mailtrapTransporter = nodemailer.createTransport({
  host: process.env.MAILTRAP_HOST || 'sandbox.smtp.mailtrap.io',
  port: process.env.MAILTRAP_PORT || 587,
  auth: {
    user: process.env.MAILTRAP_USER || '4778e2ac9242b7',
    pass: process.env.MAILTRAP_PASS || 'e6412463503acb'
  }
});

// Verify transporter configuration
transporter.verify(function(error, success) {
  if (error) {
    console.error('Email transporter verification failed:', error);
    console.error('Current email configuration:', {
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS ? '****' : 'missing'
      }
    });
  } else {
    console.log('Email server is ready to send messages');
  }
});

// Configure handlebars
const templatesDir = path.resolve(__dirname, '../templates');
console.log('Templates directory:', templatesDir);

// Check if templates directory exists
if (!fs.existsSync(templatesDir)) {
  console.error('Templates directory does not exist:', templatesDir);
  // Create directory if it doesn't exist
  try {
    fs.mkdirSync(templatesDir, { recursive: true });
    console.log('Created templates directory');
  } catch (err) {
    console.error('Failed to create templates directory:', err);
  }
}

// Check for template files
const ticketTemplate = path.join(templatesDir, 'ticket_update.html');
const requestTemplate = path.join(templatesDir, 'request_update.html');

if (!fs.existsSync(ticketTemplate)) {
  console.error('Ticket update template not found:', ticketTemplate);
  // Create a basic template
  try {
    const basicTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Ticket Update</title>
    </head>
    <body>
      <h1>Ticket Update</h1>
      <p>Hello {{name}},</p>
      <p>Your ticket #{{ticketId}} ({{ticketTitle}}) has been {{status}}.</p>
      <p>Admin message: {{adminMessage}}</p>
      <p><a href="{{ticketUrl}}">View ticket</a></p>
      <p>&copy; {{currentYear}} ArdhiKenya</p>
    </body>
    </html>
    `;
    fs.writeFileSync(ticketTemplate, basicTemplate);
    console.log('Created basic ticket template');
  } catch (err) {
    console.error('Failed to create ticket template:', err);
  }
}

if (!fs.existsSync(requestTemplate)) {
  console.error('Request update template not found:', requestTemplate);
  // Create a basic template
  try {
    const basicTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Land Request Update</title>
    </head>
    <body>
      <h1>Land Request Update</h1>
      <p>Hello {{name}},</p>
      <p>Your land verification request #{{requestId}} for parcel {{parcelNumber}} is now {{status}}.</p>
      <p>Admin message: {{adminMessage}}</p>
      <p><a href="{{requestUrl}}">View request</a></p>
      {{#if hasReport}}
      <p><a href="{{reportUrl}}">Download Report</a></p>
      {{/if}}
      <p>&copy; {{currentYear}} ArdhiKenya</p>
    </body>
    </html>
    `;
    fs.writeFileSync(requestTemplate, basicTemplate);
    console.log('Created basic request template');
  } catch (err) {
    console.error('Failed to create request template:', err);
  }
}

const handlebarOptions = {
  viewEngine: {
    extName: '.html',
    partialsDir: templatesDir,
    defaultLayout: false,
  },
  viewPath: templatesDir,
  extName: '.html',
};

// Use handlebars with nodemailer
transporter.use('compile', nodemailerHbs(handlebarOptions));
mailtrapTransporter.use('compile', nodemailerHbs(handlebarOptions));

// Log email activity to Firestore
const logEmailActivity = async (data) => {
  try {
    await db.collection('email_logs').add({
      ...data,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error logging email activity:', error);
  }
};

/**
 * Send email with fallback to Mailtrap if Gmail fails
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.template - Template name (without .html extension)
 * @param {Object} options.context - Context object with data for the template
 * @param {Object} options.metadata - Additional metadata to log
 * @returns {Promise<boolean>} - Success status
 */
const sendEmail = async (options) => {
  const { to, subject, template, context, metadata = {} } = options;
  
  // Try Gmail first
  try {
    console.log(`Preparing to send email to ${to} using template: ${template}`);
    
    const mailOptions = {
      from: `"ArdhiKenya" <${process.env.EMAIL_USER || 'telvivaztelvin@gmail.com'}>`,
      to,
      subject,
      template,
      context
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    
    await logEmailActivity({
      to,
      subject,
      status: 'sent',
      messageId: info.messageId,
      provider: 'gmail',
      ...metadata
    });
    
    return true;
  } catch (error) {
    console.error('Gmail send error:', error);
    
    // Continue to fallback
    try {
      console.log(`Attempting fallback to Mailtrap for email to ${to}`);
      
      const mailOptions = {
        from: '"ArdhiKenya" <no-reply@ardhikenya.com>',
        to,
        subject,
        template,
        context
      };
      
      const info = await mailtrapTransporter.sendMail(mailOptions);
      console.log('Fallback email sent successfully via Mailtrap:', info.messageId);
      
      await logEmailActivity({
        to,
        subject,
        status: 'sent',
        messageId: info.messageId,
        provider: 'mailtrap',
        ...metadata
      });
      
      return true;
    } catch (fallbackError) {
      console.error('Mailtrap fallback error:', fallbackError);
      
      await logEmailActivity({
        to,
        subject,
        status: 'failed',
        error: `Gmail: ${error.message}, Mailtrap: ${fallbackError.message}`,
        provider: 'both-failed',
        ...metadata
      });
      
      return false;
    }
  }
};

/**
 * Send ticket update notification email
 * @param {Object} options - Notification options
 * @param {string} options.email - User's email
 * @param {string} options.name - User's name
 * @param {string} options.ticketId - Ticket ID
 * @param {string} options.ticketTitle - Ticket title
 * @param {string} options.status - New ticket status
 * @param {string} options.adminMessage - Admin's response message
 * @param {string} options.ticketUrl - URL to view the ticket
 * @returns {Promise<boolean>} - Success status
 */
const sendTicketUpdateEmail = async (options) => {
  const { email, name, ticketId, ticketTitle, status, adminMessage, ticketUrl } = options;
  
  if (!email) {
    console.error('Email is required for ticket update notification');
    return false;
  }
  
  return sendEmail({
    to: email,
    subject: `Ticket #${ticketId} Update: ${status}`,
    template: 'ticket_update',
    context: {
      name,
      ticketId,
      ticketTitle,
      status,
      adminMessage,
      ticketUrl,
      currentYear: new Date().getFullYear()
    },
    metadata: {
      type: 'ticket_update',
      ticketId
    }
  });
};

/**
 * Send request status update notification email
 * @param {Object} options - Notification options
 * @param {string} options.email - User's email
 * @param {string} options.name - User's name
 * @param {string} options.requestId - Request ID
 * @param {string} options.parcelNumber - Land parcel number
 * @param {string} options.status - New request status
 * @param {string} options.adminMessage - Admin's message
 * @param {string} options.requestUrl - URL to view the request
 * @param {string} options.reportUrl - URL to download report (if available)
 * @returns {Promise<boolean>} - Success status
 */
const sendRequestUpdateEmail = async (options) => {
  const { email, name, requestId, parcelNumber, status, adminMessage, requestUrl, reportUrl } = options;
  
  if (!email) {
    console.error('Email is required for request update notification');
    return false;
  }
  
  return sendEmail({
    to: email,
    subject: `Land Request #${requestId} Update: ${status}`,
    template: 'request_update',
    context: {
      name,
      requestId,
      parcelNumber,
      status,
      adminMessage,
      requestUrl,
      reportUrl: reportUrl || '',
      hasReport: !!reportUrl,
      currentYear: new Date().getFullYear()
    },
    metadata: {
      type: 'request_update',
      requestId
    }
  });
};

module.exports = {
  sendEmail,
  sendTicketUpdateEmail,
  sendRequestUpdateEmail
}; 