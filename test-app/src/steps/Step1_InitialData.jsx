import React, { useState, useEffect } from 'react';
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
  const [projectLoaded, setProjectLoaded] = useState(false);
  const [selectedBldg, setSelectedBldg] = useState('');

  useEffect(() => {
    fetch('/data/project_308.json')
      .then(r => r.json())
      .then(data => dispatch({ type: 'SET', payload: { projectData: data } }));
  }, [dispatch]);

  const project = state.projectData;

  const applyProject = (buildingKey) => {
    if (!project) return;
    const bldg = project.buildings[buildingKey];
    if (!bldg) return;

    const sched = project.coolant || '80/60';
    const dt = calcDeltaT(sched, 20);
    const heatW = bldg.heatLoad_kW * 1000;

    const allWindows = [];
    bldg.windows.forEach(wg => {
      for (let i = 0; i < wg.count; i++) {
        allWindows.push({ width_mm: wg.width_mm, deviceLength_mm: Math.max(0, wg.width_mm - 200) });
      }
    });

    setCount(bldg.totalWindows);
    setLoad(bldg.heatLoad_kW);
    setUnit('kw');
    setWh(project.wallHeight_mm);
    setSh(100);
    setSchedule(sched);
    setTIn(20);
    setSelectedBldg(buildingKey);
    setProjectLoaded(true);

    dispatch({
      type: 'SET',
      payload: {
        selectedBuilding: buildingKey,
        projectName: project.name + ' — ' + bldg.name,
        systemType: project.system,
        distribution: project.distribution,
        insulationThickness_mm: project.insulationThickness_mm,
        floorHeight_mm: project.floorHeight_mm,
        riserPairs: bldg.riserPairs,
        manifoldOutputs: bldg.manifoldOutputs,
        heatingZones: bldg.heatingZones,
        apartments: bldg.apartments,
        windowCount: bldg.totalWindows,
        heatLoad_W: heatW,
        wallHeight_mm: project.wallHeight_mm,
        screedHeight_mm: 100,
        schedule: sched,
        tInside: 20,
        deltaT: dt,
        windows: allWindows,
      },
    });
  };

  const handleNext = () => {
    const c = parseInt(count);
    const l = parseFloat(load);
    if (!c || c < 1) { alert('Укажите кол-во окон'); return; }
    if (!l || l <= 0) { alert('Укажите расход тепла'); return; }

    const heatW = toWatts(l, unit);
    const dt = calcDeltaT(schedule, parseInt(tIn));

    let windows = state.windows;
    if (windows.length !== c) {
      windows = Array.from({ length: c }, () => ({ width_mm: 0, deviceLength_mm: 0 }));
    }

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
      {project && (
        <div className="info-box" style={{ marginBottom: 16 }}>
          <strong>Проект: {project.name}</strong>
          <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(project.buildings).map(([key, bldg]) => (
              <button
                key={key}
                className={`btn ${selectedBldg === key ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => applyProject(key)}
              >
                {bldg.name} ({bldg.heatLoad_kW} кВт, {bldg.totalWindows} окон)
              </button>
            ))}
          </div>
          {projectLoaded && state.selectedBuilding && project.buildings[state.selectedBuilding] && (() => {
            const b = project.buildings[state.selectedBuilding];
            return (
              <div style={{ marginTop: 12, fontSize: '0.85rem' }}>
                <table style={{ width: 'auto' }}>
                  <tbody>
                    <tr><td style={{ color: 'var(--text2)', paddingRight: 16 }}>Система отопления</td><td><strong>{project.system}</strong></td></tr>
                    <tr><td style={{ color: 'var(--text2)', paddingRight: 16 }}>Теплоноситель</td><td><strong>{project.coolant}</strong></td></tr>
                    <tr><td style={{ color: 'var(--text2)', paddingRight: 16 }}>Разводка</td><td><strong>{project.distribution}</strong></td></tr>
                    <tr><td style={{ color: 'var(--text2)', paddingRight: 16 }}>Высота простенка</td><td><strong>{project.wallHeight_mm} мм</strong></td></tr>
                    <tr><td style={{ color: 'var(--text2)', paddingRight: 16 }}>Высота этажа</td><td><strong>{project.floorHeight_mm} мм</strong></td></tr>
                    <tr><td style={{ color: 'var(--text2)', paddingRight: 16 }}>Толщина изоляции</td><td><strong>{project.insulationThickness_mm} мм</strong></td></tr>
                    <tr><td style={{ color: 'var(--text2)', paddingRight: 16 }}>Квартиры</td><td><strong>{b.apartments}</strong></td></tr>
                    <tr><td style={{ color: 'var(--text2)', paddingRight: 16 }}>Этажи</td><td><strong>{b.floors}</strong></td></tr>
                    <tr><td style={{ color: 'var(--text2)', paddingRight: 16 }}>Пар стояков (на этаж)</td><td><strong>{b.riserPairs}</strong></td></tr>
                    <tr><td style={{ color: 'var(--text2)', paddingRight: 16 }}>Выходов гребёнок (на этаж)</td><td><strong>{b.manifoldOutputs}</strong></td></tr>
                    <tr><td style={{ color: 'var(--text2)', paddingRight: 16 }}>Зон отопления</td><td><strong>{b.heatingZones}</strong></td></tr>
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}

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
