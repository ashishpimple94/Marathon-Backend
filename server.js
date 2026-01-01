const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
// Render automatically sets PORT, fallback to 5001 for local development
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Email Service Configuration
// Primary: Hostinger SMTP (Required for production)
// Fallback: SendGrid, Zoho Mail
// Note: Gmail SMTP is optional and not recommended for Render deployment

const getEmailTransporter = () => {
  // Option 1: Hostinger Mail (PRIMARY - Required for production/Render)
  if (process.env.HOSTINGER_USER && process.env.HOSTINGER_PASSWORD) {
    return nodemailer.createTransport({
      host: 'smtp.hostinger.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.HOSTINGER_USER,
        pass: process.env.HOSTINGER_PASSWORD
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }
  
  // Option 2: SendGrid (fallback option)
  if (process.env.SENDGRID_API_KEY) {
    return nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      secure: false,
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY
      }
    });
  }
  
  // Option 3: Zoho Mail (fallback option)
  if (process.env.ZOHO_USER && process.env.ZOHO_PASSWORD) {
    return nodemailer.createTransport({
      host: 'smtp.zoho.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.ZOHO_USER,
        pass: process.env.ZOHO_PASSWORD
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }
  
  // Fallback: Gmail SMTP (optional, not recommended for Render)
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });
  }
  
  // Error if no SMTP service is configured
  throw new Error('No SMTP service configured! Please set HOSTINGER_USER and HOSTINGER_PASSWORD in .env file');
};

// Transporter will be created in verify block above

// Create transporter (non-blocking for Render)
let transporter;
try {
  transporter = getEmailTransporter();
  // Verify transporter asynchronously (non-blocking for server startup)
  // This prevents Render timeout issues
  transporter.verify((error, success) => {
    if (error) {
      console.error('❌ SMTP Verification Error:', error.message);
      console.error('💡 Tip: Make sure HOSTINGER_USER and HOSTINGER_PASSWORD are set in .env file');
      console.error('⚠️  Server will continue, but emails may fail until SMTP is configured');
    } else {
      let serviceType = 'Unknown';
      if (process.env.HOSTINGER_USER) {
        serviceType = 'Hostinger Mail';
      } else if (process.env.SENDGRID_API_KEY) {
        serviceType = 'SendGrid';
      } else if (process.env.ZOHO_USER) {
        serviceType = 'Zoho Mail';
      } else if (process.env.GMAIL_USER) {
        serviceType = 'Gmail';
      }
      console.log(`✅ ${serviceType} SMTP Server is ready to send emails`);
    }
  });
} catch (error) {
  console.error('❌ Failed to create email transporter:', error.message);
  console.error('💡 Please configure HOSTINGER_USER and HOSTINGER_PASSWORD in .env file');
  console.error('⚠️  Server will continue, but emails will fail until SMTP is configured');
  // Don't exit - let server start for Render health checks
  transporter = null;
}

// Load logo as base64
let logoBase64 = '';
try {
  const logoPath = path.join(__dirname, '..', 'public', 'marathon-logo.png');
  if (fs.existsSync(logoPath)) {
    const logoBuffer = fs.readFileSync(logoPath);
    logoBase64 = logoBuffer.toString('base64');
    console.log('✅ Logo loaded successfully');
  } else {
    console.warn('⚠️ Logo file not found, using fallback');
  }
} catch (error) {
  console.warn('⚠️ Could not load logo:', error.message);
}

