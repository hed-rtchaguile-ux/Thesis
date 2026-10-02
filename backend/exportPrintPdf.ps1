param(
  [Parameter(Mandatory = $true)][string]$WorkbookPath,
  [Parameter(Mandatory = $true)][string]$PdfPath
)

$excelApp = $null
$workbook = $null

try {
  $excelApp = New-Object -ComObject Excel.Application
  $excelApp.Visible = $false
  $excelApp.DisplayAlerts = $false
  $workbook = $excelApp.Workbooks.Open($WorkbookPath, 0, $true)
  $worksheet = $workbook.Worksheets.Item('Front')
  $worksheet.PageSetup.PrintArea = '$A$1:$AG$98'
  $worksheet.PageSetup.Orientation = 1
  $worksheet.PageSetup.PaperSize = 5
  $worksheet.PageSetup.Zoom = $false
  $worksheet.PageSetup.FitToPagesWide = 1
  $worksheet.PageSetup.FitToPagesTall = 1
  $worksheet.ExportAsFixedFormat(0, $PdfPath)
  $workbook.Close($false)
  $workbook = $null
} finally {
  if ($workbook) {
    $workbook.Close($false)
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($workbook)
  }

  if ($excelApp) {
    $excelApp.Quit()
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($excelApp)
  }

  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
