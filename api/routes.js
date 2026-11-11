import { getRoutes, routeParams } from '../lib/api.js';
import { respond } from './_respond.js';

export default function handler(req, res) {
  return respond(res, () => getRoutes(routeParams(req.query || {})));
}
