import React, { useState, useEffect } from 'react';
import StepCard from '../components/StepCard';
import { useProject } from '../state/ProjectContext';
import { fmt } from '../calc/heatCalc';

export default function Step2_Windows() {
  const { state, dispatch } = useProject();

  // Группы: [{width_mm, count}]
  const initialGroups = buildGroupsFromWindows(state.windows);
  const [groups, setGroups] = useState(initialGroups.length > 0 ? initialGroups : [{ width_mm: '', count: '' }]);

  // При загрузке проекта обновляем группы
  useEffect(() => {
    if (state.windows.length > 0) {
      const g = buildGroupsFromWindows(state.windows);
      if (g.length > 0) setGroups(g);
    }
  }, [state.selectedBuilding]);

  const updateGroup = (idx, field, val) => {
    const next = [...groups];
    next[idx] = { ...next[idx], [field]: val };
    setGroups(next);
  };

  const addGroup = () => setGroups([...groups, { width_mm: '', count: '' }]);

  const removeGroup = (idx) => {
    if (groups.length <= 1) return;
    setGroups(groups.filter((_, i) => i !== idx));
  };

  const totalCount = groups.reduce((s, g) => s + (parseInt(g.count) || 0), 0);

  const handleNext = () => {
    const parsed = groups.map(g => ({ width_mm: parseInt(g.width_mm) || 0, count: parseInt(g.count) || 0 }));
    const valid = parsed.every(g => g.width_mm >= 200 && g.count >= 1);
    if (!valid) { alert('Заполните ширину (мин. 200 мм) и кол-во для каждой группы'); return; }

    if (totalCount !== state.windowCount) {
      alert(`Суммарное кол-во приборов (${totalCount}) не совпадает с заданным (${state.windowCount})`);
      return;
    }

    // Разворачиваем группы в массив окон
    const windows = [];
    parsed.forEach(g => {
      const devLen = Math.max(0, g.width_mm - 200);
      for (let i = 0; i < g.count; i++) {
        windows.push({ width_mm: g.width_mm, deviceLength_mm: devLen });
      }
    });

    const totalWinW = windows.reduce((s, w) => s + w.width_mm, 0) / 1000;
    const totalDevLen = windows.reduce((s, w) => s + w.deviceLength_mm, 0) / 1000;
    const denom = totalWinW - windows.length * 0.2;
    if (denom <= 0) { alert('Ошибка: суммарная ширина окон слишком мала'); return; }
    const ppm = state.heatLoad_W / denom;

    dispatch({
      type: 'SET',
      payload: {
        windows,
        windowCount: totalCount,
        totalWindowWidth_m: totalWinW,
        totalDeviceLength_m: totalDevLen,
        powerPerMeter_W: ppm,
      },
    });
    dispatch({ type: 'NEXT_STEP' });
  };

  return (
    <StepCard step={2} title="Размеры окон">
      <div className="info-box" style={{ marginBottom: 12 }}>
        Укажите кол-во приборов каждой длины (ширина окна). Всего приборов: <strong>{state.windowCount}</strong>, введено: <strong>{totalCount}</strong>
        {totalCount === state.windowCount && <span className="tag tag-ok" style={{ marginLeft: 8 }}>OK</span>}
        {totalCount !== state.windowCount && <span className="tag tag-over" style={{ marginLeft: 8 }}>{totalCount > state.windowCount ? '+' : ''}{totalCount - state.windowCount}</span>}
      </div>

      <table>
        <thead>
          <tr><th>Ширина окна, мм</th><th>Длина прибора, мм</th><th>Кол-во</th><th></th></tr>
        </thead>
        <tbody>
          {groups.map((g, i) => {
            const w = parseInt(g.width_mm) || 0;
            const devLen = w >= 200 ? w - 200 : 0;
            return (
              <tr key={i}>
                <td>
                  <input type="number" min="200" step="50" value={g.width_mm}
                    onChange={e => updateGroup(i, 'width_mm', e.target.value)} placeholder="1500" style={{ width: 120 }} />
                </td>
                <td style={{ fontWeight: 600 }}>{devLen > 0 ? `${devLen}` : '—'}</td>
                <td>
                  <input type="number" min="1" value={g.count}
                    onChange={e => updateGroup(i, 'count', e.target.value)} placeholder="1" style={{ width: 80 }} />
                </td>
                <td>
                  {groups.length > 1 && (
                    <button className="btn btn-secondary" onClick={() => removeGroup(i)} style={{ padding: '4px 10px', fontSize: '0.8rem' }}>x</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <button className="btn btn-secondary" onClick={addGroup} style={{ marginTop: 8 }}>+ Добавить размер</button>

      {state.powerPerMeter_W > 0 && (
        <div className="result-box" style={{ marginTop: 12 }}>
          Мощность на 1 п.м. прибора: <strong>{fmt(state.powerPerMeter_W)} Вт/м</strong>
        </div>
      )}

      <button className="btn btn-primary" onClick={handleNext} style={{ marginTop: 12 }}>Далее →</button>
    </StepCard>
  );
}

function buildGroupsFromWindows(windows) {
  if (!windows || windows.length === 0) return [];
  const map = {};
  windows.forEach(w => {
    const key = w.width_mm;
    if (!map[key]) map[key] = { width_mm: key, count: 0 };
    map[key].count++;
  });
  return Object.values(map).sort((a, b) => a.width_mm - b.width_mm);
}
