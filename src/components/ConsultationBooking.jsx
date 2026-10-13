import React, { useState, useEffect } from 'react';

const CONSULTATION_FEE_INR = 199;
const CONSULTATION_DURATION = '45 minutes';
const CALENDLY_URL = 'https://calendly.com/zrinteriordesign/45min';
const WHATSAPP_PHONE = '917878588859';

export default function ConsultationBooking({ onSuccess }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    location: '',
    propertyType: '3BHK',
    budgetTier: '15-20Lacs', // Default to requested option
    stage: 'Possession received',
    description: ''
  });

  // Booking & Verification State
  const [bookingRef, setBookingRef] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [calendlyUrl, setCalendlyUrl] = useState(CALENDLY_URL);
  const [appointment, setAppointment] = useState({
    date: 'Confirmed via Calendly',
    timeSlot: '45-Minute Confirmed Slot',
    timezone: 'Asia/Kolkata'
  });
  const [whatsappUrl, setWhatsappUrl] = useState('');

  // Handle Form Input Change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Step 1: Submit Qualification & Proceed to Payment
  const handleFormSubmit = (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!formData.name.trim()) {
      setErrorMessage('Please enter your full name');
      return;
    }
    const cleanPhone = formData.phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setErrorMessage('Please enter a valid 10-digit WhatsApp/mobile number');
      return;
    }

    setStep(2);
  };

  // Step 2: Initiate Razorpay Checkout
  const handleInitiatePayment = async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      // 1. Create order on serverless API
      const res = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 19900,
          currency: 'INR',
          leadData: formData
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to create payment order');
      }

      setBookingRef(data.bookingRef);

      // Ensure Razorpay SDK is loaded
      if (!window.Razorpay) {
        await loadRazorpayScript();
      }

      const razorpayKey = data.keyId || data.key_id;

      const options = {
        key: razorpayKey,
        amount: data.amount || 19900,
        currency: data.currency || 'INR',
        name: 'ZR Interior Design',
        description: '45-Minute Interior Design Consultation',
        order_id: data.order_id || data.orderId,
        prefill: {
          name: formData.name,
          email: formData.email,
          contact: formData.phone.replace(/\D/g, '')
        },
        notes: {
          bookingRef: data.bookingRef,
          propertyType: formData.propertyType,
          budgetTier: formData.budgetTier
        },
        theme: {
          color: '#8F7256'
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            setErrorMessage('Payment was cancelled or closed. You can retry below.');
          }
        },
        handler: async (response) => {
          await verifyPaymentOnServer(response, data.bookingRef);
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (failResp) => {
        setLoading(false);
        setErrorMessage(`Payment failed: ${failResp.error?.description || 'Transaction declined'}`);
      });

      rzp.open();
    } catch (err) {
      setLoading(false);
      setErrorMessage(err.message || 'Payment initiation failed');
    }
  };

  // Step 2b: Server-Side Signature Verification (Never trust frontend callback alone)
  const verifyPaymentOnServer = async (rzpResponse, activeBookingRef) => {
    try {
      const res = await fetch('/api/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingRef: activeBookingRef,
          order_id: rzpResponse.razorpay_order_id,
          payment_id: rzpResponse.razorpay_payment_id,
          signature: rzpResponse.razorpay_signature,
          razorpay_order_id: rzpResponse.razorpay_order_id,
          razorpay_payment_id: rzpResponse.razorpay_payment_id,
          razorpay_signature: rzpResponse.razorpay_signature
        })
      });

      const data = await res.json();
      if (!res.ok || !data.verified) {
        throw new Error(data.error || 'Server payment verification failed');
      }

      setPaymentId(rzpResponse.razorpay_payment_id);
      if (data.calendlyUrl) {
        setCalendlyUrl(data.calendlyUrl);
      }
      setLoading(false);
      setStep(3); // Advance to Calendly scheduling
    } catch (err) {
      setLoading(false);
      setErrorMessage(`Verification error: ${err.message}`);
    }
  };

  // Helper: Dynamically load Razorpay SDK
  const loadRazorpayScript = () => {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
      document.head.appendChild(script);
    });
  };

  // Step 3: Listen for Calendly Booking Completion
  useEffect(() => {
    const handleCalendlyMessage = async (e) => {
      if (e.data && e.data.event === 'calendly.event_scheduled') {
        const payload = e.data.payload;
        let scheduledDate = 'Confirmed via Calendly';
        let scheduledTime = '45-Minute Confirmed Slot';
        if (payload?.event?.start_time) {
          try {
            const d = new Date(payload.event.start_time);
            scheduledDate = d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
            scheduledTime = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
          } catch (err) {}
        }
        await confirmAppointmentOnServer({
          calendlyEventUri: payload?.event?.uri,
          calendlyInviteeUri: payload?.invitee?.uri,
          date: scheduledDate,
          timeSlot: scheduledTime
        });
      }
    };

    window.addEventListener('message', handleCalendlyMessage);
    return () => window.removeEventListener('message', handleCalendlyMessage);
  }, [bookingRef]);

  // Confirm appointment and get prefilled WhatsApp link
  const confirmAppointmentOnServer = async (details) => {
    try {
      const res = await fetch('/api/confirm-appointment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingRef,
          ...details,
          timezone: 'Asia/Kolkata'
        })
      });

      const data = await res.json();
      let targetWaUrl = data.whatsappUrl;
      if (!targetWaUrl) {
        targetWaUrl = getStepFWhatsAppUrl();
      }
      setWhatsappUrl(targetWaUrl);
      setAppointment({
        date: details.date,
        timeSlot: details.timeSlot,
        timezone: 'Asia/Kolkata (IST)'
      });
      setStep(4); // Advance to confirmed screen
      if (onSuccess) onSuccess(data);

      // Redirect current tab to WhatsApp to eliminate popup blocking
      setTimeout(() => {
        window.location.href = targetWaUrl;
      }, 350);
    } catch (err) {
      setStep(4);
    }
  };

  // Generate Step F WhatsApp Message
  const getStepFWhatsAppUrl = () => {
    if (whatsappUrl) return whatsappUrl;

    const lines = [
      'Hello ZR Interior Design Team,',
      'I have successfully paid for my interior design consultation and booked my appointment.'
    ];

    if (formData.name) lines.push(`Name: ${formData.name}`);
    if (formData.phone) lines.push(`Phone: ${formData.phone}`);
    if (formData.propertyType) lines.push(`Property Type: ${formData.propertyType}`);
    if (formData.location) lines.push(`Project Location: ${formData.location}`);
    if (appointment.date) lines.push(`Appointment Date: ${appointment.date}`);
    if (appointment.timeSlot) lines.push(`Appointment Time: ${appointment.timeSlot}`);
    if (paymentId) lines.push(`Payment Reference: ${paymentId}`);

    lines.push('Please confirm my consultation.');
    lines.push('Thank you.');

    const message = lines.join('\n');
    return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="consultation-funnel-component" style={{ maxWidth: 720, margin: '0 auto', fontFamily: 'var(--font-sans, sans-serif)' }}>
      {/* Progress Indicators */}
      <div className="form-progress" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
        {['1. Details', '2. Payment (₹199)', '3. Schedule', '4. Confirmed'].map((title, idx) => (
          <div
            key={idx}
            className={`form-progress-step ${step === idx + 1 ? 'is-active' : ''} ${step > idx + 1 ? 'is-done' : ''}`}
            style={{ fontWeight: step === idx + 1 ? 600 : 400, fontSize: '0.85rem' }}
          >
            <span>{title}</span>
          </div>
        ))}
      </div>

      {errorMessage && (
        <div style={{ padding: '0.75rem 1rem', background: '#FCEDED', border: '1px solid #EAA8A8', borderRadius: 4, marginBottom: '1.5rem', color: '#8A2626', fontSize: '0.85rem' }}>
          {errorMessage}
        </div>
      )}

      {/* STEP 1: QUALIFICATION FORM */}
      {step === 1 && (
        <form onSubmit={handleFormSubmit} className="qualification-form">
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Book Your Interior Design Consultation</h3>
            <p style={{ color: 'var(--color-text-body, #666)', fontSize: '0.9rem' }}>
              45-minute consultation · Fee: ₹199 (100% adjustable against your project contract)
            </p>
          </div>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500 }}>
              1. Full Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="form-control"
              placeholder="e.g. Dr. Rajesh Patel"
              required
              style={{ width: '100%', padding: '0.8rem', border: '1px solid #CCC', borderRadius: 4 }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500 }}>
              2. WhatsApp / Mobile Number *
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="form-control"
              placeholder="e.g. 98250 12345"
              required
              style={{ width: '100%', padding: '0.8rem', border: '1px solid #CCC', borderRadius: 4 }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500 }}>
              Email Address (Optional)
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="form-control"
              placeholder="e.g. rajesh.patel@gmail.com"
              style={{ width: '100%', padding: '0.8rem', border: '1px solid #CCC', borderRadius: 4 }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500 }}>
              3. Project Location in Vadodara / Gujarat *
            </label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              className="form-control"
              placeholder="e.g. Alkapuri, Sevasi, Gotri, Vadodara"
              required
              style={{ width: '100%', padding: '0.8rem', border: '1px solid #CCC', borderRadius: 4 }}
            />
          </div>

          {/* Field: Budget Options - Strictly: 15-20Lacs, 20-25lacs, 25-35Lacs, 35+lacs */}
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Approximate Project Budget *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
              {['15-20Lacs', '20-25lacs', '25-35Lacs', '35+lacs'].map((tier) => (
                <label
                  key={tier}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.65rem 0.85rem',
                    border: formData.budgetTier === tier ? '2px solid #8F7256' : '1px solid #DDD',
                    borderRadius: 4,
                    background: formData.budgetTier === tier ? '#FAF6F0' : '#FFF',
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="radio"
                    name="budgetTier"
                    value={tier}
                    checked={formData.budgetTier === tier}
                    onChange={handleChange}
                    style={{ marginRight: '0.5rem' }}
                  />
                  <span style={{ fontSize: '0.85rem' }}>{tier}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '1.4rem 2.5rem', background: '#8F7256', color: '#FFF', border: 'none', borderRadius: 4, fontSize: '1.2rem', fontWeight: 700, letterSpacing: '0.03em', cursor: 'pointer', boxShadow: '0 10px 24px rgba(142, 109, 58, 0.28)' }}
          >
            Book Consultation — ₹199
          </button>
        </form>
      )}

      {/* STEP 2: RAZORPAY PAYMENT REVIEW */}
      {step === 2 && (
        <div className="payment-review-card" style={{ padding: '1.5rem', background: '#FFF', border: '1px solid #E5E5E5', borderRadius: 6 }}>
          <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Confirm Consultation Details</h3>
          <div style={{ background: '#FAF8F5', padding: '1rem', borderRadius: 4, marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>Consultation:</span>
              <strong>30-Minute Consultation</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>Client Name:</span>
              <strong>{formData.name}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>WhatsApp / Phone:</span>
              <strong>{formData.phone}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>Budget Tier:</span>
              <strong>{formData.budgetTier}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #DDD', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
              <span style={{ fontWeight: 600 }}>Consultation Fee:</span>
              <span style={{ fontSize: '1.25rem', color: '#8F7256', fontWeight: 700 }}>₹199 INR</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              type="button"
              onClick={() => setStep(1)}
              style={{ padding: '0.85rem 1.25rem', border: '1px solid #CCC', background: '#FFF', borderRadius: 4, cursor: 'pointer' }}
            >
              &larr; Edit Details
            </button>
            <button
              type="button"
              onClick={handleInitiatePayment}
              disabled={loading}
              style={{ flexGrow: 1, padding: '1.4rem 2rem', background: '#8F7256', color: '#FFF', border: 'none', borderRadius: 4, fontSize: '1.15rem', fontWeight: 700, letterSpacing: '0.03em', cursor: loading ? 'not-allowed' : 'pointer', boxShadow: '0 10px 24px rgba(142, 109, 58, 0.28)' }}
            >
              {loading ? 'Opening Razorpay Checkout...' : 'Pay ₹199 via Razorpay &rarr;'}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: CALENDLY SCHEDULING (ONLY AFTER PAYMENT VERIFICATION) */}
      {step === 3 && (
        <div className="calendly-step-card" style={{ padding: '1.5rem', background: '#FFF', border: '1px solid #E5E5E5', borderRadius: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.35rem' }}>Select Your 45-Minute Slot</h3>
            <span style={{ background: '#EBF4EF', color: '#2E6B4F', padding: '0.25rem 0.6rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>
              ✓ Payment Verified
            </span>
          </div>
          <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1.5rem' }}>
            Booking Reference: <strong>#{bookingRef}</strong>. Select your preferred time on the calendar below.
          </p>

          <iframe
            src={calendlyUrl}
            width="100%"
            height="650"
            frameBorder="0"
            title="Calendly 45-Minute Consultation Scheduler"
            style={{ borderRadius: 6, border: '1px solid #E5E5E5' }}
          ></iframe>

          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() =>
                confirmAppointmentOnServer({
                  date: 'Tomorrow',
                  timeSlot: '11:30 AM'
                })
              }
              style={{ fontSize: '0.8rem', color: '#8F7256', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}
            >
              Or click here to confirm slot directly &rarr;
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: WHATSAPP CONFIRMATION (Step F) */}
      {step === 4 && (
        <div className="confirmation-card" style={{ padding: '1.75rem', background: '#FFF', border: '1px solid #8F7256', borderRadius: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#EBF4EF', color: '#2E6B4F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              ✓
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.35rem' }}>Consultation Confirmed</h3>
              <span style={{ fontSize: '0.8rem', color: '#666' }}>Ref: #{bookingRef}</span>
            </div>
          </div>

          <div style={{ background: '#FAF8F5', padding: '1rem', borderRadius: 4, marginBottom: '1.5rem', fontSize: '0.85rem' }}>
            <p style={{ margin: '0 0 0.35rem 0' }}><strong>Client:</strong> {formData.name}</p>
            <p style={{ margin: '0 0 0.35rem 0' }}><strong>Slot:</strong> {appointment.date} · {appointment.timeSlot}</p>
            <p style={{ margin: '0 0 0.35rem 0' }}><strong>Duration:</strong> {CONSULTATION_DURATION}</p>
            <p style={{ margin: '0 0 0.35rem 0' }}><strong>Fee:</strong> ₹199 (Paid & Verified)</p>
            {paymentId && <p style={{ margin: 0 }}><strong>Payment ID:</strong> {paymentId}</p>}
          </div>

          <a
            href={getStepFWhatsAppUrl()}
            target="_self"
            style={{
              display: 'block',
              textAlign: 'center',
              padding: '1.1rem 1.5rem',
              background: '#25D366',
              color: '#FFF',
              fontWeight: 600,
              textDecoration: 'none',
              borderRadius: 4,
              fontSize: '1rem'
            }}
          >
            Open WhatsApp Chat with Booking Details (+91 7878588859) &rarr;
          </a>
        </div>
      )}
    </div>
  );
}
