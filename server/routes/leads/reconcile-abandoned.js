import { DB } from '../../db.js';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
  }

  try {
    const thresholdMinutes = Number(req.query?.thresholdMinutes || req.body?.thresholdMinutes) || 30;
    const result = await DB.reconcileAbandonedLeads(thresholdMinutes);

    return res.status(200).json({
      success: true,
      message: `Reconciled abandoned leads older than ${thresholdMinutes} minutes`,
      reconciledCount: result.reconciledCount,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[Reconcile Abandoned Error]:', err);
    return res.status(500).json({ error: 'Failed to reconcile abandoned leads', message: err.message });
  }
}
