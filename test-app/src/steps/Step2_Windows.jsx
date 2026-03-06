import React, { useState } from 'react';
import StepCard from '../components/StepCard';
import { useProject } from '../state/ProjectContext';
import { fmt } from '../calc/heatCalc';

export default function Step2_Windows() {
  const { state, dispatch } = useProject();
  const [sameWidth, setSameWidth] = useState('');

  const handleWidthChange = (idx, val) => {
    const w = parseInt(val) || 0;
    dispatch({ type: 'SET_WINDOW', index: idx, data: { width_mm: w, deviceLength_mm: Math.max(0, w - 200) } });
  };

  const fillAll = () => {
    const w = parseInt(sameWidth);
    if (!w || w < 200) { alert('Укажите ширину (мин. 200 мм)'); return; }
    const newWindows = state.windows.map(() => ({ width_mm: w, deviceLength_mm: Math.max(0, w - 200) }));
    dispatch({ type: 'SET', payload: { windows: newWindows } });
  };

  const handleNext = () => {
    const allOk = state.windows.every(w => w.width_mm >= 200);
    if (!allOk) { alert('Заполните ширину всех окон (мин. 200 мм)'); return; }

    const totalWinW = state.windows.reduce((s, w) => s + w.width_mm, 0) / 1000;
    const totalDevLen = state.windows.reduce((s, w) => s + w.deviceLength_mm, 0) / 1000;
    const denom = totalWinW - state.windowCount * 0.2;
    if (denom <= 0) { alert('Ошибка: суммарная ширина окон слишком мала'); return; }
    const ppm = state.heatLoad_W / denom;

    dispatch({
      type: 'SET',
      payload: { totalWindowWidth_m: totalWinW, totalDeviceLength_m: totalDevLen, powerPerMeter_W: ppm },
    });
    dispatch({ type: 'NEXT_STEP' });
  };

  return (
    <StepCard step={2} title="Ширина окон">
      <div className="form-row" style={{ marginBottom: 12 }}>
        <div className="form-group">
          <label>Заполнить все одинаковой шириной, мм</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="number" min="200" value={sameWidth} onChange={e => setSameWidth(e.target.value)} placeholder="1500" />
            <button className="btn btn-secondary" onClick={fillAll}>Заполнить</button>
          </div>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr><th>№</th><th>Ширина окна, мм</th><th>Длина прибора, мм</th></tr>
          </thead>
          <tbody>
            {state.windows.map((w, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{i + 1}</td>
                <td>
                  <input type="number" min="200" step="50" value={w.width_mm || ''}
                    onChange={e => handleWidthChange(i, e.target.value)} placeholder="1500" />
                </td>
                <td style={{ fontWeight: 600 }}>{w.deviceLength_mm > 0 ? `${w.deviceLength_mm} мм` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {state.powerPerMeter_W > 0 && (
        <div className="result-box" style={{ marginTop: 12 }}>
          Мощность на 1 п.м. прибора: <strong>{fmt(state.powerPerMeter_W)} Вт/м</strong>
        </div>
      )}

      <button className="btn btn-primary" onClick={handleNext} style={{ marginTop: 12 }}>Далее →</button>
    </StepCard>
  );
}
