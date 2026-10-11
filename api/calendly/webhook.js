import crypto from 'crypto';
import { DB } from '../../server/db.js';

function formatCalendlyDate(isoString, timezone = 'Asia/Kolkata') {
  if (!isoString) return 'Confirmed Date';
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: timezone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(d);
  } catch (e) {
    return isoString;
  }
}

function formatCalendlyTime(isoString, timezone = 'Asia/Kolkata') {
  if (!isoString) return 'Confirmed Slot';
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(d);
  } catch (e) {
    return isoString;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const webhookSecret = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
  const signatureHeader = req.headers['calendly-webhook-signature'];

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON request body' });
    }
  }

  // Optional signature verification if signing key is set
  if (webhookSecret && signatureHeader) {
    try {
      const parts = signatureHeader.split(',');
      const t = parts.find((p) => p.startsWith('t='))?.split('=')[1];
      const v1 = parts.find((p) => p.startsWith('v1='))?.split('=')[1];

      if (t && v1) {
        const rawPayload = typeof req.body === 'string' ? req.body : JSON.stringify(body);
        const dataToSign = `${t}.${rawPayload}`;
        const expectedSignature = crypto
          .createHmac('sha256', webhookSecret)
          .update(dataToSign)
          .digest('hex');

        if (expectedSignature !== v1) {
          console.error('[Calendly Webhook] Invalid signature');
          return res.status(400).json({ error: 'Invalid Calendly signature' });
        }
      }
    } catch (err) {
      console.warn('[Calendly Webhook Signature Check Error]:', err.message);
    }
  }

  const eventType = body?.event;
  console.log(`[Calendly Webhook Received] Event: ${eventType}`);

  try {
    if (eventType === 'invitee.created') {
      const payload = body?.payload;
      const tracking = payload?.tracking || {};
      const invitee = payload?.invitee || {};
      const eventInfo = payload?.scheduled_event || {};

      // Match via utm_campaign (bookingRef), email, or phone
      const bookingRef = tracking.utm_campaign;
      const email = invitee.email;
      const startTime = eventInfo.start_time;
      const timezone = invitee.timezone || 'Asia/Kolkata';

      const appointmentDate = formatCalendlyDate(startTime, timezone);
      const appointmentTime = formatCalendlyTime(startTime, timezone);

      let matchedBooking = null;
      if (bookingRef && bookingRef.startsWith('ZR-BK')) {
        matchedBooking = await DB.getBookingByRef(bookingRef);
      }
      if (!matchedBooking && email) {
        matchedBooking = await DB.getBookingByEmail?.(email);
      }

      if (matchedBooking) {
        await DB.updateAppointmentConfirmed(matchedBooking.booking_reference, {
          date: appointmentDate,
          time: appointmentTime,
          timezone,
          calendlyEventUri: eventInfo.uri || null,
          calendlyInviteeUri: invitee.uri || null
        });
        console.log(`[Calendly Appointment Synced] Booking: ${matchedBooking.booking_reference}`);
      }
    }

    return res.status(200).json({ status: 'ok', received: true });
  } catch (err) {
    console.error('[Calendly Webhook Processing Error]:', err);
    return res.status(500).json({ error: 'Webhook processing error', details: err.message });
  }
}
