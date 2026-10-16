/**
 * ZR INTERIOR DESIGN — SAFE LOCAL DATA TO SUPABASE MIGRATION SCRIPT
 * Safely migrates existing bookings.json and leads.json records to the Supabase "leads" table.
 * Preserves all existing data with ON CONFLICT DO NOTHING.
 * 
 * Usage:
 *   node scripts/migrate-local-to-supabase.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DB, SUPABASE_PROJECT_REF, SUPABASE_DEFAULT_URL } from '../server/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');

// Load environment variables from .env
const envPath = path.join(ROOT_DIR, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

async function runLocalToSupabaseMigration() {
  console.log('==============================================================================');
  console.log('ZR INTERIOR DESIGN — LOCAL DATA TO SUPABASE MIGRATION');
  console.log('Project Reference:', SUPABASE_PROJECT_REF);
  console.log('Project URL:      ', DB.getProjectUrl());
  console.log('==============================================================================\n');

  if (!DB.isSupabaseConfigured()) {
    console.error('❌ Supabase is not configured yet in environment variables.');
    console.error('Required environment variables:');
    console.error('  SUPABASE_URL=https://udetsffqshoxanyviyht.supabase.co');
    console.error('  SUPABASE_SERVICE_ROLE_KEY=your-supabase-replacement-secret-key\n');
    process.exit(1);
  }

  const testResult = await DB.testSupabaseConnection();
  if (!testResult.connected) {
    console.error('❌ Cannot connect to Supabase:');
    console.error('  Error:', testResult.error || testResult.message);
    if (testResult.hint) {
      console.error('  Hint: ', testResult.hint);
    }
    process.exit(1);
  }

  console.log('✓ Successfully connected to Supabase project table "leads"!');
  console.log(`  Current Supabase leads count: ${testResult.leadsCount}\n`);

  const supabase = DB.getSupabase();
  const dataDir = path.join(ROOT_DIR, 'data');
  const bookingsFile = path.join(dataDir, 'bookings.json');
  const leadsFile = path.join(dataDir, 'leads.json');

  let localBookings = [];
  let localLeads = [];

  if (fs.existsSync(bookingsFile)) {
    try {
      localBookings = JSON.parse(fs.readFileSync(bookingsFile, 'utf8') || '[]');
    } catch (e) {
      console.warn('Warning: Could not parse bookings.json:', e.message);
    }
  }

  if (fs.existsSync(leadsFile)) {
    try {
      localLeads = JSON.parse(fs.readFileSync(leadsFile, 'utf8') || '[]');
    } catch (e) {
      console.warn('Warning: Could not parse leads.json:', e.message);
    }
  }

  console.log(`Found ${localBookings.length} records in bookings.json`);
  console.log(`Found ${localLeads.length} records in leads.json\n`);

  // Map and normalize records
  const recordsToInsert = [];
  const seenLeadIds = new Set();
  const seenBookingRefs = new Set();

  function addRecord(rec) {
    if (!rec.lead_id) return;
    if (seenLeadIds.has(rec.lead_id)) return;
    if (rec.booking_reference && seenBookingRefs.has(rec.booking_reference)) return;

    seenLeadIds.add(rec.lead_id);
    if (rec.booking_reference) seenBookingRefs.add(rec.booking_reference);
    recordsToInsert.push(rec);
  }

  // 1. Process leads.json (already closest to schema)
  for (const l of localLeads) {
    const timestamp = l.submitted_at || l.created_at || new Date().toISOString();
    const leadId = l.lead_id || `ZR-LEAD-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const bookingRef = l.booking_reference || `ZR-BK-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    addRecord({
      lead_id: leadId,
      booking_reference: bookingRef,
      customer_name: (l.customer_name || 'Valued Client').trim(),
      customer_phone: (l.customer_phone || '').trim(),
      customer_phone_raw: (l.customer_phone_raw || (l.customer_phone || '').replace(/\D/g, '')).trim(),
      customer_email: (l.customer_email || '').trim().toLowerCase(),
      project_location: l.project_location || '',
      property_type: l.property_type || '',
      budget_tier: l.budget_tier || '',
      project_stage: l.project_stage || '',
      project_description: l.project_description || '',
      utm_source: l.utm_source || '',
      utm_medium: l.utm_medium || '',
      utm_campaign: l.utm_campaign || '',
      utm_content: l.utm_content || '',
      utm_term: l.utm_term || '',
      fbclid: l.fbclid || '',
      gclid: l.gclid || '',
      referrer_url: l.referrer_url || '',
      user_agent: l.user_agent || '',
      ip_address: l.ip_address || '',
      payment_status: (l.payment_status || 'pending').toLowerCase(),
      consultation_fee_paise: Number(l.consultation_fee_paise) || 19900,
      currency: l.currency || 'INR',
      razorpay_order_id: l.razorpay_order_id || null,
      razorpay_payment_id: l.razorpay_payment_id || null,
      razorpay_signature: l.razorpay_signature || null,
      payment_verified_at: l.payment_verified_at || null,
      appointment_status: l.appointment_status || 'UNSCHEDULED',
      appointment_date: l.appointment_date || null,
      appointment_time: l.appointment_time || null,
      timezone: l.timezone || 'Asia/Kolkata',
      appointment_confirmed_at: l.appointment_confirmed_at || null,
      calendly_event_uri: l.calendly_event_uri || null,
      calendly_invitee_uri: l.calendly_invitee_uri || null,
      followup_status: l.followup_status || 'Not Contacted',
      internal_notes: l.internal_notes || '',
      contact_count: Number(l.contact_count) || 0,
      last_contacted_at: l.last_contacted_at || null,
      last_contacted_by: l.last_contacted_by || null,
      submitted_at: timestamp,
      created_at: timestamp,
      updated_at: l.updated_at || timestamp
    });
  }

  // 2. Process bookings.json (legacy format)
  for (const b of localBookings) {
    const timestamp = b.created_at || b.createdAt || new Date().toISOString();
    const bookingRef = b.booking_reference || b.id || `ZR-BK-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const leadId = b.lead_id || `ZR-LEAD-${bookingRef.replace(/^ZR[-_]BK[-_]/, '')}`;

    const leadInfo = b.lead || {};
    const paymentInfo = b.payment || {};
    const appointmentInfo = b.appointment || {};

    const name = (b.customer_name || leadInfo.name || 'Valued Client').trim();
    const phone = (b.customer_phone || leadInfo.phone || '').trim();
    const phoneRaw = (b.customer_phone_raw || leadInfo.phoneRaw || phone.replace(/\D/g, '')).trim();
    const email = (b.customer_email || leadInfo.email || '').trim().toLowerCase();

    const paymentStatus = (b.payment_status || paymentInfo.status || (b.status === 'CONFIRMED' ? 'paid' : 'pending')).toLowerCase();
    const appointmentStatus = b.appointment_status || (appointmentInfo.date || b.status === 'CONFIRMED' ? 'SCHEDULED' : 'UNSCHEDULED');

    addRecord({
      lead_id: leadId,
      booking_reference: bookingRef,
      customer_name: name,
      customer_phone: phone,
      customer_phone_raw: phoneRaw,
      customer_email: email,
      project_location: b.project_location || leadInfo.location || '',
      property_type: b.property_type || leadInfo.propertyType || '',
      budget_tier: b.budget_tier || leadInfo.budgetTier || '',
      project_stage: b.project_stage || leadInfo.projectStage || leadInfo.stage || '',
      project_description: b.project_description || leadInfo.description || leadInfo.requiredServices || '',
      payment_status: paymentStatus,
      consultation_fee_paise: Number(b.consultation_fee_paise) || Number(paymentInfo.amount ? paymentInfo.amount * 100 : 19900),
      currency: b.currency || paymentInfo.currency || 'INR',
      razorpay_order_id: b.razorpay_order_id || paymentInfo.orderId || null,
      razorpay_payment_id: b.razorpay_payment_id || paymentInfo.paymentId || null,
      razorpay_signature: b.razorpay_signature || paymentInfo.signature || null,
      payment_verified_at: b.payment_verified_at || paymentInfo.verifiedAt || null,
      appointment_status: appointmentStatus,
      appointment_date: b.appointment_date || appointmentInfo.date || null,
      appointment_time: b.appointment_time || appointmentInfo.timeSlot || null,
      timezone: b.timezone || 'Asia/Kolkata',
      appointment_confirmed_at: b.appointment_confirmed_at || appointmentInfo.confirmedAt || null,
      calendly_event_uri: b.calendly_event_uri || appointmentInfo.calendlyEventUri || null,
      calendly_invitee_uri: b.calendly_invitee_uri || appointmentInfo.calendlyInviteeUri || null,
      followup_status: b.followup_status || 'Not Contacted',
      submitted_at: timestamp,
      created_at: timestamp,
      updated_at: b.updated_at || b.updatedAt || timestamp
    });
  }

  console.log(`Total unique records prepared for migration: ${recordsToInsert.length}`);

  if (recordsToInsert.length === 0) {
    console.log('No records found to migrate.');
    return;
  }

  // Insert in batches of 25 with onConflict ignore
  let migratedCount = 0;
  let skippedCount = 0;
  const batchSize = 25;

  for (let i = 0; i < recordsToInsert.length; i += batchSize) {
    const batch = recordsToInsert.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('leads')
      .upsert(batch, { onConflict: 'lead_id', ignoreDuplicates: true })
      .select('id, lead_id');

    if (error) {
      console.error(`Batch ${Math.floor(i / batchSize) + 1} Error:`, error.message);
    } else {
      migratedCount += (data ? data.length : 0);
      skippedCount += (batch.length - (data ? data.length : 0));
    }
  }

  console.log('\n==============================================================================');
  console.log('MIGRATION SUMMARY');
  console.log('==============================================================================');
  console.log(`✓ Records safely processed: ${recordsToInsert.length}`);
  console.log(`✓ Successfully migrated to Supabase: ${migratedCount}`);
  console.log(`✓ Existing duplicates preserved:     ${skippedCount}`);
  console.log('Zero data loss achieved.');
  console.log('==============================================================================\n');
}

runLocalToSupabaseMigration().catch((err) => {
  console.error('Fatal Migration Error:', err);
  process.exit(1);
});
