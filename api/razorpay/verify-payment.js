import crypto from 'crypto';
import Razorpay from 'razorpay';
import { DB } from '../../server/db.js';

const CALENDLY_BASE_URL = process.env.CALENDLY_URL || 'https://calendly.com/zrinteriordesign/45min';

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

    // 1. Extract Order ID, Payment ID, and Signature (support both naming formats)
    const order_id = body.order_id || body.razorpay_order_id;
    const payment_id = body.payment_id || body.razorpay_payment_id;
    const signature = body.signature || body.razorpay_signature;
    const ref = body.bookingRef || body.bookingId;

    // 2. Validate Required Fields
    if (!order_id || !payment_id || !signature) {
      return res.status(400).json({
        error: 'Missing required payment verification parameters',
        required: ['order_id', 'payment_id', 'signature'],
        received: {
          order_id: Boolean(order_id),
          payment_id: Boolean(payment_id),
          signature: Boolean(signature)
        }
      });
    }

    const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET || process.env.RZP_KEY_SECRET || '';
    const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY || process.env.RZP_KEY_ID || '';

    if (!RAZORPAY_KEY_SECRET) {
      return res.status(500).json({
        error: 'RAZORPAY_KEY_SECRET is not configured on server',
        verified: false
      });
    }

    // 3. Server-Side HMAC SHA256 Signature Verification
    // Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
    const generatedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${order_id}|${payment_id}`)
      .digest('hex');

    let isSignatureValid = false;
    try {
      const expectedBuf = Buffer.from(generatedSignature, 'utf8');
      const providedBuf = Buffer.from(signature, 'utf8');

      if (expectedBuf.length === providedBuf.length) {
        isSignatureValid = crypto.timingSafeEqual(expectedBuf, providedBuf);
      }
    } catch (cmpErr) {
      isSignatureValid = false;
    }

    // Reject immediately on signature mismatch - DO NOT MARK AS PAID
    if (!isSignatureValid) {
      console.error('[Payment Verification Failed] Signature mismatch for order:', order_id);
      return res.status(400).json({
        error: 'Payment verification failed: Signature mismatch',
        verified: false,
        success: false
      });
    }

    // 4. Signatures match! Payment is verified.
    // Fetch transaction details from Razorpay if available
    let paymentDetails = null;
    if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
      try {
        const razorpay = new Razorpay({
          key_id: RAZORPAY_KEY_ID,
          key_secret: RAZORPAY_KEY_SECRET
        });
        paymentDetails = await razorpay.payments.fetch(payment_id);

        // Auto-capture authorized payments if not yet captured
        if (paymentDetails && paymentDetails.status === 'authorized') {
          try {
            paymentDetails = await razorpay.payments.capture(
              payment_id,
              paymentDetails.amount,
              paymentDetails.currency
            );
          } catch (capErr) {
            console.warn('[Razorpay Auto-Capture Notice]:', capErr.message);
          }
        }
      } catch (rzpErr) {
        // Non-fatal if payment is synthetic test or network blip
        console.warn('[Razorpay Details Fetch Notice]:', rzpErr.message);
      }
    }

    // 5. Update Database Record if Booking Exists
    let booking = null;
    if (ref) {
      booking = await DB.getBookingByRef(ref);
    }
    if (!booking && order_id) {
      booking = await DB.getBookingByOrderId(order_id);
    }

    let updatedRecord = null;
    try {
      updatedRecord = await DB.updatePaymentSuccess(ref || order_id, {
        paymentId: payment_id,
        orderId: order_id,
        signature: signature,
        metadata: {
          method: paymentDetails?.method || 'online',
          email: paymentDetails?.email || booking?.customer_email || '',
          contact: paymentDetails?.contact || booking?.customer_phone || '',
          capturedAt: new Date().toISOString()
        }
      });
    } catch (dbErr) {
      console.warn('[DB Payment Update Notice]:', dbErr.message);
    }

    const customerName = updatedRecord?.customer_name || booking?.customer_name || 'Client';
    const customerEmail = updatedRecord?.customer_email || booking?.customer_email || paymentDetails?.email || '';
    const customerPhone = updatedRecord?.customer_phone_raw || updatedRecord?.customer_phone || booking?.customer_phone || paymentDetails?.contact || '';
    const activeBookingRef = updatedRecord?.booking_reference || ref || `ZR-BK-${order_id.slice(-6)}`;

    // 6. Build Calendly Scheduling Link
    const calendlyParams = new URLSearchParams();
    if (customerName && customerName !== 'Client') calendlyParams.set('name', customerName);
    if (customerEmail) calendlyParams.set('email', customerEmail);
    if (customerPhone) calendlyParams.set('a1', customerPhone);
    calendlyParams.set('utm_source', 'zr_funnel');
    calendlyParams.set('utm_campaign', activeBookingRef);

    const calendlyUrl = `${CALENDLY_BASE_URL}?${calendlyParams.toString()}`;

    // 7. Return Verified Response
    return res.status(200).json({
      success: true,
      verified: true,
      message: 'Payment signature verified successfully',
      order_id,
      orderId: order_id,
      payment_id,
      paymentId: payment_id,
      bookingRef: activeBookingRef,
      calendlyUrl,
      customer: {
        name: customerName,
        email: customerEmail,
        phone: customerPhone
      }
    });
  } catch (error) {
    console.error('[Verify Payment Global Error]:', error);
    return res.status(500).json({
      error: 'Internal server error during payment verification',
      message: error.message || 'Verification failed'
    });
  }
}
