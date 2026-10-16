import { handleApiRequest } from '../server/api.js';

export default async function handler(req, res) {
  return await handleApiRequest(req, res);
}
