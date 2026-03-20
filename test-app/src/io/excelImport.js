import ExcelJS from 'exceljs';
import { calcDeltaT } from '../calc/heatCalc';

// Маппинг названий параметров → ключей state
// Поддерживаем вариации написания (регистр не важен, ищем подстроку)
const PARAM_MAP = [
  { keys: ['название проекта', 'наименование проекта', 'проект'], field: 'projectName' },
  { keys: ['система отопления', 'система'], field: 'systemType' },
  { keys: ['разводка', 'distribution'], field: 'distribution' },
  { keys: ['теплоноситель', 'график', 'температурный график'], field: 'schedule', transform: v => String(v).replace(/[°CС\s]/g, '') },
  { keys: ['расход тепла'], field: 'heatLoad_kW', transform: v => parseFloat(v) || 0 },
  { keys: ['кол-во окон', 'количество окон', 'окон'], field: 'windowCount', transform: v => parseInt(v) || 0 },
  { keys: ['высота простенка'], field: 'wallHeight_mm', transform: v => parseInt(v) || 0 },
  { keys: ['высота стяжки'], field: 'screedHeight_mm', transform: v => parseInt(v) || 100 },
  { keys: ['высота этажа'], field: 'floorHeight_mm', transform: v => parseInt(v) || 3000 },
  { keys: ['толщина изоляции'], field: 'insulationThickness_mm', transform: v => parseInt(v) || 13 },
  { keys: ['этажи', 'этажность'], field: 'floors' },
  { keys: ['квартир (всего)', 'квартир всего', 'всего квартир'], field: 'apartments', transform: v => parseInt(v) || 0 },
  { keys: ['квартир на этаже'], field: 'apartmentsPerFloor', transform: v => parseInt(v) || 0 },
  { keys: ['пар стояков'], field: 'riserPairs', transform: v => parseInt(v) || 0 },
  { keys: ['выходов гребёнок', 'выходов гребенок', 'гребёнок', 'гребенок'], field: 'manifoldOutputs', transform: v => parseInt(v) || 0 },
  { keys: ['зон отопления', 'зоны отопления'], field: 'heatingZones', transform: v => parseInt(v) || 1 },
  { keys: ['границы зон'], field: 'zoneBoundaries', transform: v => {
    if (!v || String(v).trim() === '') return [];
    return String(v).split(/[,;\s]+/).map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0);
  }},
  { keys: ['длина коридора'], field: 'corridorLength_m', transform: v => parseFloat(v) || 0 },
  { keys: ['комнат на квартиру', 'комнат/квартиру', 'ср. кол-во комнат'], field: 'roomsPerApartment', transform: v => parseInt(v) || 2 },
  { keys: ['тип разводки'], field: 'pexRoutingType', transform: v => {
    const s = String(v).toLowerCase();
    return s.includes('попутн') || s.includes('series') || s.includes('тройник') ? 'series' : 'radial';
  }},
];

// Парсим строки окон
// Формат 1: «Ширина 1700 мм» → кол-во (старый шаблон)
// Формат 2: заголовок «ширина простенка окна мм/кол-во», далее числовые строки: ширина → кол-во
function isWindowRow(paramName) {
  const n = String(paramName).toLowerCase();
  return n.includes('ширина') && n.match(/\d+/);
}

function isWindowSectionHeader(paramName) {
  const n = String(paramName).toLowerCase().trim();
  return n.includes('ширина') && n.includes('окна') && n.includes('кол');
}

function parseWindowRow(paramName, value) {
  const wMatch = String(paramName).match(/(\d+)/);
  const width_mm = wMatch ? parseInt(wMatch[1]) : 0;
  const count = parseInt(value) || 0;
  return { width_mm, count };
}

// Найти поле по названию параметра
function findField(paramName) {
  const n = String(paramName).toLowerCase().trim();
  for (const mapping of PARAM_MAP) {
    for (const key of mapping.keys) {
      if (n.includes(key)) return mapping;
    }
  }
  return null;
}

/**
 * Парсит двухколоночный массив строк [параметр, значение] в объект state
 */
