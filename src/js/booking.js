/**
 * ZR INTERIOR DESIGN — LUXURY BOOKING & INTEGRATION ENGINE
 * Connects Razorpay (₹199), Calendly (30-min consultation), WhatsApp reminders, and Meta conversions.
 */

import { ZR_CONFIG } from './config.js';
import { Tracker } from './tracking.js';
import { WhatsAppService } from './whatsapp.js';

export class BookingFunnel {
  constructor(containerEl) {
    this.container = containerEl;
    this.currentStep = 1;
    this.leadData = null;
    this.bookingId = null;
    this.orderId = null;
    this.paymentVerified = false;
    this.appointmentData = null;
    this.selectedDate = null;
    this.selectedTimeSlot = null;
    this.selectedMode = "studio";
    this.calendlyRedirectUrl = null;
    this.isProcessingPayment = false;

    this.init();
  }

  init() {
    this.renderStepIndicators();
    this.setupCalendlyListener();
  }

  setLeadData(data) {
    this.leadData = data;
    this.goToStep(2);
  }

  goToStep(stepNumber) {
    this.currentStep = stepNumber;
    this.updateStepIndicators();

    const step1El = document.getElementById('funnel-step-1');
    const step2El = document.getElementById('funnel-step-2');
    const step3El = document.getElementById('funnel-step-3');
    const step4El = document.getElementById('funnel-step-4');

    if (step1El) step1El.style.display = stepNumber === 1 ? 'block' : 'none';
    if (step2El) step2El.style.display = stepNumber === 2 ? 'block' : 'none';
    if (step3El) step3El.style.display = stepNumber === 3 ? 'block' : 'none';
    if (step4El) step4El.style.display = stepNumber === 4 ? 'block' : 'none';

    // Scroll to container top smoothly
    this.container.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (stepNumber === 2) {
      this.renderPaymentStep();
      Tracker.trackInitiateCheckout(this.leadData);
    } else if (stepNumber === 3) {
      this.renderSlotPickerStep();
    } else if (stepNumber === 4) {
      this.renderConfirmationStep();
    }
  }

  renderStepIndicators() {
    const indicatorWrap = document.getElementById('funnelStepIndicators');
    if (!indicatorWrap) return;

    indicatorWrap.innerHTML = `
      <div class="form-progress">
        <div class="form-progress-step is-active" id="progressStep1">
          <span class="step-indicator-bubble">1</span>
          <span>Qualification</span>
        </div>
        <div class="form-progress-step" id="progressStep2">
          <span class="step-indicator-bubble">2</span>
          <span>Payment (₹199)</span>
        </div>
        <div class="form-progress-step" id="progressStep3">
          <span class="step-indicator-bubble">3</span>
          <span>Schedule</span>
        </div>
        <div class="form-progress-step" id="progressStep4">
          <span class="step-indicator-bubble">4</span>
          <span>Confirmed</span>
        </div>
      </div>
    `;
  }

  updateStepIndicators() {
    for (let i = 1; i <= 4; i++) {
      const stepEl = document.getElementById(`progressStep${i}`);
      if (!stepEl) continue;

      stepEl.classList.remove('is-active', 'is-done');
      if (i < this.currentStep) {
        stepEl.classList.add('is-done');
      } else if (i === this.currentStep) {
        stepEl.classList.add('is-active');
      }
    }
  }

