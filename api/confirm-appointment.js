import { DB } from '../server/db.js';

const WHATSAPP_NUMBER = process.env.WHATSAPP_BUSINESS_PHONE || '917878588859';
const CALENDLY_EVENT_URL = process.env.CALENDLY_URL || 'https://calendly.com/zrinteriordesign/45min';

export function buildWhatsAppUrl(booking) {
  const customerName = booking.customer_name || booking.name || '';
  const customerPhone = booking.customer_phone_raw || booking.customer_phone || booking.phone || '';
  const propertyType = booking.property_type || booking.propertyType || '';
  const projectLocation = booking.project_location || booking.location || '';
  const budget = booking.budget_tier || booking.budgetTier || '';
  const bookingDate = booking.appointment_date || booking.date || '';
  const bookingTime = booking.appointment_time || booking.timeSlot || booking.time || '';
  const paymentId = booking.razorpay_payment_id || booking.payment_id || booking.paymentId || 'Verified';

  const lines = [
    'Hello ZR Interior Design Team,',
    'I have successfully paid for my interior design consultation and booked my appointment.'
  ];

  if (customerName) lines.push(`Name: ${customerName}`);
  if (customerPhone) lines.push(`Phone: ${customerPhone}`);
  if (propertyType) lines.push(`Property Type: ${propertyType}`);
  if (projectLocation) lines.push(`Project Location: ${projectLocation}`);
  if (bookingDate) lines.push(`Appointment Date: ${bookingDate}`);
  if (bookingTime) lines.push(`Appointment Time: ${bookingTime}`);
  if (paymentId) lines.push(`Payment Reference: ${paymentId}`);

  lines.push('Please confirm my consultation.');
  lines.push('Thank you.');

  const message = lines.join('\n');
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

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
      date,
      time,
      timeSlot,
      timezone,
      calendlyEventUri,
      calendlyInviteeUri
    } = body;

    const ref = bookingRef || bookingId;

    if (!ref) {
      return res.status(400).json({ error: 'Missing booking reference' });
    }

    const booking = await DB.getBookingByRef(ref);

    if (!booking) {
      return res.status(404).json({ error: 'Booking record not found' });
    }

    // Step G Requirement: Never mark an appointment as booked solely because payment succeeded.
    // Also ensure payment has actually succeeded before scheduling!
    if (booking.payment_status !== 'PAID') {
      return res.status(403).json({
        error: 'Cannot confirm appointment: Payment has not been verified yet',
        paymentStatus: booking.payment_status
      });
    }

    const appointmentDate = date || 'Confirmed via Calendly';
    const appointmentTime = time || timeSlot || '45-Minute Confirmed Slot';
    const activeTimezone = timezone || 'Asia/Kolkata';

    const updatedBooking = await DB.updateAppointmentConfirmed(ref, {
      date: appointmentDate,
      time: appointmentTime,
      timezone: activeTimezone,
      calendlyEventUri,
      calendlyInviteeUri
    });

    const finalBooking = updatedBooking || {
      ...booking,
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      timezone: activeTimezone
    };

    const whatsappUrl = buildWhatsAppUrl(finalBooking);

    return res.status(200).json({
      success: true,
      confirmed: true,
      bookingRef: ref,
      appointment: {
        date: appointmentDate,
        time: appointmentTime,
        timezone: activeTimezone,
        duration: '45 minutes'
      },
      whatsappUrl
    });
  } catch (error) {
    console.error('[Confirm Appointment Error]:', error);
    return res.status(500).json({
      error: 'Failed to confirm appointment',
      message: error.message
    });
  }
}
