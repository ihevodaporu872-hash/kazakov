import React from 'react';
import StepCard from '../components/StepCard';
import { useProject } from '../state/ProjectContext';
import { fmt, correctPower, nearestStdLengthDown, getAvailableHeights } from '../calc/heatCalc';

export default function Step4_DeviceSelection() {
  const { state, dispatch } = useProject();
  const catalogs = state.catalogs;

  if (!catalogs) return <StepCard step={4} title="Подбор приборов"><p>Загрузка каталогов...</p></StepCard>;

  const isInFloor = state.deviceType === 'inFloor';

  const selectDevice = () => {
    if (state.perWindow.length === 0) { alert('Нет подобранных приборов'); return; }
    dispatch({ type: 'NEXT_STEP' });
  };

  // === Внутрипольные конвекторы ===
  if (isInFloor) {
    const catData = catalogs.convectors[String(state.convDepth)];
    const catWm50 = catData ? catData[state.convFan] : 0;
    const factWm = correctPower(catWm50, 50, state.deltaT);
    const sufficient = factWm >= state.powerPerMeter_W;

    const perWindow = state.windows.map((w, i) => {
      const devLen_m = w.deviceLength_mm / 1000;
      const pReq = state.powerPerMeter_W * devLen_m;
      const pFact = factWm * devLen_m;
      return {
        idx: i + 1, width: w.width_mm, devLen: w.deviceLength_mm, devHeight: 150,
        powerReq: Math.round(pReq), powerFact: Math.round(pFact),
        deviceName: `Конвектор внутрипольный ${state.convFan === 'fan' ? 'с вент.' : 'б/вент.'}, глуб. ${state.convDepth}мм, L=${w.deviceLength_mm}мм`
      };
    });

    if (JSON.stringify(perWindow) !== JSON.stringify(state.perWindow)) {
      setTimeout(() => dispatch({ type: 'SET', payload: { perWindow } }), 0);
    }

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

        <table style={{ marginTop: 12 }}>
          <thead><tr><th>Окно</th><th>Шир. окна</th><th>Длина прибора</th><th>Q треб.</th><th>Q факт.</th><th>Запас</th></tr></thead>
          <tbody>
            {perWindow.map(w => {
              const margin = w.powerReq > 0 ? ((w.powerFact - w.powerReq) / w.powerReq * 100) : 0;
              return (
                <tr key={w.idx}>
                  <td>{w.idx}</td><td>{w.width}</td><td>{w.devLen}</td>
                  <td>{fmt(w.powerReq)}</td><td><strong>{fmt(w.powerFact)}</strong></td>
                  <td>{margin >= 0 ? '+' : ''}{margin.toFixed(0)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {sufficient && <button className="btn btn-primary" onClick={selectDevice} style={{ marginTop: 12 }}>Подтвердить →</button>}
      </StepCard>
    );
  }

  // === Панельные радиаторы ===
  const targetH = state.deviceHeight_mm;
  const availH = getAvailableHeights(catalogs.radiators, state.panelType);
  const bestH = availH.filter(h => h <= Math.max(targetH, 300)).pop() || 300;

  const cat = catalogs.radiators[state.panelType];
  const hData = cat ? cat[String(state.panelHeight || bestH)] : null;

  const perWindow = state.windows.map((w, i) => {
    const maxLen = w.deviceLength_mm;
    const stdLen = nearestStdLengthDown(maxLen);
    const qCat = hData ? hData[String(stdLen)] : null;
    if (!qCat) return { idx: i + 1, width: w.width_mm, devLen: 0, devHeight: state.panelHeight || bestH, powerReq: 0, powerFact: 0, deviceName: 'Нет подходящего размера' };

    const qFact = correctPower(qCat, 50, state.deltaT);
    const pReq = state.powerPerMeter_W * (w.deviceLength_mm / 1000);
    return {
      idx: i + 1, width: w.width_mm, devLen: stdLen, devHeight: state.panelHeight || bestH,
      powerReq: Math.round(pReq), powerFact: Math.round(qFact),
      deviceName: `Радиатор стальной тип ${state.panelType}, ${state.panelHeight || bestH}×${stdLen}мм`
    };
  });

  if (JSON.stringify(perWindow) !== JSON.stringify(state.perWindow)) {
    setTimeout(() => dispatch({ type: 'SET', payload: { perWindow } }), 0);
  }

  return (
    <StepCard step={4} title="Подбор приборов — панельные радиаторы">
      <div className="info-box">
        Расчётная высота: <strong>{targetH} мм</strong> | Требуемая мощность: <strong>{fmt(state.powerPerMeter_W)} Вт/м</strong>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Тип панели</label>
          <select value={state.panelType} onChange={e => dispatch({ type: 'SET', payload: { panelType: e.target.value } })}>
            <option value="11">11</option><option value="21s">21s</option>
            <option value="22">22</option><option value="33">33</option>
          </select>
        </div>
        <div className="form-group">
          <label>Высота, мм</label>
          <select value={state.panelHeight || bestH} onChange={e => dispatch({ type: 'SET', payload: { panelHeight: parseInt(e.target.value) } })}>
            {availH.filter(h => h <= Math.max(targetH, 300)).map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
      </div>

      <div style={{ overflowX: 'auto', marginTop: 12 }}>
        <table>
          <thead><tr><th>Окно</th><th>Шир. окна</th><th>Станд. длина</th><th>Q треб.</th><th>Q факт.</th><th>Запас</th><th>Статус</th></tr></thead>
          <tbody>
            {perWindow.map(w => {
              const margin = w.powerReq > 0 ? ((w.powerFact - w.powerReq) / w.powerReq * 100) : 0;
              const ok = w.powerFact >= w.powerReq * 0.95;
              let tag;
              if (margin < -5) tag = <span className="tag tag-over">Недостаточно</span>;
              else if (margin <= 25) tag = <span className="tag tag-ok">Оптимально</span>;
              else tag = <span className="tag tag-fit">С запасом</span>;
              return (
                <tr key={w.idx}>
                  <td>{w.idx}</td><td>{w.width}</td><td><strong>{w.devLen}</strong></td>
                  <td>{fmt(w.powerReq)}</td><td><strong>{fmt(w.powerFact)}</strong></td>
                  <td>{margin >= 0 ? '+' : ''}{margin.toFixed(0)}%</td><td>{tag}</td>
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
