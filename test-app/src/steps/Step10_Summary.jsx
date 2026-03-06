import React from 'react';
import StepCard from '../components/StepCard';
import { useProject } from '../state/ProjectContext';
import { fmt } from '../calc/heatCalc';
import { getWorkPrice } from '../calc/contractorPricing';
import { calculateProjectMaterials, getMaterialPrice, calculateWorkQuantities } from '../calc/materialCalc';
import { exportToExcel } from '../io/excelExport';

// Связь работ и материалов
const WORK_MATERIAL_MAP = {
  pipe_steel_32:  { matFilter: m => m.category === 'pipe_steel' && m.name.includes('Ду32') },
  pipe_steel_50:  { matFilter: m => m.category === 'pipe_steel' && m.name.includes('Ду50') },
  pipe_pex_16:    { matFilter: m => m.category === 'pipe_pex' && m.name.includes('d16') },
  pipe_pex_20:    { matFilter: m => m.category === 'pipe_pex' && m.name.includes('d20') },
  pipe_pex_25:    { matFilter: m => m.category === 'pipe_pex' && m.name.includes('d25') },
  gofra:          { matFilter: m => m.name.includes('гофр') || m.name.includes('защитн') },
  radiator_install: { matFilter: m => m.category === 'radiator_steel' || m.name.toLowerCase().includes('радиатор') },
  register_install: { matFilter: m => m.category === 'convector_infloor' || m.name.toLowerCase().includes('конвектор') },
  insulation_pe:  { matFilter: m => m.category === 'insulation' },
  insulation_mw_110: { matFilter: m => m.category === 'insulation' },
  collector:      { matFilter: m => m.name.includes('оллектор') || m.name.includes('ребёнк') },
  bottom_conn:    { matFilter: m => m.name.toLowerCase().includes('термоголовк') || m.name.toLowerCase().includes('клапан термо') },
};

