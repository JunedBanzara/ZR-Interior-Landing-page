export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Clear cookie
  res.setHeader(
    'Set-Cookie',
    'zr_admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0;'
  );

  return res.status(200).json({ success: true, message: 'Logged out successfully' });
}
