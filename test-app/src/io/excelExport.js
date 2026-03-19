import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { DEVICE_TYPE_LABELS, THERMO_LABELS, VALVE_LABELS } from '../calc/heatCalc';
import { getNumFloors, getTopFloor, calcRiserDiameter, calcZoneRiserLengths } from '../calc/materialCalc';

const COLORS = {
  contractor: 'FFFFFF',
  neighbor: 'FEF9C3',
  market: 'FFF7ED',
  manual: 'DCFCE7',
  missing: 'FEE2E2',
  header: 'DBEAFE',
  total: 'F0F9FF',
  section: 'E8F0FE',
};

export async function exportToExcel(state, workRows, materialRows, totalWork, totalMaterials, grandTotal) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Расчёт отопления';
  wb.created = new Date();

  // === Лист 1: Блок 1 — Исходные данные ===
  const ws1 = wb.addWorksheet('Блок 1 — Исходные данные');
  ws1.columns = [{ width: 40 }, { width: 25 }, { width: 20 }];

  // Заголовок
  const titleRow = ws1.addRow(['БЛОК 1: ИСХОДНЫЕ ДАННЫЕ']);
  titleRow.font = { bold: true, size: 14 };
  ws1.mergeCells('A1:C1');
  ws1.addRow([]);

  // --- Проект ---
  const projSection = ws1.addRow(['ПРОЕКТ']);
  projSection.font = { bold: true, size: 11 };
  projSection.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.section } }; });

  ws1.addRow(['Дата расчёта', new Date().toLocaleDateString('ru-RU')]);
  ws1.addRow(['Наименование проекта', state.projectName || '—']);
  ws1.addRow(['Система отопления', state.systemType || '—']);
  ws1.addRow(['Разводка', state.distribution || '—']);

  ws1.addRow([]);

  // --- Теплотехника ---
  const heatSection = ws1.addRow(['ТЕПЛОТЕХНИЧЕСКИЕ ПАРАМЕТРЫ']);
  heatSection.font = { bold: true, size: 11 };
  heatSection.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.section } }; });

  ws1.addRow(['Параметр', 'Значение', 'Ед. изм.']);
  styleHeader(ws1.getRow(ws1.rowCount));

  ws1.addRow(['Расход тепла', (state.heatLoad_W / 1000).toFixed(2), 'кВт']);
  ws1.addRow(['Расход тепла', (state.heatLoad_W / 1000000).toFixed(4), 'МВт']);
  ws1.addRow(['Расход тепла', (state.heatLoad_W / 1163000).toFixed(4), 'Гкал/ч']);
  ws1.addRow(['Температурный график', state.schedule, '°C']);
  ws1.addRow(['Δt (расчётный)', state.deltaT.toFixed(1), '°C']);
  ws1.addRow(['t внутр. воздуха', state.tInside || 20, '°C']);

  ws1.addRow([]);

  // --- Здание ---
  const bldgSection = ws1.addRow(['ПАРАМЕТРЫ ЗДАНИЯ']);
  bldgSection.font = { bold: true, size: 11 };
  bldgSection.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.section } }; });

  ws1.addRow(['Параметр', 'Значение', 'Ед. изм.']);
  styleHeader(ws1.getRow(ws1.rowCount));

  const numFloors = getNumFloors(state);
  const bldg = state.projectData?.buildings?.[state.selectedBuilding];
  ws1.addRow(['Этажи', bldg?.floors || numFloors, '']);
  ws1.addRow(['Кол-во этажей (расчётное)', numFloors, 'шт']);
  ws1.addRow(['Высота этажа', state.floorHeight_mm || 3000, 'мм']);
  ws1.addRow(['Высота простенка', state.wallHeight_mm || '—', 'мм']);
  ws1.addRow(['Высота стяжки', state.screedHeight_mm || 100, 'мм']);
  ws1.addRow(['Квартир (всего)', state.apartments || '—', 'шт']);
  ws1.addRow(['Квартир на этаже', state.apartmentsPerFloor || '—', 'шт']);
  ws1.addRow(['Длина коридора', state.corridorLength_m || '—', 'м']);

  ws1.addRow([]);

  // --- Отопительные приборы ---
  const devSection = ws1.addRow(['ОТОПИТЕЛЬНЫЕ ПРИБОРЫ']);
  devSection.font = { bold: true, size: 11 };
  devSection.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.section } }; });

  ws1.addRow(['Параметр', 'Значение', 'Ед. изм.']);
  styleHeader(ws1.getRow(ws1.rowCount));

  ws1.addRow(['Кол-во окон (= кол-во приборов)', state.windowCount, 'шт']);
  ws1.addRow(['Тип приборов', DEVICE_TYPE_LABELS[state.deviceType] || state.deviceType, '']);
  ws1.addRow(['Высота прибора', state.deviceHeight_mm || '—', 'мм']);
  ws1.addRow(['Термоголовка', THERMO_LABELS[state.thermoHead] || state.thermoHead, '']);
  ws1.addRow(['Регулирующий клапан', VALVE_LABELS[state.valve] || state.valve, '']);

  ws1.addRow([]);

  // --- Трубопроводы ---
  const pipeSection = ws1.addRow(['ТРУБОПРОВОДЫ']);
  pipeSection.font = { bold: true, size: 11 };
  pipeSection.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.section } }; });

  ws1.addRow(['Параметр', 'Значение', 'Ед. изм.']);
  styleHeader(ws1.getRow(ws1.rowCount));

  ws1.addRow(['Пар стояков (на этаж)', state.riserPairs || '—', 'шт']);
  ws1.addRow(['Зон отопления', state.heatingZones || 1, 'шт']);

  const zoneBoundaries = state.zoneBoundaries || [];
  if (zoneBoundaries.length > 0) {
    ws1.addRow(['Границы зон (этажи)', zoneBoundaries.join(', '), '']);
  }

  // Расчётный DN стояка
  const heatLoad_kW = (state.heatLoad_W || 0) / 1000;
  const riserPairs = state.riserPairs || 0;
  const heatingZones = state.heatingZones || 1;
  const velocity = state.riserVelocity_ms || 0.7;
  const heatPerRiser = riserPairs > 0 ? heatLoad_kW / (riserPairs * heatingZones) : 0;
  const riserDN = calcRiserDiameter(heatPerRiser, state.schedule || '80/60', velocity);
  ws1.addRow(['Скорость теплоносителя в стояке', velocity, 'м/с']);
  ws1.addRow(['Нагрузка на стояк (расчётная)', heatPerRiser.toFixed(2), 'кВт']);
  ws1.addRow(['DN стояка (расчётный)', 'Ду' + riserDN, 'мм']);

  ws1.addRow(['Выходов гребёнок (на этаж)', state.manifoldOutputs || '—', 'шт']);
  ws1.addRow(['Тип разводки PEX', state.pexRoutingType === 'series' ? 'Попутная (тройники)' : 'Лучевая (коллектор)', '']);
  ws1.addRow(['Ср. кол-во комнат / квартиру', state.roomsPerApartment || 2, 'шт']);
  ws1.addRow(['Толщина изоляции', state.insulationThickness_mm || 13, 'мм']);

  ws1.addRow([]);

  // --- Зональный расчёт ---
  if (riserPairs > 0) {
    const zoneSection = ws1.addRow(['ЗОНАЛЬНЫЙ РАСЧЁТ СТОЯКОВ']);
    zoneSection.font = { bold: true, size: 11 };
    zoneSection.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.section } }; });

    ws1.addRow(['Зона', 'Верхний этаж', 'Длина стояка, м']);
    styleHeader(ws1.getRow(ws1.rowCount));

    const floorH_m = (state.floorHeight_mm || 3000) / 1000;
    const topFloor = getTopFloor(state);
    const zoneData = calcZoneRiserLengths(zoneBoundaries, topFloor, floorH_m);
    zoneData.forEach(z => {
      ws1.addRow([`Зона ${z.zoneNum}`, `${z.topFloor} эт. (${z.floorsInZone} эт. в зоне)`, z.riserLength]);
    });
  }

  ws1.addRow([]);

  // --- Подрядчик и итоги ---
  const costSection = ws1.addRow(['ПОДРЯДЧИК И ИТОГИ']);
  costSection.font = { bold: true, size: 11 };
  costSection.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.section } }; });

  ws1.addRow(['Подрядчик', state.contractorsData?.contractors?.[state.contractor]?.name || state.contractor, '']);
  ws1.addRow(['Стоимость работ', Math.round(totalWork), 'руб']);
  ws1.addRow(['Стоимость материалов', Math.round(totalMaterials), 'руб']);
  const totalRow = ws1.addRow(['ИТОГО', Math.round(grandTotal), 'руб']);
  totalRow.font = { bold: true, size: 14 };
  totalRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
  totalRow.getCell(2).numFmt = '#,##0';

  // === Лист 2: Блок 2 — Подбор приборов ===
  const ws2 = wb.addWorksheet('Блок 2 — Подбор приборов');
  ws2.columns = [{ width: 8 }, { width: 50 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 12 }];

  // Заголовок
  const title2 = ws2.addRow(['БЛОК 2: ПОДБОР ПРИБОРОВ ОТОПЛЕНИЯ']);
  title2.font = { bold: true, size: 14 };
  ws2.mergeCells('A1:G1');
  ws2.addRow([]);

  // --- Параметры подбора ---
  const selParams = ws2.addRow(['ПАРАМЕТРЫ ПОДБОРА']);
  selParams.font = { bold: true, size: 11 };
  selParams.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.section } }; });

  ws2.addRow(['', 'Тип приборов', DEVICE_TYPE_LABELS[state.deviceType] || state.deviceType]);
  ws2.addRow(['', 'Температурный график', state.schedule]);
  ws2.addRow(['', 'Δt (расчётный)', state.deltaT.toFixed(1) + ' °C']);
  ws2.addRow(['', 'Удельная мощность (Q на п.м.)', (state.powerPerMeter_W || 0).toFixed(0) + ' Вт/м']);

  if (state.deviceType === 'inFloor') {
    ws2.addRow(['', 'Глубина конвектора', (state.convDepth || 130) + ' мм']);
    ws2.addRow(['', 'Тип конвектора', state.convFan === 'fan' ? 'С вентилятором' : 'Без вентилятора']);
  } else {
    ws2.addRow(['', 'Единая высота радиатора', (state.panelHeight || state.deviceHeight_mm || '—') + ' мм']);
  }

  ws2.addRow([]);

  // --- Сгруппированная ведомость ---
  const perWindow = state.perWindow || [];
  const grouped = {};
  perWindow.forEach(w => {
    const key = w.deviceName;
    if (!grouped[key]) grouped[key] = { deviceName: w.deviceName, count: 0, powerReq: w.powerReq, powerFact: w.powerFact };
    grouped[key].count++;
  });
  const groupedArr = Object.values(grouped).map(g => ({
    ...g,
    margin: g.powerReq > 0 ? ((g.powerFact - g.powerReq) / g.powerReq * 100) : 0
  }));

  const grpSection = ws2.addRow(['ВЕДОМОСТЬ ПОДБОРА (сгруппировано)']);
  grpSection.font = { bold: true, size: 11 };
  grpSection.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.section } }; });

  ws2.addRow(['№', 'Прибор', 'Кол-во', 'Q треб., Вт', 'Q факт., Вт', 'Запас, %']);
  styleHeader(ws2.getRow(ws2.rowCount));

  groupedArr.forEach((g, i) => {
    ws2.addRow([i + 1, g.deviceName, g.count, g.powerReq, g.powerFact,
      (g.margin >= 0 ? '+' : '') + g.margin.toFixed(0) + '%']);
  });

  // Итого
  const totalReq = perWindow.reduce((s, w) => s + (w.powerReq || 0), 0);
  const totalFact = perWindow.reduce((s, w) => s + (w.powerFact || 0), 0);
  const totalMargin = totalReq > 0 ? ((totalFact - totalReq) / totalReq * 100) : 0;
  const grpTotal = ws2.addRow(['', 'ИТОГО', perWindow.length, totalReq, totalFact,
    (totalMargin >= 0 ? '+' : '') + totalMargin.toFixed(1) + '%']);
  grpTotal.font = { bold: true };
  grpTotal.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
  grpTotal.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };

  ws2.addRow([]);

  // --- Детальная таблица по окнам ---
  const detSection = ws2.addRow(['ДЕТАЛЬНЫЙ ПОДБОР ПО ОКНАМ']);
  detSection.font = { bold: true, size: 11 };
  detSection.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.section } }; });

  ws2.addRow(['№ окна', 'Прибор', 'Шир. окна', 'Длина прибора', 'Высота', 'Q треб., Вт', 'Q факт., Вт']);
  styleHeader(ws2.getRow(ws2.rowCount));

  perWindow.forEach(w => {
    ws2.addRow([w.idx, w.deviceName, w.width, w.devLen, w.devHeight, w.powerReq, w.powerFact]);
  });

  // === Лист 3: Спецификация ===
  const ws3 = wb.addWorksheet('Спецификация');
  ws3.columns = [{ width: 8 }, { width: 45 }, { width: 30 }, { width: 8 }, { width: 10 }];
  ws3.addRow(['№', 'Наименование', 'Характеристики', 'Ед.', 'Кол-во']);
  styleHeader(ws3.getRow(1));
  (state.specData || []).forEach(s => {
    ws3.addRow([s.num, s.name, s.chars, s.unit, s.qty]);
  });

  // === Лист 4: Расценки работ ===
  const ws4 = wb.addWorksheet('Расценки работ');
  ws4.columns = [{ width: 6 }, { width: 50 }, { width: 10 }, { width: 15 }, { width: 15 }];
  ws4.addRow(['№', 'Наименование', 'Ед.', 'Цена, руб', 'Источник']);
  styleHeader(ws4.getRow(1));
  workRows.forEach((r, i) => {
    const row = ws4.addRow([i + 1, r.name, r.unit, Math.round(r.resolved.price || 0), getSourceText(r.resolved)]);
    const color = COLORS[r.resolved.source] || COLORS.contractor;
    row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + color } };
  });
  const tWorkRow = ws4.addRow(['', '', '', Math.round(totalWork), 'ИТОГО']);
  tWorkRow.font = { bold: true };

  // === Лист 5: Материалы ===
  const ws5 = wb.addWorksheet('Материалы');
  ws5.columns = [{ width: 6 }, { width: 45 }, { width: 10 }, { width: 10 }, { width: 15 }, { width: 15 }];
  ws5.addRow(['№', 'Наименование', 'Ед.', 'Кол-во', 'Цена ед.', 'Стоимость']);
  styleHeader(ws5.getRow(1));
  materialRows.forEach(r => {
    ws5.addRow([r.num, r.name, r.unit, r.qty, Math.round(r.unitPrice), Math.round(r.cost)]);
  });
  const tMatRow = ws5.addRow(['', '', '', '', '', Math.round(totalMaterials)]);
  tMatRow.font = { bold: true };

  // === Лист 6: Итоговая смета ===
  const ws6 = wb.addWorksheet('Итоговая смета');
  ws6.columns = [{ width: 6 }, { width: 50 }, { width: 20 }];
  ws6.addRow(['', 'Позиция', 'Сумма, руб']);
  styleHeader(ws6.getRow(1));
  ws6.addRow(['1', 'Стоимость работ', Math.round(totalWork)]);
  ws6.addRow(['2', 'Стоимость материалов', Math.round(totalMaterials)]);
  const grandRow = ws6.addRow(['', 'ИТОГО', Math.round(grandTotal)]);
  grandRow.font = { bold: true, size: 14 };
  grandRow.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };

  // Сохранение
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `raschet_otoplenie_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function styleHeader(row) {
  row.font = { bold: true };
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.header } };
    cell.border = { bottom: { style: 'thin' } };
  });
}

function getSourceText(resolved) {
  if (resolved.source === 'contractor') return 'подрядчик';
  if (resolved.source === 'neighbor') return `от ${resolved.sourceLabel}`;
  if (resolved.source === 'market') return 'рыночная';
  if (resolved.source === 'manual') return 'ручная';
  return 'нет данных';
}
