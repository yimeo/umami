import React, { useMemo, useState, useCallback } from 'react';
import { FormattedMessage, defineMessages, useIntl } from 'react-intl';
import firstBy from 'thenby';
import classNames from 'classnames';
import { percentFilter } from 'lib/filters';
import { formatLongNumber } from 'lib/format';
import DataTable from './DataTable';
import FilterButtons from 'components/common/FilterButtons';
import NoData from 'components/common/NoData';
import trafficStyles from './TrafficTable.module.css';

const FILTER_REFERRERS = 0;
const FILTER_PAGES = 1;
const FILTER_VISITED_DOMAINS = 2;
const FILTER_VISITED_PAGES = 3;

const trafficMessages = defineMessages({
  domains: { id: 'metrics.visited-domains', defaultMessage: 'Visited domains' },
  pages: { id: 'metrics.visited-pages', defaultMessage: 'Visited pages' },
  domain: { id: 'metrics.domain', defaultMessage: 'Domain' },
  page: { id: 'metrics.page-url', defaultMessage: 'Page URL' },
  views: { id: 'metrics.views', defaultMessage: 'Pageviews' },
  uniqueIps: { id: 'metrics.unique-ips', defaultMessage: 'Unique IPs' },
  share: { id: 'metrics.pageview-share', defaultMessage: 'Share of pageviews' },
  ipNote: {
    id: 'metrics.ip-privacy-note',
    defaultMessage: 'Unique IPs are counted using one-way hashes.',
  },
  showFullUrl: { id: 'metrics.show-full-url', defaultMessage: 'Show full URL' },
  hideFullUrl: { id: 'metrics.hide-full-url', defaultMessage: 'Hide full URL' },
});

export default function RealtimeViews({ websiteId, data, websites = [] }) {
  const { pageviews = [], sessions = [] } = data || {};
  const [filter, setFilter] = useState(FILTER_REFERRERS);
  const domains = useMemo(() => websites.map(({ domain }) => domain), [websites]);
  const getDomain = useCallback(
    id =>
      websites.length === 1
        ? websites[0]?.domain
        : websites.find(({ website_id }) => website_id === id)?.domain,
    [websites],
  );

  const buttons = [
    {
      label: <FormattedMessage id="metrics.referrers" defaultMessage="Referrers" />,
      value: FILTER_REFERRERS,
    },
    {
      label: <FormattedMessage id="metrics.pages" defaultMessage="Pages" />,
      value: FILTER_PAGES,
    },
    {
      label: <FormattedMessage id="metrics.visited-domains" defaultMessage="Visited domains" />,
      value: FILTER_VISITED_DOMAINS,
    },
    {
      label: <FormattedMessage id="metrics.visited-pages" defaultMessage="Visited pages" />,
      value: FILTER_VISITED_PAGES,
    },
  ];

  const renderLink = ({ x }) => {
    const domain = x.startsWith('/') ? getDomain(websiteId) : '';
    return (
      <a href={`//${domain}${x}`} target="_blank" rel="noreferrer noopener">
        {x}
      </a>
    );
  };

  const [referrers, pages] = useMemo(() => {
    if (pageviews) {
      const referrers = percentFilter(
        pageviews
          .reduce((arr, { referrer }) => {
            if (referrer?.startsWith('http')) {
              const hostname = new URL(referrer).hostname.replace(/^www\./, '');

              if (hostname && !domains.includes(hostname)) {
                const row = arr.find(({ x }) => x === hostname);

                if (!row) {
                  arr.push({ x: hostname, y: 1 });
                } else {
                  row.y += 1;
                }
              }
            }
            return arr;
          }, [])
          .sort(firstBy('y', -1)),
      );

      const pages = percentFilter(
        pageviews
          .reduce((arr, { url, website_id }) => {
            if (url?.startsWith('/')) {
              if (!websiteId && websites.length > 1) {
                url = `${getDomain(website_id)}${url}`;
              }
              const row = arr.find(({ x }) => x === url);

              if (!row) {
                arr.push({ x: url, y: 1 });
              } else {
                row.y += 1;
              }
            }
            return arr;
          }, [])
          .sort(firstBy('y', -1)),
      );

      return [referrers, pages];
    }
    return [[], []];
  }, [pageviews, domains, websiteId, websites.length, getDomain]);

  const [visitedDomains, visitedPages] = useMemo(() => {
    const hostnameBySession = new Map(
      sessions.map(({ session_id, hostname }) => [session_id, hostname]),
    );
    const websiteDomainById = new Map(
      websites.map(({ website_id, domain }) => [website_id, domain]),
    );

    const groupPageviews = type => {
      const groups = new Map();

      pageviews.forEach(pageview => {
        const hostname =
          hostnameBySession.get(pageview.session_id) || websiteDomainById.get(pageview.website_id);
        if (!hostname) {
          return;
        }

        const url = typeof pageview.url === 'string' ? pageview.url : '';
        const label =
          type === 'domain' ? hostname : `${hostname}${url.startsWith('/') ? url : `/${url}`}`;
        const row = groups.get(label) || { views: 0, ips: new Set() };
        row.views += 1;
        if (typeof pageview.ip_hash === 'string' && pageview.ip_hash) {
          row.ips.add(pageview.ip_hash);
        }
        groups.set(label, row);
      });

      return percentFilter(
        Array.from(groups, ([x, row]) => ({ x, y: row.views, ips: row.ips.size })).sort(
          firstBy('y', -1),
        ),
      );
    };

    return [groupPageviews('domain'), groupPageviews('page')];
  }, [pageviews, sessions, websites]);

  return (
    <>
      <FilterButtons buttons={buttons} selected={filter} onClick={setFilter} />
      {filter === FILTER_REFERRERS && (
        <DataTable
          title={<FormattedMessage id="metrics.referrers" defaultMessage="Referrers" />}
          metric={<FormattedMessage id="metrics.views" defaultMessage="Views" />}
          renderLabel={renderLink}
          data={referrers}
        />
      )}
      {filter === FILTER_PAGES && (
        <DataTable
          title={<FormattedMessage id="metrics.pages" defaultMessage="Pages" />}
          metric={<FormattedMessage id="metrics.views" defaultMessage="Views" />}
          renderLabel={renderLink}
          data={pages}
        />
      )}
      {filter === FILTER_VISITED_DOMAINS && (
        <RealtimeTrafficTable type="domain" data={visitedDomains} />
      )}
      {filter === FILTER_VISITED_PAGES && <RealtimeTrafficTable type="page" data={visitedPages} />}
    </>
  );
}

