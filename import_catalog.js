/**
 * EVO Remark Catalog Importer
 * 
 * Reads all sheets from the EVO Generic Description Excel file
 * and imports them into the `remark_catalog` table in Supabase.
 * 
 * Usage: node import_catalog.js
 */

require('dotenv').config();
const ExcelJS = require('exceljs');
const { createClient } = require('@supabase/supabase-js');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const EXCEL_FILE = 'EVO & EVO_Pas Generic Description rev-20 (3.29.2024).xlsx';

// Map sheet names to clean Russian category names
const CATEGORY_MAP = {
  // Russian-named sheets
  'Дизель, Воздухоподача и др. ': 'Дизель',
  'Система водяного охлажд. дизеля': 'Система охлаждения',
  'Сист смаз, труб-воды, маслоохл': 'Система смазки',
  'Топл сист(Низк и высок давл)': 'Топливная система',
  'Компр-р и Автоторм Обор': 'Компрессор и Автотормоз',
  'GE Эл Схемы и Электрич Обор-е': 'GE Электросхемы',
  'Камк Эл Схемы и Элект Обор-е': 'Камкор Электросхемы',
  'Электронн-е Обор(BSS,EGU,DID тд': 'Электроника',
  'Ходовая(Тележ,Автосц,Рычаж)': 'Ходовая часть',
  'Камкор КМБ': 'Камкор КМБ',
  'Кузов и Кабина Маш-та': 'Кузов и Кабина',
  // English-named sheets (detailed)
  '1Engine Description': 'Дизель',
  '2Water coolingSystem,Piping,Rad': 'Система охлаждения',
  '3Engine lubrication system': 'Система смазки',
  '4Fire Supression System': 'Пожаротушение',
  '5Propulsion Equipment': 'Тяговое оборудование',
  '6Fuel system': 'Топливная система',
  '7Electrical Machines': 'Электрические машины',
  '8Air Compressor Description': 'Воздушный компрессор',
  '9Electrical Schematics': 'Электросхемы',
  '10Air Brake system': 'Тормозная система',
  '11Сommunication system': 'Сеть передачи данных',
  '12Truck&Platform': 'Тележка и Платформа',
  '13TBU': 'Тормозной цилиндр (ТЦ)',
  '14Combo TM WAG': 'КМБ/КЗП/ТЭД/Колёсная пара',
  '15Carbody and Operator Cab': 'Кузов и Кабина',
};

// Sheets to skip entirely
const SKIP_SHEETS = ['Лист1', 'Лист2'];

