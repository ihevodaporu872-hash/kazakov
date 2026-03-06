import React from 'react';
import StepCard from '../components/StepCard';
import { useProject } from '../state/ProjectContext';
import { fmt, correctPower, nearestStdLengthDown, getAvailableHeights, STD_LENGTHS } from '../calc/heatCalc';

// Порядок типов от самых тонких (слабых) к толстым (мощным)
const PANEL_TYPES_ORDER = ['11', '21s', '22', '33'];

// Подбирает оптимальный радиатор: минимальный запас, но ≥ требуемой мощности, максимум +15%
function selectOptimalRadiator(catalog, maxLen, targetPower, deltaT, maxHeight, preferredType) {
  let best = null;
  let bestMargin = Infinity;

  // Перебираем типы от тонкого к толстому
  for (const pType of PANEL_TYPES_ORDER) {
    const cat = catalog[pType];
    if (!cat) continue;
    const heights = Object.keys(cat).map(Number).sort((a, b) => a - b).filter(h => h <= Math.max(maxHeight, 300));

    for (const h of heights) {
      const hData = cat[String(h)];
      if (!hData) continue;

      // Перебираем стандартные длины от минимальной
      for (const len of STD_LENGTHS) {
        if (len > maxLen) break;
        const qCat = hData[String(len)];
        if (!qCat) continue;
        const qFact = correctPower(qCat, 50, deltaT);
        const margin = targetPower > 0 ? (qFact - targetPower) / targetPower : 0;

        if (qFact >= targetPower * 0.98 && margin < bestMargin) {
          bestMargin = margin;
          best = { panelType: pType, height: h, length: len, qCat, qFact: Math.round(qFact), margin };
        }
      }
    }
  }

  // Если ничего с запасом ≤15% не нашлось, берём ближайший с мин. запасом
  if (!best || best.margin > 0.15) {
    // Попытка: если preferred type + max length подходит
    let fallback = null;
    let fallbackMargin = Infinity;

    for (const pType of PANEL_TYPES_ORDER) {
      const cat = catalog[pType];
      if (!cat) continue;
      const heights = Object.keys(cat).map(Number).sort((a, b) => a - b).filter(h => h <= Math.max(maxHeight, 300));

      for (const h of heights) {
        const hData = cat[String(h)];
        if (!hData) continue;
        for (const len of STD_LENGTHS) {
          if (len > maxLen) break;
          const qCat = hData[String(len)];
          if (!qCat) continue;
          const qFact = correctPower(qCat, 50, deltaT);
          if (qFact >= targetPower * 0.95) {
            const margin = (qFact - targetPower) / targetPower;
            if (margin < fallbackMargin) {
              fallbackMargin = margin;
              fallback = { panelType: pType, height: h, length: len, qCat, qFact: Math.round(qFact), margin };
            }
          }
        }
      }
    }
    if (fallback) best = fallback;
  }

  // Если совсем ничего — берём максимально мощный в габарит
  if (!best) {
    let maxPower = 0;
    for (const pType of PANEL_TYPES_ORDER) {
      const cat = catalog[pType];
      if (!cat) continue;
      const heights = Object.keys(cat).map(Number).sort((a, b) => a - b).filter(h => h <= Math.max(maxHeight, 300));
      for (const h of heights) {
        const hData = cat[String(h)];
        if (!hData) continue;
        const len = nearestStdLengthDown(maxLen);
        const qCat = hData[String(len)];
        if (!qCat) continue;
        const qFact = correctPower(qCat, 50, deltaT);
        if (qFact > maxPower) {
          maxPower = qFact;
          best = { panelType: pType, height: h, length: len, qCat, qFact: Math.round(qFact), margin: targetPower > 0 ? (qFact - targetPower) / targetPower : 0 };
        }
      }
    }
  }

  return best;
}

