export function fmt(n) {
  return Math.round(n).toLocaleString('ru-RU');
}

export function toWatts(val, unit) {
  if (unit === 'gcal') return val * 1163000;
  if (unit === 'mw') return val * 1000000;
  return val * 1000; // kw
}

export function calcDeltaT(schedule, tInside) {
  const [ts, tr] = schedule.split('/').map(Number);
  return ((ts + tr) / 2) - tInside;
}

// EN 442: Q_fact = Q_cat * (Δt_fact / Δt_cat)^1.3
export function correctPower(qCat, dtCat, dtFact) {
  if (dtCat === dtFact) return qCat;
  return qCat * Math.pow(dtFact / dtCat, 1.3);
}

export const STD_LENGTHS = [400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1400, 1600, 1800, 2000, 2300, 2600, 3000];

export function nearestStdLength(mm) {
  for (const s of STD_LENGTHS) {
    if (s >= mm) return s;
  }
  return STD_LENGTHS[STD_LENGTHS.length - 1];
}

export function nearestStdLengthDown(mm) {
  let best = STD_LENGTHS[0];
  for (const s of STD_LENGTHS) {
    if (s <= mm) best = s;
  }
  return best;
}

export function getAvailableHeights(catalog, panelType) {
  const panel = catalog[panelType];
  if (!panel) return [];
  return Object.keys(panel).map(Number).sort((a, b) => a - b);
}

export const PIPE_PRICES = {
  ppr: { 20: 400, 25: 500, 32: 650, 40: 850, 63: 1300 },
  pex: { 16: 350, 20: 420, 25: 550, 32: 750 }
};

export const FITTING_RATE = 0.40;
export const SMART_PIPE_DISCOUNT = 0.25;
export const SMART_FITTING_DISCOUNT = 0.30;

export const SCHEDULES = [
  { value: '95/70', label: '95/70°C' },
  { value: '90/70', label: '90/70°C' },
  { value: '80/60', label: '80/60°C' },
  { value: '70/55', label: '70/55°C' },
  { value: '60/40', label: '60/40°C' },
];

export const THERMO_OPTIONS = [
  { value: 'danfoss_ra2991', label: 'Danfoss RA 2991', desc: 'Встроенный датчик, 5–26°C, клипса RA' },
  { value: 'danfoss_remote', label: 'Danfoss с выносным датчиком', desc: 'Выносной датчик (2м), для внутрипольных / ниш' },
  { value: 'oventrop_uni', label: 'Oventrop Uni LH', desc: 'Встроенный датчик, 7–28°C, M30×1.5' },
  { value: 'none', label: 'Без термоголовки', desc: 'Ручной маховичок' },
];

export const VALVE_OPTIONS = [
  { value: 'included', label: 'В составе прибора', desc: 'Клапан встроен в прибор' },
  { value: 'danfoss_ra_n', label: 'Danfoss RA-N', desc: 'Клапан термостатический DN15, прямой' },
  { value: 'oventrop_av9', label: 'Oventrop AV9', desc: 'Клапан термостатический DN15, угловой' },
  { value: 'imi_eclipse', label: 'IMI Eclipse', desc: 'Клапан с преднастройкой, DN15-20' },
];

export const THERMO_LABELS = {
  'danfoss_ra2991': 'Danfoss RA 2991 (встроенный датчик)',
  'danfoss_remote': 'Danfoss с выносным датчиком',
  'oventrop_uni': 'Oventrop Uni LH',
  'none': 'Без термоголовки'
};

export const VALVE_LABELS = {
  'included': 'В составе прибора',
  'danfoss_ra_n': 'Danfoss RA-N DN15',
  'oventrop_av9': 'Oventrop AV9 DN15',
  'imi_eclipse': 'IMI Eclipse DN15'
};

export const DEVICE_TYPE_LABELS = {
  'inFloor': 'Внутрипольные конвекторы',
  'floor': 'Напольные радиаторы / конвекторы',
  'wall': 'Настенные радиаторы'
};
