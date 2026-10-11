import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

let __dirname = '';
try {
  const __filename = fileURLToPath(import.meta.url);
  __dirname = path.dirname(__filename);
} catch (e) {
  __dirname = process.cwd();
}

const DATA_DIR = path.join(process.cwd(), 'data');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');

// Initialize local JSON storage fallback
function ensureLocalStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(BOOKINGS_FILE)) {
      fs.writeFileSync(BOOKINGS_FILE, JSON.stringify([], null, 2));
    }
  } catch (err) {
    // Might be read-only in Vercel serverless environment; handled in memory
  }
}
ensureLocalStore();

// In-memory fallback if filesystem is read-only
let memoryBookings = [];

function readLocalBookings() {
  try {
    if (fs.existsSync(BOOKINGS_FILE)) {
      const data = fs.readFileSync(BOOKINGS_FILE, 'utf8');
      return JSON.parse(data || '[]');
    }
  } catch (e) {
    // Fall back to memory
  }
  return memoryBookings;
}

function writeLocalBookings(bookings) {
  memoryBookings = bookings;
  try {
    if (fs.existsSync(DATA_DIR)) {
      fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2));
    }
  } catch (e) {
    // Filesystem may be ephemeral/read-only on serverless
  }
}

// Check for Supabase configuration
function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey && !supabaseUrl.includes('placeholder') && !supabaseKey.includes('placeholder')) {
    try {
      return createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false }
      });
    } catch (err) {
      console.warn('[DB] Error initializing Supabase client:', err.message);
    }
  }
  return null;
}

export const DB = {
  isSupabaseConfigured() {
    return Boolean(getSupabaseClient());
  },

  async createBooking(booking) {
    const supabase = getSupabaseClient();
    const record = {
      booking_reference: booking.bookingRef || booking.booking_reference,
      customer_name: booking.name || booking.customer_name,
      customer_email: booking.email || booking.customer_email || '',
      customer_phone: booking.phone || booking.customer_phone,
      customer_phone_raw: booking.phoneRaw || booking.customer_phone_raw || '',
      project_location: booking.location || booking.project_location || '',
      property_type: booking.propertyType || booking.property_type || '',
      budget_tier: booking.budgetTier || booking.budget_tier || '',
      project_stage: booking.stage || booking.project_stage || '',
      project_description: booking.description || booking.project_description || '',
      consultation_fee_paise: booking.amountPaise || booking.consultation_fee_paise || 19900,
      currency: booking.currency || 'INR',
      razorpay_order_id: booking.orderId || booking.razorpay_order_id || null,
      payment_status: booking.paymentStatus || 'PENDING',
      appointment_status: 'UNSCHEDULED',
      whatsapp_followup_status: 'PENDING',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('consultation_bookings')
          .insert(record)
          .select()
          .single();

        if (error) {
          console.error('[DB Supabase Insert Error]:', error.message);
        } else if (data) {
          return data;
        }
      } catch (err) {
        console.error('[DB Supabase Exception]:', err.message);
      }
    }

    // Local fallback
    const all = readLocalBookings();
    all.push(record);
    writeLocalBookings(all);
    return record;
  },

  async getBookingByRef(bookingRef) {
    if (!bookingRef) return null;
    const supabase = getSupabaseClient();

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('consultation_bookings')
          .select('*')
          .eq('booking_reference', bookingRef)
          .maybeSingle();

        if (!error && data) return data;
      } catch (err) {
        console.error('[DB Supabase Query Error]:', err.message);
      }
    }

    const all = readLocalBookings();
    return all.find((b) => b.booking_reference === bookingRef) || null;
  },

  async getBookingByOrderId(orderId) {
    if (!orderId) return null;
    const supabase = getSupabaseClient();

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('consultation_bookings')
          .select('*')
          .eq('razorpay_order_id', orderId)
          .maybeSingle();

        if (!error && data) return data;
      } catch (err) {
        console.error('[DB Supabase Query Error]:', err.message);
      }
    }

    const all = readLocalBookings();
    return all.find((b) => b.razorpay_order_id === orderId) || null;
  },

  async getBookingByPaymentId(paymentId) {
    if (!paymentId) return null;
    const supabase = getSupabaseClient();

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('consultation_bookings')
          .select('*')
          .eq('razorpay_payment_id', paymentId)
          .maybeSingle();

        if (!error && data) return data;
      } catch (err) {
        console.error('[DB Supabase Query Error]:', err.message);
      }
    }

    const all = readLocalBookings();
    return all.find((b) => b.razorpay_payment_id === paymentId) || null;
  },

  async updatePaymentSuccess(bookingRefOrOrderId, { paymentId, orderId, signature, metadata }) {
    const supabase = getSupabaseClient();
    const updatePayload = {
      razorpay_payment_id: paymentId,
      ...(orderId ? { razorpay_order_id: orderId } : {}),
      razorpay_signature: signature || null,
      payment_status: 'PAID',
      payment_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...(metadata ? { payment_metadata: metadata } : {})
    };

    if (supabase) {
      try {
        let query = supabase.from('consultation_bookings').update(updatePayload);
        if (bookingRefOrOrderId.startsWith('ZR-BK') || bookingRefOrOrderId.startsWith('ZR_BK')) {
          query = query.eq('booking_reference', bookingRefOrOrderId);
        } else {
          query = query.eq('razorpay_order_id', bookingRefOrOrderId);
        }
        const { data, error } = await query.select().maybeSingle();
        if (!error && data) return data;
      } catch (err) {
        console.error('[DB Supabase Payment Update Error]:', err.message);
      }
    }

    // Local fallback
    const all = readLocalBookings();
    const idx = all.findIndex(
      (b) => b.booking_reference === bookingRefOrOrderId || b.razorpay_order_id === bookingRefOrOrderId
    );
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...updatePayload };
      writeLocalBookings(all);
      return all[idx];
    }
    return null;
  },

  async updateAppointmentConfirmed(bookingRef, { date, time, timezone, calendlyEventUri, calendlyInviteeUri }) {
    const supabase = getSupabaseClient();
    const updatePayload = {
      appointment_date: date,
      appointment_time: time,
      timezone: timezone || 'Asia/Kolkata',
      calendly_event_uri: calendlyEventUri || null,
      calendly_invitee_uri: calendlyInviteeUri || null,
      appointment_status: 'SCHEDULED',
      appointment_confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('consultation_bookings')
          .update(updatePayload)
          .eq('booking_reference', bookingRef)
          .select()
          .maybeSingle();

        if (!error && data) return data;
      } catch (err) {
        console.error('[DB Supabase Appointment Update Error]:', err.message);
      }
    }

    // Local fallback
    const all = readLocalBookings();
    const idx = all.findIndex((b) => b.booking_reference === bookingRef);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...updatePayload };
      writeLocalBookings(all);
      return all[idx];
    }
    return null;
  },

  async updateWhatsAppStatus(bookingRef, status) {
    const supabase = getSupabaseClient();
    const updatePayload = {
      whatsapp_followup_status: status,
      whatsapp_last_interaction_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (supabase) {
      try {
        await supabase
          .from('consultation_bookings')
          .update(updatePayload)
          .eq('booking_reference', bookingRef);
      } catch (e) {}
    }

    const all = readLocalBookings();
    const idx = all.findIndex((b) => b.booking_reference === bookingRef);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...updatePayload };
      writeLocalBookings(all);
    }
  }
};
