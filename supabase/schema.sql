-- ==============================================================================
-- ZR INTERIOR DESIGN — CONSULTATION BOOKINGS & PAYMENT DATABASE SCHEMA
-- Compatible with PostgreSQL / Supabase
-- ==============================================================================

-- Create consultation_bookings table
CREATE TABLE IF NOT EXISTS consultation_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_reference VARCHAR(64) UNIQUE NOT NULL,
  
  -- Customer Information
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255),
  customer_phone VARCHAR(50) NOT NULL,
  customer_phone_raw VARCHAR(50),
  
  -- Project Qualification Details
  project_location VARCHAR(255),
  property_type VARCHAR(100),
  budget_tier VARCHAR(100),
  project_stage VARCHAR(100),
  project_description TEXT,
  
  -- Payment Information (Enforced ₹199 = 19900 paise)
  consultation_fee_paise INTEGER NOT NULL DEFAULT 19900,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  razorpay_order_id VARCHAR(100) UNIQUE,
  razorpay_payment_id VARCHAR(100) UNIQUE,
  razorpay_signature TEXT,
  payment_status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, PAID, FAILED, REFUNDED
  payment_verified_at TIMESTAMPTZ,
  payment_metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Calendly Appointment Details
  calendly_event_uri TEXT,
  calendly_invitee_uri TEXT,
  appointment_date VARCHAR(100),
  appointment_time VARCHAR(100),
  timezone VARCHAR(100) DEFAULT 'Asia/Kolkata',
  appointment_status VARCHAR(50) NOT NULL DEFAULT 'UNSCHEDULED', -- UNSCHEDULED, SCHEDULED, CANCELLED, RESCHEDULED
  appointment_confirmed_at TIMESTAMPTZ,
  
  -- WhatsApp & Communication Tracking
  whatsapp_followup_status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, PREPARED, SENT
  whatsapp_last_interaction_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for lightning-fast queries and webhook lookups
CREATE INDEX IF NOT EXISTS idx_consultation_booking_ref ON consultation_bookings(booking_reference);
CREATE INDEX IF NOT EXISTS idx_consultation_order_id ON consultation_bookings(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_consultation_payment_id ON consultation_bookings(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_consultation_email ON consultation_bookings(customer_email);
CREATE INDEX IF NOT EXISTS idx_consultation_phone ON consultation_bookings(customer_phone);
CREATE INDEX IF NOT EXISTS idx_consultation_payment_status ON consultation_bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_consultation_created_at ON consultation_bookings(created_at DESC);

-- Automated trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_consultation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_consultation_updated_at ON consultation_bookings;
CREATE TRIGGER trigger_consultation_updated_at
BEFORE UPDATE ON consultation_bookings
FOR EACH ROW
EXECUTE FUNCTION update_consultation_timestamp();

-- RLS (Row Level Security) Configuration
ALTER TABLE consultation_bookings ENABLE ROW LEVEL SECURITY;

-- Allow server service_role key full administrative access
CREATE POLICY "Service Role Full Access"
ON consultation_bookings
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
