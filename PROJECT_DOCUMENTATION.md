# ZR Interior Design — Complete Project & Architecture Documentation

> **Document Version**: 2.0.0  
> **Repository**: [JunedBanzara/ZR-Interior-Landing-page](https://github.com/JunedBanzara/ZR-Interior-Landing-page)  
> **Production Target**: Vercel & Supabase Cloud  
> **Studio**: ZR Interior Design, Vadodara, Gujarat (Est. 1990)  
> **Principal Designer**: Mr. Zuber Rafik Banzara

---

## 1. Project Background & Executive Summary

### 1.1 Commercial Objectives
ZR Interior Design is a premier luxury interior design practice founded in 1990 in Vadodara, Gujarat, led by Principal Designer Mr. Zuber Rafik Banzara. With over 36 years of heritage and 500+ completed residential and commercial projects across India and internationally (UK, USA, UAE), the firm required a world-class digital presence engineered for **high-net-worth (HNW) lead acquisition and qualified consultation bookings**.

Traditional interior design websites suffer from low conversion and unqualified inquiries. This web application transforms the standard brochure site into an **interactive conversion funnel**:
1. **Pre-qualifies potential clients** via structured property type, carpet area, budget range, and timeline questions.
2. **Eliminates no-shows and casual inquiries** by charging a nominal, 100% adjustable ₹199 consultation reservation fee via Razorpay.
3. **Automates scheduling** via Calendly embed or instant slot selection for Studio, Site, or Video sessions.
4. **Instantly dispatches VIP notifications** via WhatsApp deep-links and Meta Cloud API integration.

---

## 2. Technical Stack Specification

### 2.1 Frontend
- **Runtime**: Vanilla ECMAScript (ES6+) Modules.
- **Markup**: Semantic HTML5 with accessibility attributes (`aria-*`), high-contrast ratios, and Open Graph metadata.
- **Styling Architecture**: Vanilla CSS3 using custom properties (design tokens) split into:
  - `src/styles/variables.css` — Color palettes, typography scales, shadows, radii, and transitions.
  - `src/styles/base.css` — Global reset, typography styling, base layouts, and container constraints.
  - `src/styles/components.css` — Hero matting, interactive portfolio cards, modal overlay, form steps, budget calculator, and floating concierge.
- **Bundler**: Vite 5.4+ with asset hashing, CSS code splitting, and WebP compression.

### 2.2 Backend & Serverless API
- **Local Server**: Pure Node.js HTTP server (`server/server.js`) with custom MIME type handling and JSON routing (`server/api.js`).
- **Production Serverless**: Vercel Serverless Functions in `/api` directory executing on Node.js 18+ runtime.
- **Payment Processing**: Official Razorpay Node SDK (`razorpay`) with server-enforced pricing and HMAC SHA-256 signature verification (`crypto`).
- **Scheduling**: Calendly API integration with webhook listeners for `invitee.created`.
- **Database & Persistence**:
  - Primary: Supabase Managed PostgreSQL with Row Level Security (RLS) and triggers.
  - Local Dev Fallback: Local file-based JSON persistence (`data/bookings.json`) with in-memory serverless cache.
- **Messaging**: WhatsApp Cloud API (Meta Graph API) & client-side URI encoded VIP concierge links.
- **Tracking & Analytics**: Meta Pixel integration with `Lead`, `InitiateCheckout`, and `Purchase` event hooks.

---

## 3. Detailed Component & Module Breakdown

### 3.1 `index.html` (Application Skeleton)
- **Top Navigation Bar**: Sticky frosted glass navigation (`.nav-luxury`) with brand crest, heritage badge (1990–2026), smooth-scroll links, and quick CTA button.
- **Hero Section**:
  - Left Column: Editorial typography, trust metrics (36 Years, 500+ Projects, 45-Day Handover Protocol), and "Book ₹199 Consultation" trigger.
  - Right Column: High-resolution architectural portrait of Mr. Zuber Rafik Banzara in a custom passe-partout frame with gold foil badge.
- **Trust & Heritage Banner**: Key statistics and accreditation icons (IIID, London School of Trends).
- **Milestone Timeline (1990–2026)**:
  - 1990: Inception — Handcrafted woodwork workshop.
  - 2005: Expansion — Architectural design studio in Vadodara.
  - 2018: Global Exposure — International design collaborations in the UK & UAE.
  - 2026: Modern Mastery — Turnkey luxury delivery nationwide.
- **Interactive Portfolio Gallery**:
  - Category filters: Living Room, Modular Kitchen, Master Suite, Commercial.
  - High-res project cards with hover zoom and modal inspection trigger.
- **3-Phase Execution Process**:
  - Phase 1: Spatial Design & 3D Architectural Photorealism.
  - Phase 2: Material Sourcing & Precision Joinery.
  - Phase 3: White-Glove Site Handover & Quality Audit.
- **Real-Time Cost & Budget Estimator**:
  - Sliders for square footage and property configuration.
  - Scope tier selection (Essential, Premium, Bespoke Turnkey).
  - Dynamic price range output with "Lock in this Estimate" button.
- **Designer Biography**: Mr. Zuber Rafik Banzara's story, values, credentials, and design philosophy.
- **Client Testimonials**: Verified testimonials from luxury homeowners in Vadodara.
- **Consultation Modal Container**: Houses the 4-step booking funnel.
- **Floating VIP WhatsApp Button**: Persistent pulsing action button linking to WhatsApp.

### 3.2 `src/js/config.js` (Central Configuration)
Exports `ZR_CONFIG` containing:
- Business profile, phone numbers, email, studio address.
- Verified credentials and design background.
- Consultation fee amounts (`₹199 = 19900 paise`).
- Asset image paths (WebP and PNG).
- Calendly URLs and Meta Pixel IDs.

### 3.3 `src/js/booking.js` (Funnel Controller)
Manages the multi-step state machine:
- `Step 1`: Qualification Form handling and validation.
- `Step 2`: Razorpay order creation and checkout modal launch.
- `Step 3`: Appointment slot selection (Studio, Site, or Video) and Calendly sync.
- `Step 4`: Confirmation view rendering with Google Calendar link, iCal download, and VIP WhatsApp dispatch.

### 3.4 `src/js/calculator.js` (Budget Estimator)
- Computes estimated budget per square foot based on property type (Apartment, Penthouse, Villa, Commercial) and finish quality tier.
- Automatically updates estimated execution duration in weeks.
- Passes calculated values directly into the qualification form when the user clicks "Book with this Estimate".

### 3.5 `src/js/form.js` (Input Validation)
- Enforces valid Indian phone format (10-digit mobile number, optional +91 prefix).
- Validates email syntax, required fields, and budget tiers.
- Emits structured lead payloads to the booking funnel engine.

### 3.6 `src/js/gallery.js` (Portfolio & Lightbox)
- Handles active filter tab states with smooth CSS fade transitions.
- Powers the full-screen image lightbox modal with keyboard navigation (`Esc` to close).

### 3.7 `src/js/payment.js` (Razorpay Client Integration)
- Loads and invokes `Razorpay(options)` checkout modal.
- Listens for `handler(response)` callback.
- Posts payment credentials (`razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`) to `/api/razorpay/verify-payment`.

### 3.8 `src/js/whatsapp.js` (VIP Concierge)
- Constructs pre-formatted WhatsApp chat URLs with URL-encoded messages including booking references, client name, and selected time slot.
- Opens conversation directly with `+91 7878588859`.

### 3.9 `src/js/tracking.js` (Meta Analytics)
- Wraps Meta Pixel `fbq('track', ...)` calls with safety checks.
- Dispatches standard events:
  - `ViewContent` on landing page load.
  - `Lead` on Step 1 form submission.
  - `InitiateCheckout` on Step 2 payment view.
  - `Purchase` on Step 2 payment success (value: 199 INR).

---

## 4. API Endpoints Reference

| Route | Method | Handler File | Purpose |
| :--- | :---: | :--- | :--- |
| `/api/status` | `GET` | `api/status.js` | Integration readiness and health check |
| `/api/razorpay/create-order` | `POST` | `api/razorpay/create-order.js` | Generates official Razorpay Order |
| `/api/razorpay/verify-payment` | `POST` | `api/razorpay/verify-payment.js`| Validates HMAC SHA-256 signature |
| `/api/razorpay/webhook` | `POST` | `api/razorpay/webhook.js` | Webhook listener for payment events |
| `/api/calendly/webhook` | `POST` | `api/calendly/webhook.js` | Webhook listener for appointment events |
| `/api/confirm-appointment` | `POST` | `api/confirm-appointment.js` | Stores selected consultation slot |
| `/api/booking/:id` | `GET` | `api/booking/[id].js` | Retrieves booking details by reference ID |

---

## 5. Database Schema & Persistence

### 5.1 Supabase PostgreSQL
Configured via `supabase/schema.sql`:
- Table: `consultation_bookings`
- Columns:
  - `id` (UUID, Primary Key)
  - `booking_reference` (VARCHAR, Unique)
  - `customer_name`, `customer_email`, `customer_phone`, `customer_phone_raw`
  - `project_location`, `property_type`, `budget_tier`, `project_stage`, `project_description`
  - `consultation_fee_paise` (INTEGER, Default 19900)
  - `currency` (VARCHAR, Default 'INR')
  - `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`
  - `payment_status` ('PENDING', 'PAID', 'FAILED', 'REFUNDED')
  - `payment_verified_at` (TIMESTAMPTZ)
  - `calendly_event_uri`, `appointment_date`, `appointment_time`, `timezone`, `appointment_status`
  - `whatsapp_followup_status`, `whatsapp_last_interaction_at`
  - `created_at`, `updated_at` (Auto-updated via trigger)
- Indices on `booking_reference`, `razorpay_order_id`, `razorpay_payment_id`, `customer_phone`, `customer_email`.
- Row Level Security (RLS) enabled with `service_role` full access policy.

### 5.2 Local Storage Fallback
When running locally without Supabase credentials:
- Data persists to `data/bookings.json`.
- Filesystem operations are protected with try/catch to maintain resilience in serverless read-only disk environments.

---

## 6. Environment Variables Reference

```ini
# Application Port and Base URL
PORT=3000
NODE_ENV=development
APP_BASE_URL=https://zr-interior-design.vercel.app

# Razorpay Payment Gateway
RAZORPAY_KEY_ID=rzp_live_YOUR_KEY
RAZORPAY_KEY_SECRET=YOUR_SECRET
RAZORPAY_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET
CONSULTATION_AMOUNT_PAISE=19900

# Calendly Scheduling
CALENDLY_URL=https://calendly.com/zrinteriordesign/30min
CALENDLY_WEBHOOK_SIGNING_KEY=

# WhatsApp Business
WHATSAPP_BUSINESS_PHONE=917878588859
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=

# Supabase PostgreSQL
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY

# Meta Pixel
META_PIXEL_ID=
```

---

## 7. Deployment Instructions

### 7.1 Vercel Deployment
1. Connect GitHub repository `https://github.com/JunedBanzara/ZR-Interior-Landing-page`.
2. Vercel automatically reads `vercel.json`:
   - Framework: `vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Serverless Functions in `/api`
3. Add environment variables in Vercel Project Settings.
4. Deployment completes automatically with SSL and global CDN distribution.

### 7.2 Database Setup in Supabase
1. Create a new Supabase project at [https://supabase.com](https://supabase.com).
2. Open the **SQL Editor**.
3. Copy the entire contents of `supabase/schema.sql` and run it.
4. Copy `Project URL` and `service_role` key from **Project Settings > API** into `.env`.

---

## 8. Verified Studio Credentials

- **Studio Name**: ZR Interior Design
- **Principal Designer**: Mr. Zuber Rafik Banzara
- **Studio Address**: 304, Raama Crest, Near HCG Cancer Center, Sunpharma Road, Vadodara, Gujarat 390012, India
- **Direct Phone**: [+91 7878588859](tel:+917878588859)
- **WhatsApp Concierge**: [+91 7878588859](https://wa.me/917878588859)
- **Email**: [zrinteriordesign@gmail.com](mailto:zrinteriordesign@gmail.com)
- **Operating Hours**: Monday – Saturday: 10:00 AM – 7:30 PM IST
