import { verifyAdminSession } from '../../auth.js';
import { DB } from '../../db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 1. Authorization Gate
  const auth = verifyAdminSession(req);
  if (!auth.valid) {
    return res.status(401).json({ error: 'Unauthorized. Admin authentication required.', details: auth.error });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      paymentStatus = 'all',
      followupStatus = 'all',
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query || {};

    const result = await DB.getLeadsAdmin({
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
      search,
      paymentStatus,
      followupStatus,
      sortBy,
      sortOrder
    });

    return res.status(200).json({
      success: true,
      ...result,
      databaseType: DB.isSupabaseConfigured() ? 'Supabase PostgreSQL' : 'Local Storage Fallback'
    });
  } catch (err) {
    console.error('[Admin Leads Query Error]:', err);
    return res.status(500).json({ error: 'Failed to retrieve leads', message: err.message });
  }
}