function RealtimeTrafficTable({ type, data }) {
  const { formatMessage } = useIntl();
  const [expandedLabels, setExpandedLabels] = useState({});
  const domainType = type === 'domain';
  const title = formatMessage(domainType ? trafficMessages.domains : trafficMessages.pages);
  const rows = data.slice(0, 10);
  const totalPageviews = data.reduce((total, row) => total + (Number(row.y) || 0), 0);

  return (
    <div className={trafficStyles.container}>
      <div className={trafficStyles.heading}>
        <div className={trafficStyles.title}>{title}</div>
      </div>
      <div className={trafficStyles.note}>{formatMessage(trafficMessages.ipNote)}</div>
      <div className={trafficStyles.table} role="table" aria-label={title}>
        <div className={trafficStyles.header} role="row">
          <div className={trafficStyles.headerLabel} role="columnheader">
            {formatMessage(domainType ? trafficMessages.domain : trafficMessages.page)}
          </div>
          <div
            className={trafficStyles.headerMetric}
            role="columnheader"
            title={formatMessage(trafficMessages.uniqueIps)}
          >
            IP
          </div>
          <div
            className={trafficStyles.headerMetric}
            role="columnheader"
            title={formatMessage(trafficMessages.views)}
          >
            {formatMessage(trafficMessages.views)}
          </div>
          <div
            className={trafficStyles.headerShare}
            role="columnheader"
            title={formatMessage(trafficMessages.share)}
          >
            %
          </div>
        </div>
        <div className={trafficStyles.body} role="rowgroup">
          {rows.length === 0 && (
            <div className={trafficStyles.empty} role="row">
              <div className={trafficStyles.emptyCell} role="cell">
                <NoData />
              </div>
            </div>
          )}
          {rows.map(row => {
            const pageviews = Number(row.y) || 0;
            const share = totalPageviews ? (pageviews / totalPageviews) * 100 : 0;
            const expanded = Boolean(expandedLabels[row.x]);

            return (
              <div className={trafficStyles.row} role="row" key={row.x}>
                {domainType ? (
                  <div className={trafficStyles.label} role="cell" title={row.x}>
                    {row.x}
                  </div>
                ) : (
                  <button
                    type="button"
                    role="cell"
                    className={classNames(trafficStyles.label, trafficStyles.labelButton, {
                      [trafficStyles.expanded]: expanded,
                    })}
                    title={row.x}
                    aria-label={`${formatMessage(
                      expanded ? trafficMessages.hideFullUrl : trafficMessages.showFullUrl,
                    )}: ${row.x}`}
                    aria-expanded={expanded}
                    onClick={() =>
                      setExpandedLabels(current => ({ ...current, [row.x]: !current[row.x] }))
                    }
                  >
                    {row.x}
                  </button>
                )}
                <div
                  className={trafficStyles.value}
                  role="cell"
                  title={`${formatMessage(trafficMessages.uniqueIps)}: ${row.ips}`}
                >
                  {formatLongNumber(row.ips)}
                </div>
                <div
                  className={trafficStyles.value}
                  role="cell"
                  title={`${formatMessage(trafficMessages.views)}: ${pageviews}`}
                >
                  {formatLongNumber(pageviews)}
                </div>
                <div
                  className={trafficStyles.share}
                  role="cell"
                  title={`${formatMessage(trafficMessages.share)}: ${share.toFixed(1)}%`}
                >
                  <span
                    className={trafficStyles.bar}
                    style={{ width: `${Math.max(0, Math.min(100, share))}%` }}
                  />
                  <span className={trafficStyles.shareValue}>{`${Math.round(share)}%`}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
