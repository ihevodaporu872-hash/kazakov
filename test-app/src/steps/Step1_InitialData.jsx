import React, { useState, useRef } from 'react';
import StepCard from '../components/StepCard';
import { useProject } from '../state/ProjectContext';
import { toWatts, calcDeltaT, SCHEDULES } from '../calc/heatCalc';
import { importFromExcel, importFromGoogleSheets } from '../io/excelImport';

export default function Step1_InitialData() {
  const { state, dispatch } = useProject();
  const [count, setCount] = useState(state.windowCount || '');
  const [load, setLoad] = useState('');
  const [unit, setUnit] = useState('kw');
  const [wh, setWh] = useState(state.wallHeight_mm || '');
  const [sh, setSh] = useState(state.screedHeight_mm || 100);
  const [schedule, setSchedule] = useState(state.schedule || '80/60');
  const [tIn, setTIn] = useState(state.tInside || 20);
  const [corridorLen, setCorridorLen] = useState(state.corridorLength_m || '');
  const [routingType, setRoutingType] = useState(state.pexRoutingType || 'radial');
  const [roomsPerApt, setRoomsPerApt] = useState(state.roomsPerApartment || 2);
  const [aptsPerFloor, setAptsPerFloor] = useState(state.apartmentsPerFloor || '');
  const [zoneBounds, setZoneBounds] = useState(
    (state.zoneBoundaries || []).join(', ')
  );
  const [importStatus, setImportStatus] = useState(''); // 'loading' | 'success' | 'error'
  const [importError, setImportError] = useState('');
  const [showGoogleInput, setShowGoogleInput] = useState(false);
  const [googleUrl, setGoogleUrl] = useState('');
  const [importedProject, setImportedProject] = useState(null); // многокорпусный импорт
  const [selectedBldg, setSelectedBldg] = useState('');
  const fileInputRef = useRef(null);

  // Применить данные одного корпуса к локальным полям и state
  const applyBuilding = (bldg) => {
    const sched = bldg.schedule || '80/60';
    const dt = calcDeltaT(sched, 20);
    const heatW = (bldg.heatLoad_kW || 0) * 1000;

    const allWindows = [];
    (bldg.windows || []).forEach(wg => {
      for (let i = 0; i < wg.count; i++) {
        allWindows.push({ width_mm: wg.width_mm, deviceLength_mm: Math.max(0, wg.width_mm - 200) });
      }
    });

    const windowCount = bldg.totalWindows || allWindows.length;
    const routing = bldg.pexRoutingType || 'radial';

    setCount(windowCount);
    setLoad(bldg.heatLoad_kW || '');
    setUnit('kw');
    setWh(bldg.wallHeight_mm || '');
    setSh(bldg.screedHeight_mm || 100);
    setSchedule(sched);
    setTIn(20);
    setCorridorLen(bldg.corridorLength_m || '');
    setRoutingType(routing);
    setRoomsPerApt(bldg.roomsPerApartment || 2);
    setAptsPerFloor(bldg.apartmentsPerFloor || '');
    setZoneBounds((bldg.zoneBoundaries || []).join(', '));

    dispatch({
      type: 'SET',
      payload: {
        projectName: importedProject
          ? importedProject.projectName + ' — ' + bldg.name
          : bldg.name,
        windowCount,
        heatLoad_W: heatW,
        wallHeight_mm: bldg.wallHeight_mm || 0,
        screedHeight_mm: bldg.screedHeight_mm || 100,
        floorHeight_mm: bldg.floorHeight_mm || 3000,
        insulationThickness_mm: bldg.insulationThickness_mm || 13,
        floors: bldg.floors || 0,
        apartments: bldg.apartments || 0,
        apartmentsPerFloor: bldg.apartmentsPerFloor || 0,
        schedule: sched,
        tInside: 20,
        deltaT: dt,
        windows: allWindows,
        corridorLength_m: bldg.corridorLength_m || 0,
        pexRoutingType: routing,
        roomsPerApartment: bldg.roomsPerApartment || 2,
        riserPairs: bldg.riserPairs || 0,
        manifoldOutputs: bldg.manifoldOutputs || 0,
        heatingZones: bldg.heatingZones || 1,
        zoneBoundaries: bldg.zoneBoundaries || [],
      },
    });
  };

  // Применить импортированные данные (одиночный формат)
  const applyImported = (imported) => {
    if (imported.windowCount != null) setCount(imported.windowCount);
    if (imported.heatLoad_W != null) { setLoad(imported.heatLoad_W / 1000); setUnit('kw'); }
    if (imported.wallHeight_mm != null) setWh(imported.wallHeight_mm);
    if (imported.screedHeight_mm != null) setSh(imported.screedHeight_mm);
    if (imported.schedule) setSchedule(imported.schedule);
    if (imported.corridorLength_m != null) setCorridorLen(imported.corridorLength_m);
    if (imported.pexRoutingType) setRoutingType(imported.pexRoutingType);
    if (imported.roomsPerApartment != null) setRoomsPerApt(imported.roomsPerApartment);
    if (imported.apartmentsPerFloor != null) setAptsPerFloor(imported.apartmentsPerFloor);
    if (imported.zoneBoundaries) setZoneBounds(imported.zoneBoundaries.join(', '));
    dispatch({ type: 'SET', payload: imported });
  };

  const handleImportResult = (result) => {
    if (result.isMultiBuilding) {
      setImportedProject(result);
      setSelectedBldg('');
      // Автовыбор первого корпуса
      const keys = Object.keys(result.buildings);
      if (keys.length > 0) {
        setSelectedBldg(keys[0]);
        applyBuilding(result.buildings[keys[0]]);
      }
    } else {
      setImportedProject(null);
      applyImported(result);
    }
  };

  const handleExcelImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus('loading');
    setImportError('');
    try {
      const result = await importFromExcel(file);
      handleImportResult(result);
      setImportStatus('success');
    } catch (err) {
      setImportStatus('error');
      setImportError(err.message || 'Ошибка импорта');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGoogleImport = async () => {
    if (!googleUrl.trim()) return;
    setImportStatus('loading');
    setImportError('');
    try {
      const result = await importFromGoogleSheets(googleUrl.trim());
      handleImportResult(result);
      setImportStatus('success');
      setShowGoogleInput(false);
      setGoogleUrl('');
    } catch (err) {
      setImportStatus('error');
      setImportError(err.message || 'Ошибка импорта');
    }
  };

  const handleSelectBuilding = (key) => {
    if (!importedProject) return;
    setSelectedBldg(key);
    applyBuilding(importedProject.buildings[key]);
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
        corridorLength_m: parseFloat(corridorLen) || 0,
        pexRoutingType: routingType,
        roomsPerApartment: parseInt(roomsPerApt) || 2,
        apartmentsPerFloor: parseInt(aptsPerFloor) || 0,
        zoneBoundaries: zoneBounds
          ? zoneBounds.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0)
          : [],
      },
    });
    dispatch({ type: 'NEXT_STEP' });
  };

  return (
    <StepCard step={1} title="Исходные данные">
      {/* --- Импорт данных --- */}
      <div className="info-box" style={{ marginBottom: 16 }}>
        <strong>Импорт исходных данных</strong>
        <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleExcelImport}
            style={{ display: 'none' }}
          />
          <button
            className="btn btn-secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={importStatus === 'loading'}
          >
            Из Excel (.xlsx)
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setShowGoogleInput(!showGoogleInput)}
            disabled={importStatus === 'loading'}
          >
            Из Google Таблицы
          </button>
          {importStatus === 'loading' && <span style={{ color: 'var(--text2)', fontSize: '0.85rem' }}>Загрузка...</span>}
          {importStatus === 'success' && <span style={{ color: '#16a34a', fontSize: '0.85rem', fontWeight: 600 }}>Данные загружены</span>}
          {importStatus === 'error' && <span style={{ color: '#dc2626', fontSize: '0.85rem' }}>{importError}</span>}
        </div>
        {showGoogleInput && (
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text2)' }}>
                URL Google Таблицы (должна быть опубликована: Файл → Поделиться → Опубликовать в интернете)
              </label>
              <input
                type="url"
                value={googleUrl}
                onChange={e => setGoogleUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                onKeyDown={e => e.key === 'Enter' && handleGoogleImport()}
              />
            </div>
            <button className="btn btn-primary" onClick={handleGoogleImport} style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>
              Загрузить
            </button>
          </div>
        )}
      </div>

      {/* --- Выбор корпуса (многокорпусный импорт) --- */}
      {importedProject && (
        <div className="info-box" style={{ marginBottom: 16 }}>
          <strong>Проект: {importedProject.projectName}</strong>
          <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(importedProject.buildings).map(([key, bldg]) => (
              <button
                key={key}
                className={`btn ${selectedBldg === key ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleSelectBuilding(key)}
              >
                {bldg.name} ({bldg.heatLoad_kW || 0} кВт, {bldg.totalWindows || 0} окон)
              </button>
            ))}
          </div>
          {selectedBldg && importedProject.buildings[selectedBldg] && (() => {
            const b = importedProject.buildings[selectedBldg];
            return (
              <div style={{ marginTop: 12, fontSize: '0.85rem' }}>
                <table style={{ width: 'auto' }}>
                  <tbody>
                    {b.schedule && <tr><td style={{ color: 'var(--text2)', paddingRight: 16 }}>Теплоноситель</td><td><strong>{b.schedule}</strong></td></tr>}
                    {b.pexRoutingType && <tr><td style={{ color: 'var(--text2)', paddingRight: 16 }}>Разводка</td><td><strong>{b.pexRoutingType === 'series' ? 'Попутная' : 'Лучевая'}</strong></td></tr>}
                    {b.wallHeight_mm > 0 && <tr><td style={{ color: 'var(--text2)', paddingRight: 16 }}>Высота простенка</td><td><strong>{b.wallHeight_mm} мм</strong></td></tr>}
                    {b.floorHeight_mm > 0 && <tr><td style={{ color: 'var(--text2)', paddingRight: 16 }}>Высота этажа</td><td><strong>{b.floorHeight_mm} мм</strong></td></tr>}
                    {b.insulationThickness_mm > 0 && <tr><td style={{ color: 'var(--text2)', paddingRight: 16 }}>Толщина изоляции</td><td><strong>{b.insulationThickness_mm} мм</strong></td></tr>}
                    {b.apartments > 0 && <tr><td style={{ color: 'var(--text2)', paddingRight: 16 }}>Квартиры</td><td><strong>{b.apartments}</strong></td></tr>}
                    {b.floors > 0 && <tr><td style={{ color: 'var(--text2)', paddingRight: 16 }}>Этажей</td><td><strong>{b.floors}</strong></td></tr>}
                    {b.heatingZones > 1 && <tr><td style={{ color: 'var(--text2)', paddingRight: 16 }}>Зон отопления</td><td><strong>{b.heatingZones}</strong></td></tr>}
                    {b.windows.length > 0 && <tr><td style={{ color: 'var(--text2)', paddingRight: 16 }}>Окна (импорт)</td><td><strong>{b.totalWindows} шт ({b.windows.length} типоразмеров)</strong></td></tr>}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}

      {/* --- Сводка одиночного импорта --- */}
      {importStatus === 'success' && !importedProject && state.projectName && (
        <div className="info-box" style={{ marginBottom: 16 }}>
          <strong>Проект: {state.projectName}</strong>
          <div style={{ marginTop: 8, fontSize: '0.85rem' }}>
            <table style={{ width: 'auto' }}>
              <tbody>
                {state.systemType && <tr><td style={{ color: 'var(--text2)', paddingRight: 16 }}>Система отопления</td><td><strong>{state.systemType}</strong></td></tr>}
                {state.distribution && <tr><td style={{ color: 'var(--text2)', paddingRight: 16 }}>Разводка</td><td><strong>{state.distribution}</strong></td></tr>}
                <tr><td style={{ color: 'var(--text2)', paddingRight: 16 }}>Теплоноситель</td><td><strong>{state.schedule}</strong></td></tr>
                {state.floors && <tr><td style={{ color: 'var(--text2)', paddingRight: 16 }}>Этажи</td><td><strong>{state.floors}</strong></td></tr>}
                {state.apartments > 0 && <tr><td style={{ color: 'var(--text2)', paddingRight: 16 }}>Квартиры</td><td><strong>{state.apartments}</strong></td></tr>}
                {state.windows.length > 0 && <tr><td style={{ color: 'var(--text2)', paddingRight: 16 }}>Окна (импорт)</td><td><strong>{state.windows.length} шт</strong></td></tr>}
              </tbody>
            </table>
          </div>
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

      <div className="form-row">
        <div className="form-group">
          <label>Тип разводки PEX</label>
          <select value={routingType} onChange={e => setRoutingType(e.target.value)}>
            <option value="radial">Лучевая (через внутриквартирный коллектор)</option>
            <option value="series">Попутная (через тройники)</option>
          </select>
        </div>
        <div className="form-group">
          <label>Длина коридора, м</label>
          <input type="number" min="0" value={corridorLen} onChange={e => setCorridorLen(e.target.value)} placeholder="Авто" />
        </div>
        <div className="form-group">
          <label>Ср. кол-во комнат/квартиру</label>
          <input type="number" min="1" max="6" value={roomsPerApt} onChange={e => setRoomsPerApt(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Квартир на этаже</label>
          <input type="number" min="1" value={aptsPerFloor} onChange={e => setAptsPerFloor(e.target.value)} placeholder="Авто" />
        </div>
        <div className="form-group">
          <label>Границы зон (этажи через запятую)</label>
          <input type="text" value={zoneBounds} onChange={e => setZoneBounds(e.target.value)}
            placeholder="напр. 17 — зона 1 до 17 эт." />
        </div>
      </div>

      <button className="btn btn-primary" onClick={handleNext}>Далее →</button>
    </StepCard>
  );
}
