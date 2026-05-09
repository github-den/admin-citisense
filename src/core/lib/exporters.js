function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function serializeCsvCell(value) {
  const normalized = String(value ?? '');
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replaceAll('"', '""')}"`;
  }
  return normalized;
}

export function exportRowsToCsv(filename, rows) {
  if (typeof window === 'undefined' || !rows?.length) return false;

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => serializeCsvCell(row[header])).join(',')),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}

export function exportRowsToXlsx(filename, rows, sheetName = 'Sheet1') {
  if (typeof window === 'undefined' || !rows?.length) return false;

  const headers = Object.keys(rows[0]);
  const headerMarkup = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('');
  const rowMarkup = rows.map((row) => (
    `<tr>${headers.map((header) => `<td>${escapeHtml(row[header])}</td>`).join('')}</tr>`
  )).join('');

  const workbookMarkup = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>${escapeHtml(sheetName)}</x:Name>
                <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          table { border-collapse: collapse; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
          th { background: #eff6ff; font-weight: 700; }
        </style>
      </head>
      <body>
        <table>
          <thead><tr>${headerMarkup}</tr></thead>
          <tbody>${rowMarkup}</tbody>
        </table>
      </body>
    </html>
  `;

  const blob = new Blob([workbookMarkup], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}

export function exportSectionsToPrint({ title, subtitle, sections }) {
  if (typeof window === 'undefined') return false;

  const popup = window.open('', '_blank', 'width=980,height=720');
  if (!popup) return false;

  const sectionMarkup = sections
    .map(({ heading, rows }) => {
      const body = rows
        .map(({ label, value }) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`)
        .join('');
      return `
        <section>
          <h2>${escapeHtml(heading)}</h2>
          <table>
            <tbody>${body}</tbody>
          </table>
        </section>
      `;
    })
    .join('');

  popup.document.write(`
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 32px; color: #0f172a; }
          h1 { margin: 0 0 8px; font-size: 28px; }
          p { margin: 0 0 24px; color: #475569; }
          section { margin-bottom: 24px; page-break-inside: avoid; }
          h2 { margin: 0 0 12px; font-size: 16px; text-transform: uppercase; letter-spacing: 0.06em; }
          table { width: 100%; border-collapse: collapse; }
          td { border: 1px solid #cbd5e1; padding: 10px 12px; vertical-align: top; font-size: 13px; }
          td:first-child { width: 240px; font-weight: 700; background: #f8fafc; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(subtitle ?? '')}</p>
        ${sectionMarkup}
      </body>
    </html>
  `);
  popup.document.close();
  popup.focus();
  popup.print();
  return true;
}
