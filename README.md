# Marathon Backend Server

Node.js backend server for handling form submissions and sending emails via Nodemailer.

## Quick Start

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your Gmail credentials

# Start server
npm start

# Or development mode (auto-restart)
npm run dev
```

## Environment Variables

Create `.env` file:

```env
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password
PORT=5000
```

## API Endpoints

- `POST /api/volunteer` - Volunteer Registration
- `POST /api/bulk-registration` - Bulk Registration
- `POST /api/sponsorship` - Sponsorship Inquiry
- `POST /api/pacer` - Pacer & Ambassador
- `POST /api/contact` - Contact Us
- `GET /api/health` - Health check

## Email Configuration

All emails are sent to: `shubham@fitcover360.com`

## Dependencies

- express - Web server
- nodemailer - Email sending
- cors - CORS support
- dotenv - Environment variables

