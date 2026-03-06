import React from 'react';
import StepCard from '../components/StepCard';
import { useProject } from '../state/ProjectContext';
import { fmt, PIPE_PRICES, FITTING_RATE, SMART_PIPE_DISCOUNT, SMART_FITTING_DISCOUNT } from '../calc/heatCalc';

export default function Step7_Piping() {
  const { state, dispatch } = useProject();

  const pipeType = state.pipeType;
  const diam = state.pipeDiam;
  const brand = state.pipeBrand;
  const customLen = state.pipeLen;

  const nDevices = state.windowCount || 0;
  const pipeLen = (customLen > 0) ? customLen : Math.round(nDevices * 3.5);

  const priceTable = PIPE_PRICES[pipeType] || PIPE_PRICES.ppr;
  const availDiams = Object.keys(priceTable).map(Number).sort((a, b) => a - b);
  const closestDiam = availDiams.reduce((prev, cur) => Math.abs(cur - diam) < Math.abs(prev - diam) ? cur : prev);
  const basePipePrice = priceTable[closestDiam];

  const pipeDiscount = brand === 'smart' ? SMART_PIPE_DISCOUNT : 0;
  const fittingDiscount = brand === 'smart' ? SMART_FITTING_DISCOUNT : 0;
  const pipePrice = basePipePrice * (1 - pipeDiscount);
  const fittingPrice = basePipePrice * FITTING_RATE * (1 - fittingDiscount);
  const pipeCost = pipeLen * pipePrice;
  const fittingCost = pipeLen * fittingPrice;
  const totalCost = pipeCost + fittingCost;

  return (
    <StepCard step={7} title="Стоимость материалов (трубы и фитинги)">
      <div className="info-box">
        При выборе <strong>Smart</strong>: трубы −25%, фитинги −30% от рыночной цены.
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Тип труб</label>
          <select value={pipeType} onChange={e => dispatch({ type: 'SET', payload: { pipeType: e.target.value } })}>
            <option value="ppr">PPR (полипропилен)</option>
            <option value="pex">PEX (сшитый полиэтилен)</option>
          </select>
        </div>
        <div className="form-group">
          <label>Диаметр</label>
          <select value={diam} onChange={e => dispatch({ type: 'SET', payload: { pipeDiam: parseInt(e.target.value) } })}>
            {(pipeType === 'pex' ? [16, 20, 25, 32] : [20, 25, 32, 40, 63]).map(d =>
              <option key={d} value={d}>d{d}</option>
            )}
          </select>
        </div>
        <div className="form-group">
          <label>Длина, м.п.</label>
          <input type="number" min="1" value={customLen || ''} onChange={e => dispatch({ type: 'SET', payload: { pipeLen: parseFloat(e.target.value) || 0 } })} placeholder={`Авто: ${nDevices}×3.5=${Math.round(nDevices * 3.5)}`} />
        </div>
        <div className="form-group">
          <label>Производитель</label>
          <select value={brand} onChange={e => dispatch({ type: 'SET', payload: { pipeBrand: e.target.value } })}>
            <option value="market">Рыночная цена</option>
            <option value="smart">Smart (скидка)</option>
          </select>
        </div>
      </div>

      <div style={{ overflowX: 'auto', marginTop: 16 }}>
        <table>
          <thead><tr><th>Позиция</th><th>Кол-во</th><th>Цена, руб</th><th>Стоимость, руб</th></tr></thead>
          <tbody>
            <tr>
              <td>Труба {pipeType.toUpperCase()} d{closestDiam}</td>
              <td>{pipeLen} м.п.</td>
              <td>{fmt(pipePrice)} / м.п.</td>
              <td><strong>{fmt(pipeCost)}</strong></td>
            </tr>
            <tr>
              <td>Фитинги {pipeType.toUpperCase()} d{closestDiam}</td>
              <td>{pipeLen} м.п.</td>
              <td>{fmt(Math.round(fittingPrice))} / м.п.</td>
              <td><strong>{fmt(fittingCost)}</strong></td>
            </tr>
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--border)' }}>
              <td colSpan={3} style={{ fontWeight: 600, textAlign: 'right' }}>Итого материалы:</td>
              <td className="val" style={{ fontSize: '1.2rem' }}>{fmt(Math.round(totalCost))} руб</td>
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
