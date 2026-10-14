-- ==============================================================================
-- ZR INTERIOR DESIGN — MASTER SUPABASE DATABASE SCHEMA
-- Project ID: udetsffqshoxanyviyht
-- Features:
-- 1. Automatic Lead Capture (captures every consultation form submission)
-- 2. Payment Status Tracking (pending, paid, failed, abandoned)
-- 3. Follow-up CRM & Sales Pipeline (Not Contacted, Contacted, Interested, Converted, Lost)
-- 4. Activity Logs for Staff History & Notes
-- 5. Row Level Security (RLS) & Performance Indexes
-- 6. Backwards Compatibility with consultation_bookings
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. MASTER LEADS TABLE
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id VARCHAR(64) UNIQUE NOT NULL,               -- e.g. ZR-LEAD-849201-XK92
  booking_reference VARCHAR(64) UNIQUE,              -- e.g. ZR-BK-849201-XK92
  
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
  payment_status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, paid, failed, abandoned
  consultation_fee_paise INTEGER NOT NULL DEFAULT 19900,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  razorpay_order_id VARCHAR(100),
  razorpay_payment_id VARCHAR(100),
  razorpay_signature TEXT,
  payment_verified_at TIMESTAMPTZ,
  payment_failure_reason TEXT,
  payment_metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Calendly Appointment Details
  appointment_status VARCHAR(50) NOT NULL DEFAULT 'UNSCHEDULED', -- UNSCHEDULED, SCHEDULED, CANCELLED, RESCHEDULED
  appointment_date VARCHAR(100),
  appointment_time VARCHAR(100),
  timezone VARCHAR(100) DEFAULT 'Asia/Kolkata',
  appointment_confirmed_at TIMESTAMPTZ,
  calendly_event_uri TEXT,
  calendly_invitee_uri TEXT,
  
  -- CRM Follow-Up Management (Separate from payment status)
  followup_status VARCHAR(50) NOT NULL DEFAULT 'Not Contacted', -- 'Not Contacted', 'Contacted', 'Interested', 'Converted', 'Lost'
  internal_notes TEXT DEFAULT '',
  last_contacted_at TIMESTAMPTZ,
  last_contacted_by VARCHAR(100),
  contact_count INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. ACTIVITY LOGS & NOTES HISTORY
CREATE TABLE IF NOT EXISTS lead_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL, -- LEAD_CREATED, NOTE_ADDED, STATUS_CHANGED, CONTACTED_WHATSAPP, CONTACTED_CALL, PAYMENT_VERIFIED, PAYMENT_FAILED, APPOINTMENT_SCHEDULED
  previous_status VARCHAR(50),
  new_status VARCHAR(50),
  note TEXT,
  author VARCHAR(100) NOT NULL DEFAULT 'System',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. ADMIN USERS TABLE (For secure authenticated dashboard access)
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(255) NOT NULL DEFAULT 'Administrator',
  role VARCHAR(50) NOT NULL DEFAULT 'admin', -- 'admin', 'manager', 'designer'
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

-- 6. AUTOMATED UPDATED_AT TRIGGER
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_leads_updated_at ON leads;
CREATE TRIGGER trigger_leads_updated_at
BEFORE UPDATE ON leads
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trigger_admin_users_updated_at ON admin_users;
CREATE TRIGGER trigger_admin_users_updated_at
BEFORE UPDATE ON admin_users
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- 7. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Deny all public read/write by default to protect customer data
DROP POLICY IF EXISTS "Service Role Full Access Leads" ON leads;
CREATE POLICY "Service Role Full Access Leads"
ON leads
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Service Role Full Access Activity" ON lead_activity_logs;
CREATE POLICY "Service Role Full Access Activity"
ON lead_activity_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Service Role Full Access Admin" ON admin_users;
CREATE POLICY "Service Role Full Access Admin"
ON admin_users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 8. COMPATIBILITY: CONSULTATION_BOOKINGS VIEW
-- Bridges existing legacy queries to the new comprehensive leads table
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
  'PENDING'::VARCHAR(50) AS whatsapp_followup_status,
  last_contacted_at AS whatsapp_last_interaction_at,
  created_at,
  updated_at
FROM leads;
