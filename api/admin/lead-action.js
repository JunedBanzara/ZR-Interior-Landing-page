import { verifyAdminSession } from '../../server/auth.js';
import { DB } from '../../server/db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }
    }
    body = body || {};

    const { action, leadId } = body;

    // Action 1: Get activity logs for lead
    if (action === 'get_logs') {
      if (!leadId) return res.status(400).json({ error: 'leadId is required' });
      const logs = await DB.getLeadActivityLogs(leadId);
      return res.status(200).json({ success: true, logs });
    }

    // Action 2: Update follow-up status or internal notes
    if (action === 'update_followup') {
      if (!leadId) return res.status(400).json({ error: 'leadId is required' });

      const updated = await DB.updateLeadFollowup(leadId, {
        followupStatus: body.followupStatus,
        internalNotes: body.internalNotes,
        lastContactedAt: body.markContacted ? new Date().toISOString() : body.lastContactedAt,
        author: auth.user.username || 'Staff',
        noteToAdd: body.noteToAdd
      });

      if (!updated) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      return res.status(200).json({ success: true, lead: updated });
    }

    // Action 3: Trigger abandoned leads reconciliation
    if (action === 'reconcile_abandoned') {
      const result = await DB.reconcileAbandonedLeads(body.thresholdMinutes || 30);
      return res.status(200).json({ success: true, ...result });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err) {
    console.error('[Admin Action Error]:', err);
    return res.status(500).json({ error: 'Failed to process admin action', message: err.message });
  }
}
