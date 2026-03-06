import React from 'react';
import StepCard from '../components/StepCard';
import { useProject } from '../state/ProjectContext';
import { fmt, DEVICE_TYPE_LABELS } from '../calc/heatCalc';
import { getWorkPrice } from '../calc/contractorPricing';
import { exportToExcel } from '../io/excelExport';

export default function Step10_Summary() {
  const { state } = useProject();
  const data = state.contractorsData;
  const contractor = state.contractor;
  const contractorName = data?.contractors?.[contractor]?.name || contractor;

  // Расчёт стоимости работ
  let totalWork = 0;
  const workRows = (data?.workPrices || []).map(item => {
    const override = state.workPriceOverrides[item.id];
    const resolved = override != null
      ? { price: override, source: 'manual' }
      : getWorkPrice(item, contractor, state.priceMatrix);
    totalWork += resolved.price || 0;
    return { ...item, resolved };
  });

  // Расчёт стоимости материалов (упрощённый — из спецификации)
  let totalMaterials = 0;
  const materialRows = (state.specData || []).map(spec => {
    const unitPrice = estimateMaterialPrice(spec, state);
    const cost = unitPrice * spec.qty;
    totalMaterials += cost;
    return { ...spec, unitPrice, cost };
  });

  const grandTotal = totalWork + totalMaterials;

  const handleExport = () => {
    exportToExcel(state, workRows, materialRows, totalWork, totalMaterials, grandTotal);
  };

  return (
    <StepCard step={10} title="Итоговая смета">
      <div className="summary-grid">
        <div className="summary-item">
          <div className="si-label">Подрядчик</div>
          <div className="si-value">{contractorName}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Стоимость работ</div>
          <div className="si-value">{fmt(totalWork)} руб</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Стоимость материалов</div>
          <div className="si-value">{fmt(totalMaterials)} руб</div>
        </div>
        <div className="summary-item" style={{ background: 'var(--accent-light)' }}>
          <div className="si-label">ИТОГО</div>
          <div className="si-value" style={{ fontSize: '1.3rem', color: 'var(--accent)' }}>{fmt(grandTotal)} руб</div>
        </div>
      </div>

      <div className="info-box" style={{ marginTop: 16 }}>
        Цветовая маркировка:
        <span style={{ backgroundColor: '#fff', padding: '2px 8px', margin: '0 4px', border: '1px solid #e2e8f0' }}>точная</span>
        <span style={{ backgroundColor: '#fef9c3', padding: '2px 8px', margin: '0 4px' }}>от соседнего</span>
        <span style={{ backgroundColor: '#fff7ed', padding: '2px 8px', margin: '0 4px' }}>рыночная</span>
        <span style={{ backgroundColor: '#dcfce7', padding: '2px 8px', margin: '0 4px' }}>ручная</span>
        <span style={{ backgroundColor: '#fee2e2', padding: '2px 8px', margin: '0 4px' }}>нет данных</span>
      </div>

      <h3 style={{ marginTop: 20, fontSize: '1rem' }}>Расценки работ ({contractorName})</h3>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr><th>№</th><th>Наименование</th><th>Ед.</th><th>Цена</th><th>Источник</th></tr></thead>
          <tbody>
            {workRows.map((r, i) => (
              <tr key={r.id} style={getRowStyle(r.resolved.source)}>
                <td>{i + 1}</td><td>{r.name}</td><td>{r.unit}</td>
                <td><strong>{r.resolved.price ? fmt(r.resolved.price) : '—'}</strong></td>
                <td style={{ fontSize: '0.8rem', color: 'var(--text2)' }}>{getSourceText(r.resolved)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={3} style={{ fontWeight: 600, textAlign: 'right' }}>Итого работы:</td>
              <td colSpan={2}><strong>{fmt(totalWork)} руб</strong></td></tr>
          </tfoot>
        </table>
      </div>

      <h3 style={{ marginTop: 20, fontSize: '1rem' }}>Спецификация материалов</h3>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr><th>№</th><th>Наименование</th><th>Ед.</th><th>Кол-во</th><th>Цена ед.</th><th>Стоимость</th></tr></thead>
          <tbody>
            {materialRows.map(r => (
              <tr key={r.num}>
                <td>{r.num}</td><td>{r.name}</td><td>{r.unit}</td><td>{r.qty}</td>
                <td>{fmt(r.unitPrice)}</td><td><strong>{fmt(r.cost)}</strong></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={5} style={{ fontWeight: 600, textAlign: 'right' }}>Итого материалы:</td>
              <td><strong>{fmt(totalMaterials)} руб</strong></td></tr>
          </tfoot>
        </table>
      </div>

      <div className="export-bar" style={{ marginTop: 20 }}>
        <button className="btn btn-primary" onClick={handleExport}>Скачать Excel</button>
        <button className="btn btn-secondary" onClick={() => window.print()}>Печать</button>
      </div>
    </StepCard>
  );
}

function getRowStyle(source) {
  const colors = {
    contractor: {}, neighbor: { backgroundColor: '#fef9c3' },
    market: { backgroundColor: '#fff7ed' }, manual: { backgroundColor: '#dcfce7' },
    missing: { backgroundColor: '#fee2e2' }
  };
  return colors[source] || {};
}

function getSourceText(resolved) {
  if (resolved.source === 'contractor') return '';
  if (resolved.source === 'neighbor') return `от ${resolved.sourceLabel}`;
  if (resolved.source === 'market') return 'рыночная';
  if (resolved.source === 'manual') return 'ручная';
  if (resolved.source === 'missing') return 'нет данных';
  return '';
}

function estimateMaterialPrice(spec, state) {
  const name = spec.name.toLowerCase();
  if (name.includes('радиатор')) return 8500;
  if (name.includes('конвектор')) return 30000;
  if (name.includes('термоголовка')) return 1000;
  if (name.includes('клапан')) return 1200;
  if (name.includes('воздухоотвод') || name.includes('маевского')) return 200;
  if (name.includes('кронштейн')) return 150;
  return 500;
}
