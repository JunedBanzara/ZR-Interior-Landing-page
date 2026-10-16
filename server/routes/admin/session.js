import { verifyAdminSession } from '../../auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const auth = verifyAdminSession(req);
  if (!auth.valid) {
    return res.status(401).json({ authenticated: false, error: auth.error });
  }

  return res.status(200).json({
    authenticated: true,
    user: auth.user
  });
}
