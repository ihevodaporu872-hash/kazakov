import React from 'react';
import StepCard from '../components/StepCard';
import { useProject } from '../state/ProjectContext';
import { fmt, correctPower, nearestStdLengthDown, getAvailableHeights } from '../calc/heatCalc';

// Порядок типов от самых тонких (слабых) к толстым (мощным)
const PANEL_TYPES_ORDER = ['11', '21s', '22', '33'];

// Подбирает радиатор: длина фиксирована по окну, варьируем только высоту и тип.
// Тип повышается только если при макс. высоте мощности не хватает.
function selectOptimalRadiator(catalog, deviceLength, targetPower, deltaT, maxHeight) {
  const stdLen = nearestStdLengthDown(deviceLength);
  if (stdLen <= 0) return null;

  for (const pType of PANEL_TYPES_ORDER) {
    const cat = catalog[pType];
    if (!cat) continue;
    const heights = Object.keys(cat).map(Number).sort((a, b) => a - b)
      .filter(h => h <= Math.max(maxHeight, 300));

    // Для каждого типа ищем минимальную высоту, дающую ≥ требуемой мощности
    for (const h of heights) {
      const hData = cat[String(h)];
      if (!hData) continue;
      const qCat = hData[String(stdLen)];
      if (!qCat) continue;
      const qFact = correctPower(qCat, 50, deltaT);
      const margin = targetPower > 0 ? (qFact - targetPower) / targetPower : 0;

      if (qFact >= targetPower * 0.98) {
        return { panelType: pType, height: h, length: stdLen, qCat, qFact: Math.round(qFact), margin };
      }
    }
    // Этот тип при максимальной высоте не справляется — пробуем следующий тип
  }

  // Ничего не подходит — берём самый мощный вариант (тип 33, макс. высота)
  for (let ti = PANEL_TYPES_ORDER.length - 1; ti >= 0; ti--) {
    const pType = PANEL_TYPES_ORDER[ti];
    const cat = catalog[pType];
    if (!cat) continue;
    const heights = Object.keys(cat).map(Number).sort((a, b) => b - a)
      .filter(h => h <= Math.max(maxHeight, 300));
    for (const h of heights) {
      const hData = cat[String(h)];
      if (!hData) continue;
      const qCat = hData[String(stdLen)];
      if (!qCat) continue;
      const qFact = correctPower(qCat, 50, deltaT);
      return { panelType: pType, height: h, length: stdLen, qCat, qFact: Math.round(qFact),
        margin: targetPower > 0 ? (qFact - targetPower) / targetPower : 0 };
    }
  }

  return null;
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

        <h4 style={{ marginTop: 16, fontSize: '0.95rem' }}>Ведомость подбора (сгруппировано)</h4>
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

  // === Панельные радиаторы ===
  // Длина = ближайшая стандартная к (ширина окна - 200мм)
  // Тип повышается только если высота не помогает
  const targetH = state.deviceHeight_mm;

  var perWindow = state.windows.map((w, i) => {
    const pReq = state.powerPerMeter_W * (w.deviceLength_mm / 1000);

    const opt = selectOptimalRadiator(catalogs.radiators, w.deviceLength_mm, pReq, state.deltaT, targetH);
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

  const grouped = groupDevices(perWindow);

  const totalReq = perWindow.reduce((s, w) => s + w.powerReq, 0);
  const totalFact = perWindow.reduce((s, w) => s + w.powerFact, 0);
  const totalMargin = totalReq > 0 ? ((totalFact - totalReq) / totalReq * 100) : 0;

  return (
    <StepCard step={4} title="Подбор приборов — панельные радиаторы">
      <div className="info-box">
        Расчётная высота: <strong>{targetH} мм</strong> | Мощность: <strong>{fmt(state.powerPerMeter_W)} Вт/м</strong> | Δt={state.deltaT.toFixed(0)}°C
        <br />Длина прибора = по ширине окна (−200мм). Тип повышается только при нехватке мощности.
      </div>

      <div className={totalMargin >= -5 && totalMargin <= 15 ? 'result-box' : 'warn-box'} style={{ marginTop: 12 }}>
        Σ Q треб.: <strong>{fmt(totalReq)} Вт</strong> | Σ Q факт.: <strong>{fmt(totalFact)} Вт</strong> |
        Общий запас: <strong>{totalMargin >= 0 ? '+' : ''}{totalMargin.toFixed(1)}%</strong>
      </div>

      <h4 style={{ marginTop: 16, fontSize: '0.95rem' }}>Ведомость подбора (сгруппировано)</h4>
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
