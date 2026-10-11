/**
 * ZR INTERIOR DESIGN — CLIENT WHATSAPP & CALENDAR SERVICE
 * Generates official WhatsApp messages, click-to-chat links, and calendar invites (.ics / Google Calendar)
 */

import { ZR_CONFIG } from './config.js';

export class WhatsAppService {
  /**
   * Generates the primary WhatsApp confirmation text with confirmed booking details
   * Exactly matching Step F requirement
   */
  static generateConfirmationMessage(booking) {
    const name = booking.name || 'Valued Client';
    const email = booking.email || 'Not provided';
    const phone = booking.phone || '';
    const paymentId = booking.paymentId || booking.razorpay_payment_id || 'Verified';
    const date = booking.date || 'Scheduled Date';
    const time = booking.timeSlot || '30-Minute Consultation';
    const timezone = booking.timezone || 'Asia/Kolkata (IST)';
    const bookingRef = booking.id || booking.bookingRef || 'ZR-BK';

    return `Hello Z R INTERIOR DESIGN,
I have successfully paid for my interior design consultation and booked my appointment.

Booking Details:
Name: ${name}
Email: ${email}
Phone: ${phone}
Consultation: 30-Minute Interior Design Consultation
Consultation Fee: ₹199
Payment Status: Paid
Razorpay Payment ID: ${paymentId}
Booking Date: ${date}
Booking Time: ${time}
Time Zone: ${timezone}
Calendly Event: https://calendly.com/zrinteriordesign/30min
Booking Reference: ${bookingRef}

Please confirm my consultation and let me know if I should share any floor plans, site photographs, measurements, or requirements before the meeting.

Thank you,
${name}`;
  }

  /**
   * Generates click-to-chat WhatsApp link to ZR's business number (+91 78785 88859)
   */
  static getWhatsAppUrl(booking) {
    const text = this.generateConfirmationMessage(booking);
    const phone = ZR_CONFIG.brand.whatsappNumber;
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  }

  /**
   * Returns the verified 4-stage reminder schedule
   */
  static getReminderSchedule(booking) {
    const name = booking.name || 'Valued Client';
    const time = booking.timeSlot || 'your scheduled time';

    return [
      {
        stage: "Immediate",
        timing: "Sent immediately upon confirmation",
        title: "Official Booking Confirmation",
        message: `Hello ${name}, your 30-minute consultation with ZR Interior Design has been confirmed. Date: ${booking.date}, Time: ${booking.timeSlot}. Please keep your floor plan and property details ready.`
      },
      {
        stage: "24 Hours Before",
        timing: "Sent 24 hours prior to appointment",
        title: "24-Hour Preparation Reminder",
        message: `Hello ${name}, this is a reminder of your ZR Interior Design consultation tomorrow at ${time}. Please keep your project details ready.`
      },
      {
        stage: "2 Hours Before",
        timing: "Sent 2 hours prior to appointment",
        title: "2-Hour Readiness Alert",
        message: `Hello ${name}, your ZR Interior Design consultation is scheduled for ${time} today. We look forward to speaking with you.`
      },
      {
        stage: "15 Minutes Before",
        timing: "Sent 15 minutes prior",
        title: "15-Minute Final Check-In",
        message: `Hello ${name}, your ZR Interior Design consultation starts in 15 minutes. We look forward to speaking with you.`
      }
    ];
  }

  /**
   * Generates Google Calendar event link (30 minutes)
   */
  static getGoogleCalendarUrl(booking) {
    const title = encodeURIComponent("ZR Interior Design — 30-Minute Private Consultation");
    const details = encodeURIComponent(
      `30-Minute Focused Interior Consultation with ZR Interior Design.\nPrincipal Designer: Mr. Zuber Rafik Banzara\nProperty: ${booking.propertyType || 'Residential / Commercial'}\nLocation: ${booking.location || 'Vadodara'}\nScope: ${booking.budgetTier || 'Turnkey'}\nPlease have floor plans and requirements ready.`
    );
    const location = encodeURIComponent("ZR Interior Design Studio, 304 Raama Crest, Sunpharma Road, Vadodara");

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}`;
  }

  /**
   * Generates and triggers download of .ics calendar invite (30 minutes)
   */
  static downloadIcsFile(booking) {
    const name = (booking.name || 'Client').replace(/[^\w\s-]/g, '');
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ZR Interior Design//Consultation Booking//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
SUMMARY:ZR Interior Design — 30-Minute Consultation (${name})
DESCRIPTION:Private 30-Minute Interior Design Consultation with ZR Interior Design Vadodara.\\nPrincipal Designer: Mr. Zuber Rafik Banzara.\\nFee: ₹199 (Adjustable against project).
LOCATION:ZR Interior Design Studio, Vadodara
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `ZR-Consultation-${name.replace(/\s+/g, '-')}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
