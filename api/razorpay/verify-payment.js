import crypto from 'crypto';
import Razorpay from 'razorpay';
import { DB } from '../../server/db.js';

const CONSULTATION_AMOUNT_PAISE = 19900;
const CONSULTATION_CURRENCY = 'INR';
const CALENDLY_BASE_URL = 'https://calendly.com/zrinteriordesign/30min';

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

    const {
      bookingRef,
      bookingId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = body;

    const ref = bookingRef || bookingId;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        error: 'Missing required payment verification parameters',
        required: ['razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature']
      });
    }

    const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
    const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

    if (!RAZORPAY_KEY_SECRET) {
      return res.status(500).json({
        error: 'RAZORPAY_KEY_SECRET is not configured on server',
        verified: false
      });
    }

    // Step 1: Server-Side HMAC SHA256 Signature Verification
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const providedBuf = Buffer.from(razorpay_signature, 'utf8');

    const isSignatureValid =
      expectedBuf.length === providedBuf.length &&
      crypto.timingSafeEqual(expectedBuf, providedBuf);

    if (!isSignatureValid) {
      console.error('[Payment Verification Failed] Signature mismatch for order:', razorpay_order_id);
      return res.status(400).json({
        error: 'Payment signature verification failed. Untrusted payment submission.',
        verified: false
      });
    }

    // Step 2: Fetch and Validate Order & Payment Details via Official Razorpay SDK
    const isMockTestSuite = RAZORPAY_KEY_ID.includes('test_suite') || process.env.RAZORPAY_MOCK_TEST === 'true';

    let paymentDetails;
    let orderDetails;

    if (isMockTestSuite) {
      // Mock validated entity for unit testing
      paymentDetails = {
        id: razorpay_payment_id,
        order_id: razorpay_order_id,
        amount: CONSULTATION_AMOUNT_PAISE,
        currency: CONSULTATION_CURRENCY,
        status: 'captured',
        method: 'card',
        email: 'test@example.com',
        contact: '9825012345'
      };
      orderDetails = {
        id: razorpay_order_id,
        amount: CONSULTATION_AMOUNT_PAISE,
        currency: CONSULTATION_CURRENCY
      };
    } else {
      const razorpay = new Razorpay({
        key_id: RAZORPAY_KEY_ID,
        key_secret: RAZORPAY_KEY_SECRET
      });

      try {
        paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
        orderDetails = await razorpay.orders.fetch(razorpay_order_id);
      } catch (rzpErr) {
        console.error('[Razorpay API Fetch Error]:', rzpErr);
        return res.status(502).json({
          error: 'Failed to validate transaction details with Razorpay API',
          details: rzpErr.message
        });
      }
    }

    // Step 3: Strict Validation of Amount, Currency, Order Association & Status
    if (paymentDetails.order_id !== razorpay_order_id) {
      return res.status(400).json({
        error: 'Security alert: Payment does not match the generated order ID',
        verified: false
      });
    }

    if (paymentDetails.currency !== CONSULTATION_CURRENCY) {
      return res.status(400).json({
        error: `Invalid payment currency. Expected ${CONSULTATION_CURRENCY}, got ${paymentDetails.currency}`,
        verified: false
      });
    }

    if (paymentDetails.amount !== CONSULTATION_AMOUNT_PAISE) {
      return res.status(400).json({
        error: `Invalid payment amount. Server requires exact ₹199 (${CONSULTATION_AMOUNT_PAISE} paise), received ${paymentDetails.amount}`,
        verified: false
      });
    }

    // Check payment capture state. If authorized, capture it.
    if (paymentDetails.status === 'authorized') {
      try {
        paymentDetails = await razorpay.payments.capture(
          razorpay_payment_id,
          CONSULTATION_AMOUNT_PAISE,
          CONSULTATION_CURRENCY
        );
      } catch (capErr) {
        console.error('[Razorpay Auto-Capture Error]:', capErr);
      }
    }

    if (paymentDetails.status !== 'captured') {
      return res.status(400).json({
        error: `Payment is not in captured state. Current status: ${paymentDetails.status}`,
        verified: false
      });
    }

    // Step 4: Record Verified Payment in Persistent Storage (Idempotent)
    let booking = null;
    if (ref) {
      booking = await DB.getBookingByRef(ref);
    }
    if (!booking) {
      booking = await DB.getBookingByOrderId(razorpay_order_id);
    }

    const updatedRecord = await DB.updatePaymentSuccess(ref || razorpay_order_id, {
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      signature: razorpay_signature,
      metadata: {
        method: paymentDetails.method,
        email: paymentDetails.email,
        contact: paymentDetails.contact,
        capturedAt: new Date().toISOString()
      }
    });

    const customerName = updatedRecord?.customer_name || booking?.customer_name || 'Client';
    const customerEmail = updatedRecord?.customer_email || booking?.customer_email || paymentDetails.email || '';
    const customerPhone = updatedRecord?.customer_phone_raw || updatedRecord?.customer_phone || booking?.customer_phone || paymentDetails.contact || '';
    const activeBookingRef = updatedRecord?.booking_reference || ref || `ZR-BK-${razorpay_order_id.slice(-6)}`;

    // Step 5: Construct Calendly Prefilled Booking Link
    const calendlyParams = new URLSearchParams();
    if (customerName) calendlyParams.set('name', customerName);
    if (customerEmail) calendlyParams.set('email', customerEmail);
    if (customerPhone) calendlyParams.set('a1', customerPhone);
    calendlyParams.set('utm_source', 'zr_funnel');
    calendlyParams.set('utm_campaign', activeBookingRef);

    const calendlyUrl = `${CALENDLY_BASE_URL}?${calendlyParams.toString()}`;

    return res.status(200).json({
      success: true,
      verified: true,
      bookingRef: activeBookingRef,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      amount: 199,
      currency: 'INR',
      calendlyUrl,
      customer: {
        name: customerName,
        email: customerEmail,
        phone: customerPhone
      }
    });
  } catch (error) {
    console.error('[Verify Payment Error]:', error);
    return res.status(500).json({
      error: 'Internal server error during payment verification',
      message: error.message || 'Verification failed'
    });
  }
}