  /* ==========================================================================
     STEP 2: PAYMENT (₹199) VIA RAZORPAY
     ========================================================================== */
  renderPaymentStep() {
    const step2El = document.getElementById('funnel-step-2');
    if (!step2El) return;

    step2El.innerHTML = `
      <div class="form-card" style="border-top: 3px solid var(--color-bronze);">
        <div style="margin-bottom: 2rem;">
          <span class="eyebrow">STEP 02 OF 04 · PRIVATE CONSULTATION FEE</span>
          <h3 style="font-size: clamp(1.6rem, 2.5vw, 2.25rem); margin-bottom: 0.5rem;">Confirm Your Consultation Details</h3>
          <p style="color: var(--color-text-body); font-size: var(--text-sm);">
            The ₹199 consultation fee secures a private 30-minute strategic review with our principal design team and filters uncommitted enquiries.
          </p>
        </div>

        <!-- Summary Receipt Box -->
        <div class="payment-box">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 1rem;">
            <div>
              <strong style="display: block; font-size: var(--text-base); color: var(--color-text-main);">30-Minute Private Interior Consultation</strong>
              <span style="font-size: var(--text-xs); color: var(--color-text-muted);">Principal Designer: Mr. Zuber Rafik Banzara & Turnkey Directors</span>
            </div>
            <span style="font-family: var(--font-serif); font-size: 1.75rem; font-weight: 600; color: var(--color-text-main);">₹199</span>
          </div>

          <div class="payment-summary-row">
            <span style="color: var(--color-text-muted);">Client Name:</span>
            <strong>${this.leadData.name}</strong>
          </div>
          <div class="payment-summary-row">
            <span style="color: var(--color-text-muted);">WhatsApp / Mobile:</span>
            <span>${this.leadData.phone}</span>
          </div>
          ${this.leadData.email ? `
          <div class="payment-summary-row">
            <span style="color: var(--color-text-muted);">Email Address:</span>
            <span>${this.leadData.email}</span>
          </div>
          ` : ''}
          <div class="payment-summary-row">
            <span style="color: var(--color-text-muted);">Project Location:</span>
            <span>${this.leadData.location}</span>
          </div>
          <div class="payment-summary-row">
            <span style="color: var(--color-text-muted);">Property Type:</span>
            <span>${this.leadData.propertyType}</span>
          </div>
          <div class="payment-summary-row">
            <span style="color: var(--color-text-muted);">Budget Range:</span>
            <span>${this.leadData.budgetTier}</span>
          </div>
          <div class="payment-summary-row">
            <span style="color: var(--color-text-muted);">Project Stage:</span>
            <span>${this.leadData.stage || 'In Planning'}</span>
          </div>
          ${this.leadData.description ? `
          <div class="payment-summary-row">
            <span style="color: var(--color-text-muted);">Design Notes:</span>
            <span style="font-style: italic;">${this.leadData.description}</span>
          </div>
          ` : ''}

          <div class="payment-summary-row payment-summary-total">
            <span>Total Amount Payable:</span>
            <span style="font-size: 1.85rem; color: var(--color-bronze); font-family: var(--font-serif); font-weight: 700;">₹199</span>
          </div>

          <div class="payment-adjustment-badge">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span><strong>Adjustable Guarantee:</strong> 100% of this ₹199 fee is adjusted against your project contract if you proceed with ZR Interior Design.</span>
          </div>
        </div>

        <!-- Integration Status Notice Area -->
        <div id="paymentStatusBox" style="margin-bottom: 1.5rem;"></div>

        <!-- Actions -->
        <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
          <button type="button" class="btn btn-secondary" id="paymentBackToFormBtn" style="padding: 1rem 1.5rem;">
            &larr; Edit Details
          </button>
          <button type="button" class="btn btn-primary" id="processPaymentBtn" style="flex-grow: 1; padding: 1.45rem 2.5rem; font-size: 1.2rem; font-weight: 700; letter-spacing: 0.03em; box-shadow: 0 10px 26px rgba(142, 109, 58, 0.28);">
            <span>Pay ₹199 via Razorpay &rarr;</span>
          </button>
        </div>

        <div style="display: flex; justify-content: center; align-items: center; gap: 1.5rem; margin-top: 1.5rem; font-size: var(--text-xs); color: var(--color-text-muted);">
          <span>🔒 Official Razorpay 256-Bit SSL Checkout</span>
          <span>🛡️ Verified Business Entity</span>
          <span>⚡ Instant Booking Pass</span>
        </div>
      </div>
    `;

    // Back button
    step2El.querySelector('#paymentBackToFormBtn').addEventListener('click', () => {
      this.goToStep(1);
    });

    // Payment trigger
    step2El.querySelector('#processPaymentBtn').addEventListener('click', () => {
      this.initiateRazorpayPayment();
    });
  }

