import styles from './DataTable.module.css';

export default function DataTable({ columns, rows, loading, empty = 'No data.' }) {
  if (loading) {
    return (
      <div className={styles.wrap}>
        <div className={styles.state}>
          <span className={styles.spinner} />
          <span>Loading records...</span>
        </div>
      </div>
    );
  }

  if (!rows?.length) {
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
    <div className={styles.wrap}>
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
