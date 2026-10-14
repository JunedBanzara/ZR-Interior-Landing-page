-- ==============================================================================
-- MIGRATION 001: LEADS, ACTIVITY LOGS, ADMIN USERS & RLS
-- Safe, idempotent migration for Supabase Project: udetsffqshoxanyviyht
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/udetsffqshoxanyviyht/sql
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. CREATE LEADS TABLE
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id VARCHAR(64) UNIQUE NOT NULL,
  booking_reference VARCHAR(64) UNIQUE,
  
  -- Customer Information
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50) NOT NULL,
  customer_phone_raw VARCHAR(50),
  customer_email VARCHAR(255),
  
  -- Project Qualification Details
  project_location VARCHAR(255),
  property_type VARCHAR(100),
  budget_tier VARCHAR(100),
  project_stage VARCHAR(100),
  project_description TEXT,
  
  -- Marketing & Attribution Tracking
  utm_source VARCHAR(255),
  utm_medium VARCHAR(255),
  utm_campaign VARCHAR(255),
  utm_content VARCHAR(255),
  utm_term VARCHAR(255),
  fbclid VARCHAR(255),
  gclid VARCHAR(255),
  referrer_url TEXT,
  user_agent TEXT,
  ip_address VARCHAR(100),
  
  -- Payment Tracking (Enforced ₹199 = 19900 paise)
  payment_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  consultation_fee_paise INTEGER NOT NULL DEFAULT 19900,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  razorpay_order_id VARCHAR(100),
  razorpay_payment_id VARCHAR(100),
  razorpay_signature TEXT,
  payment_verified_at TIMESTAMPTZ,
  payment_failure_reason TEXT,
  payment_metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Calendly Appointment Details
  appointment_status VARCHAR(50) NOT NULL DEFAULT 'UNSCHEDULED',
  appointment_date VARCHAR(100),
  appointment_time VARCHAR(100),
  timezone VARCHAR(100) DEFAULT 'Asia/Kolkata',
  appointment_confirmed_at TIMESTAMPTZ,
  calendly_event_uri TEXT,
  calendly_invitee_uri TEXT,
  
  -- CRM Follow-Up Management
  followup_status VARCHAR(50) NOT NULL DEFAULT 'Not Contacted',
  internal_notes TEXT DEFAULT '',
  last_contacted_at TIMESTAMPTZ,
  last_contacted_by VARCHAR(100),
  contact_count INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- If consultation_bookings table already exists as a physical table, copy records safely
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'consultation_bookings' AND table_type = 'BASE TABLE'
  ) THEN
    INSERT INTO leads (
      booking_reference,
      customer_name,
      customer_email,
      customer_phone,
      customer_phone_raw,
      project_location,
      property_type,
      budget_tier,
      project_stage,
      project_description,
      consultation_fee_paise,
      currency,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      payment_status,
      payment_verified_at,
      payment_metadata,
      calendly_event_uri,
      calendly_invitee_uri,
      appointment_date,
      appointment_time,
      timezone,
      appointment_status,
      appointment_confirmed_at,
      created_at,
      updated_at,
      lead_id
    )
    SELECT
      booking_reference,
      customer_name,
      customer_email,
      customer_phone,
      customer_phone_raw,
      project_location,
      property_type,
      budget_tier,
      project_stage,
      project_description,
      consultation_fee_paise,
      currency,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      LOWER(payment_status),
      payment_verified_at,
      payment_metadata,
      calendly_event_uri,
      calendly_invitee_uri,
      appointment_date,
      appointment_time,
      timezone,
      appointment_status,
      appointment_confirmed_at,
      created_at,
      updated_at,
      COALESCE(booking_reference, 'ZR-LEAD-' || substr(md5(random()::text), 1, 8))
    FROM consultation_bookings
    ON CONFLICT (lead_id) DO NOTHING;
  END IF;
END $$;

-- 3. ACTIVITY LOGS & NOTES HISTORY
CREATE TABLE IF NOT EXISTS lead_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL,
  previous_status VARCHAR(50),
  new_status VARCHAR(50),
  note TEXT,
  author VARCHAR(100) NOT NULL DEFAULT 'System',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. ADMIN USERS TABLE
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(255) NOT NULL DEFAULT 'Administrator',
  role VARCHAR(50) NOT NULL DEFAULT 'admin',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_leads_lead_id ON leads(lead_id);
CREATE INDEX IF NOT EXISTS idx_leads_booking_ref ON leads(booking_reference);
CREATE INDEX IF NOT EXISTS idx_leads_order_id ON leads(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_leads_payment_id ON leads(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_leads_payment_status ON leads(payment_status);
CREATE INDEX IF NOT EXISTS idx_leads_followup_status ON leads(followup_status);
CREATE INDEX IF NOT EXISTS idx_leads_customer_phone ON leads(customer_phone);
CREATE INDEX IF NOT EXISTS idx_leads_customer_email ON leads(customer_email);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_submitted_at ON leads(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_activity_lead_id ON lead_activity_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activity_created_at ON lead_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);

-- 6. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service Role Full Access Leads" ON leads;
CREATE POLICY "Service Role Full Access Leads"
ON leads FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service Role Full Access Activity" ON lead_activity_logs;
CREATE POLICY "Service Role Full Access Activity"
ON lead_activity_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service Role Full Access Admin" ON admin_users;
CREATE POLICY "Service Role Full Access Admin"
ON admin_users FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 7. COMPATIBILITY VIEW (if consultation_bookings is not already a table)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'consultation_bookings' AND table_type = 'BASE TABLE'
  ) THEN
    EXECUTE '
      CREATE OR REPLACE VIEW consultation_bookings AS
      SELECT
        id,
        booking_reference,
        customer_name,
        customer_email,
        customer_phone,
        customer_phone_raw,
        project_location,
        property_type,
        budget_tier,
        project_stage,
        project_description,
        consultation_fee_paise,
        currency,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        UPPER(payment_status) AS payment_status,
        payment_verified_at,
        payment_metadata,
        calendly_event_uri,
        calendly_invitee_uri,
        appointment_date,
        appointment_time,
        timezone,
        appointment_status,
        appointment_confirmed_at,
        ''PENDING''::VARCHAR(50) AS whatsapp_followup_status,
        last_contacted_at AS whatsapp_last_interaction_at,
        created_at,
        updated_at
      FROM leads;
    ';
  END IF;
END $$;
