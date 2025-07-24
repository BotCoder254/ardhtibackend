require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const axios = require('axios');
const moment = require('moment');
const Buffer = require('buffer').Buffer;
const notificationRoutes = require('./routes/notificationRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Enhanced CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || ['http://localhost:3000', 'https://ardhikenya.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400 // 24 hours
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Helper function for JSON responses
const sendJsonResponse = (res, statusCode, data) => {
  res.status(statusCode).json(data);
};

// ACCESS TOKEN FUNCTION
async function getAccessToken() {
  const consumer_key = process.env.MPESA_CONSUMER_KEY || "frmypHgIJYc7mQuUu5NBvnYc0kF1StP3"; 
  const consumer_secret = process.env.MPESA_CONSUMER_SECRET || "UAeJAJLNUkV5MLpL"; 
  const url = "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";

  const auth = "Basic " + Buffer.from(consumer_key + ":" + consumer_secret).toString("base64");

  try {
    console.log('Requesting access token...');
    const response = await axios.get(url, {
      headers: {
        Authorization: auth,
      },
    });
    console.log('Access token response:', response.data);
    const accessToken = response.data.access_token;
    return accessToken;
  } catch (error) {
    console.error('Error getting access token:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      error: error.message
    });
    throw new Error('Failed to get access token: ' + (error.response?.data?.errorMessage || error.message));
  }
}

