/**
 * ZR INTERIOR DESIGN — PROJECTS SHOWCASE & REVIEWS CAROUSEL
 * Handles real project gallery transitions and client reviews carousel strictly from FinalImages.
 */

export const PROJECTS_DATA = [
  {
    id: "living-room-sketch",
    title: "Contemporary Living Room — Sketch to Reality",
    category: "Residential · Architectural Living Space",
    location: "Vadodara, Gujarat",
    area: "3,200 sq. ft.",
    timeline: "5 Months",
    image: "/assets/images/FinalImages/Sketch%20to%20Reality_%20Modern%20Living%20Room.png",
    description: "From initial hand-drawn architectural perspective sketch to built reality. Featuring custom warm fluted wood louvers, integrated LED coves, Italian marble TV feature wall, and bespoke floating cabinetry.",
    highlights: [
      "Exact translation from hand perspective drawing to finished space",
      "Custom fluted wood acoustic partitions with integrated LED strips",
      "Monolithic Italian marble slab TV feature console",
      "Seamless neutral porcelain floor tiling with warm ambient illumination"
    ]
  },
  {
    id: "sevasi-penthouse",
    title: "Sevasi Penthouse Master Suite",
    category: "Residential · Luxury Penthouse",
    location: "Sevasi, Vadodara",
    area: "4,400 sq. ft.",
    timeline: "5 Months",
    image: "/assets/images/FinalImages/project-penthouse.jpg",
    description: "An editorial master suite and terrace lounge for a top-floor penthouse. Rich ribbed walnut accents, concealed cove illumination, acoustic fabric bed headboard wall, and custom glass-enclosed walk-in wardrobe.",
    highlights: [
      "Custom fluted walnut wood joinery crafted by in-house team",
      "Acoustic fabric wall integration with brushed bronze sconces",
      "Walk-in wardrobe with smoked glass sliding partitions & sensor lighting",
      "Natural hardwood engineered flooring with low VOC matte finish"
    ]
  },
  {
    id: "bedroom-comparison",
    title: "Architectural Bedroom Suite — Plan to Render",
    category: "Residential · Master Suite & Joinery",
    location: "Alkapuri, Vadodara",
    area: "2,800 sq. ft.",
    timeline: "4 Months",
    image: "/assets/images/FinalImages/Architectural%20Bedroom%20Plan%20and%20Render%20Comparison.png",
    description: "Side-by-side comparison of technical CAD plan view, elevations A, B, C, D, and the fully rendered master suite. Demonstrating millimetre-level precision in wardrobe joinery, study console, and cove lighting.",
    highlights: [
      "Complete CAD plan view and elevations A, B, C, D documentation",
      "Integrated floor-to-ceiling wardrobe with vertical LED display shelving",
      "Minimalist floating study desk with fluted timber back-panel",
      "Layered perimeter cove and pendant lighting balance"
    ]
  },
  {
    id: "kitchen-comparison",
    title: "Gourmet Waterfall Island Kitchen — Plan to Reality",
    category: "Residential · Modular & Turnkey Kitchen",
    location: "Vasna-Bhayli Road, Vadodara",
    area: "1,850 sq. ft.",
    timeline: "3.5 Months",
    image: "/assets/images/FinalImages/From%20Plan%20to%20Luxury%20Kitchen.png",
    description: "Complete architectural plan view and side elevations translated into an illuminated waterfall marble island, fluted bar counter, premium appliance wall, and custom dropped timber ceiling canopy.",
    highlights: [
      "Technical kitchen plan view and island elevation drawings",
      "Monolithic marble waterfall island with fluted timber front apron",
      "Concealed LED under-cabinet illumination & pendant fixtures",
      "Integrated appliance tower wall and hidden utility access"
    ]
  },
  {
    id: "apartment-residence",
    title: "Open-Plan Living & Dining Residence",
    category: "Residential · 4BHK Apartment",
    location: "Gotri, Vadodara",
    area: "2,650 sq. ft.",
    timeline: "4.5 Months",
    image: "/assets/images/FinalImages/project-apartment.jpg",
    description: "Warm minimalist open-concept living and dining with curved lime-wash plaster architectural walls, monolithic quartzite kitchen island, natural oak cabinetry, and integrated dining nook.",
    highlights: [
      "Curved sculptural architectural wall transitions",
      "Waterfall island in monolithic Cristallo Quartzite",
      "Natural white oak fluted cabinetry with invisible hardware",
      "Recessed architectural lighting layout optimized for art displays"
    ]
  }
];