export default function Step4_DeviceSelection() {
  const { state, dispatch } = useProject();
  const catalogs = state.catalogs;

  if (!catalogs) return <StepCard step={4} title="Подбор приборов"><p>Загрузка каталогов...</p></StepCard>;

  const isInFloor = state.deviceType === 'inFloor';

  const selectDevice = () => {
    if (perWindow.length === 0) { alert('Нет подобранных приборов'); return; }
    if (JSON.stringify(perWindow) !== JSON.stringify(state.perWindow)) {
      dispatch({ type: 'SET', payload: { perWindow } });
    }
    dispatch({ type: 'NEXT_STEP' });
  };

  // === Внутрипольные конвекторы ===
  if (isInFloor) {
    const catData = catalogs.convectors[String(state.convDepth)];
    const catWm50 = catData ? catData[state.convFan] : 0;
    const factWm = correctPower(catWm50, 50, state.deltaT);
    const sufficient = factWm >= state.powerPerMeter_W;

    var perWindow = state.windows.map((w, i) => {
      const devLen_m = w.deviceLength_mm / 1000;
      const pReq = state.powerPerMeter_W * devLen_m;
      const pFact = factWm * devLen_m;
      return {
        idx: i + 1, width: w.width_mm, devLen: w.deviceLength_mm, devHeight: 150,
        powerReq: Math.round(pReq), powerFact: Math.round(pFact),
        deviceName: `Конвектор внутрипольный ${state.convFan === 'fan' ? 'с вент.' : 'б/вент.'}, глуб. ${state.convDepth}мм, L=${w.deviceLength_mm}мм`
      };
    });

    // Группировка одинаковых
    const grouped = groupDevices(perWindow);

    return (
      <StepCard step={4} title="Подбор приборов — внутрипольные конвекторы">
        <div className="info-box">
          Требуемая мощность: <strong>{fmt(state.powerPerMeter_W)} Вт/м</strong> при Δt={state.deltaT.toFixed(0)}°C
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Глубина, мм</label>
            <select value={state.convDepth} onChange={e => dispatch({ type: 'SET', payload: { convDepth: parseInt(e.target.value) } })}>
              {[90, 110, 130, 180, 240, 300].map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Тип</label>
            <select value={state.convFan} onChange={e => dispatch({ type: 'SET', payload: { convFan: e.target.value } })}>
              <option value="natural">Без вентилятора</option>
              <option value="fan">С вентилятором</option>
            </select>
          </div>
        </div>

        <div className={sufficient ? 'result-box' : 'warn-box'}>
          Каталожная (Δt=50°C): <strong>{fmt(catWm50)} Вт/м</strong> |
          Фактическая (Δt={state.deltaT.toFixed(0)}°C): <strong>{fmt(factWm)} Вт/м</strong> —
          {sufficient ? <span className="tag tag-ok"> Достаточно</span> : <span className="tag tag-over"> Недостаточно</span>}
        </div>

        <h4 style={{ marginTop: 16, fontSize: '0.95rem' }}>Сводка (группировка одинаковых)</h4>
        <table style={{ marginTop: 8 }}>
          <thead><tr><th>Прибор</th><th>Кол-во</th><th>Q треб.</th><th>Q факт.</th><th>Запас</th></tr></thead>
          <tbody>
            {grouped.map((g, i) => (
              <tr key={i}>
                <td style={{ fontSize: '0.85rem' }}>{g.deviceName}</td>
                <td><strong>{g.count}</strong></td>
                <td>{fmt(g.powerReq)}</td><td><strong>{fmt(g.powerFact)}</strong></td>
                <td>{g.margin >= 0 ? '+' : ''}{g.margin.toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>

        {sufficient && <button className="btn btn-primary" onClick={selectDevice} style={{ marginTop: 12 }}>Подтвердить →</button>}
      </StepCard>
    );
  }

  // === Панельные радиаторы — автоподбор с минимальным запасом ===
  const targetH = state.deviceHeight_mm;

  var perWindow = state.windows.map((w, i) => {
    const maxLen = w.deviceLength_mm;
    const pReq = state.powerPerMeter_W * (w.deviceLength_mm / 1000);

    const opt = selectOptimalRadiator(catalogs.radiators, maxLen, pReq, state.deltaT, targetH);
    if (!opt) {
      return {
        idx: i + 1, width: w.width_mm, devLen: 0, devHeight: 0,
        powerReq: Math.round(pReq), powerFact: 0,
        deviceName: 'Нет подходящего размера', panelType: '-', panelHeight: 0
      };
    }

    return {
      idx: i + 1, width: w.width_mm, devLen: opt.length, devHeight: opt.height,
      powerReq: Math.round(pReq), powerFact: opt.qFact,
      deviceName: `Радиатор стальной тип ${opt.panelType}, ${opt.height}×${opt.length}мм`,
      panelType: opt.panelType, panelHeight: opt.height
    };
  });

  // Группировка одинаковых
  const grouped = groupDevices(perWindow);

  const totalReq = perWindow.reduce((s, w) => s + w.powerReq, 0);
  const totalFact = perWindow.reduce((s, w) => s + w.powerFact, 0);
  const totalMargin = totalReq > 0 ? ((totalFact - totalReq) / totalReq * 100) : 0;

  return (
    <StepCard step={4} title="Подбор приборов — панельные радиаторы">
      <div className="info-box">
        Расчётная высота: <strong>{targetH} мм</strong> | Требуемая мощность: <strong>{fmt(state.powerPerMeter_W)} Вт/м</strong> | Δt={state.deltaT.toFixed(0)}°C
        <br />Автоподбор: минимальный тип панели и длина с запасом ≤15%
      </div>

      <div className={totalMargin <= 15 ? 'result-box' : 'warn-box'} style={{ marginTop: 12 }}>
        Σ Q треб.: <strong>{fmt(totalReq)} Вт</strong> | Σ Q факт.: <strong>{fmt(totalFact)} Вт</strong> |
        Общий запас: <strong>{totalMargin >= 0 ? '+' : ''}{totalMargin.toFixed(1)}%</strong>
      </div>

      <h4 style={{ marginTop: 16, fontSize: '0.95rem' }}>Сводка (группировка одинаковых)</h4>
      <div style={{ overflowX: 'auto', marginTop: 8 }}>
        <table>
          <thead><tr><th>Прибор</th><th>Кол-во</th><th>Q треб.</th><th>Q факт.</th><th>Запас</th><th>Статус</th></tr></thead>
          <tbody>
            {grouped.map((g, i) => {
              let tag;
              if (g.margin < -5) tag = <span className="tag tag-over">Недостаточно</span>;
              else if (g.margin <= 15) tag = <span className="tag tag-ok">Оптимально</span>;
              else tag = <span className="tag tag-fit">С запасом</span>;
              return (
                <tr key={i}>
                  <td style={{ fontSize: '0.85rem' }}>{g.deviceName}</td>
                  <td><strong>{g.count}</strong></td>
                  <td>{fmt(g.powerReq)}</td><td><strong>{fmt(g.powerFact)}</strong></td>
                  <td>{g.margin >= 0 ? '+' : ''}{g.margin.toFixed(0)}%</td>
                  <td>{tag}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button className="btn btn-primary" onClick={selectDevice} style={{ marginTop: 12 }}>Подтвердить →</button>
    </StepCard>
  );
}

function groupDevices(perWindow) {
  const map = {};
  perWindow.forEach(w => {
    const key = w.deviceName;
    if (!map[key]) map[key] = { deviceName: w.deviceName, count: 0, powerReq: w.powerReq, powerFact: w.powerFact, margin: 0 };
    map[key].count++;
  });
  return Object.values(map).map(g => ({
    ...g,
    margin: g.powerReq > 0 ? ((g.powerFact - g.powerReq) / g.powerReq * 100) : 0
  }));
}
