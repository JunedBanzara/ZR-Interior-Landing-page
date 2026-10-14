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
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');
const LOGS_FILE = path.join(DATA_DIR, 'activity_logs.json');

// Ensure local storage directory
function ensureLocalStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(LEADS_FILE)) {
      fs.writeFileSync(LEADS_FILE, JSON.stringify([], null, 2));
    }
    if (!fs.existsSync(BOOKINGS_FILE)) {
      fs.writeFileSync(BOOKINGS_FILE, JSON.stringify([], null, 2));
    }
    if (!fs.existsSync(LOGS_FILE)) {
      fs.writeFileSync(LOGS_FILE, JSON.stringify([], null, 2));
    }
  } catch (err) {
    // Read-only in Vercel serverless environment; handled in memory
  }
}
ensureLocalStore();

// In-memory fallbacks if filesystem is ephemeral/read-only
let memoryLeads = [];
let memoryBookings = [];
let memoryLogs = [];

function readLocal(file, memory) {
  try {
    if (fs.existsSync(file)) {
      const data = fs.readFileSync(file, 'utf8');
      return JSON.parse(data || '[]');
    }
  } catch (e) {}
  return memory;
}

function writeLocal(file, data, setMemory) {
  setMemory(data);
  try {
    if (fs.existsSync(DATA_DIR)) {
      fs.writeFileSync(file, JSON.stringify(data, null, 2));
    }
  } catch (e) {}
}

function readLocalLeads() { return readLocal(LEADS_FILE, memoryLeads); }
function writeLocalLeads(data) { writeLocal(LEADS_FILE, data, (d) => { memoryLeads = d; }); }

function readLocalLogs() { return readLocal(LOGS_FILE, memoryLogs); }
function writeLocalLogs(data) { writeLocal(LOGS_FILE, data, (d) => { memoryLogs = d; }); }

// Supabase client instance (server-side only with service_role key)
function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey && !supabaseUrl.includes('placeholder') && !supabaseKey.includes('placeholder')) {
    try {
      return createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false }
      });
    } catch (err) {
      console.warn('[DB] Supabase init warning:', err.message);
    }
  }
  return null;
}

