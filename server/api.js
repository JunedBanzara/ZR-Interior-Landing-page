import createOrderHandler from '../api/razorpay/create-order.js';
import verifyPaymentHandler from '../api/razorpay/verify-payment.js';
import webhookHandler from '../api/razorpay/webhook.js';
import calendlyWebhookHandler from '../api/calendly/webhook.js';
import confirmAppointmentHandler from '../api/confirm-appointment.js';
import bookingHandler from '../api/booking/[id].js';
import statusHandler from '../api/status.js';

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
  const pathname = url.pathname;
  const method = req.method;

  if (method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Parse JSON Body for POST/PUT requests if not already parsed
  if (!req.body && (method === 'POST' || method === 'PUT')) {
    try {
      req.body = await parseJsonBody(req);
    } catch (e) {
      res.status(400).json({ error: 'Invalid JSON request body' });
      return;
    }
  }

  try {
    // 1. Status Check
    if (pathname === '/api/status') {
      return await statusHandler(req, res);
    }

    // 2. Razorpay Order Creation (Supports both standard and namespaced paths)
    if (pathname === '/api/razorpay/create-order' || pathname === '/api/create-order') {
      return await createOrderHandler(req, res);
    }

    // 3. Razorpay Signature & Amount Verification
    if (pathname === '/api/razorpay/verify-payment' || pathname === '/api/verify-payment') {
      return await verifyPaymentHandler(req, res);
    }

    // 4. Razorpay Webhook
    if (pathname === '/api/razorpay/webhook') {
      return await webhookHandler(req, res);
    }

    // 5. Calendly Webhook
    if (pathname === '/api/calendly/webhook') {
      return await calendlyWebhookHandler(req, res);
    }

    // 6. Confirm Appointment
    if (pathname === '/api/confirm-appointment') {
      return await confirmAppointmentHandler(req, res);
    }

    // 7. Booking Details
    if (pathname.startsWith('/api/booking/')) {
      const id = pathname.replace('/api/booking/', '');
      req.query = { id };
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

function parseJsonBody(req) {
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
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', (err) => reject(err));
  });
}
