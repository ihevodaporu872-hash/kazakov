import React, { useState } from 'react';
import StepCard from '../components/StepCard';
import { useProject } from '../state/ProjectContext';
import { toWatts, calcDeltaT, SCHEDULES } from '../calc/heatCalc';

export default function Step1_InitialData() {
  const { state, dispatch } = useProject();
  const [count, setCount] = useState(state.windowCount || '');
  const [load, setLoad] = useState('');
  const [unit, setUnit] = useState('kw');
  const [wh, setWh] = useState(state.wallHeight_mm || '');
  const [sh, setSh] = useState(state.screedHeight_mm || 100);
  const [schedule, setSchedule] = useState(state.schedule || '80/60');
  const [tIn, setTIn] = useState(state.tInside || 20);

  const handleNext = () => {
    const c = parseInt(count);
    const l = parseFloat(load);
    if (!c || c < 1) { alert('Укажите кол-во окон'); return; }
    if (!l || l <= 0) { alert('Укажите расход тепла'); return; }

    const heatW = toWatts(l, unit);
    const dt = calcDeltaT(schedule, parseInt(tIn));
    const windows = Array.from({ length: c }, () => ({ width_mm: 0, deviceLength_mm: 0 }));

    dispatch({
      type: 'SET',
      payload: {
        windowCount: c,
        heatLoad_W: heatW,
        wallHeight_mm: parseInt(wh) || 0,
        screedHeight_mm: parseInt(sh) || 100,
        schedule,
        tInside: parseInt(tIn),
        deltaT: dt,
        windows,
      },
    });
    dispatch({ type: 'NEXT_STEP' });
  };

  return (
    <StepCard step={1} title="Исходные данные">
      <div className="form-row">
        <div className="form-group">
          <label>Кол-во окон (= кол-во приборов)</label>
          <input type="number" min="1" value={count} onChange={e => setCount(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Расход тепла</label>
          <input type="number" min="0" step="0.1" value={load} onChange={e => setLoad(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Единица</label>
          <select value={unit} onChange={e => setUnit(e.target.value)}>
            <option value="kw">кВт</option>
            <option value="gcal">Гкал/ч</option>
            <option value="mw">МВт</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Высота простенка над полом, мм</label>
          <input type="number" min="0" value={wh} onChange={e => setWh(e.target.value)} placeholder="Не указана" />
        </div>
        <div className="form-group">
          <label>Высота стяжки, мм</label>
          <input type="number" min="0" value={sh} onChange={e => setSh(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Температурный график</label>
          <select value={schedule} onChange={e => setSchedule(e.target.value)}>
            {SCHEDULES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>t внутр. воздуха, °C</label>
          <input type="number" value={tIn} onChange={e => setTIn(e.target.value)} />
        </div>
      </div>
      <button className="btn btn-primary" onClick={handleNext}>Далее →</button>
    </StepCard>
  );
}
