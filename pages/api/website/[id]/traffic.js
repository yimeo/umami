import { getTrafficMetrics } from 'queries';
import { ok, badRequest, methodNotAllowed, unauthorized } from 'lib/response';
import { allowQuery } from 'lib/auth';
import { useCors } from 'lib/middleware';

export default async (req, res) => {
  if (req.method !== 'GET') {
    return methodNotAllowed(res);
  }

  await useCors(req, res);

  if (!(await allowQuery(req))) {
    return unauthorized(res);
  }

  const { id, type, start_at, end_at, domain } = req.query;
  const websiteId = Number(id);
  const startTime = Number(start_at);
  const endTime = Number(end_at);

  if (
    !Number.isInteger(websiteId) ||
    websiteId <= 0 ||
    !['domain', 'page'].includes(type) ||
    !Number.isFinite(startTime) ||
    !Number.isFinite(endTime) ||
    startTime > endTime ||
    (domain !== undefined && (typeof domain !== 'string' || domain.length > 512))
  ) {
    return badRequest(res);
  }

  const data = await getTrafficMetrics(
    websiteId,
    new Date(startTime),
    new Date(endTime),
    type,
    type === 'page' ? domain : undefined,
  );

  return ok(res, data);
};
