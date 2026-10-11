import { DB } from '../server/db.js';

const WHATSAPP_NUMBER = '917878588859';
const CALENDLY_EVENT_URL = 'https://calendly.com/zrinteriordesign/30min';

export function buildWhatsAppUrl(booking) {
  const customerName = booking.customer_name || 'Valued Client';
  const customerEmail = booking.customer_email || 'Not provided';
  const customerPhone = booking.customer_phone || '';
  const paymentId = booking.razorpay_payment_id || 'Verified';
  const bookingDate = booking.appointment_date || 'Upcoming Date';
  const bookingTime = booking.appointment_time || '30-Minute Consultation';
  const timeZone = booking.timezone || 'Asia/Kolkata (IST)';
  const bookingRef = booking.booking_reference || 'ZR-BK';

  const message = `Hello Z R INTERIOR DESIGN,
I have successfully paid for my interior design consultation and booked my appointment.

Booking Details:
Name: ${customerName}
Email: ${customerEmail}
Phone: ${customerPhone}
Consultation: 30-Minute Interior Design Consultation
Consultation Fee: ₹199
Payment Status: Paid
Razorpay Payment ID: ${paymentId}
Booking Date: ${bookingDate}
Booking Time: ${bookingTime}
Time Zone: ${timeZone}
Calendly Event: ${CALENDLY_EVENT_URL}
Booking Reference: ${bookingRef}

Please confirm my consultation and let me know if I should share any floor plans, site photographs, measurements, or requirements before the meeting.

Thank you,
${customerName}`;

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
    const appointmentTime = time || timeSlot || '30-Minute Confirmed Slot';
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
        duration: '30 minutes'
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
