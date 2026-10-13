import { DB } from '../server/db.js';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
  const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
  const isRazorpayConfigured = Boolean(
    RAZORPAY_KEY_ID &&
    RAZORPAY_KEY_SECRET &&
    !RAZORPAY_KEY_ID.includes('placeholder') &&
    !RAZORPAY_KEY_SECRET.includes('placeholder')
  );

  return res.status(200).json({
    status: 'online',
    system: 'Z R Interior Design Booking & Payment Automation Engine',
    serverTime: new Date().toISOString(),
    fee: {
      amountInr: 199,
      amountPaise: 19900,
      currency: 'INR',
      durationMinutes: 45
    },
    integrations: {
      razorpay: {
        configured: isRazorpayConfigured,
        mode: RAZORPAY_KEY_ID.startsWith('rzp_test_') ? 'test' : (isRazorpayConfigured ? 'live' : 'unconfigured')
      },
      calendly: {
        configured: true,
        url: process.env.CALENDLY_URL || 'https://calendly.com/zrinteriordesign/45min'
      },
      whatsapp: {
        configured: true,
        businessPhone: '+91 78785 88859'
      },
      database: {
        type: DB.isSupabaseConfigured() ? 'Supabase PostgreSQL' : 'Local Fallback Storage'
      }
    }
  });
}
