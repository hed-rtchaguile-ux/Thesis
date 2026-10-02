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
    if (!response.ok) throw new Error('Unable to prepare the application form for printing.')

    printWindow.document.open()
    printWindow.document.write(await response.text())
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
