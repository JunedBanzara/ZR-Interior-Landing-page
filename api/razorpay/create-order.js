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

    // 1. Validate Amount (Minimum 100 paise = ₹1)
    const rawAmount = body.amount !== undefined ? body.amount : CONSULTATION_AMOUNT_PAISE;
    const amount = Number(rawAmount);

    if (isNaN(amount) || amount < 100) {
      return res.status(400).json({
        error: 'Invalid amount. Minimum amount is 100 paise (₹1).',
        received: rawAmount
      });
    }

    // 2. Currency & Receipt
    const currency = (body.currency || CONSULTATION_CURRENCY).toUpperCase();

    const uniqueSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const bookingRef = body.bookingRef || `ZR-BK-${Date.now().toString().slice(-6)}-${uniqueSuffix}`;
    const receipt = body.receipt || `rcpt_${bookingRef.replace(/[^a-zA-Z0-9]/g, '').slice(-12)}`;

    // 3. Customer Details (optional or from leadData)
    const customer = body.leadData || body.customer || body;
    const clientName = (customer && customer.name) ? customer.name.trim() : 'Client';
    const clientPhone = (customer && customer.phone) ? customer.phone.trim() : '';
    const clientEmail = (customer && customer.email) ? customer.email.trim() : '';

    const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY || process.env.RZP_KEY_ID || '';
    const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET || process.env.RZP_KEY_SECRET || '';

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return res.status(500).json({
        error: 'Razorpay credentials not configured on server',
        message: 'RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is missing.'
      });
    }

    // 4. Initialize Razorpay SDK and Create Order
    let order;
    try {
      const razorpay = new Razorpay({
        key_id: RAZORPAY_KEY_ID,
        key_secret: RAZORPAY_KEY_SECRET
      });

      const orderOptions = {
        amount,
        currency,
        receipt,
        notes: {
          bookingRef,
          clientName,
          clientPhone,
          clientEmail,
          propertyType: customer?.propertyType || 'Not specified',
          budgetTier: customer?.budgetTier || 'Not specified',
          ...(body.notes || {})
        }
      };

      order = await razorpay.orders.create(orderOptions);
    } catch (rzpError) {
      console.error('[Razorpay Create Order Error]:', rzpError);

      // Handle Authentication Failure (401)
      if (
        rzpError.statusCode === 401 ||
        (rzpError.error && rzpError.error.code === 'BAD_REQUEST_ERROR' && rzpError.error.description?.toLowerCase().includes('auth')) ||
        (rzpError.message && rzpError.message.toLowerCase().includes('auth'))
      ) {
        return res.status(401).json({
          error: 'Razorpay authentication failed',
          message: rzpError.error?.description || rzpError.message || 'Invalid Razorpay Key ID or Secret'
        });
      }

      // Handle other Razorpay API errors (500)
      return res.status(500).json({
        error: 'Failed to create Razorpay order',
        message: rzpError.error?.description || rzpError.message || 'Razorpay API error'
      });
    }

    // 5. Link with existing lead or save pending lead record
    const leadId = body.leadId || customer?.leadId;
    try {
      if (leadId || body.bookingRef) {
        await DB.linkRazorpayOrder(leadId || body.bookingRef, order.id);
      } else if (clientName && clientName !== 'Client') {
        await DB.createLead({
          bookingRef,
          name: clientName,
          email: clientEmail,
          phone: clientPhone,
          phoneRaw: customer?.phoneRaw || clientPhone.replace(/\D/g, ''),
          location: customer?.location || '',
          propertyType: customer?.propertyType || '',
          budgetTier: customer?.budgetTier || '',
          stage: customer?.stage || '',
          description: customer?.description || '',
          amountPaise: amount,
          currency,
          orderId: order.id,
          paymentStatus: 'pending'
        });
      }
    } catch (dbErr) {
      console.warn('[DB Lead Link/Save Warning]:', dbErr.message);
    }

    // 6. Return response with order_id, amount, currency (plus helpers)
    return res.status(200).json({
      success: true,
      status: 'created',
      order_id: order.id,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      keyId: RAZORPAY_KEY_ID,
      key_id: RAZORPAY_KEY_ID,
      bookingRef
    });
  } catch (error) {
    console.error('[Create Order Global Error]:', error);
    return res.status(500).json({
      error: 'Failed to create payment order',
      message: error.message || 'Internal server error'
    });
  }
}