// Routes
app.use('/api/notifications', notificationRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

// M-Pesa Routes
app.get("/api/mpesa", (req, res) => {
  sendJsonResponse(res, 200, { 
    ResponseCode: "0",
    message: "M-Pesa API Server is running" 
  });
});

app.get("/api/mpesa/access_token", async (req, res) => {
  try {
    const accessToken = await getAccessToken();
    sendJsonResponse(res, 200, { 
      ResponseCode: "0",
      accessToken 
    });
  } catch (error) {
    console.error('Access token error:', error);
    sendJsonResponse(res, 500, { 
      ResponseCode: "1",
      errorMessage: error.message 
    });
  }
});

app.post("/api/mpesa/stkpush", async (req, res) => {
  try {
    console.log("Received STK push request:", req.body);
    
    // Validate required fields
    if (!req.body.phone || !req.body.amount || !req.body.orderId) {
      console.error('Missing required fields:', req.body);
      return sendJsonResponse(res, 400, {
        ResponseCode: "1",
        errorMessage: "Missing required fields. Please provide 'phone', 'amount', and 'orderId'"
      });
    }

    let phoneNumber = req.body.phone;
    const amount = req.body.amount;
    const orderId = req.body.orderId;

    // Format the phone number
    phoneNumber = phoneNumber.toString().trim();
    // Remove leading zeros, plus, or spaces
    phoneNumber = phoneNumber.replace(/^\+|^0+|\s+/g, "");
    // Add country code if not present
    if (!phoneNumber.startsWith("254")) {
      phoneNumber = "254" + phoneNumber;
    }

    // Validate phone number format
    if (!/^254\d{9}$/.test(phoneNumber)) {
      console.error('Invalid phone number format:', phoneNumber);
      return sendJsonResponse(res, 400, {
        ResponseCode: "1",
        errorMessage: "Invalid phone number format. Must be 12 digits starting with 254"
      });
    }

    // Validate amount
    if (isNaN(amount) || amount <= 0) {
      console.error('Invalid amount:', amount);
      return sendJsonResponse(res, 400, {
        ResponseCode: "1",
        errorMessage: "Invalid amount. Must be a positive number"
      });
    }

    const accessToken = await getAccessToken();
    const url = "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest";
    const auth = "Bearer " + accessToken;
    const timestampx = moment().format("YYYYMMDDHHmmss");
    const password = Buffer.from(
      "4121151" +
        "68cb945afece7b529b4a0901b2d8b1bb3bd9daa19bfdb48c69bec8dde962a932" +
        timestampx
    ).toString("base64");

    const requestBody = {
      BusinessShortCode: "4121151",
      Password: password,
      Timestamp: timestampx,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: phoneNumber,
      PartyB: "4121151",
      PhoneNumber: phoneNumber,
      CallBackURL: `${process.env.BASE_URL || 'https://ardhikenya.com'}/api/mpesa/callback/${orderId}`,
      AccountReference: "ARDHIKENYA",
      TransactionDesc: "Payment for subscription",
    };

    console.log('Making STK push request:', {
      url,
      body: requestBody,
      headers: { Authorization: auth }
    });

    try {
      const response = await axios.post(url, requestBody, {
        headers: {
          Authorization: auth,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
      });

      console.log('STK push response:', response.data);
      
      // Ensure the response has the expected format
      if (!response.data.ResponseCode && response.data.ResponseCode !== "0") {
        throw new Error('Invalid response format from M-Pesa API');
      }

      // Send response with proper headers
      res.setHeader('Content-Type', 'application/json');
      res.json({
        ResponseCode: "0",
        ResponseDescription: "Success. Request accepted for processing",
        CheckoutRequestID: response.data.CheckoutRequestID,
        CustomerMessage: response.data.CustomerMessage,
        orderId: orderId
      });
    } catch (mpesaError) {
      console.error('M-Pesa API error:', mpesaError.response?.data || mpesaError);
      return sendJsonResponse(res, 502, {
        ResponseCode: "1",
        errorMessage: mpesaError.response?.data?.errorMessage || 'M-Pesa API request failed'
      });
    }
  } catch (error) {
    console.error('STK push error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      error: error.message
    });

    // Send error response with proper headers
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({
      ResponseCode: "1",
      ResponseDescription: error.message || "Failed to initiate payment"
    });
  }
});

// Remove the duplicate callback route and use the one from subscriptionRoutes
app.post("/api/mpesa/callback/:orderId", async (req, res) => {
  try {
    // Forward to subscription controller
    const { processMpesaCallback } = require('./controllers/subscriptionController');
    await processMpesaCallback(req, res);
  } catch (error) {
    console.error('Callback error:', error);
    // Still send success response to M-Pesa
    res.json({
      ResponseCode: "0",
      ResponseDesc: "Success"
    });
  }
});

app.post("/api/mpesa/query", async (req, res) => {
  try {
    console.log("Received query request:", req.body);
    const queryCode = req.body.queryCode;

    if (!queryCode) {
      console.error('Missing queryCode parameter');
      return sendJsonResponse(res, 200, {
        ResponseCode: "1",
        ResultCode: "1",
        ResultDesc: "Missing queryCode parameter",
        errorMessage: "Missing queryCode parameter"
      });
    }

    const accessToken = await getAccessToken();
    const url = "https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query";
    const auth = "Bearer " + accessToken;
    const timestampx = moment().format("YYYYMMDDHHmmss");
    const password = Buffer.from(
      "4121151" +
        "68cb945afece7b529b4a0901b2d8b1bb3bd9daa19bfdb48c69bec8dde962a932" +
        timestampx
    ).toString("base64");

    const requestBody = {
      BusinessShortCode: "4121151", //change this to the correct Till number 
      Password: password,
      Timestamp: timestampx,
      CheckoutRequestID: queryCode,
    };

    console.log('Making query request:', {
      url,
      body: requestBody,
      headers: { Authorization: auth }
    });

    try {
      const response = await axios.post(url, requestBody, {
        headers: {
          Authorization: auth,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
      });

      console.log('Query response:', response.data);
      
      // Check for successful payment
      if (response.data.ResultCode === "0") {
        // Payment was successful
        return sendJsonResponse(res, 200, {
          ResponseCode: "0",
          ResultCode: "0",
          ResultDesc: "The service request is processed successfully.",
          isSuccessful: true
        });
      }
      
      // Check for specific error codes that indicate cancellation
      if (response.data.ResultCode === "1032") {
        return sendJsonResponse(res, 200, {
          ResponseCode: "3", // Custom code for cancellation
          ResultCode: "1032",
          ResultDesc: "Transaction canceled by user",
          errorMessage: "Transaction was canceled",
          isCanceled: true
        });
      }

      // Handle successful response
      return sendJsonResponse(res, 200, {
        ...response.data,
        ResponseCode: response.data.ResponseCode || "0"
      });
    } catch (mpesaError) {
      console.error('M-Pesa API error response:', mpesaError.response?.data);
      
      // Check for specific error codes
      const errorCode = mpesaError.response?.data?.errorCode;
      const errorMessage = mpesaError.response?.data?.errorMessage;

      // Check if it's a processing status error
      if (errorCode === '500.001.1001') {
        return sendJsonResponse(res, 200, {
          ResponseCode: "2", // Custom code for processing
          ResultCode: "2",
          ResultDesc: "The transaction is being processed",
          errorMessage: errorMessage,
          isProcessing: true
        });
      }

      // Check if it's a cancellation error
      if (errorCode === '500.001.1032') {
        return sendJsonResponse(res, 200, {
          ResponseCode: "3", // Custom code for cancellation
          ResultCode: "1032",
          ResultDesc: "Transaction canceled by user",
          errorMessage: errorMessage,
          isCanceled: true
        });
      }

      // Handle other M-Pesa API errors
      return sendJsonResponse(res, 200, {
        ResponseCode: "1",
        ResultCode: "1",
        ResultDesc: errorMessage || "Failed to check payment status",
        errorMessage: errorMessage || "Payment query failed"
      });
    }
  } catch (error) {
    console.error('Query error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      error: error.message
    });

    // Return a structured error response
    return sendJsonResponse(res, 200, {
      ResponseCode: "1",
      ResultCode: "1",
      ResultDesc: error.message || "Failed to check payment status",
      errorMessage: error.message || "Payment query failed"
    });
  }
});

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'ArdhiKenya API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 