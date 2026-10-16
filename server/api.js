import createOrderHandler from './routes/razorpay/create-order.js';
import verifyPaymentHandler from './routes/razorpay/verify-payment.js';
import webhookHandler from './routes/razorpay/webhook.js';
import calendlyWebhookHandler from './routes/calendly/webhook.js';
import confirmAppointmentHandler from './routes/confirm-appointment.js';
import bookingHandler from './routes/booking.js';
import statusHandler from './routes/status.js';
import leadCaptureHandler from './routes/leads/capture.js';
import reconcileAbandonedHandler from './routes/leads/reconcile-abandoned.js';
import adminLoginHandler from './routes/admin/login.js';
import adminLogoutHandler from './routes/admin/logout.js';
import adminSessionHandler from './routes/admin/session.js';
import adminLeadsHandler from './routes/admin/leads.js';
import adminLeadActionHandler from './routes/admin/lead-action.js';
import adminExportHandler from './routes/admin/export.js';

export async function handleApiRequest(req, res) {
  // Ensure res has Vercel-like helper methods in Node/Vite middleware
  if (!res.status) {
    res.status = function(code) {
      this.statusCode = code;
      return this;
    };
  }
  if (!res.json) {
    res.json = function(data) {
      if (!this.headersSent) {
        this.setHeader('Content-Type', 'application/json');
      }
      this.end(JSON.stringify(data));
      return this;
    };
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  
  // Robust pathname detection across Vercel rewrite, Node.js, and Vite middleware
  let pathname = url.pathname;
  const matchedPathQuery = url.searchParams.get('_path');
  const matchedHeader = req.headers['x-matched-path'];

  if (matchedPathQuery) {
    pathname = matchedPathQuery.startsWith('/') ? `/api${matchedPathQuery}` : `/api/${matchedPathQuery}`;
  } else if (matchedHeader && matchedHeader.startsWith('/api/')) {
    pathname = matchedHeader.split('?')[0];
  }

  // Remove trailing slashes (except for exact '/')
  if (pathname.length > 5 && pathname.endsWith('/')) {
    pathname = pathname.replace(/\/+$/, '');
  }

  const method = req.method;

  if (method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Parse query string into req.query
  if (!req.query) {
    req.query = Object.fromEntries(url.searchParams.entries());
  } else {
    for (const [k, v] of url.searchParams.entries()) {
      if (k !== '_path' && !req.query[k]) {
        req.query[k] = v;
      }
    }
  }

  // Parse JSON Body for POST/PUT requests if not already parsed
  if (!req.body && (method === 'POST' || method === 'PUT')) {
    try {
      const rawBody = await getRawRequestBody(req);
      req.rawBody = rawBody;
      req.body = rawBody ? JSON.parse(rawBody) : {};
    } catch (e) {
      res.status(400).json({ error: 'Invalid JSON request body' });
      return;
    }
  } else if (typeof req.body === 'string' && req.body.trim().startsWith('{')) {
    try {
      req.rawBody = req.body;
      req.body = JSON.parse(req.body);
    } catch (e) {}
  }

  try {
    // 1. Status Check
    if (pathname === '/api/status') {
      return await statusHandler(req, res);
    }

    // 2. Lead Capture (Before Payment)
    if (pathname === '/api/leads/capture' || pathname === '/api/leads') {
      return await leadCaptureHandler(req, res);
    }

    // 3. Reconcile Abandoned Leads
    if (pathname === '/api/leads/reconcile-abandoned') {
      return await reconcileAbandonedHandler(req, res);
    }

    // 4. Admin Authentication
    if (pathname === '/api/admin/login') {
      return await adminLoginHandler(req, res);
    }
    if (pathname === '/api/admin/logout') {
      return await adminLogoutHandler(req, res);
    }
    if (pathname === '/api/admin/session') {
      return await adminSessionHandler(req, res);
    }

    // 5. Admin Leads Management & Actions
    if (pathname === '/api/admin/leads') {
      return await adminLeadsHandler(req, res);
    }
    if (pathname === '/api/admin/lead-action') {
      return await adminLeadActionHandler(req, res);
    }
    if (pathname === '/api/admin/export') {
      return await adminExportHandler(req, res);
    }

    // 6. Razorpay Order Creation (Supports both standard and namespaced paths)
    if (pathname === '/api/razorpay/create-order' || pathname === '/api/create-order') {
      return await createOrderHandler(req, res);
    }

    // 7. Razorpay Signature & Amount Verification
    if (pathname === '/api/razorpay/verify-payment' || pathname === '/api/verify-payment') {
      return await verifyPaymentHandler(req, res);
    }

    // 8. Razorpay Webhook
    if (pathname === '/api/razorpay/webhook') {
      return await webhookHandler(req, res);
    }

    // 9. Calendly Webhook
    if (pathname === '/api/calendly/webhook') {
      return await calendlyWebhookHandler(req, res);
    }

    // 10. Confirm Appointment
    if (pathname === '/api/confirm-appointment') {
      return await confirmAppointmentHandler(req, res);
    }

    // 11. Booking Details
    if (pathname.startsWith('/api/booking/')) {
      const id = pathname.replace('/api/booking/', '').replace(/^\/+/, '');
      req.query = { ...req.query, id };
      return await bookingHandler(req, res);
    }

    // Route not found
    res.status(404).json({ error: `API route not found: ${pathname}` });
  } catch (err) {
    console.error('[API Router Error]:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
  }
}

function getRawRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2e6) {
        req.socket.destroy();
        reject(new Error('Request entity too large'));
      }
    });
    req.on('end', () => {
      resolve(body);
    });
    req.on('error', (err) => reject(err));
  });
}
