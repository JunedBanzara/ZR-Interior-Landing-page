/**
 * ZR INTERIOR DESIGN — SHORT PROJECT QUALIFICATION FORM (7 FIELDS)
 * Collects and validates focused qualification fields prior to payment.
 */

import { Tracker } from './tracking.js';

export class QualificationForm {
  constructor(formElement, onSubmitSuccess) {
    this.form = formElement;
    this.onSubmitSuccess = onSubmitSuccess;
    this.formData = {};

    this.init();
  }

  init() {
    if (!this.form) return;

    this.form.addEventListener('submit', (e) => this.handleSubmit(e));

    // Remove invalid styling on user interaction
    this.form.querySelectorAll('input, select, textarea').forEach((input) => {
      input.addEventListener('input', () => {
        this.clearInvalid(input);
      });
      input.addEventListener('change', () => {
        this.clearInvalid(input);
      });
    });

    // Restore draft if saved
    this.restoreDraft();
  }

  clearInvalid(input) {
    if (!input) return;
    input.classList.remove('is-invalid');
    const group = input.closest('.form-group');
    if (group) {
      group.classList.remove('has-error');
      const err = group.querySelector('.form-error-msg');
      if (err) err.style.display = 'none';
    }
  }

  markInvalid(input, message) {
    if (!input) return;
    input.classList.add('is-invalid');
    const group = input.closest('.form-group');
    if (group) {
      group.classList.add('has-error');
      const err = group.querySelector('.form-error-msg');
      if (err) {
        err.textContent = message;
        err.style.display = 'block';
      }
    }
  }

  highlightGroup(groupName, message) {
    const group = this.form.querySelector(`[data-group="${groupName}"]`);
    if (group) {
      group.classList.add('has-error');
      const err = group.querySelector('.form-error-msg');
      if (err) {
        err.textContent = message;
        err.style.display = 'block';
      }
    }
  }

  saveDraft(data) {
    try {
      localStorage.setItem('zr_qualification_draft', JSON.stringify(data));
    } catch (e) {
      // storage unavailable
    }
  }

  restoreDraft() {
    try {
      const saved = localStorage.getItem('zr_qualification_draft');
      if (!saved) return;
      const data = JSON.parse(saved);

      if (data.name) {
        const el = this.form.querySelector('#fullName');
        if (el) el.value = data.name;
      }
      if (data.phone) {
        const el = this.form.querySelector('#phoneNumber');
        if (el) el.value = data.phone;
      }
      if (data.email) {
        const el = this.form.querySelector('#emailAddress');
        if (el) el.value = data.email;
      }
      if (data.location) {
        const el = this.form.querySelector('#projectLocation');
        if (el) el.value = data.location;
      }
      if (data.propertyType) {
        const radio = this.form.querySelector(`input[name="propertyType"][value="${data.propertyType}"]`);
        if (radio) radio.checked = true;
      }
      if (data.budgetTier) {
        const radio = this.form.querySelector(`input[name="budgetTier"][value="${data.budgetTier}"]`);
        if (radio) radio.checked = true;
      }
      if (data.stage) {
        const radio = this.form.querySelector(`input[name="projectStage"][value="${data.stage}"]`);
        if (radio) radio.checked = true;
      }
      if (data.description) {
        const el = this.form.querySelector('#projectDescription');
        if (el) el.value = data.description;
      }
    } catch (e) {
      // ignore parsing error
    }
  }

  validate() {
    let isValid = true;

    // 1. Full Name
    const nameInput = this.form.querySelector('#fullName');
    const name = nameInput ? nameInput.value.trim() : '';
    if (!name || name.length < 2) {
      isValid = false;
      this.markInvalid(nameInput, 'Please enter your full name');
    }

    // 2. Phone / WhatsApp Number
    const phoneInput = this.form.querySelector('#phoneNumber');
    const phoneRaw = phoneInput ? phoneInput.value.replace(/\D/g, '') : '';
    const isValidPhone = phoneRaw.length === 10 || (phoneRaw.length === 12 && phoneRaw.startsWith('91'));
    if (!isValidPhone) {
      isValid = false;
      this.markInvalid(phoneInput, 'Please enter a valid 10-digit WhatsApp/mobile number');
    }

    // 2b. Email Address (Optional or validated if entered)
    const emailInput = this.form.querySelector('#emailAddress');
    const email = emailInput ? emailInput.value.trim() : '';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      isValid = false;
      this.markInvalid(emailInput, 'Please enter a valid email address');
    }

