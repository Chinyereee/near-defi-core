import { getState } from '../lib/api.js';
import { respond } from './_respond.js';

export default function handler(req, res) {
  return respond(res, () => getState());
}
