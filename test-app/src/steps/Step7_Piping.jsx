import React from 'react';
import StepCard from '../components/StepCard';
import { useProject } from '../state/ProjectContext';
import { fmt } from '../calc/heatCalc';

// Цены PEX по производителям и диаметрам (руб/м.п.)
const PEX_BRANDS = {
  pradex:  { name: 'Pradex',  prices: { 16: 180, 20: 250, 25: 350, 32: 480 } },
  rehau:   { name: 'Rehau',   prices: { 16: 320, 20: 420, 25: 560, 32: 750 } },
  sanext:  { name: 'Sanext',  prices: { 16: 210, 20: 280, 25: 400, 32: 550 } },
  everest: { name: 'Эверест', prices: { 16: 150, 20: 200, 25: 300, 32: 420 } },
  eae:     { name: 'EAE',     prices: { 16: 220, 20: 300, 25: 420, 32: 580 } },
};

const PEX_DIAMETERS = [16, 20, 25];
const FITTING_RATE = 0.40; // Фитинги = 40% от стоимости труб

export default function Step7_Piping() {
  const { state, dispatch } = useProject();

  const brand = state.pipeBrand && PEX_BRANDS[state.pipeBrand] ? state.pipeBrand : 'pradex';
  const brandData = PEX_BRANDS[brand];

  const nDevices = state.windowCount || 0;

  // Разбивка по диаметрам:
  // d16 — подводки к приборам (~1.5 м.п. на прибор)
  // d20 — разводка от гребёнки (~2 м.п. на прибор)
  // d25 — магистраль этажная
  // Стояки = стальные трубопроводы (не PEX)
  const manifoldOutputs = state.manifoldOutputs || 0;
  const numFloors = getNumFloors(state);

  const pipeByDiam = {
    16: { label: 'Подводка к приборам', qty: Math.round(nDevices * 1.5) },
    20: { label: 'Разводка от гребёнки', qty: Math.round(nDevices * 2.0) },
    25: { label: 'Магистраль этажная', qty: Math.round(manifoldOutputs * numFloors * 3) },
  };

  // Пользователь может скорректировать
  const overrides = state.pipeLenByDiam || {};

  let totalPipeCost = 0;
  let totalFittingCost = 0;

  const rows = PEX_DIAMETERS.map(d => {
    const auto = pipeByDiam[d]?.qty || 0;
    const qty = overrides[d] != null ? overrides[d] : auto;
    const pipePrice = brandData.prices[d] || 0;
    const fittingPrice = Math.round(pipePrice * FITTING_RATE);
    const pipeCost = qty * pipePrice;
    const fittingCost = qty * fittingPrice;
    totalPipeCost += pipeCost;
    totalFittingCost += fittingCost;
    return { d, label: pipeByDiam[d]?.label || '', qty, auto, pipePrice, fittingPrice, pipeCost, fittingCost };
  });

  const totalCost = totalPipeCost + totalFittingCost;

  const updateLen = (d, val) => {
    dispatch({
      type: 'SET',
      payload: {
        pipeLenByDiam: { ...overrides, [d]: parseFloat(val) || 0 }
      }
    });
  };

  return (
    <StepCard step={7} title="Трубы PEX и фитинги">
      <div className="info-box">
        Разводка PEX по диаметрам. Длины рассчитаны автоматически — можно скорректировать.
      </div>

      <div className="form-row" style={{ marginBottom: 16 }}>
        <div className="form-group">
          <label>Производитель PEX</label>
          <select value={brand} onChange={e => dispatch({ type: 'SET', payload: { pipeBrand: e.target.value } })}>
            {Object.entries(PEX_BRANDS).map(([id, b]) => (
              <option key={id} value={id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Диаметр</th>
              <th>Назначение</th>
              <th>Кол-во, м.п.</th>
              <th>Труба, руб/м</th>
              <th>Фитинги, руб/м</th>
              <th>Стоимость труб</th>
              <th>Стоимость фитингов</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.d}>
                <td><strong>d{r.d}</strong></td>
                <td style={{ fontSize: '0.85rem', color: 'var(--text2)' }}>{r.label}</td>
                <td>
                  <input type="number" min="0" value={overrides[r.d] != null ? overrides[r.d] : r.auto}
                    onChange={e => updateLen(r.d, e.target.value)}
                    style={{ width: 80 }} placeholder={r.auto} />
                </td>
                <td>{fmt(r.pipePrice)}</td>
                <td>{fmt(r.fittingPrice)}</td>
                <td>{fmt(r.pipeCost)}</td>
                <td>{fmt(r.fittingCost)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--border)' }}>
              <td colSpan={5} style={{ fontWeight: 600, textAlign: 'right' }}>Итого:</td>
              <td><strong>{fmt(totalPipeCost)}</strong></td>
              <td><strong>{fmt(totalFittingCost)}</strong></td>
            </tr>
            <tr>
              <td colSpan={5} style={{ fontWeight: 600, textAlign: 'right' }}>Всего труб + фитингов:</td>
              <td colSpan={2} className="val" style={{ fontSize: '1.1rem' }}><strong>{fmt(Math.round(totalCost))} руб</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="export-bar">
        <button className="btn btn-primary" onClick={() => dispatch({ type: 'NEXT_STEP' })}>Далее: расценки подрядчиков →</button>
      </div>
    </StepCard>
  );
}

function getNumFloors(state) {
  let numFloors = 16;
  if (state.projectData && state.selectedBuilding) {
    const bldg = state.projectData.buildings[state.selectedBuilding];
    if (bldg && bldg.floors) {
      const m = bldg.floors.match(/(\d+)-(\d+)/);
      if (m) numFloors = parseInt(m[2]) - parseInt(m[1]) + 1;
    }
  }
  return numFloors;
}
