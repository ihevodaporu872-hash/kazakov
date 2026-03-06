import React, { useEffect } from 'react';
import StepCard from '../components/StepCard';
import { useProject } from '../state/ProjectContext';
import { fmt, THERMO_LABELS, VALVE_LABELS, DEVICE_TYPE_LABELS } from '../calc/heatCalc';

export default function Step6_Specification() {
  const { state, dispatch } = useProject();

  useEffect(() => {
    if (state.currentStep < 6 || state.perWindow.length === 0) return;
    buildSpec();
  }, [state.currentStep, state.perWindow, state.thermoHead, state.valve]);

  const buildSpec = () => {
    const deviceGroups = {};
    state.perWindow.forEach(w => {
      const key = w.deviceName;
      if (!deviceGroups[key]) deviceGroups[key] = { name: w.deviceName, count: 0, power: w.powerFact };
      deviceGroups[key].count++;
    });

    const specs = [];
    let num = 1;

    for (const g of Object.values(deviceGroups)) {
      specs.push({ num: num++, name: g.name, chars: `Q=${fmt(g.power)} Вт при Δt=${state.deltaT.toFixed(0)}°C`, unit: 'шт', qty: g.count });
    }

    if (state.thermoHead && state.thermoHead !== 'none') {
      specs.push({ num: num++, name: `Термоголовка ${THERMO_LABELS[state.thermoHead]}`, chars: '', unit: 'шт', qty: state.windowCount });
    }

    if (state.valve && state.valve !== 'included') {
      specs.push({ num: num++, name: `Клапан ${VALVE_LABELS[state.valve]}`, chars: 'DN15', unit: 'шт', qty: state.windowCount });
    }

    specs.push({ num: num++, name: 'Воздухоотводчик (кран Маевского)', chars: 'DN15', unit: 'шт', qty: state.windowCount });

    if (state.deviceType !== 'inFloor') {
      const bPerRad = state.deviceType === 'wall' ? 3 : 2;
      specs.push({ num: num++, name: 'Кронштейн крепления радиатора', chars: '', unit: 'шт', qty: state.windowCount * bPerRad });
    }

    dispatch({ type: 'SET', payload: { specData: specs } });
  };

  const totalPowerReq = state.perWindow.reduce((s, w) => s + w.powerReq, 0);
  const totalPowerFact = state.perWindow.reduce((s, w) => s + w.powerFact, 0);

  return (
    <StepCard step={6} title="Итоговая спецификация">
      <div className="summary-grid">
        <div className="summary-item"><div className="si-label">Расход тепла</div><div className="si-value">{(state.heatLoad_W / 1000).toFixed(2)} кВт</div></div>
        <div className="summary-item"><div className="si-label">Кол-во приборов</div><div className="si-value">{state.windowCount} шт</div></div>
        <div className="summary-item"><div className="si-label">Мощность Вт/м</div><div className="si-value">{fmt(state.powerPerMeter_W)} Вт/м</div></div>
        <div className="summary-item"><div className="si-label">Тип приборов</div><div className="si-value">{DEVICE_TYPE_LABELS[state.deviceType]}</div></div>
        <div className="summary-item"><div className="si-label">Σ Q требуемая</div><div className="si-value">{fmt(totalPowerReq)} Вт</div></div>
        <div className="summary-item"><div className="si-label">Σ Q фактическая</div><div className="si-value">{fmt(totalPowerFact)} Вт</div></div>
      </div>

      <h3 style={{ marginTop: 20, fontSize: '1rem' }}>Ведомость подбора приборов</h3>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr><th>№</th><th>Шир. окна</th><th>Длина прибора</th><th>Высота</th><th>Q треб.</th><th>Прибор</th><th>Q факт.</th></tr></thead>
          <tbody>
            {state.perWindow.map(w => (
              <tr key={w.idx}>
                <td>{w.idx}</td><td>{w.width}</td><td>{w.devLen}</td><td>{w.devHeight}</td>
                <td>{fmt(w.powerReq)}</td><td style={{ fontSize: '0.82rem' }}>{w.deviceName}</td><td><strong>{fmt(w.powerFact)}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 style={{ marginTop: 20, fontSize: '1rem' }}>Спецификация оборудования</h3>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr><th>№</th><th>Наименование</th><th>Характеристики</th><th>Ед.</th><th>Кол-во</th></tr></thead>
          <tbody>
            {state.specData.map(s => (
              <tr key={s.num}><td>{s.num}</td><td>{s.name}</td><td>{s.chars}</td><td>{s.unit}</td><td>{s.qty}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="export-bar">
        <button className="btn btn-primary" onClick={() => dispatch({ type: 'NEXT_STEP' })}>Далее: трубы и стоимость →</button>
      </div>
    </StepCard>
  );
}
