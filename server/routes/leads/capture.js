import { DB } from '../../db.js';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
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

    // Validate Required Fields
    const name = (body.name || body.customer_name || '').trim();
    const phone = (body.phone || body.customer_phone || '').trim();
    const phoneRaw = (body.phoneRaw || phone).replace(/\D/g, '');

    if (!name || name.length < 2) {
      return res.status(400).json({ error: 'Valid customer name is required' });
    }

    if (!phoneRaw || phoneRaw.length < 10) {
      return res.status(400).json({ error: 'Valid 10-digit mobile/WhatsApp number is required' });
    }

    // Extract Client Metadata
    const userAgent = req.headers['user-agent'] || '';
    const forwardedFor = req.headers['x-forwarded-for'];
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : req.socket?.remoteAddress || '';
    const referrer = req.headers['referer'] || req.headers['referrer'] || '';

    // Create Lead in Supabase / DB
    const lead = await DB.createLead({
      ...body,
      name,
      phone,
      phoneRaw,
      userAgent,
      ip,
      referrer
    });

    return res.status(200).json({
      success: true,
      message: 'Consultation lead captured successfully',
      leadId: lead.lead_id,
      bookingRef: lead.booking_reference,
      id: lead.id,
      paymentStatus: lead.payment_status,
      timestamp: lead.created_at
    });
  } catch (err) {
    console.error('[Lead Capture Error]:', err);
    return res.status(500).json({
      error: 'Failed to capture lead',
      message: err.message || 'Internal server error'
    });
  }
}
