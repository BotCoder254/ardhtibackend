const express = require('express');
const router = express.Router();
const { sendTicketNotifications, sendRequestNotifications, markNotificationAsRead } = require('../controllers/notificationController');
const { verifyToken, verifyAdmin } = require('../middleware/auth');

/**
 * @route POST /api/notifications/ticket/:ticketId
 * @desc Send notifications for ticket updates (admin only)
 * @access Private/Admin
 */
router.post('/ticket/:ticketId', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { userId, status, adminMessage, isPremium } = req.body;
    
    console.log(`Processing ticket notification for ticket ${ticketId}`, { userId, status });
    
    if (!userId || !status || !adminMessage) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: userId, status, adminMessage' 
      });
    }
    
    const results = await sendTicketNotifications({
      ticketId,
      userId,
      status,
      adminMessage,
      isPremium
    });
    
    console.log(`Ticket notification sent successfully for ticket ${ticketId}`, results);
    
    res.status(200).json({
      success: true,
      message: 'Notifications sent successfully',
      results
    });
  } catch (error) {
    console.error('Error in ticket notification route:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send notifications', 
      error: error.message 
    });
  }
});

/**
 * @route POST /api/notifications/request/:requestId
 * @desc Send notifications for request updates (admin only)
 * @access Private/Admin
 */
router.post('/request/:requestId', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { userId, status, adminMessage, reportUrl, isPremium } = req.body;
    
    console.log(`Processing request notification for request ${requestId}`, { userId, status });
    
    if (!userId || !status) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: userId, status' 
      });
    }
    
    const results = await sendRequestNotifications({
      requestId,
      userId,
      status,
      adminMessage: adminMessage || `Your request has been updated to ${status}`,
      reportUrl,
      isPremium
    });
    
    console.log(`Request notification sent successfully for request ${requestId}`, results);
    
    res.status(200).json({
      success: true,
      message: 'Notifications sent successfully',
      results
    });
  } catch (error) {
    console.error('Error in request notification route:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send notifications', 
      error: error.message 
    });
  }
});

/**
 * @route PUT /api/notifications/:notificationId/read
 * @desc Mark a notification as read
 * @access Private
 */
router.put('/:notificationId/read', verifyToken, async (req, res) => {
  try {
    const { notificationId } = req.params;
    console.log(`Marking notification ${notificationId} as read for user ${req.user.uid}`);
    
    const success = await markNotificationAsRead(notificationId);
    
    if (success) {
      res.status(200).json({
        success: true,
        message: 'Notification marked as read'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to mark notification as read'
      });
    }
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
});

module.exports = router; 