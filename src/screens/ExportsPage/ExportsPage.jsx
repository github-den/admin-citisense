'use client';

import { useState } from 'react';
import { 
  DownloadSimple,
  Info
} from '@phosphor-icons/react';
import AdminDateRangeFilter from '../../components/ui/AdminDateRangeFilter.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/DataTable/DataTable.jsx';
import {
  createPresetAdminDateRange,
  isDefaultAdminDateRange,
} from '@core/lib/adminDateRange.js';
import { useAdminWorkspace } from '@core/hooks/useAdminWorkspace.js';
import styles from '../../styles/adminWorkspace.module.css';

export default function ExportsPage() {
  const workspace = useAdminWorkspace();
  const [dateRange, setDateRange] = useState(() => createPresetAdminDateRange('all'));
  const hasActiveFilters = !isDefaultAdminDateRange(dateRange);
  const exportColumns = [
    { key: 'date', label: 'Date', width: 140 },
    { key: 'source', label: 'Source', width: 200 },
    { key: 'format', label: 'Format', width: 120 },
    { key: 'scope', label: 'Scope' },
    { key: 'status', label: 'Status', width: 140 },
    { key: 'download', label: 'Download', width: 140 },
  ];
  const exportRows = [];

  return (
    <div className={`${styles.page} ${styles.pageWide}`}>
      <div className={styles.pageHeader}>
        <div className={styles.inlineHeaderMeta}>
          <h1 className={styles.pageTitle}>Exports</h1>
          <span className={styles.headerDivider}>|</span>
          <span className={styles.headerContext}>Data Hub</span>
        </div>
      </div>

      <section className={styles.toolbar}>
        <div className={styles.selectionSummary}>
          <Button variant="secondary" size="md" disabled>
            <DownloadSimple size={15} weight="bold" />
            Export
          </Button>
          <span className={styles.selectionCount}>0 exports available</span>
        </div>

        <div className={styles.filterRow}>
          <AdminDateRangeFilter
            value={dateRange}
            onChange={setDateRange}
            align="end"
            className={`${styles.filterMenuTrigger} ${hasActiveFilters ? styles.filterMenuTriggerActive : ''}`}
          />
          <Button
            variant="secondary"
            size="md"
            type="button"
            onClick={() => {
              if (hasActiveFilters) setDateRange(createPresetAdminDateRange('all'));
            }}
            className={`${styles.filterMenuTrigger} ${hasActiveFilters ? styles.filterMenuTriggerActive : styles.filterMenuTriggerMuted}`}
            aria-disabled={!hasActiveFilters}
          >
            Clear all
          </Button>
        </div>
      </section>

      <section className={styles.tablePanel}>
        <DataTable
          columns={exportColumns}
          rows={exportRows}
          minWidth={980}
          empty="No exports yet"
          showEmptyTable
          emptyRowCount={10}
        />
      </section>

      <div className={styles.resultsMeta} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Info size={14} weight="duotone" />
        <span>Real-time dashboard and list exports are already available on their respective pages for {workspace.scopeLabel}.</span>
      </div>
    </div>
  );
}
