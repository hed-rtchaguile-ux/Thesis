const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs/promises');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { pathToFileURL } = require('node:url');
const ExcelJS = require('exceljs');

const FORM_ROWS = 98;
const FORM_COLUMNS = 33;
const TEMPLATE_PATH = path.join(__dirname, '..', 'frontend', 'public', 'marriage-license-template.xlsx');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const execFileAsync = promisify(execFile);
const PDF_BROWSER_PATHS = [
  process.env.CHROME_PATH,
  process.env.EDGE_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

async function findPdfBrowser() {
  for (const browserPath of PDF_BROWSER_PATHS) {
    try {
      await fs.access(browserPath);
      return browserPath;
    } catch {
      // Try the next standard browser installation path.
    }
  }

  throw new Error('Install Chrome or Edge, or set CHROME_PATH or EDGE_PATH to its executable.');
}

function join(values, separator = ', ') {
  return values.filter(Boolean).join(separator);
}

function dateParts(value) {
  if (!value) return { day: '', month: '', year: '' };
  const text = String(value);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const local = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text);
  const year = iso ? Number(iso[1]) : local ? Number(local[3]) : 0;
  const month = iso ? Number(iso[2]) : local ? Number(local[2]) : 0;
  const day = iso ? Number(iso[3]) : local ? Number(local[1]) : 0;
  return { day: day || '', month: MONTHS[month - 1] || '', year: year || '' };
}

function personDateParts(application, person) {
  const day = application[`${person}DobDay`];
  const month = application[`${person}DobMonth`];
  const year = application[`${person}DobYear`];
  if (day && month && year) {
    const monthNumber = Number(month) || MONTHS.findIndex((name) => name.toLowerCase() === String(month).toLowerCase()) + 1;
    return { day, month: MONTHS[monthNumber - 1] || month, year };
  }

  const namedMonth = /^(\d{1,2})[/-]([A-Za-z]+)[/-](\d{4})$/.exec(String(application[`${person}Dob`] || ''));
  if (namedMonth) {
    const monthName = MONTHS.find((name) => name.toLowerCase() === namedMonth[2].toLowerCase());
    return { day: namedMonth[1], month: monthName || namedMonth[2], year: namedMonth[3] };
  }
  return dateParts(application[`${person}Dob`]);
}

function personName(application, person) {
  const fullName = String(application[`${person}FullName`] || '').trim();
  const nameParts = fullName.split(/\s+/).filter(Boolean);

  if (!application[`${person}FirstName`] && nameParts.length > 1) {
    return {
      first: nameParts[0],
      middle: nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '',
      last: nameParts[nameParts.length - 1],
    };
  }

  return {
    first: application[`${person}FirstName`] || fullName,
    middle: application[`${person}MiddleName`] || '',
    last: application[`${person}LastName`] || '',
  };
}

function personAddress(application, person, prefix = '') {
  return join([
    application[`${person}${prefix}ResidenceHouseNo`],
    application[`${person}${prefix}ResidenceStreet`],
    application[`${person}${prefix}ResidenceBarangay`],
    application[`${person}${prefix}ResidenceCity`],
    application[`${person}${prefix}ResidenceProvince`],
    application[`${person}${prefix}ResidenceCountry`],
  ]);
}

