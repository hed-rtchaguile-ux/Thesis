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

    const html = await response.text()
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
  } catch (error) {
    printWindow.close()
    window.alert(error.message)
  }
}