  async initiateRazorpayPayment() {
    if (this.isProcessingPayment) return;
    this.isProcessingPayment = true;

    const payBtn = document.getElementById('processPaymentBtn');
    const statusBox = document.getElementById('paymentStatusBox');

    if (payBtn) {
      payBtn.disabled = true;
      payBtn.innerHTML = `
        <span class="spinner" style="display:inline-block; width:16px; height:16px; border:2px solid currentColor; border-right-color:transparent; border-radius:50%; animation:spin 0.75s linear infinite; margin-right:8px; vertical-align:middle;"></span>
        Contacting Payment Gateway...
      `;
    }

    try {
      // 1. Create order on server (Never trust frontend amount)
      const res = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadData: this.leadData })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to initialize payment order');
      }

      this.bookingId = data.bookingRef || data.bookingId;

      // Check if server is awaiting Razorpay API credentials
      if (data.status === 'awaiting_credentials') {
        this.isProcessingPayment = false;
        if (payBtn) {
          payBtn.disabled = false;
          payBtn.innerHTML = `<span>Retry Razorpay Payment &rarr;</span>`;
        }

        if (statusBox) {
          statusBox.innerHTML = `
            <div style="padding: 1.25rem; background: #FFFDF9; border: 1px solid var(--color-bronze-light); border-left: 4px solid var(--color-bronze); border-radius: var(--radius-xs);">
              <h4 style="margin: 0 0 0.5rem 0; font-size: var(--text-sm); color: var(--color-text-main); display: flex; align-items: center; gap: 0.5rem;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                Razorpay Integration Ready · Awaiting API Credentials
              </h4>
              <p style="margin: 0 0 0.75rem 0; font-size: var(--text-xs); color: var(--color-text-body); line-height: 1.6;">
                Pending consultation record <strong>#${this.bookingId}</strong> has been saved. To accept payments, add your Razorpay Key ID and Secret to your server environment variables.
              </p>
              <div style="font-size: 0.75rem; color: var(--color-text-muted); background: #F6F4EE; padding: 0.5rem 0.75rem; border-radius: 2px;">
                Required: <code>RAZORPAY_KEY_ID=rzp_test_...</code> &nbsp;|&nbsp; Enforced Amount: <strong>₹199 INR</strong>
              </div>
            </div>
          `;
        }
        return;
      }

      this.orderId = data.orderId;

      // 2. Load official Razorpay Checkout SDK if not already present
      await this.ensureRazorpayLoaded();

      // 3. Launch official Razorpay Checkout modal
      const options = {
        key: data.keyId,
        amount: data.amount, // Enforced 19900 paise on server
        currency: data.currency || 'INR',
        name: ZR_CONFIG.brand.name,
        description: "30-Minute Private Interior Design Consultation",
        image: "assets/images/logo-zr.png",
        order_id: data.orderId,
        prefill: {
          name: this.leadData.name,
          email: this.leadData.email || '',
          contact: this.leadData.phoneRaw || this.leadData.phone
        },
        notes: {
          bookingRef: this.bookingId,
          propertyType: this.leadData.propertyType,
          budgetTier: this.leadData.budgetTier
        },
        theme: {
          color: "#8F7256"
        },
        modal: {
          ondismiss: () => {
            this.isProcessingPayment = false;
            if (payBtn) {
              payBtn.disabled = false;
              payBtn.innerHTML = `<span>Retry Payment (₹199) &rarr;</span>`;
            }
            if (statusBox) {
              statusBox.innerHTML = `
                <div style="padding: 0.75rem 1rem; background: #FCEDED; border: 1px solid #EAA8A8; border-radius: var(--radius-xs); font-size: var(--text-xs); color: #8A2626;">
                  Payment checkout was closed or cancelled. Click below to reopen and complete your reservation.
                </div>
              `;
            }
          }
        },
        handler: async (response) => {
          await this.handlePaymentVerification(response);
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (failResp) => {
        console.error('[Razorpay Payment Failed]', failResp.error);
        this.isProcessingPayment = false;
        if (payBtn) {
          payBtn.disabled = false;
          payBtn.innerHTML = `<span>Retry Payment (₹199) &rarr;</span>`;
        }
        if (statusBox) {
          statusBox.innerHTML = `
            <div style="padding: 0.75rem 1rem; background: #FCEDED; border: 1px solid #EAA8A8; border-radius: var(--radius-xs); font-size: var(--text-xs); color: #8A2626;">
              Payment failed: ${failResp.error.description || 'Transaction was declined by issuing bank'}. Please retry.
            </div>
          `;
        }
      });

      rzp.open();
    } catch (err) {
      console.error('[Payment Error]:', err);
      this.isProcessingPayment = false;
      if (payBtn) {
        payBtn.disabled = false;
        payBtn.innerHTML = `<span>Retry Payment (₹199) &rarr;</span>`;
      }
      if (statusBox) {
        statusBox.innerHTML = `
          <div style="padding: 0.75rem 1rem; background: #FCEDED; border: 1px solid #EAA8A8; border-radius: var(--radius-xs); font-size: var(--text-xs); color: #8A2626;">
            Error initiating payment: ${err.message}. Please check connection or retry.
          </div>
        `;
      }
    }
  }

  ensureRazorpayLoaded() {
    return new Promise((resolve, reject) => {
      if (window.Razorpay) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Razorpay Checkout script'));
      document.head.appendChild(script);
    });
  }

  async handlePaymentVerification(rzpResponse) {
    const statusBox = document.getElementById('paymentStatusBox');
    if (statusBox) {
      statusBox.innerHTML = `
        <div style="padding: 0.75rem 1rem; background: #EBF4EF; border: 1px solid #A8D1BC; border-radius: var(--radius-xs); font-size: var(--text-xs); color: #2E6B4F;">
          Verifying payment signature with secure server...
        </div>
      `;
    }

    try {
      // Server-Side Verification: Never trust client-side success callback alone!
      const verifyRes = await fetch('/api/razorpay/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingRef: this.bookingId,
          razorpay_order_id: rzpResponse.razorpay_order_id,
          razorpay_payment_id: rzpResponse.razorpay_payment_id,
          razorpay_signature: rzpResponse.razorpay_signature
        })
      });

      const verifyData = await verifyRes.json();

      if (!verifyRes.ok || !verifyData.verified) {
        throw new Error(verifyData.error || 'Server signature verification failed');
      }

      this.paymentVerified = true;
      this.paymentId = rzpResponse.razorpay_payment_id;
      this.calendlyRedirectUrl = verifyData.calendlyUrl;

      // Track Meta Purchase Conversion Event
      Tracker.trackPurchase(rzpResponse.razorpay_order_id, this.leadData);

      // Transition to Step 3 (Calendly Scheduling) ONLY AFTER server confirms payment
      this.goToStep(3);
    } catch (err) {
      console.error('[Payment Verification Failed]', err);
      this.isProcessingPayment = false;
      if (statusBox) {
        statusBox.innerHTML = `
          <div style="padding: 0.75rem 1rem; background: #FCEDED; border: 1px solid #EAA8A8; border-radius: var(--radius-xs); font-size: var(--text-xs); color: #8A2626;">
            Payment verification error: ${err.message}. If funds were debited, our team will verify your transaction manually.
          </div>
        `;
      }
    }
  }

  /* ==========================================================================
     STEP 3: CALENDLY 30-MINUTE CONSULTATION SCHEDULER
     ========================================================================== */
  renderSlotPickerStep() {
    const step3El = document.getElementById('funnel-step-3');
    if (!step3El) return;

    const calendlyUrl = this.calendlyRedirectUrl || this.getCalendlyPrefilledUrl();

    step3El.innerHTML = `
      <div class="form-card" style="border-top: 3px solid var(--color-bronze);">
        <div style="margin-bottom: 1.75rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem;">
            <span class="eyebrow" style="margin-bottom: 0;">STEP 03 OF 04 · CALENDAR BOOKING</span>
            <span style="display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.25rem 0.6rem; background: #EBF4EF; color: #2E6B4F; font-size: 0.75rem; font-weight: 600; border-radius: 2px;">
              ✓ ₹199 Payment Verified
            </span>
          </div>
          <h3 style="font-size: clamp(1.6rem, 2.5vw, 2.25rem); margin-bottom: 0.5rem;">Select Your 30-Minute Consultation Time</h3>
          <p style="color: var(--color-text-body); font-size: var(--text-sm);">
            Choose your preferred slot with our principal design studio. Your details have been prefilled.
          </p>
        </div>

        <!-- Consultation Format Options -->
        <div style="margin-bottom: 1.5rem;">
          <label class="form-label">Consultation Format</label>
          <div class="chip-grid" id="modeSelectorGrid">
            ${ZR_CONFIG.consultation.modes.map((mode, i) => `
              <div class="chip-option">
                <input type="radio" id="mode-${mode.id}" name="consultationMode" value="${mode.id}" ${i === 0 ? 'checked' : ''}>
                <label for="mode-${mode.id}" class="chip-label">${mode.label}</label>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- External Calendly Link for Full Tab View -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1rem; padding: 0.75rem 1rem; background: var(--color-bg-base); border-radius: var(--radius-xs); border: 1px solid var(--border-subtle);">
          <span style="font-size: var(--text-xs); color: var(--color-text-body);">
            Having trouble viewing the calendar widget?
          </span>
          <a href="${calendlyUrl}" target="_blank" rel="noopener" class="btn btn-sm btn-outline" id="openCalendlyDirectBtn">
            Open Calendly in New Tab &rarr;
          </a>
        </div>

        <!-- Official Calendly Inline Widget Container -->
        <div style="margin-bottom: 1.5rem;">
          <div class="calendly-inline-widget" id="calendlyInlineWidget" style="min-width:320px; height:680px; border:1px solid var(--border-subtle); border-radius:var(--radius-xs); overflow:hidden;"></div>
        </div>

        <!-- Direct Instant Slot Fallback for offline/custom environments -->
        <div style="padding: 1.25rem; background: var(--color-bg-base); border: 1px dashed var(--border-medium); border-radius: var(--radius-xs); margin-bottom: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <h4 style="margin: 0; font-size: var(--text-sm); font-weight: 600; color: var(--color-text-main);">
              Alternative Direct Slot Confirmation
            </h4>
            <span style="font-size: var(--text-xs); color: var(--color-text-muted);">Direct Sync with Studio</span>
          </div>
          <p style="font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: 1rem;">
            If Calendly is loading slowly or blocked by browser shields, confirm your preferred time slot directly:
          </p>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.5rem; margin-bottom: 1rem;">
            <button type="button" class="btn btn-secondary direct-slot-btn" data-slot="Tomorrow · 11:30 AM" style="padding: 0.6rem; font-size: 0.78rem;">Tomorrow · 11:30 AM</button>
            <button type="button" class="btn btn-secondary direct-slot-btn" data-slot="Tomorrow · 04:00 PM" style="padding: 0.6rem; font-size: 0.78rem;">Tomorrow · 04:00 PM</button>
            <button type="button" class="btn btn-secondary direct-slot-btn" data-slot="In 2 Days · 02:30 PM" style="padding: 0.6rem; font-size: 0.78rem;">In 2 Days · 02:30 PM</button>
            <button type="button" class="btn btn-secondary direct-slot-btn" data-slot="In 2 Days · 05:30 PM" style="padding: 0.6rem; font-size: 0.78rem;">In 2 Days · 05:30 PM</button>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; font-size: var(--text-xs); color: var(--color-text-muted);">
          <span>Booking Reference: <strong>#${this.bookingId || 'ZR-CONF'}</strong></span>
          <span>30-Minute Private Session · Vadodara</span>
        </div>
      </div>
    `;

    // Initialize Calendly Widget
    this.mountCalendlyWidget();

    // Direct slot buttons event listener
    step3El.querySelectorAll('.direct-slot-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const slotText = btn.getAttribute('data-slot');
        this.confirmAppointment({
          date: slotText.split('·')[0].trim(),
          timeSlot: slotText.split('·')[1].trim(),
          eventTime: new Date().toISOString()
        });
      });
    });
  }

  getCalendlyPrefilledUrl() {
    const params = new URLSearchParams();
    if (this.leadData?.name) params.set('name', this.leadData.name);
    if (this.leadData?.email) params.set('email', this.leadData.email);
    if (this.leadData?.phoneRaw || this.leadData?.phone) {
      params.set('a1', this.leadData.phoneRaw || this.leadData.phone);
    }
    params.set('utm_source', 'zr_funnel');
    if (this.bookingId) params.set('utm_campaign', this.bookingId);

    return `${ZR_CONFIG.booking.calendlyUrl}?${params.toString()}`;
  }

  mountCalendlyWidget() {
    const container = document.getElementById('calendlyInlineWidget');
    if (!container) return;

    if (!window.Calendly) {
      const script = document.createElement('script');
      script.src = 'https://assets.calendly.com/assets/external/widget.js';
      script.async = true;
      script.onload = () => this.injectCalendlyIframe();
      document.head.appendChild(script);
    } else {
      this.injectCalendlyIframe();
    }
  }

  injectCalendlyIframe() {
    const container = document.getElementById('calendlyInlineWidget');
    if (!container || !window.Calendly) return;

    const calendlyUrl = ZR_CONFIG.booking.calendlyUrl;

    window.Calendly.initInlineWidget({
      url: calendlyUrl,
      parentElement: container,
      prefill: {
        name: this.leadData.name,
        email: this.leadData.email || '',
        smsReminderNumber: this.leadData.phoneRaw || this.leadData.phone
      },
      utm: {
        utmCampaign: this.bookingId || 'zr_consultation',
        utmSource: 'landing_page',
        utmMedium: 'funnel_payment_verified'
      }
    });
  }

  setupCalendlyListener() {
    window.addEventListener('message', async (e) => {
      // Official Calendly scheduled event listener
      if (e.data && e.data.event === 'calendly.event_scheduled') {
        console.log('[Calendly Event Scheduled Message]:', e.data.payload);
        const payload = e.data.payload;

        await this.confirmAppointment({
          calendlyEventUri: payload?.event?.uri || null,
          calendlyInviteeUri: payload?.invitee?.uri || null,
          date: 'Confirmed via Calendly',
          timeSlot: '30-Minute Confirmed Slot',
          eventTime: new Date().toISOString()
        });
      }
    });
  }

  async confirmAppointment(appointmentDetails) {
    this.appointmentData = appointmentDetails;

    try {
      const modeSelected = document.querySelector('input[name="consultationMode"]:checked')?.value || 'studio';
      const modeObj = ZR_CONFIG.consultation.modes.find((m) => m.id === modeSelected);

      const res = await fetch('/api/confirm-appointment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingRef: this.bookingId,
          calendlyEventUri: appointmentDetails.calendlyEventUri,
          calendlyInviteeUri: appointmentDetails.calendlyInviteeUri,
          date: appointmentDetails.date,
          timeSlot: appointmentDetails.timeSlot,
          eventTime: appointmentDetails.eventTime,
          mode: modeObj?.label || 'ZR Design Studio (Vadodara)'
        })
      });

      const data = await res.json();
      console.log('[Appointment Confirmed Response]', data);

      if (data.whatsappUrl) {
        this.whatsappUrl = data.whatsappUrl;
      }

      // Track Meta Schedule Conversion Event
      Tracker.trackSchedule({
        date: appointmentDetails.date,
        timeSlot: appointmentDetails.timeSlot,
        mode: modeSelected
      });

      // Move to Step 4: Confirmation
      this.goToStep(4);
    } catch (err) {
      console.error('[Confirmation Error]:', err);
      // Still display confirmation step with local details
      this.goToStep(4);
    }
  }

  /* ==========================================================================
     STEP 4: CONFIRMATION & WHATSAPP JOURNEY (Step F)
     ========================================================================== */
  renderConfirmationStep() {
    const step4El = document.getElementById('funnel-step-4');
    if (!step4El) return;

    const bookingPayload = {
      id: this.bookingId,
      bookingRef: this.bookingId,
      name: this.leadData.name,
      phone: this.leadData.phone,
      email: this.leadData.email,
      paymentId: this.paymentId || 'Verified',
      date: this.appointmentData?.date || 'Confirmed Session',
      timeSlot: this.appointmentData?.timeSlot || '30-Minute Consultation',
      timezone: 'Asia/Kolkata (IST)',
      propertyType: this.leadData.propertyType,
      location: this.leadData.location,
      budgetTier: this.leadData.budgetTier,
      modeLabel: 'ZR Design Studio (Vadodara)'
    };

    const whatsappUrl = this.whatsappUrl || WhatsAppService.getWhatsAppUrl(bookingPayload);
    const googleCalUrl = WhatsAppService.getGoogleCalendarUrl(bookingPayload);
    const reminders = WhatsAppService.getReminderSchedule(bookingPayload);

    step4El.innerHTML = `
      <div class="form-card" style="border-top: 3px solid var(--color-success); text-align: left;">
        <div style="display: flex; align-items: flex-start; gap: 1.25rem; margin-bottom: 2rem;">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--color-success-bg); color: var(--color-success); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; flex-shrink: 0;">
            ✓
          </div>
          <div>
            <span class="eyebrow" style="color: var(--color-success); margin-bottom: 0.25rem;">CONFIRMATION # ${this.bookingId || 'ZR-CONFIRMED'}</span>
            <h3 style="font-size: clamp(1.6rem, 2.5vw, 2.25rem); margin-bottom: 0.35rem;">Consultation Confirmed</h3>
            <p style="color: var(--color-text-body); font-size: var(--text-sm); margin: 0;">
              Your 30-minute consultation with Principal Designer Mr. Zuber Rafik Banzara is locked.
            </p>
          </div>
        </div>

        <!-- Appointment Summary Box -->
        <div class="payment-box" style="margin-bottom: 2rem;">
          <div class="payment-summary-row">
            <span style="color: var(--color-text-muted);">Client Name:</span>
            <strong>${bookingPayload.name}</strong>
          </div>
          ${bookingPayload.email ? `
          <div class="payment-summary-row">
            <span style="color: var(--color-text-muted);">Email:</span>
            <span>${bookingPayload.email}</span>
          </div>
          ` : ''}
          <div class="payment-summary-row">
            <span style="color: var(--color-text-muted);">Phone:</span>
            <span>${bookingPayload.phone}</span>
          </div>
          <div class="payment-summary-row">
            <span style="color: var(--color-text-muted);">Appointment Slot:</span>
            <span style="color: var(--color-bronze); font-weight: 600;">${bookingPayload.date} · ${bookingPayload.timeSlot}</span>
          </div>
          <div class="payment-summary-row">
            <span style="color: var(--color-text-muted);">Duration:</span>
            <span>30 Minutes Dedicated Session</span>
          </div>
          <div class="payment-summary-row">
            <span style="color: var(--color-text-muted);">Property Scope:</span>
            <span>${bookingPayload.propertyType} (${bookingPayload.location})</span>
          </div>
          <div class="payment-summary-row">
            <span style="color: var(--color-text-muted);">Fee Paid:</span>
            <span style="color: var(--color-success); font-weight: 600;">₹199 INR (100% Adjustable Against Project)</span>
          </div>
          ${bookingPayload.paymentId ? `
          <div class="payment-summary-row">
            <span style="color: var(--color-text-muted);">Razorpay Payment ID:</span>
            <span style="font-family: monospace; font-size: var(--text-xs);">${bookingPayload.paymentId}</span>
          </div>
          ` : ''}
        </div>

        <!-- Primary WhatsApp Next Step Action Box -->
        <div style="padding: 1.5rem; background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: var(--radius-xs); margin-bottom: 2rem;">
          <h4 style="margin: 0 0 0.5rem 0; font-size: var(--text-sm); color: #166534; display: flex; align-items: center; gap: 0.5rem;">
            <span>💬</span> Next Step: Send Confirmed Details to WhatsApp Studio
          </h4>
          <p style="margin: 0 0 1rem 0; font-size: var(--text-xs); color: #15803D; line-height: 1.6;">
            Tap the button below to open WhatsApp with your prefilled consultation details. Review and tap <strong>Send</strong> so our design team can prepare your session brief.
          </p>
          <a href="${whatsappUrl}" target="_blank" rel="noopener" class="btn btn-primary" id="openWhatsAppPrimaryBtn" style="display: flex; align-items: center; justify-content: center; gap: 0.65rem; width: 100%; padding: 1.15rem 1.75rem; text-decoration: none; font-size: 1rem;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.669-.699c.969.54 1.772.82 2.791.82 3.182 0 5.768-2.587 5.768-5.766.001-3.187-2.575-5.771-5.768-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.077-1.127-.061-.264-.085-.599-.2-1.031-.387-1.812-.785-3.003-2.62-3.094-2.744-.09-.124-.741-.987-.741-1.884 0-.897.469-1.339.636-1.52.167-.181.365-.226.486-.226.122 0 .243.001.349.006.111.005.26-.042.406.31.152.368.517 1.264.562 1.356.045.091.076.198.015.319-.06.122-.091.198-.182.304-.091.106-.192.237-.274.318-.091.091-.186.19-.08.372.106.182.472.779 1.013 1.261.698.622 1.287.815 1.469.906.182.091.288.076.394-.046.106-.121.455-.53.576-.712.121-.182.242-.152.407-.091.167.061 1.061.5 1.243.591.182.091.304.137.349.213.045.076.045.441-.099.846z"/></svg>
            <span>Open WhatsApp Chat with Booking Details (+91 7878588859)</span>
          </a>
        </div>

        <!-- WhatsApp Automation & Reminders Track -->
        <div style="margin-bottom: 2rem;">
          <h4 style="font-family: var(--font-sans); font-size: var(--text-xs); text-transform: uppercase; letter-spacing: var(--tracking-wider); color: var(--color-text-main); margin-bottom: 1rem;">
            Automated WhatsApp Confirmation & Reminder Schedule (Asia/Kolkata)
          </h4>

          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            ${reminders.map((r, idx) => `
              <div style="display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.85rem 1rem; background: var(--color-bg-base); border: 1px solid var(--border-subtle); border-radius: var(--radius-xs);">
                <div style="width: 20px; height: 20px; border-radius: 50%; background: ${idx === 0 ? 'var(--color-success)' : 'var(--color-bronze-light)'}; color: #FFF; font-size: 0.65rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;">
                  ${idx + 1}
                </div>
                <div style="flex-grow: 1;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.2rem;">
                    <strong style="font-size: var(--text-xs); color: var(--color-text-main);">${r.title}</strong>
                    <span style="font-size: 0.7rem; color: var(--color-text-muted);">${r.timing}</span>
                  </div>
                  <p style="margin: 0; font-size: 0.75rem; color: var(--color-text-body); line-height: 1.45;">
                    "${r.message}"
                  </p>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Calendar Actions -->
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 2rem;">
          <a href="${googleCalUrl}" target="_blank" rel="noopener" class="btn btn-secondary" style="padding: 1rem 1.25rem; text-decoration: none;">
            Add to Google Calendar
          </a>
          <button type="button" class="btn btn-secondary" id="downloadIcsBtn" style="padding: 1rem 1.25rem;">
            Download .ICS File
          </button>
        </div>

        <!-- Preparation Checklist Notice -->
        <div style="border-left: 2px solid var(--color-bronze); padding-left: 1.25rem; font-size: var(--text-xs); color: var(--color-text-body); line-height: 1.6;">
          <strong>Preparation for Your Session:</strong><br>
          Please keep your floor plan blueprint, property photos, and functional family requirements handy. If meeting at the studio, we are located at 304, Raama Crest, Near HCG Cancer Center, Sunpharma Road, Vadodara - Gujarat. 390012.
        </div>
      </div>
    `;

    // Download iCS event listener
    step4El.querySelector('#downloadIcsBtn').addEventListener('click', () => {
      WhatsAppService.downloadIcsFile(bookingPayload);
    });
  }
}