export function parseImportRows(rows) {
  const result = {};
  const windowGroups = [];
  let inWindowSection = false;

  for (const row of rows) {
    const paramName = row[0];
    const value = row[1];
    if (!paramName || String(paramName).trim() === '') continue;

    // Заголовок секции окон — «ширина простенка окна мм/кол-во»
    if (isWindowSectionHeader(paramName)) {
      inWindowSection = true;
      continue;
    }

    // В секции окон: числовые строки (ширина → кол-во)
    if (inWindowSection) {
      const width = parseInt(paramName);
      const count = parseInt(value) || 0;
      if (!isNaN(width) && width > 0 && count > 0) {
        windowGroups.push({ width_mm: width, count });
      }
      // Если строка не числовая — выходим из секции окон
      if (isNaN(width)) inWindowSection = false;
      else continue;
    }

    // Окна формата «Ширина 1700 мм» → кол-во
    if (isWindowRow(paramName)) {
      const wg = parseWindowRow(paramName, value);
      if (wg.width_mm > 0 && wg.count > 0) windowGroups.push(wg);
      continue;
    }

    // Секционные заголовки — пропускаем
    const n = String(paramName).toLowerCase().trim();
    if (['окна', 'параметр', 'ед. изм.', 'значение'].includes(n)) continue;

    const mapping = findField(paramName);
    if (mapping) {
      result[mapping.field] = mapping.transform ? mapping.transform(value) : String(value || '');
    }
  }

  // Формируем state для dispatch
  const state = {};

  if (result.projectName) state.projectName = result.projectName;
  if (result.systemType) state.systemType = result.systemType;
  if (result.distribution) state.distribution = result.distribution;

  // Теплотехника
  const schedule = result.schedule || '80/60';
  state.schedule = schedule;
  state.deltaT = calcDeltaT(schedule, 20);
  state.tInside = 20;

  if (result.heatLoad_kW != null) {
    state.heatLoad_W = result.heatLoad_kW * 1000;
  }

  // Здание
  if (result.wallHeight_mm != null) state.wallHeight_mm = result.wallHeight_mm;
  if (result.screedHeight_mm != null) state.screedHeight_mm = result.screedHeight_mm;
  if (result.floorHeight_mm != null) state.floorHeight_mm = result.floorHeight_mm;
  if (result.insulationThickness_mm != null) state.insulationThickness_mm = result.insulationThickness_mm;
  if (result.floors != null) state.floors = result.floors;
  if (result.apartments != null) state.apartments = result.apartments;
  if (result.apartmentsPerFloor != null) state.apartmentsPerFloor = result.apartmentsPerFloor;
  if (result.corridorLength_m != null) state.corridorLength_m = result.corridorLength_m;
  if (result.roomsPerApartment != null) state.roomsPerApartment = result.roomsPerApartment;

  // Трубопроводы
  if (result.riserPairs != null) state.riserPairs = result.riserPairs;
  if (result.manifoldOutputs != null) state.manifoldOutputs = result.manifoldOutputs;
  if (result.heatingZones != null) state.heatingZones = result.heatingZones;
  if (result.zoneBoundaries != null) state.zoneBoundaries = result.zoneBoundaries;
  if (result.pexRoutingType != null) state.pexRoutingType = result.pexRoutingType;

  // Окна
  if (windowGroups.length > 0) {
    const allWindows = [];
    let totalWindows = 0;
    windowGroups.forEach(wg => {
      for (let i = 0; i < wg.count; i++) {
        allWindows.push({ width_mm: wg.width_mm, deviceLength_mm: Math.max(0, wg.width_mm - 200) });
      }
      totalWindows += wg.count;
    });
    state.windows = allWindows;
    state.windowCount = totalWindows;
  } else if (result.windowCount) {
    state.windowCount = result.windowCount;
    state.windows = Array.from({ length: result.windowCount }, () => ({ width_mm: 0, deviceLength_mm: 0 }));
  }

  return state;
}

// --- Хелпер для извлечения значения ячейки ---
// ExcelJS может возвращать richText-объекты, формулы, гиперссылки
function cellValue(val) {
  if (val == null) return null;
  if (typeof val === 'object') {
    if (val.richText) return val.richText.map(r => r.text || '').join('');
    if ('result' in val) return val.result; // формула
    if (val.text != null) return val.text;  // гиперссылка
  }
  return val;
}

function cellStr(val) {
  const v = cellValue(val);
  return v != null ? String(v) : '';
}

