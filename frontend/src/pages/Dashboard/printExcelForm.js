import { apiFetch } from '../auth'

export async function printExcelForm(applicationId) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    window.alert('Allow pop-ups to print the application form.')
    return
  }

  printWindow.document.title = 'Preparing application form'
  printWindow.document.body.textContent = 'Preparing application form...'

  try {
    const response = await apiFetch(`/api/applications/${applicationId}/print`)
    if (!response.ok) {
      const result = await response.json().catch(() => null)
      throw new Error(result?.message || `Unable to prepare the application form for printing (${response.status}).`)
    }

    const formTable = await response.text()
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Marriage License Application</title>
  <style>
    @page { size: 8.5in 13in; margin: 0; }
    * { box-sizing: border-box; }
    html, body { width: 100%; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; }
    .print-page { width: 8.5in; height: 13in; padding: 0.25in; overflow: hidden; }
    .excel-form-table { width: 100%; table-layout: fixed; border-collapse: collapse; border-spacing: 0; transform-origin: top left; }
    .excel-form-table td { box-sizing: border-box; }
  </style>
</head>
<body>
  <main class="print-page">${formTable}</main>
  <script>
    (() => {
      const page = document.querySelector('.print-page');
      const table = page && page.querySelector('.excel-form-table');
      if (!table) throw new Error('The marriage license form could not be laid out for printing.');

      const formHeight = table.getBoundingClientRect().height;
      const printableHeight = 12.5 * 96;
      if (!formHeight) throw new Error('The marriage license form has no printable dimensions.');
      table.style.transform = \`scaleY(\${Math.min(1, (printableHeight / formHeight) * 1.25)})\`;
      window.addEventListener('load', () => {
        window.focus();
        window.print();
      }, { once: true });
    })();
  </script>
</body>
</html>`
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
  } catch (error) {
    printWindow.close()
    window.alert(error.message)
  }
}