export default function Step10_Summary() {
  const { state } = useProject();
  const data = state.contractorsData;
  const contractor = state.contractor;
  const contractorName = data?.contractors?.[contractor]?.name || contractor;

  // Объёмы работ
  const workQty = calculateWorkQuantities(state);

  // Расчёт работ с объёмами
  let totalWork = 0;
  const workRows = (data?.workPrices || []).map(item => {
    const override = state.workPriceOverrides[item.id];
    const resolved = override != null
      ? { price: override, source: 'manual' }
      : getWorkPrice(item, contractor, state.priceMatrix);
    const qty = workQty[item.id] || 0;
    const unitPrice = resolved.price || 0;
    const cost = unitPrice * qty;
    totalWork += cost;
    return { ...item, resolved, qty, unitPrice, cost };
  });

  // Расчёт материалов
  const projectMaterials = calculateProjectMaterials(state);
  let totalMaterials = 0;
  const materialRows = projectMaterials.map(item => {
    const override = state.materialPriceOverrides[item.priceKey || item.name];
    let priceInfo;
    if (override != null) {
      priceInfo = { price: override, source: 'manual' };
    } else {
      priceInfo = getMaterialPrice(item, state.priceMatrix, state.brandsData, state.brandSelections);
    }
    const unitPrice = priceInfo.price;
    const cost = unitPrice * item.qty;
    totalMaterials += cost;
    return { ...item, unitPrice, cost, priceSource: priceInfo.source };
  });

  // Привязка материалов к работам
  const usedMaterialNums = new Set();
  const workWithMaterials = workRows
    .filter(w => w.qty > 0 || w.cost > 0) // показываем только с объёмами
    .map(work => {
      const mapping = WORK_MATERIAL_MAP[work.id];
      let linkedMaterials = [];
      if (mapping) {
        linkedMaterials = materialRows.filter(m => {
          if (usedMaterialNums.has(m.num)) return false;
          return mapping.matFilter(m);
        });
        linkedMaterials.forEach(m => usedMaterialNums.add(m.num));
      }
      return { ...work, linkedMaterials };
    });

  // Непривязанные материалы
  const unlinkedMaterials = materialRows.filter(m => !usedMaterialNums.has(m.num));

  const grandTotal = totalWork + totalMaterials;

  const handleExport = () => {
    exportToExcel(state, workRows, materialRows, totalWork, totalMaterials, grandTotal);
  };

  return (
    <StepCard step={10} title="Итоговая смета">
      {state.projectName && (
        <div className="info-box" style={{ marginBottom: 16 }}>
          <strong>{state.projectName}</strong>
          {state.systemType && <span style={{ marginLeft: 12, color: 'var(--text2)' }}>{state.systemType}, {state.distribution}</span>}
        </div>
      )}

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

      <h3 style={{ marginTop: 20, fontSize: '1rem' }}>Попозиционный расчёт ({contractorName})</h3>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>№</th>
              <th>Наименование</th>
              <th>Характеристики</th>
              <th>Ед.</th>
              <th>Кол-во</th>
              <th>Цена ед.</th>
              <th>Стоимость</th>
              <th>Источник</th>
            </tr>
          </thead>
          <tbody>
            {workWithMaterials.map((work, wi) => {
              const matCost = work.linkedMaterials.reduce((s, m) => s + m.cost, 0);
              const posTotal = work.cost + matCost;

              return (
                <React.Fragment key={work.id}>
                  {/* Работа */}
                  <tr style={{ ...getRowStyle(work.resolved.source), fontWeight: 600 }}>
                    <td>{wi + 1}</td>
                    <td>{work.name}</td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text2)' }}>работа</td>
                    <td>{work.unit}</td>
                    <td>{work.qty}</td>
                    <td>{work.unitPrice ? fmt(work.unitPrice) : '—'}</td>
                    <td>{work.cost ? fmt(work.cost) : '—'}</td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>{getSourceText(work.resolved)}</td>
                  </tr>
                  {/* Материалы под работой */}
                  {work.linkedMaterials.map(mat => (
                    <tr key={`m-${mat.num}`} style={{ ...getRowStyle(mat.priceSource), fontSize: '0.88rem' }}>
                      <td></td>
                      <td style={{ paddingLeft: 24, color: 'var(--text2)' }}>{mat.name}</td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>{mat.chars}</td>
                      <td>{mat.unit}</td>
                      <td>{mat.qty}</td>
                      <td>{fmt(mat.unitPrice)}</td>
                      <td>{fmt(mat.cost)}</td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>{getMatSourceText(mat.priceSource)}</td>
                    </tr>
                  ))}
                  {/* Итого позиции */}
                  {work.linkedMaterials.length > 0 && (
                    <tr style={{ backgroundColor: '#f8fafc', borderTop: '1px solid var(--border)' }}>
                      <td></td>
                      <td colSpan={5} style={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 600 }}>Итого позиция:</td>
                      <td style={{ fontWeight: 700 }}>{fmt(posTotal)}</td>
                      <td></td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {/* Непривязанные материалы */}
            {unlinkedMaterials.length > 0 && (
              <>
                <tr style={{ backgroundColor: '#f0f9ff' }}>
                  <td colSpan={8} style={{ fontWeight: 600, paddingTop: 12 }}>Прочие материалы</td>
                </tr>
                {unlinkedMaterials.map(mat => (
                  <tr key={`u-${mat.num}`} style={getRowStyle(mat.priceSource)}>
                    <td></td>
                    <td>{mat.name}</td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>{mat.chars}</td>
                    <td>{mat.unit}</td>
                    <td>{mat.qty}</td>
                    <td>{fmt(mat.unitPrice)}</td>
                    <td><strong>{fmt(mat.cost)}</strong></td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>{getMatSourceText(mat.priceSource)}</td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--border)' }}>
              <td colSpan={5}></td>
              <td style={{ fontWeight: 600, textAlign: 'right' }}>Работы:</td>
              <td><strong>{fmt(totalWork)}</strong></td>
              <td></td>
            </tr>
            <tr>
              <td colSpan={5}></td>
              <td style={{ fontWeight: 600, textAlign: 'right' }}>Материалы:</td>
              <td><strong>{fmt(totalMaterials)}</strong></td>
              <td></td>
            </tr>
            <tr style={{ backgroundColor: 'var(--accent-light)' }}>
              <td colSpan={5}></td>
              <td style={{ fontWeight: 700, textAlign: 'right', fontSize: '1.05rem' }}>ИТОГО:</td>
              <td style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--accent)' }}>{fmt(grandTotal)} руб</td>
              <td></td>
            </tr>
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
    missing: { backgroundColor: '#fee2e2' }, estimate: { backgroundColor: '#fff7ed' },
    brand: { backgroundColor: '#f0f9ff' },
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

function getMatSourceText(source) {
  if (source === 'market') return 'рыночная';
  if (source === 'brand') return 'бренд';
  if (source === 'estimate') return 'оценка';
  if (source === 'manual') return 'ручная';
  if (source === 'missing') return 'нет данных';
  return '';
}