    // 3. Project Location
    const locInput = this.form.querySelector('#projectLocation');
    const location = locInput ? locInput.value.trim() : '';
    if (!location || location.length < 2) {
      isValid = false;
      this.markInvalid(locInput, 'Please specify project location (e.g. Alkapuri, Sevasi, Gotri, Vadodara)');
    }

    // 4. Property Type
    const propType = this.form.querySelector('input[name="propertyType"]:checked');
    if (!propType) {
      isValid = false;
      this.highlightGroup('propertyType', 'Please select property type');
    }

    // 5. Approximate Project Budget
    const budget = this.form.querySelector('input[name="budgetTier"]:checked');
    if (!budget) {
      isValid = false;
      this.highlightGroup('budgetTier', 'Please select approximate budget range');
    }

    // 6. Expected Project Start Date / Stage
    const stage = this.form.querySelector('input[name="projectStage"]:checked');
    if (!stage) {
      isValid = false;
      this.highlightGroup('projectStage', 'Please select project stage');
    }

    // 7. Optional Project Description (always valid)
    const descInput = this.form.querySelector('#projectDescription');
    const description = descInput ? descInput.value.trim() : '';

    if (!isValid) {
      const firstError = this.form.querySelector('.has-error, .is-invalid');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return null;
    }

    const payload = {
      name,
      email,
      phone: phoneRaw.length === 10 ? `+91 ${phoneRaw.slice(0, 5)} ${phoneRaw.slice(5)}` : `+${phoneRaw}`,
      phoneRaw,
      location,
      propertyType: propType.value,
      budgetTier: budget.value,
      stage: stage.value,
      description,
      submittedAt: new Date().toISOString()
    };

    this.saveDraft(payload);
    return payload;
  }

  async handleSubmit(e) {
    e.preventDefault();
    if (this.isSubmitting) return;

    const data = this.validate();
    if (!data) return;

    const submitBtn = this.form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Submit Form';

    // Show inline saving status
    this.isSubmitting = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <span class="spinner" style="display:inline-block; width:16px; height:16px; border:2px solid currentColor; border-right-color:transparent; border-radius:50%; animation:spin 0.75s linear infinite; margin-right:8px; vertical-align:middle;"></span>
        Saving Consultation Details...
      `;
    }

    // Capture marketing UTM parameters
    const urlParams = new URLSearchParams(window.location.search);
    const trackingPayload = {
      ...data,
      utm_source: urlParams.get('utm_source') || '',
      utm_medium: urlParams.get('utm_medium') || '',
      utm_campaign: urlParams.get('utm_campaign') || '',
      utm_content: urlParams.get('utm_content') || '',
      utm_term: urlParams.get('utm_term') || '',
      fbclid: urlParams.get('fbclid') || '',
      gclid: urlParams.get('gclid') || ''
    };

    try {
      // 1. Persist lead in Supabase BEFORE moving to payment step
      const res = await fetch('/api/leads/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trackingPayload)
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || result.message || 'Failed to save consultation details');
      }

      // Clear any previous error box
      const existingError = this.form.querySelector('.form-global-error');
      if (existingError) existingError.style.display = 'none';

      // Fire Meta Lead event
      Tracker.trackLead(data);

      const leadId = result.leadId || result.id;
      const bookingRef = result.bookingRef;

      if (typeof this.onSubmitSuccess === 'function') {
        this.onSubmitSuccess(data, leadId, bookingRef);
      }
    } catch (err) {
      console.error('[Lead Save Error]:', err);
      // Show non-destructive inline error (preserves all customer inputs)
      let errorBox = this.form.querySelector('.form-global-error');
      if (!errorBox) {
        errorBox = document.createElement('div');
        errorBox.className = 'form-global-error';
        errorBox.style.cssText = 'background: #FFF5F5; border: 1px solid #FEB2B2; color: #C53030; padding: 0.85rem 1rem; border-radius: 4px; margin-top: 1rem; font-size: 0.9rem; text-align: center;';
        const submitRow = this.form.querySelector('.form-submit-row');
        if (submitRow) submitRow.parentNode.insertBefore(errorBox, submitRow);
      }
      errorBox.innerHTML = `⚠️ Unable to securely save your booking details: <strong>${err.message}</strong>. Your information is preserved—please tap to retry.`;
      errorBox.style.display = 'block';
    } finally {
      this.isSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }
    }
  }
}
