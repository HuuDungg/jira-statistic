export interface TableColumn {
  title: string;
  align?: 'left' | 'center' | 'right';
}

/**
 * Copy data as both Rich HTML Table (for Jira, MS Teams, Slack, Word, Google Docs)
 * and clean Plain Text (for Notepad, Code editors).
 */
export async function copyTableToClipboard(
  columns: TableColumn[],
  rows: (string | number)[][],
  summaryText?: string
): Promise<boolean> {
  // 1. Build Rich HTML Table
  const style = `
    <style>
      table { border-collapse: collapse; width: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; color: #1e293b; }
      th { background-color: #f1f5f9; color: #0f172a; font-weight: 700; border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
      td { border: 1px solid #e2e8f0; padding: 7px 12px; vertical-align: middle; }
      tr:nth-child(even) td { background-color: #f8fafc; }
      .summary { margin-top: 10px; font-weight: 600; font-size: 12px; color: #475569; }
    </style>
  `;

  const thead = `<thead><tr>${columns
    .map(c => `<th style="text-align: ${c.align || 'left'}; border: 1px solid #cbd5e1; padding: 8px 12px; background: #f1f5f9; font-weight: 700; color: #0f172a;">${c.title}</th>`)
    .join('')}</tr></thead>`;

  const tbody = `<tbody>${rows
    .map((row, idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      const cells = row
        .map((cell, colIdx) => {
          const align = columns[colIdx]?.align || 'left';
          return `<td style="text-align: ${align}; border: 1px solid #e2e8f0; padding: 7px 12px; background: ${bg};">${cell}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('')}</tbody>`;

  const htmlContent = `<html><body>${style}<table>${thead}${tbody}</table>${summaryText ? `<div class="summary" style="margin-top: 10px; font-size: 12px; font-weight: 600; color: #475569;">${summaryText}</div>` : ''}</body></html>`;

  // 2. Build clean Plain Text / TSV (Excel & text editors)
  const tsvHeader = columns.map(c => c.title).join('\t');
  const tsvRows = rows.map(r => r.join('\t')).join('\n');
  const plainText = `${tsvHeader}\n${tsvRows}${summaryText ? `\n\n${summaryText}` : ''}`;

  // 3. Write ClipboardItem
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      const blobHtml = new Blob([htmlContent], { type: 'text/html' });
      const blobText = new Blob([plainText], { type: 'text/plain' });
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': blobHtml,
          'text/plain': blobText
        })
      ]);
      return true;
    }
  } catch (err) {
    console.warn('ClipboardItem error, falling back to writeText', err);
  }

  try {
    await navigator.clipboard.writeText(plainText);
    return true;
  } catch (e) {
    console.error('Failed to copy', e);
    return false;
  }
}
