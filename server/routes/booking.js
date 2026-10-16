import { DB } from '../db.js';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'Missing booking ID parameter' });
    }

    let booking = await DB.getBookingByRef(id);
    if (!booking) {
      booking = await DB.getBookingByOrderId(id);
    }
    if (!booking) {
      booking = await DB.getBookingByPaymentId(id);
    }

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    return res.status(200).json({
      bookingRef: booking.booking_reference,
      name: booking.customer_name,
      phone: booking.customer_phone,
      email: booking.customer_email,
      paymentStatus: (booking.payment_status || '').toUpperCase() === 'PAID' ? 'PAID' : (booking.payment_status || '').toUpperCase(),
      payment_status: booking.payment_status,
      appointmentStatus: booking.appointment_status,
      appointmentDate: booking.appointment_date,
      appointmentTime: booking.appointment_time,
      timezone: booking.timezone,
      createdAt: booking.created_at
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
}
