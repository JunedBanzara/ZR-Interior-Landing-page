/**
 * ZR INTERIOR DESIGN — MAIN APPLICATION CONTROLLER
 */

import { ZR_CONFIG } from './config.js';
import { Tracker } from './tracking.js';
import { QualificationForm } from './form.js';
import { BookingFunnel } from './booking.js';
import { ProjectModal, ProjectsCarousel, ReviewsCarousel } from './gallery.js';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Project Gallery Lightbox
  const projectModal = new ProjectModal();

  // 2. Initialize Projects Interactive Carousel
  const projectsCarouselEl = document.getElementById('projectsSliderWrapper');
  if (projectsCarouselEl) {
    new ProjectsCarousel(projectsCarouselEl);
  }

  // 3. Initialize 3-Slide Client Reviews Carousel (Non-looping, no autoplay)
  const reviewsCarouselEl = document.getElementById('reviewsCarouselWrapper');
  if (reviewsCarouselEl) {
    new ReviewsCarousel(reviewsCarouselEl);
  }

  // 4. Initialize Booking Funnel Engine
  const funnelContainer = document.getElementById('funnelContainer');
  let bookingFunnel = null;
  if (funnelContainer) {
    bookingFunnel = new BookingFunnel(funnelContainer);
  }

  // 5. Initialize Qualification Form (7 Fields)
  const qualificationFormEl = document.getElementById('projectQualificationForm');
  if (qualificationFormEl && bookingFunnel) {
    new QualificationForm(qualificationFormEl, (leadData, leadId, bookingRef) => {
      bookingFunnel.setLeadData(leadData, leadId, bookingRef);
    });
  }

  // 6. CTA Smooth Scroll Handlers
  document.querySelectorAll('[data-action="book-consultation"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById('qualification-form-section') || document.getElementById('consultation');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
        // Focus first input
        setTimeout(() => {
          const firstInput = document.getElementById('fullName');
          if (firstInput) firstInput.focus();
        }, 500);
      }
    });
  });

  // 7. Scroll to Projects
  document.querySelectorAll('[data-action="explore-projects"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById('projects');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // 8. FAQ Accordion Interaction
  document.querySelectorAll('.faq-trigger').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const item = trigger.closest('.faq-item');
      const content = item.querySelector('.faq-content');
      const isOpen = item.classList.contains('is-open');

      // Close all items
      document.querySelectorAll('.faq-item').forEach((i) => {
        i.classList.remove('is-open');
        const c = i.querySelector('.faq-content');
        if (c) c.style.maxHeight = null;
      });

      // Toggle current item
      if (!isOpen) {
        item.classList.add('is-open');
        content.style.maxHeight = content.scrollHeight + 'px';
      }
    });
  });

  // Open first FAQ by default
  const firstFaq = document.querySelector('.faq-item');
  if (firstFaq) {
    firstFaq.classList.add('is-open');
    const firstContent = firstFaq.querySelector('.faq-content');
    if (firstContent) {
      firstContent.style.maxHeight = firstContent.scrollHeight + 'px';
    }
  }

  // 9. Scroll Reveal Observer
  const revealElements = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    revealElements.forEach((el) => revealObserver.observe(el));
  } else {
    revealElements.forEach((el) => el.classList.add('is-visible'));
  }

  // 10. Sticky Mobile Consultation Bar Visibility
  const stickyBar = document.getElementById('stickyMobileCta');
  const heroSection = document.querySelector('.hero-section');
  const consultationSection = document.getElementById('qualification-form-section') || document.getElementById('consultation');

  if (stickyBar && heroSection && consultationSection && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      () => {
        const heroBottom = heroSection.getBoundingClientRect().bottom;
        const consultTop = consultationSection.getBoundingClientRect().top;
        const consultBottom = consultationSection.getBoundingClientRect().bottom;

        // Show when scrolled past hero, hide when viewing consultation form or after
        const isPastHero = heroBottom < 0;
        const isOverConsultation = consultTop < window.innerHeight && consultBottom > 0;

        if (isPastHero && !isOverConsultation) {
          stickyBar.classList.add('is-active');
        } else {
          stickyBar.classList.remove('is-active');
        }
      },
      { threshold: [0, 0.5, 1] }
    );

    window.addEventListener('scroll', () => {
      const heroBottom = heroSection.getBoundingClientRect().bottom;
      const consultTop = consultationSection.getBoundingClientRect().top;
      const consultBottom = consultationSection.getBoundingClientRect().bottom;

      const isPastHero = heroBottom < 0;
      const isOverConsultation = consultTop < window.innerHeight && consultBottom > 0;

      if (isPastHero && !isOverConsultation) {
        stickyBar.classList.add('is-active');
      } else {
        stickyBar.classList.remove('is-active');
      }
    }, { passive: true });
  }
});