// --- Многокорпусный формат ---
// Строка 1: названия проектов/корпусов в столбцах
// Строка 2: секции + «Итог» для каждого корпуса
// Строки 3+: параметры в столбце A, значения в столбцах корпусов
// Окна: секция «ширина простенка окна мм/кол-во», ширина в столбце A, кол-во в столбце корпуса

const MULTI_PARAM_MAP = [
  { keys: ['расход тепла'], field: 'heatLoad_kW', transform: v => parseFloat(v) || 0 },
  { keys: ['кол во окон', 'кол-во окон', 'количество окон'], field: 'windowCount', transform: v => parseInt(v) || 0 },
  { keys: ['высота стяжки'], field: 'screedHeight_mm', transform: v => parseInt(v) || 100 },
  { keys: ['высота этажа'], field: 'floorHeight_mm', transform: v => parseInt(v) || 3000 },
  { keys: ['толщина изоляции'], field: 'insulationThickness_mm', transform: v => parseInt(v) || 13 },
  { keys: ['этажей корпуса', 'кол во этажей', 'кол-во этажей'], field: 'floors', transform: v => parseInt(v) || 0 },
  { keys: ['количество квартир'], field: 'apartments', transform: v => parseInt(v) || 0 },
  { keys: ['зон отопления', 'зоны отопления'], field: 'heatingZones', transform: v => parseInt(v) || 1 },
  { keys: ['границы зон'], field: 'zoneBoundaries', transform: v => {
    if (v == null || String(v).trim() === '') return [];
    return String(v).split(/[,;\s]+/).map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0);
  }},
  { keys: ['тип разводки'], field: 'pexRoutingType', transform: v => {
    const s = String(v).toLowerCase();
    return s.includes('попутн') || s.includes('тройник') ? 'series' : 'radial';
  }},
  { keys: ['температурный график'], field: 'schedule', transform: v => String(v).replace(/[°CС\s]/g, '') },
  { keys: ['высота простенка'], field: 'wallHeight_mm', transform: v => parseInt(v) || 0 },
  { keys: ['длина коридора'], field: 'corridorLength_m', transform: v => parseFloat(v) || 0 },
  { keys: ['комнат на квартиру', 'комнат/квартиру'], field: 'roomsPerApartment', transform: v => parseInt(v) || 2 },
  { keys: ['квартир на этаже', 'этажи/кол во квартир', 'этажи/кол-во квартир'], field: 'apartmentsPerFloor', transform: v => parseInt(v) || 0 },
  { keys: ['пар стояков'], field: 'riserPairs', transform: v => parseInt(v) || 0 },
  { keys: ['выходов гребёнок', 'выходов гребенок', 'гребёнок', 'гребенок'], field: 'manifoldOutputs', transform: v => parseInt(v) || 0 },
];

function findMultiField(paramName) {
  const n = cellStr(paramName).toLowerCase().replace(/[^\wа-яё\s/\-]/gi, '').trim();
  for (const mapping of MULTI_PARAM_MAP) {
    for (const key of mapping.keys) {
      if (n.includes(key)) return mapping;
    }
  }
  return null;
}

function isMultiBuildingFormat(ws) {
  const a1 = cellStr(ws.getRow(1).getCell(1).value).toLowerCase();
  const a2 = cellStr(ws.getRow(2).getCell(1).value).toLowerCase();
  if (!a1 || !a2) return false;
  return (a1.includes('название') || a1.includes('корпус')) && a2.includes('секци');
}

