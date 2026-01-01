# Marathon Backend Deployment Guide

## 🚀 Quick Deploy to Render.com

### 1. Prerequisites
- GitHub account with Marathon-Backend repository
- Render.com account (free tier available)
- SMTP service credentials (Hostinger recommended)

### 2. Deploy Steps

1. **Connect Repository**
   - Go to [Render.com](https://render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub account
   - Select `Marathon-Backend` repository

2. **Configure Service**
   ```
   Name: marathon-backend
   Environment: Node
   Build Command: npm install
   Start Command: npm start
   ```

3. **Environment Variables**
   Add these in Render dashboard:
   ```
   PORT=10000
   HOSTINGER_USER=your-email@yourdomain.com
   HOSTINGER_PASSWORD=your-hostinger-password
   ```

4. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment (2-3 minutes)
   - Your API will be available at: `https://your-app-name.onrender.com`

### 3. SMTP Configuration Options

#### Option 1: Hostinger Mail (Recommended)
```env
HOSTINGER_USER=your-email@yourdomain.com
HOSTINGER_PASSWORD=your-hostinger-password
```

#### Option 2: SendGrid (Alternative)
```env
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=your-verified-sender@yourdomain.com
```

#### Option 3: Zoho Mail (Alternative)
```env
ZOHO_USER=your-email@yourdomain.com
ZOHO_PASSWORD=your-zoho-password
```

### 4. Test Deployment

After deployment, test your API:

```bash
# Health check
curl https://your-app-name.onrender.com/api/health

# Test contact form
curl -X POST https://your-app-name.onrender.com/api/contact \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "email": "test@example.com",
    "subject": "Test Message",
    "message": "This is a test message"
  }'
```

### 5. Frontend Integration

Update your frontend API base URL:

```javascript
// In your React app
const API_BASE_URL = 'https://your-app-name.onrender.com';

// Example usage
const response = await fetch(`${API_BASE_URL}/api/contact`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(formData),
});
```

## 🔧 Local Development

### Setup
```bash
# Clone repository
git clone git@github.com:ashishpimple94/Marathon-Backend.git
cd Marathon-Backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your SMTP credentials

# Start development server
npm run dev
```

### Available Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with auto-reload

### API Endpoints
- `GET /` - Root endpoint (health check)
- `GET /api/health` - Detailed health check
- `POST /api/contact` - Contact form submission
- `POST /api/volunteer` - Volunteer registration
- `POST /api/bulk-registration` - Bulk registration request
- `POST /api/sponsorship` - Sponsorship inquiry
- `POST /api/pacer` - Pacer & Ambassador application

## 📧 Email Configuration

### Hostinger Mail Setup (Recommended)
1. Purchase domain and hosting from Hostinger
2. Create email account (e.g., contact@yourdomain.com)
3. Use email credentials in environment variables
4. SMTP settings:
   - Host: smtp.hostinger.com
   - Port: 587
   - Security: STARTTLS

### SendGrid Setup (Alternative)
1. Create SendGrid account
2. Verify your sender domain
3. Generate API key
4. Add API key to environment variables

### Gmail Setup (Not Recommended for Production)
1. Enable 2-factor authentication
2. Generate app-specific password
3. Use app password (not regular password)
4. May have delivery limitations

## 🛠️ Troubleshooting

### Common Issues

1. **SMTP Authentication Failed**
   - Check credentials are correct
   - Ensure SMTP service is enabled
   - For Gmail, use app password, not regular password

2. **Render Deployment Timeout**
   - Server starts quickly with non-blocking SMTP verification
   - Check logs in Render dashboard
   - Ensure PORT environment variable is set

3. **CORS Issues**
   - CORS is enabled for all origins
   - Check frontend is making requests to correct URL

4. **Email Not Received**
   - Check spam folder
   - Verify SMTP credentials
   - Check server logs for errors

### Logs
Check logs in Render dashboard or locally:
```bash
# Local development
npm run dev

# Check specific endpoint
curl -X POST http://localhost:5001/api/health
```

## 🔒 Security Notes

- Never commit `.env` file to repository
- Use environment variables for all sensitive data
- SMTP credentials should be kept secure
- Consider using app-specific passwords for email services
- Regularly rotate API keys and passwords

## 📞 Support

If you encounter issues:
1. Check server logs in Render dashboard
2. Verify environment variables are set correctly
3. Test SMTP credentials with a simple email client
4. Ensure frontend is pointing to correct backend URL