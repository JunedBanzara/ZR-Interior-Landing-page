import { authenticateAdmin, createAdminToken } from '../../auth.js';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON request body' });
      }
    }
    body = body || {};

    const { username, password } = body;
    const authResult = await authenticateAdmin(username, password);

    if (!authResult.success) {
      return res.status(401).json({ error: authResult.message || 'Authentication failed' });
    }

    const token = createAdminToken(authResult.user);

    // Set secure HttpOnly cookie
    res.setHeader(
      'Set-Cookie',
      `zr_admin_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400; ${
        process.env.NODE_ENV === 'production' ? 'Secure;' : ''
      }`
    );

    return res.status(200).json({
      success: true,
      token,
      user: authResult.user,
      expiresIn: 86400
    });
  } catch (err) {
    console.error('[Admin Login Error]:', err);
    return res.status(500).json({ error: 'Internal login error', message: err.message });
  }
}
