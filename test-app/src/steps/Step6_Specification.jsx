import React, { useEffect } from 'react';
import StepCard from '../components/StepCard';
import { useProject } from '../state/ProjectContext';
import { fmt, THERMO_LABELS, VALVE_LABELS, DEVICE_TYPE_LABELS } from '../calc/heatCalc';

export default function Step6_Specification() {
  const { state, dispatch } = useProject();

  useEffect(() => {
    if (state.currentStep < 6 || state.perWindow.length === 0) return;
    buildSpec();
  }, [state.currentStep, state.perWindow, state.thermoHead, state.valve, state.deviceType]);

  const buildSpec = () => {
    const deviceGroups = {};
    state.perWindow.forEach(w => {
      const key = w.deviceName;
      if (!deviceGroups[key]) deviceGroups[key] = { name: w.deviceName, count: 0, power: w.powerFact };
      deviceGroups[key].count++;
    });

    const specs = [];
    let num = 1;

    // Приборы отопления
    for (const g of Object.values(deviceGroups)) {
      specs.push({ num: num++, name: g.name, chars: `Q=${fmt(g.power)} Вт при Δt=${state.deltaT.toFixed(0)}°C`, unit: 'шт', qty: g.count });
    }

    // Термоголовка
    if (state.thermoHead && state.thermoHead !== 'none') {
      specs.push({ num: num++, name: `Термоголовка ${THERMO_LABELS[state.thermoHead]}`, chars: '', unit: 'шт', qty: state.windowCount });
    }

    // Регулирующий клапан (если не в составе прибора)
    if (state.valve && state.valve !== 'included') {
      specs.push({ num: num++, name: `Клапан ${VALVE_LABELS[state.valve]}`, chars: 'DN15', unit: 'шт', qty: state.windowCount });
    }

    // ========================================
    // Узел подключения прибора (по типу)
    // ========================================

    if (state.deviceType === 'inFloor') {
      // Внутрипольные: RLV + RA-N + переход на PEX Ду16
      specs.push({ num: num++, name: 'Клапан RLV', chars: 'DN15, в составе узла подключения', unit: 'шт', qty: state.windowCount });
      specs.push({ num: num++, name: 'Клапан RA-N', chars: 'DN15, термостатический', unit: 'шт', qty: state.windowCount });
      specs.push({ num: num++, name: 'Переход RLV/RA-N → PEX Ду16', chars: '', unit: 'компл.', qty: state.windowCount });

    } else if (state.deviceType === 'floor') {
      // Напольные: RLV-K + 2 ниппеля + 2 евроконуса + 2 L-образные трубки
      specs.push({ num: num++, name: 'Клапан RLV-K', chars: 'DN15, нижнее подключение', unit: 'шт', qty: state.windowCount });
      specs.push({ num: num++, name: 'Ниппель', chars: 'G1/2"', unit: 'шт', qty: state.windowCount * 2 });
      specs.push({ num: num++, name: 'Евроконус', chars: 'G1/2" × PEX Ду16', unit: 'шт', qty: state.windowCount * 2 });
      specs.push({ num: num++, name: 'L-образная трубка', chars: 'Для подключения напольного прибора', unit: 'шт', qty: state.windowCount * 2 });

    } else {
      // Настенные — зависит от комплектации, по умолчанию вариант 2 (RLV-K)
      specs.push({ num: num++, name: 'Клапан RLV-K', chars: 'DN15, нижнее подключение', unit: 'шт', qty: state.windowCount });
      specs.push({ num: num++, name: 'Ниппель', chars: 'G1/2"', unit: 'шт', qty: state.windowCount * 2 });
      specs.push({ num: num++, name: 'Евроконус', chars: 'G1/2" × PEX Ду16', unit: 'шт', qty: state.windowCount * 2 });
      specs.push({ num: num++, name: 'L-образная трубка', chars: 'Для подключения настенного прибора', unit: 'шт', qty: state.windowCount * 2 });
    }

    // Воздухоотводчик
    specs.push({ num: num++, name: 'Воздухоотводчик (кран Маевского)', chars: 'DN15', unit: 'шт', qty: state.windowCount });

    // Кронштейны
    if (state.deviceType !== 'inFloor') {
      const bPerRad = state.deviceType === 'wall' ? 3 : 2;
      specs.push({ num: num++, name: 'Кронштейн крепления радиатора', chars: state.deviceType === 'wall' ? 'Настенное крепление' : 'Напольное крепление', unit: 'шт', qty: state.windowCount * bPerRad });
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

      <h3 style={{ marginTop: 20, fontSize: '1rem' }}>Ведомость подбора приборов (сгруппировано)</h3>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr><th>№</th><th>Прибор</th><th>Шир. окна</th><th>Длина</th><th>Высота</th><th>Кол-во</th><th>Q треб.</th><th>Q факт.</th><th>Запас</th></tr></thead>
          <tbody>
            {groupPerWindow(state.perWindow).map((g, i) => {
              const margin = g.powerReq > 0 ? ((g.powerFact - g.powerReq) / g.powerReq * 100) : 0;
              return (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td style={{ fontSize: '0.82rem' }}>{g.deviceName}</td>
                  <td>{g.width}</td>
                  <td>{g.devLen}</td>
                  <td>{g.devHeight}</td>
                  <td><strong>{g.count}</strong></td>
                  <td>{fmt(g.powerReq)}</td>
                  <td><strong>{fmt(g.powerFact)}</strong></td>
                  <td>{margin >= 0 ? '+' : ''}{margin.toFixed(0)}%</td>
                </tr>
              );
            })}
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
        <button className="btn btn-primary" onClick={() => dispatch({ type: 'NEXT_STEP' })}>Далее: трубы и материалы →</button>
      </div>
    </StepCard>
  );
}

function groupPerWindow(perWindow) {
  const map = {};
  (perWindow || []).forEach(w => {
    const key = `${w.deviceName}_${w.width}_${w.devLen}_${w.devHeight}`;
    if (!map[key]) map[key] = { ...w, count: 0 };
    map[key].count++;
  });
  return Object.values(map);
}