function generateId(prefix = 'ZR-LEAD') {
  const now = Date.now().toString().slice(-6);
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${now}-${rand}`;
}

export const DB = {
  isSupabaseConfigured() {
    return Boolean(getSupabaseClient());
  },

  getSupabase() {
    return getSupabaseClient();
  },

  /* ==========================================================================
     1. AUTOMATIC LEAD CAPTURE (BEFORE PAYMENT)
     ========================================================================== */
  async createLead(leadInput) {
    const supabase = getSupabaseClient();

    const timestamp = new Date().toISOString();
    const leadId = leadInput.leadId || generateId('ZR-LEAD');
    const bookingRef = leadInput.bookingRef || generateId('ZR-BK');

    const record = {
      lead_id: leadId,
      booking_reference: bookingRef,
      customer_name: (leadInput.name || leadInput.customer_name || 'Valued Client').trim(),
      customer_phone: (leadInput.phone || leadInput.customer_phone || '').trim(),
      customer_phone_raw: (leadInput.phoneRaw || leadInput.customer_phone_raw || '').replace(/\D/g, ''),
      customer_email: (leadInput.email || leadInput.customer_email || '').trim().toLowerCase(),
      project_location: leadInput.location || leadInput.project_location || '',
      property_type: leadInput.propertyType || leadInput.property_type || '',
      budget_tier: leadInput.budgetTier || leadInput.budget_tier || '',
      project_stage: leadInput.stage || leadInput.project_stage || '',
      project_description: leadInput.description || leadInput.project_description || '',
      utm_source: leadInput.utm_source || '',
      utm_medium: leadInput.utm_medium || '',
      utm_campaign: leadInput.utm_campaign || '',
      utm_content: leadInput.utm_content || '',
      utm_term: leadInput.utm_term || '',
      fbclid: leadInput.fbclid || '',
      gclid: leadInput.gclid || '',
      referrer_url: leadInput.referrer || '',
      user_agent: leadInput.userAgent || '',
      ip_address: leadInput.ip || '',
      payment_status: 'pending',
      consultation_fee_paise: Number(leadInput.amountPaise) || 19900,
      currency: 'INR',
      razorpay_order_id: leadInput.orderId || leadInput.razorpay_order_id || null,
      appointment_status: 'UNSCHEDULED',
      followup_status: 'Not Contacted',
      internal_notes: '',
      contact_count: 0,
      submitted_at: timestamp,
      created_at: timestamp,
      updated_at: timestamp
    };

    let savedRecord = null;

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('leads')
          .insert(record)
          .select()
          .single();

        if (error) {
          console.error('[DB Supabase Insert Lead Error]:', error.message);
        } else if (data) {
          savedRecord = data;
          // Log activity
          try {
            await supabase.from('lead_activity_logs').insert({
              lead_id: data.id,
              action_type: 'LEAD_CREATED',
              previous_status: null,
              new_status: 'pending',
              note: `Lead created via consultation form for ${record.customer_name} (${record.property_type || 'Unspecified'})`,
              author: 'System',
              created_at: timestamp
            });
          } catch (logErr) {}
        }
      } catch (err) {
        console.error('[DB Supabase Exception on createLead]:', err.message);
      }
    }

    if (!savedRecord) {
      // Local storage fallback
      const all = readLocalLeads();
      // Deduplicate recent submission with identical phone if within 2 minutes
      const existingIdx = all.findIndex(l => 
        l.customer_phone_raw === record.customer_phone_raw &&
        l.payment_status === 'pending' &&
        (new Date(timestamp) - new Date(l.created_at)) < 120000
      );

      if (existingIdx >= 0) {
        all[existingIdx] = { ...all[existingIdx], ...record, lead_id: all[existingIdx].lead_id, updated_at: timestamp };
        savedRecord = all[existingIdx];
      } else {
        all.unshift(record);
        savedRecord = record;
      }
      writeLocalLeads(all);

      // Local log
      const logs = readLocalLogs();
      logs.unshift({
        id: generateId('LOG'),
        lead_id: savedRecord.lead_id,
        action_type: 'LEAD_CREATED',
        note: `Lead created via consultation form`,
        author: 'System',
        created_at: timestamp
      });
      writeLocalLogs(logs);
    }

    return savedRecord;
  },

  /* ==========================================================================
     2. LEAD RETRIEVAL & QUERYING
     ========================================================================== */
  async getLeadById(idOrRef) {
    if (!idOrRef) return null;
    const supabase = getSupabaseClient();

    if (supabase) {
      try {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrRef);
        let query = supabase.from('leads').select('*');

        if (isUUID) {
          query = query.eq('id', idOrRef);
        } else if (idOrRef.startsWith('ZR-LEAD')) {
          query = query.eq('lead_id', idOrRef);
        } else if (idOrRef.startsWith('ZR-BK') || idOrRef.startsWith('ZR_BK')) {
          query = query.eq('booking_reference', idOrRef);
        } else if (idOrRef.startsWith('order_')) {
          query = query.eq('razorpay_order_id', idOrRef);
        } else if (idOrRef.startsWith('pay_')) {
          query = query.eq('razorpay_payment_id', idOrRef);
        } else {
          query = query.or(`lead_id.eq.${idOrRef},booking_reference.eq.${idOrRef},razorpay_order_id.eq.${idOrRef}`);
        }

        const { data, error } = await query.maybeSingle();
        if (!error && data) return data;
      } catch (err) {
        console.error('[DB Supabase getLeadById Error]:', err.message);
      }
    }

    const all = readLocalLeads();
    return all.find(l => 
      l.id === idOrRef ||
      l.lead_id === idOrRef ||
      l.booking_reference === idOrRef ||
      l.razorpay_order_id === idOrRef ||
      l.razorpay_payment_id === idOrRef
    ) || null;
  },

  /* ==========================================================================
     3. LINK RAZORPAY ORDER TO LEAD
     ========================================================================== */
  async linkRazorpayOrder(leadIdOrRef, orderId) {
    if (!leadIdOrRef || !orderId) return null;
    const supabase = getSupabaseClient();
    const timestamp = new Date().toISOString();

    if (supabase) {
      try {
        let query = supabase.from('leads').update({
          razorpay_order_id: orderId,
          updated_at: timestamp
        });

        if (leadIdOrRef.startsWith('ZR-LEAD')) {
          query = query.eq('lead_id', leadIdOrRef);
        } else if (leadIdOrRef.startsWith('ZR-BK') || leadIdOrRef.startsWith('ZR_BK')) {
          query = query.eq('booking_reference', leadIdOrRef);
        } else {
          query = query.eq('id', leadIdOrRef);
        }

        const { data, error } = await query.select().maybeSingle();
        if (!error && data) return data;
      } catch (err) {
        console.error('[DB Supabase linkRazorpayOrder Error]:', err.message);
      }
    }

    const all = readLocalLeads();
    const idx = all.findIndex(l => l.lead_id === leadIdOrRef || l.booking_reference === leadIdOrRef || l.id === leadIdOrRef);
    if (idx >= 0) {
      all[idx].razorpay_order_id = orderId;
      all[idx].updated_at = timestamp;
      writeLocalLeads(all);
      return all[idx];
    }
    return null;
  },

  /* ==========================================================================
     4. PAYMENT VERIFICATION (UPDATE TO PAID)
     ========================================================================== */
  async updatePaymentSuccess(bookingRefOrOrderId, { paymentId, orderId, signature, metadata }) {
    const supabase = getSupabaseClient();
    const timestamp = new Date().toISOString();

    const updatePayload = {
      razorpay_payment_id: paymentId,
      ...(orderId ? { razorpay_order_id: orderId } : {}),
      razorpay_signature: signature || null,
      payment_status: 'paid',
      payment_verified_at: timestamp,
      updated_at: timestamp,
      ...(metadata ? { payment_metadata: metadata } : {})
    };

    if (supabase) {
      try {
        let query = supabase.from('leads').update(updatePayload);
        if (bookingRefOrOrderId.startsWith('ZR-LEAD')) {
          query = query.eq('lead_id', bookingRefOrOrderId);
        } else if (bookingRefOrOrderId.startsWith('ZR-BK') || bookingRefOrOrderId.startsWith('ZR_BK')) {
          query = query.eq('booking_reference', bookingRefOrOrderId);
        } else {
          query = query.eq('razorpay_order_id', bookingRefOrOrderId);
        }

        const { data, error } = await query.select().maybeSingle();
        if (!error && data) {
          // Add activity log
          try {
            await supabase.from('lead_activity_logs').insert({
              lead_id: data.id,
              action_type: 'PAYMENT_VERIFIED',
              previous_status: 'pending',
              new_status: 'paid',
              note: `₹199 payment verified successfully via Razorpay (Payment ID: ${paymentId})`,
              author: 'Razorpay',
              created_at: timestamp
            });
          } catch (e) {}
          return data;
        }
      } catch (err) {
        console.error('[DB Supabase Payment Update Error]:', err.message);
      }
    }

    const all = readLocalLeads();
    const idx = all.findIndex(
      (b) => b.booking_reference === bookingRefOrOrderId ||
             b.razorpay_order_id === bookingRefOrOrderId ||
             b.lead_id === bookingRefOrOrderId
    );

    if (idx >= 0) {
      all[idx] = { ...all[idx], ...updatePayload };
      writeLocalLeads(all);

      const logs = readLocalLogs();
      logs.unshift({
        id: generateId('LOG'),
        lead_id: all[idx].lead_id || all[idx].id,
        action_type: 'PAYMENT_VERIFIED',
        note: `Payment verified via Razorpay ID: ${paymentId}`,
        author: 'Razorpay',
        created_at: timestamp
      });
      writeLocalLogs(logs);

      return all[idx];
    }
    return null;
  },

  /* ==========================================================================
     5. PAYMENT FAILURE / CANCELLATION
     ========================================================================== */
  async updatePaymentFailed(bookingRefOrOrderId, { reason, metadata }) {
    const supabase = getSupabaseClient();
    const timestamp = new Date().toISOString();

    if (supabase) {
      try {
        // Only update if not already paid
        const existing = await this.getLeadById(bookingRefOrOrderId);
        if (existing && existing.payment_status === 'paid') {
          // Never overwrite a verified paid status
          return existing;
        }

        const { data, error } = await supabase
          .from('leads')
          .update({
            payment_status: 'failed',
            payment_failure_reason: reason || 'Payment cancelled or failed',
            updated_at: timestamp
          })
          .eq('razorpay_order_id', bookingRefOrOrderId)
          .select()
          .maybeSingle();

        if (!error && data) {
          try {
            await supabase.from('lead_activity_logs').insert({
              lead_id: data.id,
              action_type: 'PAYMENT_FAILED',
              new_status: 'failed',
              note: `Payment failed: ${reason || 'Unknown error'}`,
              author: 'Razorpay',
              created_at: timestamp
            });
          } catch (e) {}
          return data;
        }
      } catch (e) {}
    }

    const all = readLocalLeads();
    const idx = all.findIndex(b => b.razorpay_order_id === bookingRefOrOrderId || b.booking_reference === bookingRefOrOrderId);
    if (idx >= 0 && all[idx].payment_status !== 'paid') {
      all[idx].payment_status = 'failed';
      all[idx].payment_failure_reason = reason;
      all[idx].updated_at = timestamp;
      writeLocalLeads(all);
      return all[idx];
    }
    return null;
  },

  /* ==========================================================================
     6. ABANDONED LEADS RECONCILIATION (> 30 MINUTES PENDING)
     ========================================================================== */
  async reconcileAbandonedLeads(thresholdMinutes = 30) {
    const supabase = getSupabaseClient();
    const cutoffDate = new Date(Date.now() - thresholdMinutes * 60 * 1000).toISOString();
    const timestamp = new Date().toISOString();
    let reconciledCount = 0;

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('leads')
          .update({
            payment_status: 'abandoned',
            updated_at: timestamp
          })
          .eq('payment_status', 'pending')
          .lt('created_at', cutoffDate)
          .select('id, lead_id');

        if (!error && data) {
          reconciledCount = data.length;
          for (const item of data) {
            try {
              await supabase.from('lead_activity_logs').insert({
                lead_id: item.id,
                action_type: 'STATUS_CHANGED',
                previous_status: 'pending',
                new_status: 'abandoned',
                note: `Marked as abandoned: checkout incomplete after ${thresholdMinutes} minutes`,
                author: 'System',
                created_at: timestamp
              });
            } catch (e) {}
          }
        }
      } catch (err) {
        console.error('[DB Reconcile Abandoned Error]:', err.message);
      }
    }

    const all = readLocalLeads();
    for (const lead of all) {
      if (lead.payment_status === 'pending' && new Date(lead.created_at) < new Date(cutoffDate)) {
        lead.payment_status = 'abandoned';
        lead.updated_at = timestamp;
        reconciledCount++;
      }
    }
    writeLocalLeads(all);

    return { reconciledCount, thresholdMinutes };
  },

  /* ==========================================================================
     7. CALENDLY APPOINTMENT CONFIRMATION
     ========================================================================== */
  async updateAppointmentConfirmed(bookingRef, { date, time, timezone, calendlyEventUri, calendlyInviteeUri }) {
    const supabase = getSupabaseClient();
    const timestamp = new Date().toISOString();

    const updatePayload = {
      appointment_date: date,
      appointment_time: time,
      timezone: timezone || 'Asia/Kolkata',
      calendly_event_uri: calendlyEventUri || null,
      calendly_invitee_uri: calendlyInviteeUri || null,
      appointment_status: 'SCHEDULED',
      appointment_confirmed_at: timestamp,
      updated_at: timestamp
    };

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('leads')
          .update(updatePayload)
          .or(`booking_reference.eq.${bookingRef},lead_id.eq.${bookingRef}`)
          .select()
          .maybeSingle();

        if (!error && data) {
          try {
            await supabase.from('lead_activity_logs').insert({
              lead_id: data.id,
              action_type: 'APPOINTMENT_SCHEDULED',
              note: `Confirmed Calendly 45-min appointment for ${date} at ${time}`,
              author: 'Calendly',
              created_at: timestamp
            });
          } catch (e) {}
          return data;
        }
      } catch (err) {
        console.error('[DB Supabase Appointment Update Error]:', err.message);
      }
    }

    const all = readLocalLeads();
    const idx = all.findIndex((b) => b.booking_reference === bookingRef || b.lead_id === bookingRef);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...updatePayload };
      writeLocalLeads(all);
      return all[idx];
    }
    return null;
  },

  /* ==========================================================================
     8. ADMIN DASHBOARD QUERIES & FILTERING
     ========================================================================== */
  async getLeadsAdmin({
    search = '',
    paymentStatus = 'all',
    followupStatus = 'all',
    page = 1,
    limit = 20,
    sortBy = 'created_at',
    sortOrder = 'desc'
  } = {}) {
    const supabase = getSupabaseClient();
    const offset = (page - 1) * limit;

    let leads = [];
    let total = 0;
    let counts = {
      totalLeads: 0,
      unpaidLeads: 0,
      paidConsultations: 0,
      followupsRequired: 0
    };

    if (supabase) {
      try {
        // 1. Fetch total counts
        const { data: allData, error: countErr } = await supabase
          .from('leads')
          .select('id, payment_status, followup_status');

        if (!countErr && allData) {
          counts.totalLeads = allData.length;
          counts.unpaidLeads = allData.filter(l => l.payment_status !== 'paid').length;
          counts.paidConsultations = allData.filter(l => l.payment_status === 'paid').length;
          counts.followupsRequired = allData.filter(l => l.followup_status === 'Not Contacted' || l.followup_status === 'Contacted').length;
        }

        // 2. Fetch filtered data
        let query = supabase.from('leads').select('*', { count: 'exact' });

        if (paymentStatus && paymentStatus !== 'all') {
          query = query.eq('payment_status', paymentStatus);
        }

        if (followupStatus && followupStatus !== 'all') {
          query = query.eq('followup_status', followupStatus);
        }

        if (search && search.trim()) {
          const s = search.trim();
          query = query.or(`customer_name.ilike.%${s}%,customer_phone.ilike.%${s}%,customer_email.ilike.%${s}%,project_location.ilike.%${s}%`);
        }

        query = query.order(sortBy, { ascending: sortOrder === 'asc' });
        query = query.range(offset, offset + limit - 1);

        const { data, count, error } = await query;
        if (!error && data) {
          leads = data;
          total = count || 0;
          return { leads, total, page, limit, totalPages: Math.ceil(total / limit), counts };
        }
      } catch (err) {
        console.error('[DB Supabase getLeadsAdmin Error]:', err.message);
      }
    }

    // Local fallback
    let all = readLocalLeads();

    counts.totalLeads = all.length;
    counts.unpaidLeads = all.filter(l => l.payment_status !== 'paid').length;
    counts.paidConsultations = all.filter(l => l.payment_status === 'paid').length;
    counts.followupsRequired = all.filter(l => l.followup_status === 'Not Contacted' || l.followup_status === 'Contacted').length;

    let filtered = [...all];

    if (paymentStatus && paymentStatus !== 'all') {
      filtered = filtered.filter(l => l.payment_status === paymentStatus);
    }
    if (followupStatus && followupStatus !== 'all') {
      filtered = filtered.filter(l => l.followup_status === followupStatus);
    }
    if (search && search.trim()) {
      const s = search.trim().toLowerCase();
      filtered = filtered.filter(l => 
        (l.customer_name && l.customer_name.toLowerCase().includes(s)) ||
        (l.customer_phone && l.customer_phone.toLowerCase().includes(s)) ||
        (l.customer_email && l.customer_email.toLowerCase().includes(s)) ||
        (l.project_location && l.project_location.toLowerCase().includes(s))
      );
    }

    filtered.sort((a, b) => {
      const valA = new Date(a[sortBy] || a.created_at || 0);
      const valB = new Date(b[sortBy] || b.created_at || 0);
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    total = filtered.length;
    leads = filtered.slice(offset, offset + limit);

    return { leads, total, page, limit, totalPages: Math.ceil(total / limit), counts };
  },

  /* ==========================================================================
     9. UPDATE LEAD FOLLOW-UP STATUS & NOTES
     ========================================================================== */
  async updateLeadFollowup(leadId, { followupStatus, internalNotes, lastContactedAt, author = 'Staff', noteToAdd }) {
    const supabase = getSupabaseClient();
    const timestamp = new Date().toISOString();

    const existingLead = await this.getLeadById(leadId);
    if (!existingLead) return null;

    const previousStatus = existingLead.followup_status;
    const updatePayload = {
      updated_at: timestamp
    };

    if (followupStatus) {
      updatePayload.followup_status = followupStatus;
    }
    if (internalNotes !== undefined) {
      updatePayload.internal_notes = internalNotes;
    }
    if (lastContactedAt) {
      updatePayload.last_contacted_at = lastContactedAt;
      updatePayload.last_contacted_by = author;
      updatePayload.contact_count = (existingLead.contact_count || 0) + 1;
    }

    let updatedLead = null;

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('leads')
          .update(updatePayload)
          .eq('id', existingLead.id)
          .select()
          .maybeSingle();

        if (!error && data) {
          updatedLead = data;
          // Add Activity Log
          let actionType = 'NOTE_ADDED';
          if (followupStatus && followupStatus !== previousStatus) actionType = 'STATUS_CHANGED';
          else if (lastContactedAt) actionType = 'CONTACTED';

          await supabase.from('lead_activity_logs').insert({
            lead_id: data.id,
            action_type: actionType,
            previous_status: previousStatus,
            new_status: followupStatus || previousStatus,
            note: noteToAdd || (followupStatus ? `Status changed to ${followupStatus}` : 'Notes updated'),
            author,
            created_at: timestamp
          });
        }
      } catch (err) {
        console.error('[DB updateLeadFollowup Error]:', err.message);
      }
    }

    if (!updatedLead) {
      const all = readLocalLeads();
      const idx = all.findIndex(l => l.id === existingLead.id || l.lead_id === existingLead.lead_id);
      if (idx >= 0) {
        all[idx] = { ...all[idx], ...updatePayload };
        updatedLead = all[idx];
        writeLocalLeads(all);

        const logs = readLocalLogs();
        logs.unshift({
          id: generateId('LOG'),
          lead_id: existingLead.id || existingLead.lead_id,
          action_type: followupStatus !== previousStatus ? 'STATUS_CHANGED' : 'NOTE_ADDED',
          previous_status: previousStatus,
          new_status: followupStatus || previousStatus,
          note: noteToAdd || `Updated follow-up status to ${followupStatus || previousStatus}`,
          author,
          created_at: timestamp
        });
        writeLocalLogs(logs);
      }
    }

    return updatedLead;
  },

  /* ==========================================================================
     10. LEAD ACTIVITY LOGS
     ========================================================================== */
  async getLeadActivityLogs(leadId) {
    const supabase = getSupabaseClient();
    const existing = await this.getLeadById(leadId);
    if (!existing) return [];

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('lead_activity_logs')
          .select('*')
          .eq('lead_id', existing.id)
          .order('created_at', { ascending: false });

        if (!error && data) return data;
      } catch (e) {}
    }

    const all = readLocalLogs();
    return all.filter(log => log.lead_id === existing.id || log.lead_id === existing.lead_id);
  },

  /* ==========================================================================
     11. EXPORT LEADS AS CSV
     ========================================================================== */
  async exportLeadsCsv() {
    const { leads } = await this.getLeadsAdmin({ limit: 10000, page: 1 });

    const headers = [
      'Lead ID',
      'Booking Ref',
      'Customer Name',
      'Phone',
      'Email',
      'Location',
      'Property Type',
      'Budget Tier',
      'Project Stage',
      'Payment Status',
      'Razorpay Order ID',
      'Razorpay Payment ID',
      'Follow-up Status',
      'Internal Notes',
      'Last Contacted Date',
      'UTM Source',
      'UTM Medium',
      'UTM Campaign',
      'Submission Date'
    ];

    const escapeCsv = (str) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows = leads.map(l => [
      escapeCsv(l.lead_id),
      escapeCsv(l.booking_reference),
      escapeCsv(l.customer_name),
      escapeCsv(l.customer_phone),
      escapeCsv(l.customer_email),
      escapeCsv(l.project_location),
      escapeCsv(l.property_type),
      escapeCsv(l.budget_tier),
      escapeCsv(l.project_stage),
      escapeCsv(l.payment_status),
      escapeCsv(l.razorpay_order_id),
      escapeCsv(l.razorpay_payment_id),
      escapeCsv(l.followup_status),
      escapeCsv(l.internal_notes),
      escapeCsv(l.last_contacted_at),
      escapeCsv(l.utm_source),
      escapeCsv(l.utm_medium),
      escapeCsv(l.utm_campaign),
      escapeCsv(l.submitted_at || l.created_at)
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  },

  /* ==========================================================================
     12. BACKWARDS COMPATIBILITY WRAPPERS (Preserves all existing callers)
     ========================================================================== */
  async createBooking(booking) {
    return this.createLead(booking);
  },

  async getBookingByRef(bookingRef) {
    return this.getLeadById(bookingRef);
  },

  async getBookingByOrderId(orderId) {
    return this.getLeadById(orderId);
  },

  async getBookingByPaymentId(paymentId) {
    return this.getLeadById(paymentId);
  },

  async updateWhatsAppStatus(bookingRef, status) {
    const lead = await this.getLeadById(bookingRef);
    if (!lead) return;
    await this.updateLeadFollowup(lead.id, {
      lastContactedAt: new Date().toISOString(),
      author: 'WhatsApp'
    });
  }
};
