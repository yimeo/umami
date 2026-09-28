import React, { useState } from 'react';
import classNames from 'classnames';
import { defineMessages, useIntl } from 'react-intl';
import Link from 'components/common/Link';
import Loading from 'components/common/Loading';
import ErrorMessage from 'components/common/ErrorMessage';
import NoData from 'components/common/NoData';
import Arrow from 'assets/arrow-right.svg';
import useFetch from 'hooks/useFetch';
import useDateRange from 'hooks/useDateRange';
import usePageQuery from 'hooks/usePageQuery';
import { formatLongNumber } from 'lib/format';
import styles from './TrafficTable.module.css';

const messages = defineMessages({
  domains: { id: 'metrics.visited-domains', defaultMessage: 'Visited domains' },
  pages: { id: 'metrics.visited-pages', defaultMessage: 'Visited pages' },
  domain: { id: 'metrics.domain', defaultMessage: 'Domain' },
  page: { id: 'metrics.page-url', defaultMessage: 'Page URL' },
  views: { id: 'metrics.views', defaultMessage: 'Pageviews' },
  uniqueIps: { id: 'metrics.unique-ips', defaultMessage: 'Unique IPs' },
  share: { id: 'metrics.pageview-share', defaultMessage: 'Share of pageviews' },
  allPages: { id: 'metrics.all-pages', defaultMessage: 'All pages' },
  showFullUrl: { id: 'metrics.show-full-url', defaultMessage: 'Show full URL' },
  hideFullUrl: { id: 'metrics.hide-full-url', defaultMessage: 'Hide full URL' },
  ipNote: {
    id: 'metrics.ip-privacy-note',
    defaultMessage:
      'IP addresses are only counted using a one-way hash. Historical IP counts are unavailable.',
  },
});

function TrafficTable({ websiteId, type, limit = 10 }) {
  const { formatMessage } = useIntl();
  const [expandedLabels, setExpandedLabels] = useState({});
  const [{ startDate, endDate, modified }] = useDateRange(websiteId);
  const {
    resolve,
    router,
    query: { domain },
  } = usePageQuery();
  const pageDomain = type === 'page' ? domain : undefined;
  const { data, loading, error } = useFetch(
    `/website/${websiteId}/traffic`,
    {
      params: {
        type,
        start_at: +startDate,
        end_at: +endDate,
        domain: pageDomain,
      },
    },
    [type, modified, pageDomain],
  );

  const rows = Array.isArray(data) ? (limit ? data.slice(0, limit) : data) : [];
  const totalPageviews = Array.isArray(data)
    ? data.reduce((total, row) => total + (Number(row.pageviews) || 0), 0)
    : 0;
  const baseTitle = formatMessage(type === 'domain' ? messages.domains : messages.pages);
  const title = pageDomain ? `${baseTitle} · ${pageDomain}` : baseTitle;
  const view = type === 'domain' ? 'domain' : 'visited-pages';

  return (
    <div className={styles.container}>
      <div className={styles.heading}>
        <div className={styles.title}>{title}</div>
        {pageDomain && (
          <Link
            className={styles.clearFilter}
            href={router.pathname}
            as={resolve({ domain: undefined })}
            size="small"
          >
            {formatMessage(messages.allPages)}
          </Link>
        )}
      </div>
      <div className={styles.note}>{formatMessage(messages.ipNote)}</div>
      {!data && loading && <Loading />}
      {error && <ErrorMessage />}
      {data && !error && (
        <div className={styles.table} role="table" aria-label={title}>
          <div className={styles.header} role="row">
            <div className={styles.headerLabel} role="columnheader">
              {formatMessage(type === 'domain' ? messages.domain : messages.page)}
            </div>
            <div
              className={styles.headerMetric}
              role="columnheader"
              title={formatMessage(messages.uniqueIps)}
            >
              IP
            </div>
            <div
              className={styles.headerMetric}
              role="columnheader"
              title={formatMessage(messages.views)}
            >
              {formatMessage(messages.views)}
            </div>
            <div
              className={styles.headerShare}
              role="columnheader"
              title={formatMessage(messages.share)}
            >
              %
            </div>
          </div>
          <div className={styles.body} role="rowgroup">
            {rows.length === 0 && (
              <div className={styles.empty} role="row">
                <div className={styles.emptyCell} role="cell">
                  <NoData />
                </div>
              </div>
            )}
            {rows.map(row => {
              const pageviews = Number(row.pageviews) || 0;
              const ips = Number(row.ips) || 0;
              const share = totalPageviews ? (pageviews / totalPageviews) * 100 : 0;
              const barWidth = Math.max(0, Math.min(100, share));
              const expanded = Boolean(expandedLabels[row.label]);

              return (
                <div className={styles.row} role="row" key={row.label}>
                  {type === 'domain' ? (
                    <Link
                      href={resolve({ view: 'visited-pages', domain: row.label })}
                      className={classNames(styles.label, styles.domainLink)}
                    >
                      {row.label}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      role="cell"
                      className={classNames(styles.label, styles.labelButton, {
                        [styles.expanded]: expanded,
                      })}
                      title={row.label}
                      aria-label={`${formatMessage(
                        expanded ? messages.hideFullUrl : messages.showFullUrl,
                      )}: ${row.label}`}
                      aria-expanded={expanded}
                      onClick={() =>
                        setExpandedLabels(current => ({
                          ...current,
                          [row.label]: !current[row.label],
                        }))
                      }
                    >
                      {row.label}
                    </button>
                  )}
                  <div
                    className={styles.value}
                    role="cell"
                    title={`${formatMessage(messages.uniqueIps)}: ${ips}`}
                  >
                    {formatLongNumber(ips)}
                  </div>
                  <div
                    className={styles.value}
                    role="cell"
                    title={`${formatMessage(messages.views)}: ${pageviews}`}
                  >
                    {formatLongNumber(pageviews)}
                  </div>
                  <div
                    className={styles.share}
                    role="cell"
                    title={`${formatMessage(messages.share)}: ${share.toFixed(1)}%`}
                  >
                    <span className={styles.bar} style={{ width: `${barWidth}%` }} />
                    <span className={styles.shareValue}>{`${Math.round(share)}%`}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className={styles.footer}>
        {data && !error && limit && data.length > limit && (
          <Link
            icon={<Arrow />}
            href={router.pathname}
            as={resolve({ view })}
            size="small"
            iconRight
          >
            {formatMessage({ id: 'label.more', defaultMessage: 'More' })}
          </Link>
        )}
      </div>
    </div>
  );
}

export function DomainTrafficTable(props) {
  return <TrafficTable {...props} type="domain" />;
}

export function PageTrafficTable(props) {
  return <TrafficTable {...props} type="page" />;
}
