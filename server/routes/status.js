import { DB } from '../db.js';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY || process.env.RZP_KEY_ID || '';
  const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET || process.env.RZP_KEY_SECRET || '';
  const isRazorpayConfigured = Boolean(
    RAZORPAY_KEY_ID &&
    RAZORPAY_KEY_SECRET &&
    !RAZORPAY_KEY_ID.includes('placeholder') &&
    !RAZORPAY_KEY_SECRET.includes('placeholder')
  );

  const detectedRazorpayKeys = Object.keys(process.env).filter(k => 
    k.toUpperCase().includes('RAZOR') || 
    k.toUpperCase().includes('RZP')
  );

  const detectedSupabaseKeys = Object.keys(process.env).filter(k => 
    k.toUpperCase().includes('SUPABASE')
  );

  const dbConnectionTest = await DB.testSupabaseConnection();

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
        mode: RAZORPAY_KEY_ID.startsWith('rzp_test_') ? 'test' : (isRazorpayConfigured ? 'live' : 'unconfigured'),
        envDiagnostics: {
          has_RAZORPAY_KEY_ID: Boolean(process.env.RAZORPAY_KEY_ID),
          has_RAZORPAY_KEY_SECRET: Boolean(process.env.RAZORPAY_KEY_SECRET),
          detectedRazorpayEnvVarNames: detectedRazorpayKeys
        }
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
        type: DB.isSupabaseConfigured() ? 'Supabase PostgreSQL' : 'Local Fallback Storage',
        configured: DB.isSupabaseConfigured(),
        connected: dbConnectionTest.connected,
        projectUrl: DB.getProjectUrl(),
        projectReference: 'udetsffqshoxanyviyht',
        leadsCount: dbConnectionTest.leadsCount ?? null,
        statusMessage: dbConnectionTest.message || dbConnectionTest.error || (DB.isSupabaseConfigured() ? 'Connected' : 'Operating on local fallback storage until keys are configured'),
        envDiagnostics: {
          has_SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
          has_SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_REPLACEMENT_SECRET_KEY),
          has_SUPABASE_ANON_KEY: Boolean(process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY),
          detectedSupabaseEnvVarNames: detectedSupabaseKeys
        }
      }
    }
  });
}