// Helper function to escape HTML
const escapeHTML = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// Helper function to format email HTML content
const formatEmailHTML = (formType, formData) => {
  // Extract individual fields for better display
  const fields = [];
  
  // Field name mappings for better labels
  const fieldLabels = {
    contactPersonName: 'Contact Person Name',
    designation: 'Designation',
    mobile: 'Mobile Number',
    email: 'Email Address',
    numberOfParticipants: 'Number of Participants',
    organizationName: 'Organization Name',
    additionalRequirements: 'Additional Requirements',
    companyName: 'Company Name',
    contactPerson: 'Contact Person',
    phone: 'Phone Number',
    sponsorshipLevel: 'Sponsorship Level',
    websiteUrl: 'Website URL',
    companyInfo: 'Company Info',
    name: 'Name',
    preferredArea: 'Preferred Area',
    availableDateStart: 'Available Date Start',
    availableDateEnd: 'Available Date End',
    timeAvailability: 'Time Availability',
    whyVolunteer: 'Why Volunteer',
    profileImage: 'Profile Image',
    firstName: 'First Name',
    lastName: 'Last Name',
    company: 'Company',
    subject: 'Subject',
    privacyTermsAccepted: 'Privacy Terms Accepted',
    smsAuthorization: 'SMS Authorization',
    rolePreference: 'Role Preference',
    experience: 'Experience'
  };
  
  Object.keys(formData).forEach(key => {
    // Skip empty values and email (will be shown in footer)
    if (formData[key] !== undefined && formData[key] !== null && formData[key] !== '' && key !== 'email') {
      const label = fieldLabels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
      let value = formData[key];
      
      // Format boolean values
      if (typeof value === 'boolean') {
        value = value ? 'Yes' : 'No';
      }
      
      // Handle null values
      if (value === null || value === 'null') {
        value = 'Not provided';
      }
      
      fields.push({ label: escapeHTML(label), value: escapeHTML(String(value)) });
    }
  });
  
  // Add email separately at the end if it exists
  if (formData.email) {
    fields.push({ label: 'Email Address', value: escapeHTML(formData.email) });
  }
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #1f2937;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 40px 20px;
          min-height: 100vh;
        }
        .email-wrapper {
          max-width: 650px;
          margin: 0 auto;
        }
        .container {
          background: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
        }
        .header {
          background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 50%, #0369a1 100%);
          color: white;
          padding: 40px 30px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .header::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
          animation: pulse 3s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
        .header-content {
          position: relative;
          z-index: 1;
        }
        .logo-container {
          margin-bottom: 25px;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 70px;
        }
        .logo-img {
          max-width: 200px;
          max-height: 100px;
          height: auto;
          width: auto;
          object-fit: contain;
          filter: brightness(0) invert(1);
          background: transparent;
          display: block;
        }
        .header-icon {
          font-size: 48px;
          margin-bottom: 15px;
          display: block;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
          letter-spacing: -0.5px;
          text-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header .form-type {
          margin-top: 10px;
          font-size: 15px;
          opacity: 0.95;
          font-weight: 500;
          letter-spacing: 0.3px;
        }
        .content {
          padding: 40px 30px;
        }
        .section {
          margin: 30px 0;
        }
        .section:first-child {
          margin-top: 0;
        }
        .section-title {
          font-size: 20px;
          font-weight: 700;
          color: #0ea5e9;
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 3px solid #e5e7eb;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .section-title::after {
          content: '';
          flex: 1;
          height: 3px;
          background: linear-gradient(90deg, #0ea5e9 0%, transparent 100%);
          margin-left: 10px;
        }
        .fields-grid {
          display: grid;
          gap: 16px;
        }
        .field-group {
          background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
          padding: 20px;
          border-radius: 12px;
          border-left: 4px solid #0ea5e9;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          transition: all 0.3s ease;
        }
        .field-group:hover {
          transform: translateX(4px);
          box-shadow: 0 4px 12px rgba(14, 165, 233, 0.15);
        }
        .field-label {
          font-weight: 700;
          color: #6b7280;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .field-label::before {
          content: '▸';
          color: #0ea5e9;
          font-size: 14px;
        }
        .field-value {
          color: #111827;
          font-size: 16px;
          font-weight: 500;
          word-break: break-word;
          line-height: 1.5;
        }
        .footer {
          background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
          padding: 25px 30px;
          border-top: 2px solid #e5e7eb;
          text-align: center;
        }
        .footer-content {
          font-size: 13px;
          color: #6b7280;
          line-height: 1.6;
        }
        .reply-to {
          color: #0ea5e9;
          text-decoration: none;
          font-weight: 600;
          transition: color 0.3s ease;
        }
        .reply-to:hover {
          color: #0284c7;
        }
        .divider {
          height: 1px;
          background: linear-gradient(90deg, transparent 0%, #e5e7eb 50%, transparent 100%);
          margin: 30px 0;
        }
        @media only screen and (max-width: 600px) {
          body {
            padding: 20px 10px;
          }
          .content {
            padding: 30px 20px;
          }
          .header {
            padding: 30px 20px;
          }
          .header h1 {
            font-size: 24px;
          }
          .field-group {
            padding: 16px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="container">
          <div class="header">
            <div class="header-content">
              <div class="logo-container">
                ${logoBase64 ? `<img src="data:image/png;base64,${logoBase64}" alt="Marathon Logo" class="logo-img">` : '<span class="header-icon">📧</span>'}
              </div>
              <h1>New Form Submission</h1>
              <div class="form-type">${escapeHTML(formType)}</div>
            </div>
          </div>
          
          <div class="content">
            <div class="section">
              <div class="section-title">
                <span>📋</span>
                <span>Form Details</span>
              </div>
              <div class="fields-grid">
                ${fields.map(field => `
                  <div class="field-group">
                    <div class="field-label">${field.label}</div>
                    <div class="field-value">${field.value}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
          
          <div class="footer">
            <div class="footer-content">
              <strong>Reply To:</strong><br>
              <a href="mailto:${escapeHTML(formData.email || 'N/A')}" class="reply-to">${escapeHTML(formData.email || 'N/A')}</a>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Helper function to format email text content
const formatEmailContent = (formType, formData) => {
  let textContent = `=== FORM SUBMISSION ===\n\n`;
  textContent += `Form Type: ${formType}\n\n`;
  textContent += `=== FORM DETAILS ===\n\n`;
  
  // Field name mappings for better labels
  const fieldLabels = {
    contactPersonName: 'Contact Person Name',
    designation: 'Designation',
    mobile: 'Mobile Number',
    email: 'Email Address',
    numberOfParticipants: 'Number of Participants',
    organizationName: 'Organization Name',
    additionalRequirements: 'Additional Requirements',
    companyName: 'Company Name',
    contactPerson: 'Contact Person',
    phone: 'Phone Number',
    sponsorshipLevel: 'Sponsorship Level',
    websiteUrl: 'Website URL',
    companyInfo: 'Company Info',
    name: 'Name',
    preferredArea: 'Preferred Area',
    availableDateStart: 'Available Date Start',
    availableDateEnd: 'Available Date End',
    timeAvailability: 'Time Availability',
    whyVolunteer: 'Why Volunteer',
    profileImage: 'Profile Image',
    firstName: 'First Name',
    lastName: 'Last Name',
    company: 'Company',
    subject: 'Subject',
    privacyTermsAccepted: 'Privacy Terms Accepted',
    smsAuthorization: 'SMS Authorization',
    rolePreference: 'Role Preference',
    experience: 'Experience'
  };
  
  Object.keys(formData).forEach(key => {
    if (formData[key] !== undefined && formData[key] !== null && formData[key] !== '' && key !== 'email') {
      const label = fieldLabels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
      let value = formData[key];
      
      // Format boolean values
      if (typeof value === 'boolean') {
        value = value ? 'Yes' : 'No';
      }
      
      textContent += `${label}: ${value}\n`;
    }
  });
  
  // Add email at the end
  if (formData.email) {
    textContent += `\nEmail Address: ${formData.email}\n`;
  }
  
  textContent += `\n---\nReply To: ${formData.email || 'N/A'}`;
  
  return textContent;
};

// Volunteer Registration
app.post('/api/volunteer', async (req, res) => {
  try {
    if (!transporter) {
      return res.status(503).json({ 
        success: false, 
        error: 'SMTP service not configured. Please check server logs.' 
      });
    }
    const formData = req.body;
    const fromEmail = process.env.HOSTINGER_USER || process.env.ZOHO_USER || process.env.SENDGRID_FROM_EMAIL || 'shubham@fitcover360.com';
    const mailOptions = {
      from: `"${formData.form_type || 'Volunteer Registration'}" <${fromEmail}>`,
      to: 'shubham@fitcover360.com',
      cc: 'fitcover360@gmail.com',
      replyTo: formData.email,
      subject: `New Volunteer Registration Submission`,
      text: formatEmailContent('Volunteer Registration', formData),
      html: formatEmailHTML('Volunteer Registration', formData)
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Volunteer email error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Bulk Registration
app.post('/api/bulk-registration', async (req, res) => {
  try {
    if (!transporter) {
      return res.status(503).json({ 
        success: false, 
        error: 'SMTP service not configured. Please check server logs.' 
      });
    }
    const formData = req.body;
    
    const fromEmail = process.env.HOSTINGER_USER || process.env.ZOHO_USER || process.env.SENDGRID_FROM_EMAIL || 'shubham@fitcover360.com';
    const mailOptions = {
      from: `"${formData.form_type || 'Bulk Registration Request'}" <${fromEmail}>`,
      to: 'shubham@fitcover360.com',
      cc: 'fitcover360@gmail.com',
      replyTo: formData.email,
      subject: `New Bulk Registration Request Submission`,
      text: formatEmailContent('Bulk Registration Request', formData),
      html: formatEmailHTML('Bulk Registration Request', formData)
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Bulk registration email error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Sponsorship Inquiry
app.post('/api/sponsorship', async (req, res) => {
  try {
    if (!transporter) {
      return res.status(503).json({ 
        success: false, 
        error: 'SMTP service not configured. Please check server logs.' 
      });
    }
    const formData = req.body;
    
    const fromEmail = process.env.HOSTINGER_USER || process.env.ZOHO_USER || process.env.SENDGRID_FROM_EMAIL || 'shubham@fitcover360.com';
    const mailOptions = {
      from: `"${formData.form_type || 'Sponsorship Inquiry'}" <${fromEmail}>`,
      to: 'shubham@fitcover360.com',
      cc: 'fitcover360@gmail.com',
      replyTo: formData.email,
      subject: `New Sponsorship Inquiry Submission`,
      text: formatEmailContent('Sponsorship Inquiry', formData),
      html: formatEmailHTML('Sponsorship Inquiry', formData)
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Sponsorship email error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Pacer & Ambassador
app.post('/api/pacer', async (req, res) => {
  try {
    if (!transporter) {
      return res.status(503).json({ 
        success: false, 
        error: 'SMTP service not configured. Please check server logs.' 
      });
    }
    const formData = req.body;
    
    const fromEmail = process.env.HOSTINGER_USER || process.env.ZOHO_USER || process.env.SENDGRID_FROM_EMAIL || 'shubham@fitcover360.com';
    const mailOptions = {
      from: `"${formData.form_type || 'Pacer & Ambassador Application'}" <${fromEmail}>`,
      to: 'shubham@fitcover360.com',
      cc: 'fitcover360@gmail.com',
      replyTo: formData.email,
      subject: `New Pacer & Ambassador Application Submission`,
      text: formatEmailContent('Pacer & Ambassador Application', formData),
      html: formatEmailHTML('Pacer & Ambassador Application', formData)
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Pacer email error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Contact Us
app.post('/api/contact', async (req, res) => {
  try {
    if (!transporter) {
      return res.status(503).json({ 
        success: false, 
        error: 'SMTP service not configured. Please check server logs.' 
      });
    }
    const formData = req.body;
    const fromEmail = process.env.HOSTINGER_USER || process.env.ZOHO_USER || process.env.SENDGRID_FROM_EMAIL || 'shubham@fitcover360.com';
    const mailOptions = {
      from: `"${formData.form_type || 'Contact Us Form'}" <${fromEmail}>`,
      to: 'shubham@fitcover360.com',
      cc: 'fitcover360@gmail.com',
      replyTo: formData.email,
      subject: `New Contact Us Form Submission`,
      text: formatEmailContent('Contact Us Form', formData),
      html: formatEmailHTML('Contact Us Form', formData)
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Contact email error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Root endpoint for Render health checks (must respond quickly)
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    smtp: transporter ? 'configured' : 'not configured',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📧 Email will be sent to: shubham@fitcover360.com`);
  console.log(`📧 CC: fitcover360@gmail.com`);
  const fromEmail = process.env.HOSTINGER_USER || process.env.ZOHO_USER || process.env.SENDGRID_FROM_EMAIL || 'shubham@fitcover360.com';
  console.log(`📧 From Email: ${fromEmail}`);
  if (process.env.HOSTINGER_USER) {
    console.log(`✅ Using Hostinger Mail for email (Primary SMTP)`);
  } else if (process.env.SENDGRID_API_KEY) {
    console.log(`✅ Using SendGrid for email (Fallback)`);
  } else if (process.env.ZOHO_USER) {
    console.log(`✅ Using Zoho Mail for email (Fallback)`);
  } else if (process.env.GMAIL_USER) {
    console.log(`⚠️  Using Gmail SMTP for email (Not recommended for Render)`);
  }
});

