import crypto from 'crypto';
import { DB } from '../../db.js';

const CONSULTATION_AMOUNT_PAISE = 19900;
const CONSULTATION_CURRENCY = 'INR';

// Helper to extract raw body buffer from request
async function getRawBody(req) {
  if (req.rawBody) return req.rawBody;
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');

  return new Promise((resolve, reject) => {
    let chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', (err) => reject(err));
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const webhookSignature = req.headers['x-razorpay-signature'];
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSignature) {
    return res.status(400).json({ error: 'Missing x-razorpay-signature header' });
  }

  if (!webhookSecret) {
    console.warn('[Razorpay Webhook Warning] RAZORPAY_WEBHOOK_SECRET is not configured.');
    return res.status(500).json({ error: 'Webhook secret is not configured on server' });
  }

  let rawBody = '';
  try {
    rawBody = await getRawBody(req);
  } catch (err) {
    return res.status(400).json({ error: 'Failed to read raw webhook body' });
  }

  // Verify Webhook Signature with RAZORPAY_WEBHOOK_SECRET (Not API secret)
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  const expectedBuf = Buffer.from(expectedSignature, 'utf8');
  const providedBuf = Buffer.from(webhookSignature, 'utf8');

  const isValid =
    expectedBuf.length === providedBuf.length &&
    crypto.timingSafeEqual(expectedBuf, providedBuf);

  if (!isValid) {
    console.error('[Razorpay Webhook Error] Invalid webhook signature detected');
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  let payload = {};
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const event = payload.event;
  console.log(`[Razorpay Webhook Received] Event: ${event}`);

  try {
    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = payload.payload?.payment?.entity;
      const orderEntity = payload.payload?.order?.entity;

      const orderId = paymentEntity?.order_id || orderEntity?.id;
      const paymentId = paymentEntity?.id;
      const amount = paymentEntity?.amount || orderEntity?.amount;
      const currency = paymentEntity?.currency || orderEntity?.currency;
      const notes = paymentEntity?.notes || orderEntity?.notes || {};
      const bookingRef = notes.bookingRef;

      // Validate exact consultation fee
      if (amount === CONSULTATION_AMOUNT_PAISE && currency === CONSULTATION_CURRENCY && orderId && paymentId) {
        console.log(`[Webhook Payment Reconciled] Order: ${orderId}, Payment: ${paymentId}`);

        await DB.updatePaymentSuccess(bookingRef || orderId, {
          paymentId,
          orderId,
          signature: 'webhook_verified',
          metadata: {
            webhookEvent: event,
            method: paymentEntity?.method,
            capturedAt: new Date().toISOString()
          }
        });
      }
    } else if (event === 'payment.failed') {
      const paymentEntity = payload.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id;
      const errorDescription = paymentEntity?.error_description || paymentEntity?.error_reason || 'Payment failed';
      if (orderId) {
        console.log(`[Webhook Payment Failed] Order: ${orderId}, Reason: ${errorDescription}`);
        await DB.updatePaymentFailed(orderId, {
          reason: errorDescription,
          metadata: {
            webhookEvent: event,
            errorCode: paymentEntity?.error_code,
            errorDescription
          }
        });
      }
    }

    // Always acknowledge 200 OK to Razorpay
    return res.status(200).json({ status: 'ok', received: true });
  } catch (err) {
    console.error('[Webhook Processing Error]:', err);
    return res.status(500).json({ error: 'Failed to process webhook event' });
  }
}
