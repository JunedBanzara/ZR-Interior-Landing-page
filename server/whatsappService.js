import { Store } from './store.js';

const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const BUSINESS_PHONE = process.env.WHATSAPP_BUSINESS_PHONE || '917878588859';

export const WhatsAppServerService = {
  /**
   * Check if WhatsApp API is fully configured
   */
  isConfigured() {
    return Boolean(WHATSAPP_TOKEN && WHATSAPP_PHONE_NUMBER_ID);
  },

  /**
   * Format phone number to international E.164 without plus or spaces (e.g. 917878588859)
   */
  formatRecipientPhone(rawPhone) {
    if (!rawPhone) return '';
    let digits = rawPhone.replace(/\D/g, '');
    if (digits.length === 10) {
      digits = '91' + digits;
    }
    return digits;
  },

  /**
   * Send WhatsApp message via Meta Cloud API or log status
   */
  async sendMessage(toPhone, messageBody, templateName = null) {
    const formattedTo = this.formatRecipientPhone(toPhone);

    if (!this.isConfigured()) {
      console.log(`[WhatsApp Service] [STATUS: AWAITING_CREDENTIALS] Would send to +${formattedTo}:`);
      console.log(`----------------------------------------`);
      console.log(messageBody);
      console.log(`----------------------------------------`);
      return {
        success: false,
        status: 'awaiting_credentials',
        message: 'WhatsApp Cloud API credentials awaiting configuration in .env'
      };
    }

    try {
      const url = `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedTo,
        type: 'text',
        text: { preview_url: false, body: messageBody }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[WhatsApp Service] Send Error:', data);
        return { success: false, error: data };
      }

      console.log(`[WhatsApp Service] Message dispatched to +${formattedTo}:`, data);
      return { success: true, data };
    } catch (err) {
      console.error('[WhatsApp Service] Network Error:', err.message);
      return { success: false, error: err.message };
    }
  },

  /**
   * Schedule the 4-phase notification journey in Asia/Kolkata timezone:
   * 1. Immediate confirmation
   * 2. 24 hours before
   * 3. 2 hours before
   * 4. 15 minutes before
   */
  async scheduleBookingNotifications(booking) {
    const { id, lead, appointment } = booking;
    const clientName = lead.name || 'Valued Client';
    const clientPhone = lead.phone || lead.whatsapp;
    const dateStr = appointment?.date || 'Scheduled Date';
    const timeStr = appointment?.timeSlot || 'Scheduled Time';

    const immediateMsg = `Hello ${clientName}, your consultation with ZR Interior Design has been confirmed.\n\nDate: ${dateStr}\nTime: ${timeStr}\nDuration: 45 minutes\n\nPlease keep your floor plan, property details, and requirements ready for the conversation.\n\nWe look forward to speaking with you.`;

    const reminder24h = `Hello ${clientName}, this is a reminder of your ZR Interior Design consultation tomorrow at ${timeStr}. Please keep your project details ready.`;

    const reminder2h = `Hello ${clientName}, your ZR Interior Design consultation is scheduled for ${timeStr} today. We look forward to speaking with you.`;

    const reminder15m = `Hello ${clientName}, your ZR Interior Design consultation starts in 15 minutes. We look forward to speaking with you.`;

    const stages = [
      { id: `${id}_immediate`, stage: 'immediate', text: immediateMsg, target: 'Immediate upon confirmation' },
      { id: `${id}_24h`, stage: '24_hours_before', text: reminder24h, target: '24 hours before appointment' },
      { id: `${id}_2h`, stage: '2_hours_before', text: reminder2h, target: '2 hours before appointment' },
      { id: `${id}_15m`, stage: '15_minutes_before', text: reminder15m, target: '15 minutes before appointment' }
    ];

    // Save reminder records in persistence store
    stages.forEach((s) => {
      Store.saveReminder({
        id: s.id,
        bookingId: id,
        recipient: clientPhone,
        stage: s.stage,
        message: s.text,
        scheduledForDescription: s.target,
        status: this.isConfigured() ? 'PENDING' : 'AWAITING_CREDENTIALS',
        timezone: 'Asia/Kolkata',
        createdAt: new Date().toISOString()
      });
    });

    // Send immediate confirmation
    const immediateRes = await this.sendMessage(clientPhone, immediateMsg);
    Store.saveReminder({
      id: `${id}_immediate`,
      status: immediateRes.success ? 'SENT' : (this.isConfigured() ? 'FAILED' : 'AWAITING_CREDENTIALS'),
      sentAt: new Date().toISOString()
    });

    return {
      scheduled: true,
      stagesCount: stages.length,
      immediateResult: immediateRes
    };
  }
};
