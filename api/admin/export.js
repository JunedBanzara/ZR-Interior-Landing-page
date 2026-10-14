import { verifyAdminSession } from '../../server/auth.js';
import { DB } from '../../server/db.js';

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
    return res.status(401).json({ error: 'Unauthorized. Admin authentication required.' });
  }

  try {
    const csvData = await DB.exportLeadsCsv();
    const filename = `zr-interior-leads-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvData);
  } catch (err) {
    console.error('[CSV Export Error]:', err);
    return res.status(500).json({ error: 'Failed to export CSV', message: err.message });
  }
}
