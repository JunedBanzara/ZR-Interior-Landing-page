/**
 * ZR INTERIOR DESIGN — META ADS TRACKING MODULE
 * Supports Meta Pixel & Conversions API standard conversion events:
 * - PageView
 * - ViewContent
 * - Lead
 * - InitiateCheckout
 * - Purchase (deduplicated by Order ID)
 * - Schedule (deduplicated by Booking ID)
 */

import { ZR_CONFIG } from './config.js';

class TrackingService {
  constructor() {
    this.pixelId = ZR_CONFIG.tracking.metaPixelId;
    this.debug = ZR_CONFIG.tracking.debugLogging;
    this.trackedPurchases = new Set();
    this.trackedSchedules = new Set();
    this.init();
  }

  init() {
    if (typeof window !== 'undefined') {
      this.track('PageView');
      if (this.debug) {
        console.log(`[ZR Tracking] Initialized Meta Tracking Engine`);
      }
    }
  }

  /**
   * Safe wrapper around window.fbq
   * @param {string} eventName Standard Meta Pixel event name
   * @param {object} params Event parameters
   */
  track(eventName, params = {}) {
    const timestamp = new Date().toISOString();

    if (this.debug) {
      console.groupCollapsed(`🎯 [Meta Conversion Event] ${eventName}`);
      console.log('Timestamp:', timestamp);
      console.log('Payload:', params);
      console.groupEnd();
    }

    // Standard Meta Pixel call
    if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
      try {
        if (Object.keys(params).length > 0) {
          window.fbq('track', eventName, params);
        } else {
          window.fbq('track', eventName);
        }
      } catch (err) {
        console.warn('[ZR Tracking] fbq error:', err);
      }
    }

    // Dispatch DOM event for custom integrations / dataLayer
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('zr_meta_conversion', {
          detail: { eventName, params, timestamp }
        })
      );

      if (window.dataLayer && Array.isArray(window.dataLayer)) {
        window.dataLayer.push({
          event: `meta_${eventName.toLowerCase()}`,
          ...params
        });
      }
    }
  }

  trackViewContent(contentName, category = 'Turnkey Interior') {
    this.track('ViewContent', {
      content_name: contentName,
      content_category: category,
      content_type: 'interior_design_service'
    });
  }

  trackLead(leadData) {
    this.track('Lead', {
      content_name: 'Project Qualification Form',
      property_type: leadData.propertyType,
      project_stage: leadData.projectStage,
      budget_tier: leadData.budgetTier,
      location: leadData.location || 'Vadodara',
      value: 0,
      currency: 'INR'
    });
  }

  trackInitiateCheckout(leadData) {
    this.track('InitiateCheckout', {
      content_name: '₹199 Consultation Checkout',
      value: ZR_CONFIG.consultation.price,
      currency: ZR_CONFIG.consultation.currency,
      num_items: 1,
      property_type: leadData?.propertyType || ''
    });
  }

  trackPurchase(orderId, leadData) {
    if (!orderId) return;
    // Deduplication check: Never fire Purchase twice for same order ID
    if (this.trackedPurchases.has(orderId)) {
      if (this.debug) console.log(`[ZR Tracking] Duplicate Purchase event suppressed for ${orderId}`);
      return;
    }

    this.trackedPurchases.add(orderId);

    this.track('Purchase', {
      content_name: '30-Minute Private Consultation Verified',
      value: ZR_CONFIG.consultation.price,
      currency: ZR_CONFIG.consultation.currency,
      order_id: orderId,
      status: 'verified_paid',
      property_type: leadData?.propertyType || ''
    });
  }

  trackSchedule(bookingData) {
    const key = `${bookingData.date}_${bookingData.timeSlot}`;
    if (this.trackedSchedules.has(key)) {
      if (this.debug) console.log(`[ZR Tracking] Duplicate Schedule event suppressed for ${key}`);
      return;
    }

    this.trackedSchedules.add(key);

    this.track('Schedule', {
      content_name: 'Consultation Appointment Confirmed',
      appointment_date: bookingData.date,
      appointment_time: bookingData.timeSlot,
      mode: bookingData.mode,
      value: ZR_CONFIG.consultation.price,
      currency: ZR_CONFIG.consultation.currency
    });
  }
}

export const Tracker = new TrackingService();