async function run() {
  console.log('📖 Reading Excel file...');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_FILE);

  const allItems = [];

  workbook.worksheets.forEach((sheet) => {
    const name = sheet.name.trim();
    if (SKIP_SHEETS.includes(name)) return;

    const category = CATEGORY_MAP[name] || CATEGORY_MAP[sheet.name] || name;

    // Detect column layout
    // Most sheets: code=col2, en=col3, ru=col4
    // Some sheets (like 15Carbody): code=col1, en=col2, ru=col3
    let codeCol = 2, enCol = 3, ruCol = 4;

    const testRow = sheet.getRow(5);
    const c1 = String(testRow.getCell(1).value || '').trim();
    const c2 = String(testRow.getCell(2).value || '').trim();
    const c3 = String(testRow.getCell(3).value || '').trim();
    const c4 = String(testRow.getCell(4).value || '').trim();

    // If col1 looks like a code and col4 is empty, data is shifted left
    if (c1.match(/^\.\d+/) && c2.length > 10 && c3.length > 5 && !c4) {
      codeCol = 1; enCol = 2; ruCol = 3;
    }

    let sectionRu = '';

    for (let r = 1; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const rawCode = String(row.getCell(codeCol).value || '').trim();
      const enText = String(row.getCell(enCol).value || '').trim();
      const ruText = String(row.getCell(ruCol).value || '').trim();

      // Detect section headers (e.g. "1.1 Engine Block" / "1.1 Блок дизеля")
      if (!rawCode && ruText && ruText.match(/^\d+\.\d+\s/) && !ruText.includes('Первоначальные')) {
        sectionRu = ruText;
        continue;
      }
      if (!rawCode && enText && enText.match(/^\d+\.\d+\s/) && !enText.includes('Initial Symptoms')) {
        // For English-only sections, use English as section name
        if (!sectionRu) sectionRu = enText;
        continue;
      }

      // Skip non-data rows
      if (!rawCode || rawCode.length < 3) continue;

      // Clean the code: remove leading/trailing dots -> "6.0.1"
      const code = rawCode.replace(/^\./, '').replace(/\.$/, '').trim();
      if (!code) continue;

      // We need at least one text
      const description = ruText || enText;
      if (!description || description.length < 3) continue;

      // Determine if this item has a fillable field
      const hasPlaceholder = description.includes('#___') || 
                              description.includes('№___') || 
                              description.includes('описать здесь') ||
                              description.includes('Описать здесь') ||
                              description.includes('(describe here)');

      allItems.push({
        code,
        category,
        section: sectionRu || null,
        description_ru: ruText || null,
        description_en: enText || null,
        has_placeholder: hasPlaceholder,
        is_active: true,
      });
    }
  });

  // Deduplicate by code (prefer the entry with Russian text)
  const deduped = new Map();
  for (const item of allItems) {
    const existing = deduped.get(item.code);
    if (!existing) {
      deduped.set(item.code, item);
    } else if (!existing.description_ru && item.description_ru) {
      // Replace if existing has no Russian but new one does
      deduped.set(item.code, item);
    }
    // If both have Russian text and same code but different categories, keep both with modified key
    else if (existing.description_ru && item.description_ru && existing.category !== item.category) {
      deduped.set(item.code + '_' + item.category, item);
    }
  }

  const items = Array.from(deduped.values());
  console.log(`✅ Parsed ${items.length} unique catalog items from ${workbook.worksheets.length} sheets`);

  // Show sample
  console.log('\n--- Sample items ---');
  items.slice(0, 5).forEach(i => {
    console.log(`  ${i.code} [${i.category}] ${i.description_ru || i.description_en}`);
  });

  // Stats by category
  const byCat = {};
  items.forEach(i => { byCat[i.category] = (byCat[i.category] || 0) + 1; });
  console.log('\n--- Items per category ---');
  Object.entries(byCat).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });

  // Insert into Supabase in batches of 500
  console.log('\n🚀 Inserting into Supabase...');
  
  // First, clear existing catalog data
  const { error: deleteError } = await supabase
    .from('remark_catalog')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

  if (deleteError) {
    console.log('⚠️  Could not clear existing data (table may not exist yet):', deleteError.message);
    console.log('   Please create the table first using the SQL below, then re-run this script.');
    console.log(`
-- Run this in Supabase SQL Editor:
CREATE TABLE IF NOT EXISTS remark_catalog (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  category TEXT NOT NULL,
  section TEXT,
  description_ru TEXT,
  description_en TEXT,
  has_placeholder BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_remark_catalog_category ON remark_catalog(category);
CREATE INDEX IF NOT EXISTS idx_remark_catalog_code ON remark_catalog(code);

-- RLS
ALTER TABLE remark_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read catalog" ON remark_catalog
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage catalog" ON remark_catalog
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_global_admin = true)
  );
    `);
    return;
  }

  const BATCH_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('remark_catalog').insert(batch);
    
    if (error) {
      console.error(`❌ Error inserting batch ${i / BATCH_SIZE + 1}:`, error.message);
      return;
    }
    
    inserted += batch.length;
    console.log(`  Inserted ${inserted} / ${items.length}...`);
  }

  console.log(`\n✅ Successfully imported ${inserted} catalog items!`);
}

run().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
