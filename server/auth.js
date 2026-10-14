import crypto from 'crypto';
import { DB } from './db.js';

const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 Hours

function getSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.RAZORPAY_KEY_SECRET ||
    'zr_interior_admin_secure_session_secret_2026'
  );
}

/**
 * Creates an HMAC-SHA256 signed session token
 */
export function createAdminToken(user) {
  const payload = {
    username: user.username || 'admin',
    role: user.role || 'admin',
    exp: Date.now() + SESSION_EXPIRY_MS
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSecret())
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
}

/**
 * Validates a session token
 */
export function verifyAdminToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', getSecret())
    .update(payloadB64)
    .digest('base64url');

  const expectedBuf = Buffer.from(expectedSignature, 'utf8');
  const providedBuf = Buffer.from(signature, 'utf8');

  if (expectedBuf.length !== providedBuf.length || !crypto.timingSafeEqual(expectedBuf, providedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) {
      return null; // Expired
    }
    return payload;
  } catch (e) {
    return null;
  }
}

/**
 * Verifies admin session from cookie or Authorization header
 */
export function verifyAdminSession(req) {
  let token = null;

  // 1. Check Authorization Bearer header
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  // 2. Check cookie if header not present
  if (!token && req.headers['cookie']) {
    const cookies = req.headers['cookie'].split(';');
    for (const c of cookies) {
      const [k, v] = c.trim().split('=');
      if (k === 'zr_admin_session' && v) {
        token = decodeURIComponent(v);
        break;
      }
    }
  }

  if (!token) return { valid: false, error: 'No session token provided' };

  const session = verifyAdminToken(token);
  if (!session) {
    return { valid: false, error: 'Invalid or expired session token' };
  }

  return { valid: true, user: session };
}

/**
 * Authenticates admin credentials
 */
export async function authenticateAdmin(username, password) {
  if (!username || !password) return { success: false, message: 'Username and password required' };

  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD;

  // 1. Check environment variable credentials
  if (adminPass) {
    if (username.trim().toLowerCase() === adminUser.toLowerCase() && password === adminPass) {
      return { success: true, user: { username: adminUser, role: 'admin' } };
    }
  } else {
    // If ADMIN_PASSWORD is not set in env yet, fallback to local default for initial setup
    if (username.trim().toLowerCase() === 'admin' && password === 'ZRAdmin@2026!') {
      return { success: true, user: { username: 'admin', role: 'admin' } };
    }
  }

  // 2. Check Supabase admin_users table if Supabase is configured
  const supabase = DB.getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('username', username.trim())
        .eq('is_active', true)
        .maybeSingle();

      if (!error && data) {
        // Simple hash comparison (SHA256 with salt or plain hash)
        const [salt, storedHash] = (data.password_hash || '').split(':');
        if (salt && storedHash) {
          const testHash = crypto.createHmac('sha256', salt).update(password).digest('hex');
          if (testHash === storedHash) {
            return { success: true, user: { username: data.username, role: data.role || 'admin' } };
          }
        }
      }
    } catch (e) {
      console.warn('[Admin Auth DB Error]:', e.message);
    }
  }

  return { success: false, message: 'Invalid admin username or password' };
}
