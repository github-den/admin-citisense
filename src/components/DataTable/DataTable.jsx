import styles from './DataTable.module.css';

export default function DataTable({
  columns,
  rows,
  loading,
  empty = 'No data.',
  minWidth = 900,
  showEmptyTable = false,
  emptyRowCount = 10,
}) {
  if (loading) {
    return (
      <div className={styles.wrap}>
        <div className={styles.state}>
          <div className={styles.skeleton} aria-hidden="true">
            <div className={styles.skeletonRow} />
            <div className={styles.skeletonRow} />
            <div className={styles.skeletonRow} />
            <div className={styles.skeletonRow} />
          </div>
        </div>
      </div>
    );
  }

  if (!rows?.length) {
    if (showEmptyTable) {
      return (
        <div
          className={styles.wrap}
          style={{
            ['--table-min-width']: `${minWidth}px`,
            ['--table-placeholder-rows']: String(emptyRowCount),
          }}
        >
          <table className={styles.table}>
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col.key} className={styles.th} style={{ width: col.width }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className={styles.trEmpty}>
                <td colSpan={columns.length} className={`${styles.td} ${styles.emptyTableCell}`}>
                  <div className={styles.emptyTableContent}>{empty}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    }

    return (
      <div className={styles.wrap}>
        <div className={styles.state}>
          <span className={styles.emptyDot} />
          <span>{empty}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap} style={{ ['--table-min-width']: `${minWidth}px` }}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} className={styles.th} style={{ width: col.width }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id ?? i} className={styles.tr}>
              {columns.map(col => (
                <td key={col.key} className={styles.td}>
                  {col.render ? col.render(row) : row[col.key] ?? '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
