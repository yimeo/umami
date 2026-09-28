import { rawQuery } from 'lib/db';

const domainExpression = `COALESCE(NULLIF(TRIM(session.hostname), ''), '(unknown)')`;

export async function getTrafficMetrics(websiteId, startDate, endDate, type, domain) {
  const labelExpression =
    type === 'domain'
      ? domainExpression
      : type === 'page'
      ? `CONCAT(${domainExpression}, COALESCE(NULLIF(TRIM(pageview.url), ''), '/'))`
      : null;

  if (!labelExpression) {
    throw new Error('Invalid traffic dimension');
  }

  const filterDomain = type === 'page' && domain !== undefined;
  const params = filterDomain
    ? [websiteId, startDate, endDate, domain]
    : [websiteId, startDate, endDate];

  return rawQuery(
    `
    select ${labelExpression} as label,
      count(*) as pageviews,
      count(distinct pageview.ip_hash) as ips
    from pageview
      inner join session on pageview.session_id = session.session_id
    where pageview.website_id = $1
      and pageview.created_at between $2 and $3
      ${filterDomain ? `and ${domainExpression} = $4` : ''}
    group by 1
    order by pageviews desc, label asc
    `,
    params,
  );
}
