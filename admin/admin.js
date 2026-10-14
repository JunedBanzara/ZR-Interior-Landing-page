/**
 * ZR INTERIOR DESIGN — ADMIN LEADS MANAGEMENT PORTAL JAVASCRIPT
 */

class AdminPortal {
  constructor() {
    this.currentPage = 1;
    this.currentLimit = 20;
    this.currentLeads = [];
    this.selectedLead = null;
    this.authToken = localStorage.getItem('zr_admin_token') || null;

    this.init();
  }

  async init() {
    this.bindEvents();
    await this.checkAuth();
  }

  bindEvents() {
    // 1. Login Form Submit
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    }

    // 2. Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }

    // 3. Search & Filters
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      let debounceTimer = null;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.currentPage = 1;
          this.loadLeads();
        }, 350);
      });
    }

    const filterPayment = document.getElementById('filterPaymentStatus');
    if (filterPayment) {
      filterPayment.addEventListener('change', () => {
        this.currentPage = 1;
        this.loadLeads();
      });
    }

    const filterFollowup = document.getElementById('filterFollowupStatus');
    if (filterFollowup) {
      filterFollowup.addEventListener('change', () => {
        this.currentPage = 1;
        this.loadLeads();
      });
    }

    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadLeads());
    }

    // 4. Pagination
    const prevBtn = document.getElementById('prevPageBtn');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (this.currentPage > 1) {
          this.currentPage--;
          this.loadLeads();
        }
      });
    }

    const nextBtn = document.getElementById('nextPageBtn');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.currentPage++;
        this.loadLeads();
      });
    }

    // 5. CSV Export
    const exportBtn = document.getElementById('exportCsvBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.handleExportCsv());
    }

    // 6. Abandoned Reconcile
    const reconcileBtn = document.getElementById('reconcileBtn');
    if (reconcileBtn) {
      reconcileBtn.addEventListener('click', () => this.handleReconcileAbandoned());
    }

    // 7. Modal Close
    const closeBtn = document.getElementById('closeModalBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeModal());
    }

    const modalOverlay = document.getElementById('leadDetailModal');
    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) this.closeModal();
      });
    }
  }

  /* ==========================================================================
     AUTHENTICATION & SESSION
     ========================================================================== */
  async checkAuth() {
    try {
      const res = await fetch('/api/admin/session', {
        headers: this.getAuthHeaders()
      });

      if (res.ok) {
        const data = await res.json();
        if (data.authenticated) {
          this.showDashboard();
          this.loadLeads();
          return;
        }
      }
    } catch (e) {}

    this.showLogin();
  }

  getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    return headers;
  }

  showLogin() {
    document.getElementById('loginView').style.display = 'flex';
    document.getElementById('dashboardView').style.display = 'none';
  }

  showDashboard() {
    document.getElementById('loginView').style.display = 'none';
    document.getElementById('dashboardView').style.display = 'block';
  }

  async handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const submitBtn = document.getElementById('loginSubmitBtn');
    const errorBox = document.getElementById('loginError');

    errorBox.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Verifying Credentials...';

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      this.authToken = data.token;
      if (data.token) {
        localStorage.setItem('zr_admin_token', data.token);
      }

      this.showDashboard();
      this.loadLeads();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Authenticate & Access Dashboard';
    }
  }

  async handleLogout() {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch (e) {}
    this.authToken = null;
    localStorage.removeItem('zr_admin_token');
    this.showLogin();
  }

  /* ==========================================================================
     DATA LOADING & RENDERING
     ========================================================================== */
  async loadLeads() {
    const tbody = document.getElementById('leadsTableBody');
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center" style="padding: 3rem 1rem; color: var(--color-text-muted);">
          <div class="spinner"></div> Retrieving live leads from database...
        </td>
      </tr>
    `;

    const search = document.getElementById('searchInput')?.value.trim() || '';
    const paymentStatus = document.getElementById('filterPaymentStatus')?.value || 'all';
    const followupStatus = document.getElementById('filterFollowupStatus')?.value || 'all';

    const params = new URLSearchParams({
      page: this.currentPage,
      limit: this.currentLimit,
      search,
      paymentStatus,
      followupStatus
    });

    try {
      const res = await fetch(`/api/admin/leads?${params.toString()}`, {
        headers: this.getAuthHeaders()
      });

      if (res.status === 401) {
        this.showLogin();
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load leads');
      }

      this.currentLeads = data.leads || [];

      // Update Database Status Badge
      const dbBadge = document.getElementById('dbStatusBadge');
      if (dbBadge && data.databaseType) {
        dbBadge.textContent = `● ${data.databaseType}`;
      }

      // Update KPI Cards
      if (data.counts) {
        document.getElementById('kpiTotalLeads').textContent = data.counts.totalLeads;
        document.getElementById('kpiUnpaidLeads').textContent = data.counts.unpaidLeads;
        document.getElementById('kpiPaidConsultations').textContent = data.counts.paidConsultations;
        document.getElementById('kpiFollowupsRequired').textContent = data.counts.followupsRequired;
      }

      // Update Pagination
      this.renderPagination(data.total, data.page, data.totalPages);

      // Render Table Rows
      this.renderTable(this.currentLeads);
    } catch (err) {
      console.error('[Load Leads Error]:', err);
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center" style="padding: 2.5rem 1rem; color: #F87171;">
            ⚠️ Error loading leads: ${err.message}
          </td>
        </tr>
      `;
    }
  }

  renderTable(leads) {
    const tbody = document.getElementById('leadsTableBody');
    if (!leads || leads.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center" style="padding: 3rem 1rem; color: var(--color-text-muted);">
            No consultation leads found matching current filters.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = leads.map(lead => {
      const formattedDate = new Date(lead.submitted_at || lead.created_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const paymentBadgeClass = `badge badge-${(lead.payment_status || 'pending').toLowerCase()}`;
      const followupBadgeClass = `badge badge-followup-${(lead.followup_status || 'not-contacted').toLowerCase().replace(/\s+/g, '-')}`;

      const phoneRaw = (lead.customer_phone_raw || lead.customer_phone || '').replace(/\D/g, '');
      const whatsAppNumber = phoneRaw.length === 10 ? `91${phoneRaw}` : phoneRaw;

      // Personalized WhatsApp follow-up message (non-fabricated, truthful context)
      const waMessage = encodeURIComponent(
        `Hello ${lead.customer_name},\n\nThank you for reaching out to ZR Interior Design regarding your ${lead.property_type || 'residential'} project in ${lead.project_location || 'Vadodara'}.\n\nWe noticed you submitted your consultation details to speak with Principal Designer Mr. Zuber Rafik Banzara. Would you like assistance in scheduling your 45-minute private consultation?\n\nBest regards,\nZR Interior Design Studio, Vadodara`
      );
      const waUrl = `https://wa.me/${whatsAppNumber}?text=${waMessage}`;

      return `
        <tr data-lead-id="${lead.id}">
          <td>
            <strong class="customer-name">${this.escape(lead.customer_name)}</strong>
            <div class="customer-meta">
              <a href="tel:${lead.customer_phone}">📞 ${this.escape(lead.customer_phone)}</a>
              ${lead.customer_email ? `<a href="mailto:${lead.customer_email}">✉️ ${this.escape(lead.customer_email)}</a>` : ''}
            </div>
            <span style="font-size: 0.72rem; color: var(--color-bronze-light); display: block; margin-top: 0.2rem;">
              Ref: ${this.escape(lead.booking_reference || lead.lead_id)}
            </span>
          </td>

          <td>
            <strong>${this.escape(lead.property_type || 'Unspecified')}</strong>
            <span style="display: block; font-size: 0.8rem; color: var(--color-text-muted);">
              📍 ${this.escape(lead.project_location || 'Vadodara')}
            </span>
          </td>

          <td>
            <span style="font-weight: 600; color: #FFFFFF; display: block;">${this.escape(lead.budget_tier || 'Not specified')}</span>
            <span style="font-size: 0.8rem; color: var(--color-text-muted);">
              Stage: ${this.escape(lead.project_stage || 'Planning')}
            </span>
          </td>

          <td>
            <span class="${paymentBadgeClass}">
              ${lead.payment_status === 'paid' ? '✓ PAID ₹199' : lead.payment_status.toUpperCase()}
            </span>
            ${lead.razorpay_order_id ? `<span style="display: block; font-size: 0.7rem; color: var(--color-text-muted); margin-top: 0.25rem;">Order: ${this.escape(lead.razorpay_order_id.slice(-8))}</span>` : ''}
          </td>

          <td>
            <select class="form-select form-select-sm followup-select" data-id="${lead.id}" style="padding: 0.35rem 0.6rem; font-size: 0.78rem;">
              <option value="Not Contacted" ${lead.followup_status === 'Not Contacted' ? 'selected' : ''}>Not Contacted</option>
              <option value="Contacted" ${lead.followup_status === 'Contacted' ? 'selected' : ''}>Contacted</option>
              <option value="Interested" ${lead.followup_status === 'Interested' ? 'selected' : ''}>Interested</option>
              <option value="Converted" ${lead.followup_status === 'Converted' ? 'selected' : ''}>Converted</option>
              <option value="Lost" ${lead.followup_status === 'Lost' ? 'selected' : ''}>Lost</option>
            </select>
            ${lead.last_contacted_at ? `<span style="display: block; font-size: 0.7rem; color: var(--color-text-muted); margin-top: 0.25rem;">Last: ${new Date(lead.last_contacted_at).toLocaleDateString('en-IN')}</span>` : ''}
          </td>

          <td>
            <span style="font-size: 0.8rem; color: var(--color-text-body);">${formattedDate}</span>
            ${lead.utm_source ? `<span style="display: block; font-size: 0.7rem; color: var(--color-bronze-light); margin-top: 0.2rem;">UTM: ${this.escape(lead.utm_source)}</span>` : ''}
          </td>

          <td>
            <div class="action-buttons">
              <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="btn-icon btn-whatsapp" title="Open WhatsApp chat with prefilled manual follow-up">
                💬 WhatsApp
              </a>
              <a href="tel:${lead.customer_phone}" class="btn-icon btn-call" title="Call Customer">
                📞 Call
              </a>
              <button type="button" class="btn-icon view-details-btn" data-id="${lead.id}" title="View full details and notes">
                👁️ View
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach row events
    tbody.querySelectorAll('.view-details-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const lead = this.currentLeads.find(l => l.id === id);
        if (lead) this.openModal(lead);
      });
    });

    tbody.querySelectorAll('.followup-select').forEach(select => {
      select.addEventListener('change', async (e) => {
        const id = select.getAttribute('data-id');
        const newStatus = select.value;
        await this.updateLeadStatus(id, newStatus);
      });
    });
  }

  renderPagination(total, page, totalPages) {
    const info = document.getElementById('paginationInfo');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const indicator = document.getElementById('currentPageIndicator');

    if (info) info.textContent = `Showing ${Math.min((page - 1) * this.currentLimit + 1, total)}–${Math.min(page * this.currentLimit, total)} of ${total} leads`;
    if (indicator) indicator.textContent = `Page ${page} of ${totalPages || 1}`;
    if (prevBtn) prevBtn.disabled = page <= 1;
    if (nextBtn) nextBtn.disabled = page >= totalPages;
  }

  /* ==========================================================================
     ACTIONS & CRM UPDATES
     ========================================================================== */
  async updateLeadStatus(leadId, newStatus) {
    try {
      const res = await fetch('/api/admin/lead-action', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          action: 'update_followup',
          leadId,
          followupStatus: newStatus,
          markContacted: newStatus === 'Contacted' || newStatus === 'Interested'
        })
      });

      if (res.ok) {
        // Quick feedback
        const lead = this.currentLeads.find(l => l.id === leadId);
        if (lead) {
          lead.followup_status = newStatus;
        }
      }
    } catch (e) {
      console.error('[Update Status Error]:', e);
    }
  }

  async openModal(lead) {
    this.selectedLead = lead;
    const modal = document.getElementById('leadDetailModal');
    const title = document.getElementById('modalLeadName');
    const sub = document.getElementById('modalLeadId');
    const content = document.getElementById('modalLeadContent');

    title.textContent = lead.customer_name;
    sub.textContent = `${lead.booking_reference || lead.lead_id} · Submitted ${new Date(lead.submitted_at || lead.created_at).toLocaleString('en-IN')}`;

    content.innerHTML = `
      <div class="modal-grid-2">
        <div class="detail-item">
          <strong>Phone / WhatsApp</strong>
          <span><a href="tel:${lead.customer_phone}" style="color:var(--color-bronze-light); text-decoration:none;">${this.escape(lead.customer_phone)}</a></span>
        </div>
        <div class="detail-item">
          <strong>Email Address</strong>
          <span>${lead.customer_email ? `<a href="mailto:${lead.customer_email}" style="color:var(--color-bronze-light); text-decoration:none;">${this.escape(lead.customer_email)}</a>` : 'Not provided'}</span>
        </div>
        <div class="detail-item">
          <strong>Project Location</strong>
          <span>${this.escape(lead.project_location || 'Vadodara')}</span>
        </div>
        <div class="detail-item">
          <strong>Property Type</strong>
          <span>${this.escape(lead.property_type || 'Unspecified')}</span>
        </div>
        <div class="detail-item">
          <strong>Budget Tier</strong>
          <span>${this.escape(lead.budget_tier || 'Unspecified')}</span>
        </div>
        <div class="detail-item">
          <strong>Project Stage</strong>
          <span>${this.escape(lead.project_stage || 'Planning')}</span>
        </div>
        <div class="detail-item">
          <strong>Payment Status</strong>
          <span style="font-weight:700; color:${lead.payment_status === 'paid' ? '#34D399' : '#FBBF24'}">
            ${lead.payment_status.toUpperCase()} ${lead.payment_verified_at ? `(Verified ${new Date(lead.payment_verified_at).toLocaleDateString('en-IN')})` : ''}
          </span>
        </div>
        <div class="detail-item">
          <strong>Razorpay IDs</strong>
          <span>Order: ${lead.razorpay_order_id || 'None'} | Payment: ${lead.razorpay_payment_id || 'None'}</span>
        </div>
      </div>

      ${lead.project_description ? `
      <div style="background:var(--bg-card); padding:1rem; border-radius:4px; margin-bottom:1.5rem; border:1px solid var(--border-subtle);">
        <strong style="display:block; font-size:0.75rem; color:var(--color-text-muted); text-transform:uppercase; margin-bottom:0.4rem;">Customer Project Requirements & Notes:</strong>
        <p style="font-size:0.9rem; color:#FFFFFF; font-style:italic;">"${this.escape(lead.project_description)}"</p>
      </div>
      ` : ''}

      <!-- Attribution Box -->
      ${lead.utm_source || lead.utm_campaign ? `
      <div style="background:rgba(197, 168, 128, 0.08); padding:0.85rem 1rem; border-radius:4px; margin-bottom:1.5rem; border:1px solid var(--border-accent); font-size:0.8rem;">
        <strong>Meta / Campaign Attribution:</strong> Source: <code>${this.escape(lead.utm_source || 'direct')}</code> | Medium: <code>${this.escape(lead.utm_medium || 'none')}</code> | Campaign: <code>${this.escape(lead.utm_campaign || 'none')}</code>
      </div>
      ` : ''}

      <!-- Internal CRM Notes & Status Form -->
      <div style="background:var(--bg-card); padding:1.25rem; border-radius:6px; border:1px solid var(--border-subtle);">
        <h4 style="font-size:1rem; margin-bottom:1rem; color:var(--color-bronze);">Update Follow-up & Internal Notes</h4>
        
        <div class="form-group">
          <label>Follow-up Status</label>
          <select id="modalFollowupStatus" class="form-select">
            <option value="Not Contacted" ${lead.followup_status === 'Not Contacted' ? 'selected' : ''}>Not Contacted</option>
            <option value="Contacted" ${lead.followup_status === 'Contacted' ? 'selected' : ''}>Contacted</option>
            <option value="Interested" ${lead.followup_status === 'Interested' ? 'selected' : ''}>Interested</option>
            <option value="Converted" ${lead.followup_status === 'Converted' ? 'selected' : ''}>Converted</option>
            <option value="Lost" ${lead.followup_status === 'Lost' ? 'selected' : ''}>Lost</option>
          </select>
        </div>

        <div class="form-group">
          <label>Add Activity Note</label>
          <textarea id="modalNewNote" class="form-input" rows="3" placeholder="Enter notes from call, discussion details, property visits..."></textarea>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
          <label style="font-size:0.85rem; color:var(--color-text-body); display:inline-flex; align-items:center; gap:0.4rem; cursor:pointer;">
            <input type="checkbox" id="modalMarkContacted" checked> Mark as Contacted Today
          </label>
          <button type="button" class="btn btn-primary btn-sm" id="modalSaveNoteBtn">
            Save Notes & Status
          </button>
        </div>
      </div>

      <!-- Activity Timeline -->
      <div class="activity-timeline">
        <h4 style="font-size:0.95rem; margin-bottom:1rem; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:0.04em;">Activity & Follow-Up History</h4>
        <div id="modalActivityLog">
          <div class="spinner"></div> Loading activity history...
        </div>
      </div>
    `;

    modal.style.display = 'flex';

    // Fetch Activity Logs
    this.loadActivityLogs(lead.id);

    // Save Button
    document.getElementById('modalSaveNoteBtn').addEventListener('click', async () => {
      const status = document.getElementById('modalFollowupStatus').value;
      const note = document.getElementById('modalNewNote').value.trim();
      const markContacted = document.getElementById('modalMarkContacted').checked;
      const btn = document.getElementById('modalSaveNoteBtn');

      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Saving...';

      try {
        await fetch('/api/admin/lead-action', {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({
            action: 'update_followup',
            leadId: lead.id,
            followupStatus: status,
            noteToAdd: note,
            internalNotes: note ? `${lead.internal_notes ? lead.internal_notes + '\n\n' : ''}[${new Date().toLocaleDateString('en-IN')}]: ${note}` : lead.internal_notes,
            markContacted
          })
        });

        this.closeModal();
        this.loadLeads();
      } catch (e) {
        alert('Failed to save notes: ' + e.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = 'Save Notes & Status';
      }
    });
  }

  async loadActivityLogs(leadId) {
    const container = document.getElementById('modalActivityLog');
    try {
      const res = await fetch('/api/admin/lead-action', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ action: 'get_logs', leadId })
      });

      const data = await res.json();
      if (!res.ok || !data.logs || data.logs.length === 0) {
        container.innerHTML = '<span style="font-size:0.8rem; color:var(--color-text-muted);">No activity history recorded yet.</span>';
        return;
      }

      container.innerHTML = data.logs.map(log => `
        <div class="timeline-item">
          <span class="timeline-date">${new Date(log.created_at).toLocaleString('en-IN')} · By ${this.escape(log.author || 'System')}</span>
          <p class="timeline-note">${this.escape(log.note || log.action_type)}</p>
        </div>
      `).join('');
    } catch (e) {
      container.innerHTML = '<span style="font-size:0.8rem; color:#F87171;">Error loading activity history.</span>';
    }
  }

  closeModal() {
    const modal = document.getElementById('leadDetailModal');
    if (modal) modal.style.display = 'none';
    this.selectedLead = null;
  }

  async handleExportCsv() {
    const btn = document.getElementById('exportCsvBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Generating CSV...';

    try {
      const res = await fetch('/api/admin/export', {
        headers: this.getAuthHeaders()
      });

      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zr-interior-leads-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert('CSV Export error: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }

  async handleReconcileAbandoned() {
    if (!confirm('Reconcile pending checkouts older than 30 minutes to "abandoned"? (Verified paid records will never be affected).')) {
      return;
    }

    const btn = document.getElementById('reconcileBtn');
    btn.disabled = true;

    try {
      const res = await fetch('/api/admin/lead-action', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ action: 'reconcile_abandoned', thresholdMinutes: 30 })
      });

      const data = await res.json();
      alert(`Reconciliation complete. Updated ${data.reconciledCount || 0} pending leads to abandoned.`);
      this.loadLeads();
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      btn.disabled = false;
    }
  }

  escape(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new AdminPortal();
});