export const REVIEWS_DATA = [
  {
    id: 1,
    quote: "Mr. Zuber's ability to translate our raw 4BHK floor plan into a cohesive, warm home was exceptional. The finish of the woodwork and Italian stone detailing exceeded what we envisioned during 3D reviews.",
    clientName: "Dr. & Mrs. R. Patel",
    projectType: "4BHK Luxury Apartment, Vasna",
    verifiedLocation: "Vadodara"
  },
  {
    id: 2,
    quote: "From the initial design drawings to the final day of handover, the in-house execution team handled every site challenge seamlessly. A truly dependable turnkey experience in Vadodara.",
    clientName: "Mr. H. Shah",
    projectType: "Private Villa, Alkapuri",
    verifiedLocation: "Vadodara"
  },
  {
    id: 3,
    quote: "The 30-minute consultation gave us complete clarity on our budget allocation and space planning. Seeing the exact materials and realistic execution schedule gave us immense confidence.",
    clientName: "Mrs. S. Desai",
    projectType: "Penthouse Residence, Sevasi",
    verifiedLocation: "Vadodara"
  }
];

/**
 * Projects Gallery Carousel / Swipe Component
 */
export class ProjectsCarousel {
  constructor(containerEl) {
    this.container = containerEl;
    if (!this.container) return;

    this.currentIndex = 0;
    this.slides = this.container.querySelectorAll('.project-slide');
    this.total = this.slides.length;
    this.counterEl = this.container.querySelector('.projects-counter');
    this.prevBtn = this.container.querySelector('.projects-prev-btn');
    this.nextBtn = this.container.querySelector('.projects-next-btn');
    this.track = this.container.querySelector('.projects-slider-track');
    this.dotsContainer = this.container.querySelector('.projects-dots');

    this.touchStartX = 0;
    this.touchEndX = 0;

    this.init();
  }

  init() {
    if (this.total === 0) return;

    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', () => this.prev());
    }
    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', () => this.next());
    }

    // Touch Swipe Support
    if (this.track) {
      this.track.addEventListener('touchstart', (e) => {
        this.touchStartX = e.changedTouches[0].screenX;
      }, { passive: true });

      this.track.addEventListener('touchend', (e) => {
        this.touchEndX = e.changedTouches[0].screenX;
        this.handleSwipe();
      }, { passive: true });
    }

    // Keyboard navigation
    this.container.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') this.prev();
      if (e.key === 'ArrowRight') this.next();
    });

    this.update();
  }

  handleSwipe() {
    const diff = this.touchStartX - this.touchEndX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        this.next();
      } else {
        this.prev();
      }
    }
  }

  goTo(index) {
    this.currentIndex = (index + this.total) % this.total;
    this.update();
  }

  next() {
    this.goTo(this.currentIndex + 1);
  }

  prev() {
    this.goTo(this.currentIndex - 1);
  }

  update() {
    this.slides.forEach((slide, idx) => {
      slide.classList.toggle('is-active', idx === this.currentIndex);
    });

    if (this.counterEl) {
      this.counterEl.textContent = `0${this.currentIndex + 1} / 0${this.total}`;
    }

    if (this.dotsContainer) {
      const dots = this.dotsContainer.querySelectorAll('.projects-dot');
      dots.forEach((dot, idx) => {
        dot.classList.toggle('is-active', idx === this.currentIndex);
      });
    }

    if (this.track) {
      this.track.style.transform = `translateX(-${this.currentIndex * 100}%)`;
    }
  }
}

/**
 * Three-Slide Client Reviews Carousel
 * STRICT REQUIREMENT:
 * 1. Exactly 3 slides
 * 2. Mobile touch swiping
 * 3. Third slide is FINAL slide (do NOT loop back to first)
 * 4. Autoplay disabled
 */
export class ReviewsCarousel {
  constructor(containerEl) {
    this.container = containerEl;
    if (!this.container) return;

    this.currentIndex = 0;
    this.slides = this.container.querySelectorAll('.review-slide');
    this.total = this.slides.length; // strictly 3
    this.counterEl = this.container.querySelector('.reviews-counter');
    this.prevBtn = this.container.querySelector('.reviews-prev-btn');
    this.nextBtn = this.container.querySelector('.reviews-next-btn');
    this.track = this.container.querySelector('.reviews-track');
    this.dotsContainer = this.container.querySelector('.reviews-dots');

    this.touchStartX = 0;
    this.touchEndX = 0;

    this.init();
  }

