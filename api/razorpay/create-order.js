import Razorpay from 'razorpay';
import { DB } from '../../server/db.js';

const CONSULTATION_AMOUNT_PAISE = 19900;
const CONSULTATION_CURRENCY = 'INR';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON request body' });
      }
    }
    body = body || {};

    const customer = body.leadData || body.customer || body;

    // Validate essential customer fields
    if (!customer.name || !customer.name.trim()) {
      return res.status(400).json({ error: 'Customer full name is required' });
    }
    if (!customer.phone || !customer.phone.trim()) {
      return res.status(400).json({ error: 'Customer phone/WhatsApp number is required' });
    }

    const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
    const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

    // Generate unique booking reference
    const uniqueSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const bookingRef = `ZR-BK-${Date.now().toString().slice(-6)}-${uniqueSuffix}`;

    const isRazorpayConfigured = Boolean(
      RAZORPAY_KEY_ID &&
      RAZORPAY_KEY_SECRET &&
      !RAZORPAY_KEY_ID.includes('placeholder') &&
      !RAZORPAY_KEY_SECRET.includes('placeholder') &&
      !RAZORPAY_KEY_ID.includes('YOUR_KEY')
    );

    // Initial development mode / awaiting credentials check
    if (!isRazorpayConfigured) {
      // Save pending booking record
      await DB.createBooking({
        bookingRef,
        name: customer.name.trim(),
        email: (customer.email || '').trim(),
        phone: customer.phone.trim(),
        phoneRaw: customer.phoneRaw || customer.phone.replace(/\D/g, ''),
        location: customer.location || '',
        propertyType: customer.propertyType || '',
        budgetTier: customer.budgetTier || '',
        stage: customer.stage || '',
        description: customer.description || '',
        amountPaise: CONSULTATION_AMOUNT_PAISE,
        currency: CONSULTATION_CURRENCY,
        orderId: null,
        paymentStatus: 'PENDING'
      });

      return res.status(200).json({
        status: 'awaiting_credentials',
        bookingRef,
        amount: CONSULTATION_AMOUNT_PAISE,
        currency: CONSULTATION_CURRENCY,
        keyId: null,
        message: 'Razorpay Key ID and Secret are awaiting configuration in .env or Vercel environment variables.'
      });
    }

    // Check for test suite environment
    const isMockTestSuite = RAZORPAY_KEY_ID.includes('test_suite') || process.env.RAZORPAY_MOCK_TEST === 'true';

    let order;
    if (isMockTestSuite) {
      order = {
        id: `order_test_${Date.now()}`,
        amount: CONSULTATION_AMOUNT_PAISE,
        currency: CONSULTATION_CURRENCY,
        status: 'created'
      };
    } else {
      // Initialize Official Razorpay SDK
      const razorpay = new Razorpay({
        key_id: RAZORPAY_KEY_ID,
        key_secret: RAZORPAY_KEY_SECRET
      });

      // Create official order with server-enforced amount (Never trust frontend)
      const orderOptions = {
        amount: CONSULTATION_AMOUNT_PAISE, // 19900 paise = ₹199 INR
        currency: CONSULTATION_CURRENCY,
        receipt: `rcpt_${bookingRef.replace(/[^a-zA-Z0-9]/g, '').slice(-12)}`,
        notes: {
          bookingRef,
          clientName: customer.name.trim(),
          clientPhone: customer.phone.trim(),
          clientEmail: (customer.email || '').trim(),
          propertyType: customer.propertyType || 'Not specified',
          budgetTier: customer.budgetTier || 'Not specified'
        }
      };

      order = await razorpay.orders.create(orderOptions);
    }

    // Save pending booking in persistent database
    await DB.createBooking({
      bookingRef,
      name: customer.name.trim(),
      email: (customer.email || '').trim(),
      phone: customer.phone.trim(),
      phoneRaw: customer.phoneRaw || customer.phone.replace(/\D/g, ''),
      location: customer.location || '',
      propertyType: customer.propertyType || '',
      budgetTier: customer.budgetTier || '',
      stage: customer.stage || '',
      description: customer.description || '',
      amountPaise: CONSULTATION_AMOUNT_PAISE,
      currency: CONSULTATION_CURRENCY,
      orderId: order.id,
      paymentStatus: 'PENDING'
    });

    return res.status(200).json({
      success: true,
      status: 'ok',
      bookingRef,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('[Create Order Error]:', error);
    return res.status(500).json({
      error: 'Failed to create payment order',
      message: error.message || 'Internal server error'
    });
  }
}
