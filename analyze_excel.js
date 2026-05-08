const ExcelJS = require('exceljs');

async function run() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('EVO & EVO_Pas Generic Description rev-20 (3.29.2024).xlsx');
  
  // The file has two types of sheets:
  // 1. Russian-named sheets (first ~11) - category summary sheets with data in cols 3-4 (sometimes col 2-3)
  // 2. English-named sheets (numbered 1-15) - detailed description sheets with data in cols 3-4
  // Let's analyze ALL sheets properly, detecting where the actual data columns are
  
  const allItems = [];
  
  workbook.worksheets.forEach((sheet) => {
    const name = sheet.name;
    
    // Skip utility sheets
    if (name === 'Лист1' || name === 'Лист2') return;
    
    // Detect column layout by checking row 3 or 5
    let enCol = 3;
    let ruCol = 4;
    let codeCol = 2;
    
    // Check if first data is in col 2 (like sheet "15Carbody...")
    const testRow5 = sheet.getRow(5);
    const col2val = String(testRow5.getCell(2).value || '');
    const col3val = String(testRow5.getCell(3).value || '');
    const col4val = String(testRow5.getCell(4).value || '');
    
    if (col2val.length > 10 && col3val.length > 10 && !col4val) {
      // Data is in columns 2 (EN) and 3 (RU)
      enCol = 2;
      ruCol = 3;
      codeCol = 1;
    }
    
    let sectionName = '';
    
    for (let r = 1; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const code = String(row.getCell(codeCol).value || '').trim();
      const en = String(row.getCell(enCol).value || '').trim();
      const ru = String(row.getCell(ruCol).value || '').trim();
      
      // Detect section headers (e.g. "1.0 Engine...", "1.1 Engine Block...")
      if (!code && en && en.match(/^\d+\.\d+\s/) && !en.includes('Initial Symptoms')) {
        sectionName = en;
        continue;
      }
      
      // Skip header/section rows
      if (!code || code.length < 3) continue;
      if (en.length < 5) continue;
      
      // This is a data row
      allItems.push({
        sheet: name,
        code: code,
        section: sectionName,
        en: en.substring(0, 120),
        ru: ru ? ru.substring(0, 120) : '(no RU)'
      });
    }
  });
  
  console.log('TOTAL CATALOG ITEMS:', allItems.length);
  console.log('\n--- FIRST 30 items ---');
  allItems.slice(0, 30).forEach((item, i) => {
    console.log(`${i+1}. [${item.sheet}] ${item.code}`);
    console.log(`   EN: ${item.en}`);
    console.log(`   RU: ${item.ru}`);
  });
  
  // Stats by sheet
  console.log('\n--- ITEMS PER SHEET ---');
  const bySheet = {};
  allItems.forEach(item => {
    bySheet[item.sheet] = (bySheet[item.sheet] || 0) + 1;
  });
  Object.entries(bySheet).forEach(([sheet, count]) => {
    console.log(`  ${sheet}: ${count} items`);
  });
}

run();
