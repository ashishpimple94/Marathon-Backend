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
  const logoPath = path.join(__dirname, '..', 'public', 'marathon-logo-new.png');
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
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
          background: #f3f4f6;
          padding: 20px;
        }
        .email-wrapper {
          max-width: 700px;
          margin: 0 auto;
          background: #ffffff;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }
        .header {
          background: linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #60a5fa 100%);
          color: white;
          padding: 50px 40px;
          text-align: center;
          position: relative;
        }
        .header::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, #fbbf24, #f59e0b, #fbbf24);
        }
        .logo-container {
          background: white;
          border-radius: 16px;
          padding: 25px;
          margin: 0 auto 25px;
          display: inline-block;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        }
        .logo-img {
          max-width: 200px;
          max-height: 100px;
          height: auto;
          width: auto;
          object-fit: contain;
          display: block;
        }
        .header h1 {
          font-size: 32px;
          font-weight: 800;
          margin: 20px 0 10px;
          letter-spacing: -0.5px;
          text-transform: uppercase;
        }
        .header .form-type {
          font-size: 16px;
          font-weight: 600;
          opacity: 0.95;
          background: rgba(255, 255, 255, 0.2);
          padding: 8px 20px;
          border-radius: 20px;
          display: inline-block;
          margin-top: 10px;
        }
        .content {
          padding: 45px 40px;
        }
        .section-header {
          background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
          padding: 25px 30px;
          border-radius: 16px;
          margin-bottom: 35px;
          box-shadow: 0 10px 25px rgba(59, 130, 246, 0.3);
          position: relative;
          overflow: hidden;
        }
        .section-header::before {
          content: '';
          position: absolute;
          top: 0;
          right: 0;
          width: 200px;
          height: 200px;
          background: radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%);
          border-radius: 50%;
          transform: translate(30%, -30%);
        }
        .section-title {
          font-size: 26px;
          font-weight: 900;
          color: #ffffff;
          display: flex;
          align-items: center;
          gap: 15px;
          position: relative;
          z-index: 1;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .section-title span:first-child {
          font-size: 32px;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        }
        .fields-grid {
          display: grid;
          gap: 20px;
        }
        .field-group {
          background: #ffffff;
          padding: 25px;
          border-radius: 14px;
          border: 2px solid #e5e7eb;
          transition: all 0.3s ease;
          position: relative;
        }
        .field-group::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 5px;
          background: linear-gradient(180deg, #3b82f6, #60a5fa);
          border-radius: 14px 0 0 14px;
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .field-group:hover::before {
          opacity: 1;
        }
        .field-group:hover {
          border-color: #3b82f6;
          box-shadow: 0 8px 20px rgba(59, 130, 246, 0.15);
          transform: translateY(-2px);
        }
        .field-label {
          font-weight: 700;
          color: #6b7280;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1.2px;
          margin-bottom: 10px;
          display: block;
        }
        .field-value {
          color: #111827;
          font-size: 17px;
          font-weight: 600;
          word-break: break-word;
          line-height: 1.6;
        }
        .footer {
          background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
          padding: 35px 40px;
          border-top: 3px solid #e5e7eb;
          text-align: center;
        }
        .footer-title {
          font-size: 14px;
          font-weight: 700;
          color: #374151;
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .reply-to {
          color: #3b82f6;
          text-decoration: none;
          font-weight: 700;
          font-size: 16px;
          transition: all 0.3s ease;
          display: inline-block;
          padding: 8px 16px;
          border-radius: 8px;
          background: #eff6ff;
        }
        .reply-to:hover {
          color: #1e40af;
          background: #dbeafe;
          transform: translateY(-2px);
        }
        .footer-info {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #d1d5db;
          font-size: 12px;
          color: #9ca3af;
          line-height: 1.5;
        }
        @media only screen and (max-width: 600px) {
          body {
            padding: 10px;
          }
          .header {
            padding: 35px 25px;
          }
          .content {
            padding: 30px 25px;
          }
          .footer {
            padding: 25px 20px;
          }
          .header h1 {
            font-size: 24px;
          }
          .field-group {
            padding: 20px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="header">
          <div class="logo-container">
            ${logoBase64 ? `<img src="data:image/png;base64,${logoBase64}" alt="Marathon Logo" class="logo-img">` : '<span style="font-size:48px">🏃</span>'}
          </div>
          <h1>New Form Submission</h1>
          <div class="form-type">${escapeHTML(formType)}</div>
        </div>
        
        <div class="content">
          <div class="section-header">
            <div class="section-title">
              <span>📋</span>
              <span>Submission Details</span>
            </div>
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
        
        <div class="footer">
          <div class="footer-title">📧 Reply To</div>
          <a href="mailto:${escapeHTML(formData.email || 'N/A')}" class="reply-to">${escapeHTML(formData.email || 'N/A')}</a>
          <div class="footer-info">
            This is an automated notification from Fitcover360 Marathon Registration System.<br>
            © ${new Date().getFullYear()} Fitcover360. All rights reserved.
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