function parseMultiBuildingSheet(ws) {
  const getVal = (r, c) => cellValue(ws.getRow(r).getCell(c).value);
  const getStr = (r, c) => cellStr(ws.getRow(r).getCell(c).value);

  // Находим столбцы «Итог» — итерируем ячейки строки 2
  const buildingCols = [];
  const row2 = ws.getRow(2);
  row2.eachCell({ includeEmpty: false }, (cell, colNum) => {
    if (colNum <= 1) return;
    const val = cellStr(cell.value).toLowerCase().trim();
    if (val.includes('итог')) {
      // Имя корпуса из строки 1
      let name = getStr(1, colNum);
      if (!name) {
        for (let cc = colNum - 1; cc >= 2; cc--) {
          const v = getStr(1, cc);
          if (v) { name = v; break; }
        }
      }
      name = (name || `Корпус ${buildingCols.length + 1}`).trim();
      buildingCols.push({ col: colNum, name });
    }
  });

  if (buildingCols.length === 0) return null;

  // Сканируем параметры в столбце A — итерируем строки
  const maxRow = ws.actualRowCount || ws.rowCount || 200;
  const paramRows = {};
  let windowSectionRow = -1;

  for (let r = 3; r <= maxRow; r++) {
    const raw = ws.getRow(r).getCell(1).value;
    const paramName = cellValue(raw);
    if (paramName == null) continue;
    const n = cellStr(raw).toLowerCase().trim();

    // Секция окон
    if (n.includes('ширина') && n.includes('окна') && n.includes('кол')) {
      windowSectionRow = r;
      continue;
    }

    const mapping = findMultiField(raw);
    if (mapping && !paramRows[mapping.field]) {
      paramRows[mapping.field] = { row: r, mapping };
    }
  }

  // Извлекаем данные для каждого корпуса
  const buildings = {};
  for (const { col, name } of buildingCols) {
    const bldg = { name };

    // Считываем параметры
    for (const [field, { row, mapping }] of Object.entries(paramRows)) {
      const val = getVal(row, col);
      if (val != null) {
        bldg[field] = mapping.transform ? mapping.transform(val) : val;
      }
    }

    // Окна: ширина в столбце A, кол-во в столбце корпуса
    const windows = [];
    if (windowSectionRow > 0) {
      for (let r = windowSectionRow + 1; r <= maxRow; r++) {
        const widthRaw = getVal(r, 1);
        const width = parseInt(widthRaw);
        if (isNaN(width) || width <= 0) {
          if (widthRaw != null && String(widthRaw).trim() !== '') break;
          continue;
        }
        const count = parseInt(getVal(r, col)) || 0;
        if (count > 0) {
          windows.push({ width_mm: width, count });
        }
      }
    }
    bldg.windows = windows;
    bldg.totalWindows = bldg.windowCount || windows.reduce((s, w) => s + w.count, 0);

    buildings[name] = bldg;
  }

  const firstName = buildingCols[0]?.name || '';
  const projectName = firstName.replace(/\s*корпус\s*[\d.+]+.*/i, '').trim() || firstName;

  return { isMultiBuilding: true, projectName, buildings };
}

/**
 * Импорт из Excel-файла (.xlsx)
 * Автоматически определяет формат: многокорпусный или двухколоночный
 */
export async function importFromExcel(file) {
  const wb = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await wb.xlsx.load(buffer);

  const ws = wb.worksheets[0];
  if (!ws) throw new Error('Файл не содержит листов');

  // Определяем формат
  if (isMultiBuildingFormat(ws)) {
    const result = parseMultiBuildingSheet(ws);
    if (result) return result;
  }

  // Двухколоночный формат (параметр → значение)
  const rows = [];
  ws.eachRow((row) => {
    const cells = [];
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      if (colNum <= 2) cells[colNum - 1] = cellValue(cell.value);
    });
    if (cells.length > 0) rows.push([cells[0] != null ? cells[0] : '', cells[1] != null ? cells[1] : '']);
  });

  return parseImportRows(rows);
}

/**
 * Импорт из Google Sheets (по URL опубликованной таблицы)
 * Поддерживает:
 * - https://docs.google.com/spreadsheets/d/SHEET_ID/edit...
 * - https://docs.google.com/spreadsheets/d/SHEET_ID/pub...
 */
export async function importFromGoogleSheets(url) {
  // Извлекаем ID таблицы
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) throw new Error('Не удалось определить ID таблицы из URL');

  const sheetId = match[1];

  // Пробуем получить как CSV (для опубликованных таблиц)
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

  const response = await fetch(csvUrl);
  if (!response.ok) {
    throw new Error(
      'Не удалось загрузить таблицу. Убедитесь, что она опубликована:\n' +
      'Файл → Поделиться → Опубликовать в интернете → Опубликовать'
    );
  }

  const text = await response.text();
  const rows = parseCSV(text);
  return parseImportRows(rows);
}

/**
 * Простой парсер CSV (с поддержкой кавычек)
 */
function parseCSV(text) {
  const lines = text.split('\n');
  const result = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const cells = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (ch === '"') {
        if (inQuotes && trimmed[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());

    if (cells.length >= 2) {
      result.push([cells[0], cells[1]]);
    }
  }

  return result;
}
