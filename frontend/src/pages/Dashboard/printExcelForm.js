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
    const contentType = response.headers.get('content-type') || ''
    const responseContent = contentType.includes('application/json')
      ? await response.json()
      : await response.text()
    if (!response.ok) {
      const message = typeof responseContent === 'object'
        ? responseContent.message || responseContent.error
        : responseContent
      throw new Error(message || `Unable to prepare the application form (HTTP ${response.status}).`)
    }
    if (typeof responseContent !== 'string' || !responseContent.toLowerCase().includes('<html')) {
      throw new Error('The print service returned an invalid application form.')
    }

    printWindow.document.open()
    printWindow.document.write(responseContent)
    printWindow.document.close()
    window.setTimeout(() => {
      if (printWindow.closed) return
      printWindow.focus()
      printWindow.print()
    }, 500)
  } catch (error) {
    printWindow.close()
    window.alert(error.message)
  }
}