  init() {
    if (this.total === 0) return;

    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', () => this.prev());
    }
    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', () => this.next());
    }

    // Touch Swipe Support
    if (this.track) {
      this.track.addEventListener('touchstart', (e) => {
        this.touchStartX = e.changedTouches[0].screenX;
      }, { passive: true });

      this.track.addEventListener('touchend', (e) => {
        this.touchEndX = e.changedTouches[0].screenX;
        this.handleSwipe();
      }, { passive: true });
    }

    // Keyboard navigation
    this.container.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') this.prev();
      if (e.key === 'ArrowRight') this.next();
    });

    this.update();
  }

  handleSwipe() {
    const diff = this.touchStartX - this.touchEndX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        // Swipe left -> next slide
        this.next();
      } else {
        // Swipe right -> prev slide
        this.prev();
      }
    }
  }

  goTo(index) {
    // STRICT RULE: CLAMP BETWEEN 0 AND TOTAL - 1 (NO LOOPING!)
    if (index < 0) {
      this.currentIndex = 0;
    } else if (index >= this.total) {
      this.currentIndex = this.total - 1; // Stay at slide 3
    } else {
      this.currentIndex = index;
    }
    this.update();
  }

  next() {
    if (this.currentIndex < this.total - 1) {
      this.goTo(this.currentIndex + 1);
    }
  }

  prev() {
    if (this.currentIndex > 0) {
      this.goTo(this.currentIndex - 1);
    }
  }

  update() {
    this.slides.forEach((slide, idx) => {
      const isActive = idx === this.currentIndex;
      slide.classList.toggle('is-active', isActive);
      slide.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    });

    if (this.counterEl) {
      this.counterEl.textContent = `0${this.currentIndex + 1} / 0${this.total}`;
    }

    if (this.dotsContainer) {
      const dots = this.dotsContainer.querySelectorAll('.review-dot');
      dots.forEach((dot, idx) => {
        dot.classList.toggle('is-active', idx === this.currentIndex);
      });
    }

    // Button states (disable boundary buttons)
    if (this.prevBtn) {
      this.prevBtn.disabled = this.currentIndex === 0;
      this.prevBtn.setAttribute('aria-disabled', this.currentIndex === 0 ? 'true' : 'false');
    }
    if (this.nextBtn) {
      this.nextBtn.disabled = this.currentIndex === this.total - 1;
      this.nextBtn.setAttribute('aria-disabled', this.currentIndex === this.total - 1 ? 'true' : 'false');
    }

    if (this.track) {
      this.track.style.transform = `translateX(-${this.currentIndex * 100}%)`;
    }
  }
}

/**
 * Project Details Lightbox Modal
 */
export class ProjectModal {
  constructor() {
    this.modalEl = null;
    this.init();
  }

  init() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-project-id]');
      if (btn) {
        e.preventDefault();
        const projectId = btn.getAttribute('data-project-id');
        this.open(projectId);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modalEl) {
        this.close();
      }
    });
  }

  open(projectId) {
    const project = PROJECTS_DATA.find(p => p.id === projectId);
    if (!project) return;

    this.close();

    const overlay = document.createElement('div');
    overlay.className = 'project-modal-backdrop';
    overlay.innerHTML = `
      <div class="project-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <button type="button" class="project-modal-close" aria-label="Close project view">&times;</button>
        <div class="project-modal-grid">
          <div class="project-modal-media">
            <img src="${project.image}" alt="${project.title}" loading="lazy" />
          </div>
          <div class="project-modal-info">
            <span class="eyebrow">${project.category}</span>
            <h3 id="modalTitle" style="font-size: 1.75rem; margin: 0.5rem 0 1rem;">${project.title}</h3>
            <p style="color: var(--color-text-body); font-size: 0.95rem; margin-bottom: 1.5rem; line-height: 1.6;">
              ${project.description}
            </p>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; padding: 1rem 0; border-top: 1px solid var(--border-subtle); border-bottom: 1px solid var(--border-subtle); margin-bottom: 1.5rem;">
              <div>
                <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-text-muted); display: block;">Location</span>
                <strong style="font-size: 0.9rem;">${project.location}</strong>
              </div>
              <div>
                <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-text-muted); display: block;">Scale</span>
                <strong style="font-size: 0.9rem;">${project.area}</strong>
              </div>
            </div>
            <h4 style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-bronze); margin-bottom: 0.75rem;">
              Execution Highlights
            </h4>
            <ul style="list-style: none; padding: 0; margin: 0 0 2rem; display: flex; flex-direction: column; gap: 0.5rem;">
              ${project.highlights.map(h => `
                <li style="font-size: 0.85rem; color: var(--color-text-body); display: flex; align-items: flex-start; gap: 0.5rem;">
                  <span style="color: var(--color-bronze); line-height: 1.2;">▪</span>
                  <span>${h}</span>
                </li>
              `).join('')}
            </ul>
            <button type="button" class="btn btn-primary btn-block" data-action="book-consultation" onclick="document.querySelector('.project-modal-backdrop')?.remove();">
              BOOK MY CONSULTATION — ₹199
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.modalEl = overlay;
    document.body.style.overflow = 'hidden';

    overlay.querySelector('.project-modal-close').addEventListener('click', () => this.close());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });
  }

  close() {
    if (this.modalEl) {
      this.modalEl.remove();
      this.modalEl = null;
      document.body.style.overflow = '';
    }
  }
}