function fillPerson(sheet, application, person, side, formValueCells) {
  const cells = side === 'groom'
    ? { first: 'D23', middle: 'D24', last: 'D25', day: 'B28', month: 'E28', year: 'I28', age: 'L28', birth: 'A30', birthCountry: 'L30', sex: 'A32', citizenship: 'H32', residence: 'A34', religion: 'A35', civilStatus: 'A37', previouslyMarried: 'A38', dissolutionPlace: 'A42', dissolutionDay: 'A44', dissolutionMonth: 'F44', dissolutionYear: 'K44', relationship: 'A46', fatherFirst: 'A48', fatherMiddle: 'F48', fatherLast: 'J48', fatherCitizenship: 'A49', fatherResidence: 'A51', motherFirst: 'A53', motherMiddle: 'F53', motherLast: 'J53', motherCitizenship: 'A54', motherResidence: 'A56', advisorName: 'A58', advisorRelationship: 'A61', advisorCitizenship: 'A62', advisorResidence: 'A64' }
    : { first: 'X23', middle: 'X24', last: 'X25', day: 'U28', month: 'W28', year: 'AB28', age: 'AE28', birth: 'U30', birthCountry: 'AE30', sex: 'U32', citizenship: 'AA32', residence: 'U34', religion: 'U35', civilStatus: 'U37', previouslyMarried: 'U38', dissolutionPlace: 'U42', dissolutionDay: 'U44', dissolutionMonth: 'Z44', dissolutionYear: 'AE44', relationship: 'U46', fatherFirst: 'U48', fatherMiddle: 'Z48', fatherLast: 'AE48', fatherCitizenship: 'U49', fatherResidence: 'U51', motherFirst: 'U53', motherMiddle: 'Z53', motherLast: 'AE53', motherCitizenship: 'U54', motherResidence: 'U56', advisorName: 'U58', advisorRelationship: 'U61', advisorCitizenship: 'U62', advisorResidence: 'U64' };
  const set = (key, value) => {
    const cell = sheet.getCell(cells[key]);
    cell.value = key === 'day' && value ? String(value).padStart(2, '0') : value || '';
    if (['day', 'month', 'year', 'age'].includes(key)) {
      cell.alignment = { ...(cell.alignment || {}), horizontal: 'center', vertical: 'middle', wrapText: true };
    }
    formValueCells.add(cell.address);
  };
  const name = personName(application, person);
  const dob = personDateParts(application, person);
  const fatherName = personName({
    [`${person}FirstName`]: application[`${person}FatherFirstName`],
    [`${person}MiddleName`]: application[`${person}FatherMiddleName`],
    [`${person}LastName`]: application[`${person}FatherLastName`],
    [`${person}FullName`]: application[`${person}FatherName`],
  }, person);
  const motherName = personName({
    [`${person}FirstName`]: application[`${person}MotherMaidenFirstName`],
    [`${person}MiddleName`]: application[`${person}MotherMaidenMiddleName`],
    [`${person}LastName`]: application[`${person}MotherMaidenLastName`],
    [`${person}FullName`]: application[`${person}MotherMaidenName`],
  }, person);
  const dissolutionDate = dateParts(join([
    application[`${person}DissolutionDay`],
    application[`${person}DissolutionMonth`],
    application[`${person}DissolutionYear`],
  ], '/'));
  const previouslyMarried = application[`${person}PreviouslyMarried`];
  const dissolutionDescription = previouslyMarried && /^(no|false)$/i.test(String(previouslyMarried))
    ? 'Not previously married'
    : join([previouslyMarried, application[`${person}DissolutionMethod`]]);

  set('first', name.first);
  set('middle', name.middle);
  set('last', name.last);
  set('day', dob.day);
  set('month', dob.month);
  set('year', dob.year);
  set('age', application[`${person}Age`]);
  set('birth', join([application[`${person}BirthPlaceCity`], application[`${person}BirthPlaceProvince`]]));
  set('birthCountry', application[`${person}BirthPlaceCountry`]);
  set('sex', application[`${person}Gender`]);
  set('citizenship', application[`${person}Citizenship`]);
  set('residence', personAddress(application, person));
  set('religion', join([application[`${person}Religion`], application[`${person}ReligionSect`]], ' / '));
  set('civilStatus', application[`${person}CivilStatus`]);
  set('previouslyMarried', dissolutionDescription);
  set('dissolutionPlace', join([
    application[`${person}DissolutionCity`],
    application[`${person}DissolutionProvince`],
    application[`${person}DissolutionCountry`],
  ]));
  set('dissolutionDay', dissolutionDate.day);
  set('dissolutionMonth', dissolutionDate.month);
  set('dissolutionYear', dissolutionDate.year);
  set('relationship', application[`${person}DegreeRelationship`]);
  set('fatherFirst', fatherName.first);
  set('fatherMiddle', fatherName.middle);
  set('fatherLast', fatherName.last);
  ['fatherFirst', 'fatherMiddle', 'fatherLast', 'motherFirst', 'motherMiddle', 'motherLast'].forEach((key) => {
    const cell = sheet.getCell(cells[key]);
    cell.alignment = { ...(cell.alignment || {}), horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  set('fatherCitizenship', application[`${person}FatherCitizenship`]);
  set('fatherResidence', personAddress(application, person, 'Father'));
  set('motherFirst', motherName.first);
  set('motherMiddle', motherName.middle);
  set('motherLast', motherName.last);
  set('motherCitizenship', application[`${person}MotherMaidenCitizenship`]);
  set('motherResidence', personAddress(application, person, 'Mother'));
  set('advisorName', application[`${person}AdvisorName`]);
  set('advisorRelationship', application[`${person}AdvisorRelationship`]);
  set('advisorCitizenship', application[`${person}AdvisorCitizenship`]);
  set('advisorResidence', personAddress(application, person, 'Advisor'));
}

function fillTemplate(sheet, application) {
  const formValueCells = new Set();
  const groomMaritalHistoryCell = sheet.getCell('A38');
  groomMaritalHistoryCell.alignment = {
    ...groomMaritalHistoryCell.alignment,
    horizontal: 'center',
    vertical: 'middle',
    wrapText: true,
  };
  fillPerson(sheet, application, 'groom', 'groom', formValueCells);
  fillPerson(sheet, application, 'bride', 'bride', formValueCells);
  return formValueCells;
}

async function buildPrintFormPdf(application) {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'wedrings-print-'));
  const htmlPath = path.join(tempDirectory, 'application.html');
  const pdfPath = path.join(tempDirectory, 'application.pdf');

  try {
    const formTable = await buildPrintFormHtml(application);
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { size: 8.5in 13in; margin: 0.25in; }
    * { box-sizing: border-box; }
    html, body { width: 100%; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; }
    .print-page { width: 8in; height: 12.5in; overflow: hidden; }
    .excel-form-table { width: 100%; table-layout: fixed; border-collapse: collapse; border-spacing: 0; transform-origin: top left; }
    .excel-form-table td { box-sizing: border-box; }
  </style>
</head>
<body>
  <main class="print-page">${formTable}</main>
  <script>
    (() => {
      const page = document.querySelector('.print-page');
      const table = page?.querySelector('.excel-form-table');
      if (!page || !table) throw new Error('The marriage license form could not be laid out for printing.');

      const formHeight = table.getBoundingClientRect().height;
      const printableHeight = 12.5 * 96;
      const pageFillFactor = 1.25;
      if (!formHeight) throw new Error('The marriage license form has no printable dimensions.');

      table.style.transform = \`scaleY(\${Math.min(1, (printableHeight / formHeight) * pageFillFactor)})\`;
    })();
  </script>
</body>
</html>`;
    await fs.writeFile(htmlPath, html, 'utf8');

    const browserPath = await findPdfBrowser();
    await execFileAsync(browserPath, [
      '--headless',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-networking',
      '--no-first-run',
      '--no-default-browser-check',
      '--no-pdf-header-footer',
      `--user-data-dir=${path.join(tempDirectory, 'browser-profile')}`,
      `--print-to-pdf=${pdfPath}`,
      pathToFileURL(htmlPath).href,
    ], { timeout: 30000 });

    const pdf = await fs.readFile(pdfPath);
    if (!pdf.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
      throw new Error('The browser did not produce a valid PDF file.');
    }
    return pdf;
  } finally {
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function colorValue(color, fallback = '') {
  if (!color) return fallback;
  if (color.argb) return `#${color.argb.slice(-6)}`;
  if (color.rgb) return `#${color.rgb.slice(-6)}`;
  return fallback;
}

function borderValue(side) {
  if (!side?.style) return '';
  const widths = { hair: '0.5px', dotted: '1px', dashed: '1px', thin: '1px', double: '3px', medium: '2px', thick: '3px' };
  const lineStyle = ['dotted', 'dashed', 'double'].includes(side.style) ? side.style : 'solid';
  return `${widths[side.style] || '1px'} ${lineStyle} ${colorValue(side.color, '#333333')}`;
}

function cellCss(cell, isTemplateText, mergedBorders = {}, isCenterPrompt = false) {
  const style = cell.style || {};
  const font = style.font || {};
  const alignment = style.alignment || {};
  const fill = style.fill || {};
  const fontSize = font.size || 8;
  const css = {
    'text-align': isCenterPrompt || alignment.horizontal === 'centerContinuous' ? 'center' : alignment.horizontal || 'left',
    'vertical-align': alignment.vertical === 'center' ? 'middle' : alignment.vertical || 'top',
    'white-space': alignment.wrapText ? 'pre-wrap' : 'nowrap',
    'font-family': `${font.name || 'Arial'}, sans-serif`,
    'font-size': `${isTemplateText ? fontSize : 8}pt`,
    'font-weight': isTemplateText ? (font.bold ? '700' : '400') : '700',
    'font-style': isTemplateText && font.italic ? 'italic' : 'normal',
    'text-decoration': font.underline ? 'underline' : 'none',
    color: colorValue(font.color, '#111111'),
    padding: '1px 2px',
    overflow: isTemplateText ? 'visible' : 'hidden',
    'text-overflow': 'clip',
    'word-break': 'normal',
  };
  if (fill.type === 'pattern' && fill.pattern === 'solid') css['background-color'] = colorValue(fill.fgColor, 'transparent');
  for (const side of ['top', 'right', 'bottom', 'left']) {
    const border = borderValue(style.border?.[side] || mergedBorders[side]);
    if (border) css[`border-${side}`] = border;
  }
  if (alignment.indent) css['padding-left'] = `${2 + alignment.indent * 8}px`;
  return Object.entries(css).map(([key, value]) => `${key}:${escapeHtml(value)}`).join(';');
}

function mergeLayout(sheet, additionalMerges = []) {
  const starts = new Map();
  const skipped = new Set();

  for (const range of [...sheet.model.merges, ...additionalMerges]) {
    const [start, end] = range.split(':');
    const startCell = sheet.getCell(start);
    const endCell = sheet.getCell(end);
    if (startCell.row > FORM_ROWS || startCell.col > FORM_COLUMNS) continue;
    const visibleColumns = Array.from(
      { length: Math.min(endCell.col, FORM_COLUMNS) - startCell.col + 1 },
      (_, index) => startCell.col + index,
    ).filter((column) => !sheet.getColumn(column).hidden);
    if (visibleColumns.length === 0) continue;

    const visibleStartColumn = visibleColumns[0];
    const visibleEndColumn = visibleColumns[visibleColumns.length - 1];
    const visibleStartCell = sheet.getCell(startCell.row, visibleStartColumn);
    const topRightCell = sheet.getCell(startCell.row, visibleEndColumn);
    const bottomLeftCell = sheet.getCell(Math.min(endCell.row, FORM_ROWS), visibleStartColumn);
    const bottomRightCell = sheet.getCell(Math.min(endCell.row, FORM_ROWS), visibleEndColumn);
    const visibleRowSpan = Array.from(
      { length: Math.min(endCell.row, FORM_ROWS) - startCell.row + 1 },
      (_, index) => startCell.row + index,
    ).filter((rowNumber) => !sheet.getRow(rowNumber).hidden).length;

    starts.set(visibleStartCell.address, {
      rowSpan: visibleRowSpan,
      colSpan: visibleColumns.length,
      valueSource: startCell.address,
      borders: {
        top: visibleStartCell.style?.border?.top || topRightCell.style?.border?.top,
        right: topRightCell.style?.border?.right || bottomRightCell.style?.border?.right,
        bottom: bottomLeftCell.style?.border?.bottom || bottomRightCell.style?.border?.bottom,
        left: visibleStartCell.style?.border?.left || bottomLeftCell.style?.border?.left,
      },
    });
    for (let row = startCell.row; row <= Math.min(endCell.row, FORM_ROWS); row += 1) {
      for (let column = startCell.col; column <= Math.min(endCell.col, FORM_COLUMNS); column += 1) {
        const address = sheet.getCell(row, column).address;
        if (address !== visibleStartCell.address) skipped.add(address);
      }
    }
  }
  return { starts, skipped };
}

async function buildPrintFormHtml(application) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMPLATE_PATH);
  const sheet = workbook.getWorksheet('Front');
  if (!sheet) throw new Error('The workbook does not contain its Front form sheet.');

  sheet.getCell('P28').value = null;
  sheet.getCell('B27').value = '(Day)';
  sheet.getCell('U27').value = '(Day)';
  sheet.getCell('G17').value = sheet.getCell('X17').value;

  const templateTextCells = new Set();
  for (let row = 1; row <= FORM_ROWS; row += 1) {
    for (let column = 1; column <= FORM_COLUMNS; column += 1) {
      const cell = sheet.getCell(row, column);
      if (cell.value !== null && cell.value !== undefined && cell.value !== '') templateTextCells.add(cell.address);
    }
  }

  const formValueCells = fillTemplate(sheet, { ...(application.applicationData || {}), ...application });
  const { starts, skipped } = mergeLayout(sheet, ['R32:T32', 'R35:T35', 'R36:T36']);
  const visibleColumns = Array.from({ length: FORM_COLUMNS }, (_, index) => index + 1)
    .filter((column) => !sheet.getColumn(column).hidden);
  const totalWidth = visibleColumns.map((column) => sheet.getColumn(column).width || 8)
    .reduce((sum, width) => sum + width, 0);
  const columns = visibleColumns.map((column) => (
    `<col style="width:${((sheet.getColumn(column).width || 8) / totalWidth) * 100}%">`
  )).join('');
  const rows = [];

  for (let rowNumber = 1; rowNumber <= FORM_ROWS; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    if (row.hidden) continue;
    const cells = [];
    for (let column = 1; column <= FORM_COLUMNS; column += 1) {
      if (sheet.getColumn(column).hidden) continue;
      const cell = sheet.getCell(rowNumber, column);
      if (skipped.has(cell.address)) continue;
      const span = starts.get(cell.address) || {};
      const valueCell = span.valueSource ? sheet.getCell(span.valueSource) : cell;
      const isTemplateText = templateTextCells.has(valueCell.address) && !formValueCells.has(valueCell.address);
      const isCenterPrompt = isTemplateText && valueCell.col >= 18 && valueCell.col <= 20 && valueCell.row >= 23 && valueCell.row <= 64;
      const text = valueCell.value === null || valueCell.value === undefined ? '' : valueCell.text || String(valueCell.value);
      const rowSpan = span.rowSpan ? ` rowspan="${span.rowSpan}"` : '';
      const colSpan = span.colSpan ? ` colspan="${span.colSpan}"` : '';
      const cellClass = [
        isTemplateText ? 'template-text' : 'form-value',
        isCenterPrompt ? 'center-prompt' : '',
      ].filter(Boolean).join(' ');
      cells.push(`<td class="${cellClass}" data-cell="${cell.address}"${rowSpan}${colSpan} style="${cellCss(valueCell, isTemplateText, span.borders, isCenterPrompt)}">${escapeHtml(text)}</td>`);
    }
    const height = ((row.height || 12.75) * 96) / 72;
    rows.push(`<tr style="height:${height}px">${cells.join('')}</tr>`);
  }

  return `<table class="excel-form-table" aria-label="Completed Application for Marriage License"><colgroup>${columns}</colgroup><tbody>${rows.join('')}</tbody></table>`;
}

module.exports = { buildPrintFormHtml, buildPrintFormPdf };
