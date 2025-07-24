# ArdhiKenya Backend

This is the backend server for ArdhiKenya land verification platform.

## Features

- User notifications (in-app, email, SMS)
- M-Pesa payment integration
- Firebase integration
- Subscription management

## Setup Instructions

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file based on `.env.example` with your credentials
4. Place your Firebase Admin SDK service account JSON file in the `config` directory
5. Start the server:
   ```
   npm run dev
   ```

## Environment Variables

The following environment variables are required:

```
# Server Configuration
PORT=5000
NODE_ENV=development

# Email Configuration (Gmail)
EMAIL_USER=your_gmail_email@gmail.com
EMAIL_PASS=your_gmail_app_password

# Email Fallback (Mailtrap)
MAILTRAP_HOST=sandbox.smtp.mailtrap.io
MAILTRAP_PORT=587
MAILTRAP_USER=your_mailtrap_user
MAILTRAP_PASS=your_mailtrap_password

# SMS Configuration (VasPro)
VASPRO_API_KEY=your_vaspro_api_key
VASPRO_SENDER_ID=ArdhiKenya

# M-Pesa API Configuration
MPESA_CONSUMER_KEY=your_mpesa_consumer_key
MPESA_CONSUMER_SECRET=your_mpesa_consumer_secret

# Frontend URL (for links in emails and SMS)
FRONTEND_URL=http://localhost:3000

# Base URL for callbacks
BASE_URL=http://localhost:5000
```

## API Routes

- **Notifications**: `/api/notifications`
- **Subscriptions**: `/api/subscriptions`
- **M-Pesa**: `/api/mpesa`
- **Health check**: `/health`

## Deploying to Render

This project is configured for easy deployment to Render.com using the included `render.yaml` file.

### Deployment Steps

1. Create a Render account at [render.com](https://render.com)
2. Connect your GitHub repository
3. Click "New" > "Blueprint" and select your repository
4. Render will detect the `render.yaml` file and configure your services
5. Set up your environment variables in the Render dashboard:
   - `EMAIL_USER` and `EMAIL_PASS` for Gmail
   - `MAILTRAP_HOST`, `MAILTRAP_USER`, and `MAILTRAP_PASS` for Mailtrap fallback
   - `VASPRO_API_KEY` for SMS
   - `MPESA_CONSUMER_KEY` and `MPESA_CONSUMER_SECRET` for M-Pesa integration
6. Upload your Firebase Admin SDK service account JSON file to Render's file system

### Important Notes

- Make sure to set `FRONTEND_URL` to your actual frontend URL in production
- Health checks will be performed on the `/health` endpoint
- All API endpoints will be available at `https://your-render-url.onrender.com/api/` 