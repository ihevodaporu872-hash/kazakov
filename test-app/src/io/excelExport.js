import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { DEVICE_TYPE_LABELS, THERMO_LABELS, VALVE_LABELS } from '../calc/heatCalc';

const COLORS = {
  contractor: 'FFFFFF',
  neighbor: 'FEF9C3',
  market: 'FFF7ED',
  manual: 'DCFCE7',
  missing: 'FEE2E2',
  header: 'DBEAFE',
  total: 'F0F9FF',
};

export async function exportToExcel(state, workRows, materialRows, totalWork, totalMaterials, grandTotal) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Расчёт отопления';
  wb.created = new Date();

  // === Лист 1: Сводка ===
  const ws1 = wb.addWorksheet('Сводка');
  ws1.columns = [{ width: 35 }, { width: 30 }];
  ws1.addRow(['Параметр', 'Значение']);
  styleHeader(ws1.getRow(1));
  ws1.addRow(['Дата расчёта', new Date().toLocaleDateString('ru-RU')]);
  ws1.addRow(['Расход тепла, кВт', (state.heatLoad_W / 1000).toFixed(2)]);
  ws1.addRow(['Кол-во приборов', state.windowCount]);
  ws1.addRow(['Температурный график', state.schedule]);
  ws1.addRow(['Δt, °C', state.deltaT.toFixed(1)]);
  ws1.addRow(['Тип приборов', DEVICE_TYPE_LABELS[state.deviceType] || state.deviceType]);
  ws1.addRow(['Термоголовка', THERMO_LABELS[state.thermoHead] || state.thermoHead]);
  ws1.addRow(['Регулирующий клапан', VALVE_LABELS[state.valve] || state.valve]);
  ws1.addRow(['Подрядчик', state.contractorsData?.contractors?.[state.contractor]?.name || state.contractor]);
  ws1.addRow([]);
  ws1.addRow(['Стоимость работ, руб', Math.round(totalWork)]);
  ws1.addRow(['Стоимость материалов, руб', Math.round(totalMaterials)]);
  const totalRow = ws1.addRow(['ИТОГО, руб', Math.round(grandTotal)]);
  totalRow.font = { bold: true, size: 14 };
  totalRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };

  // === Лист 2: Подбор приборов ===
  const ws2 = wb.addWorksheet('Подбор приборов');
  ws2.columns = [{ width: 8 }, { width: 15 }, { width: 15 }, { width: 12 }, { width: 15 }, { width: 45 }, { width: 15 }];
  ws2.addRow(['№ окна', 'Шир. окна', 'Длина прибора', 'Высота', 'Q треб., Вт', 'Прибор', 'Q факт., Вт']);
  styleHeader(ws2.getRow(1));
  (state.perWindow || []).forEach(w => {
    ws2.addRow([w.idx, w.width, w.devLen, w.devHeight, w.powerReq, w.deviceName, w.powerFact]);
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
