import React from 'react';
import StepCard from '../components/StepCard';
import RadioCards from '../components/RadioCards';
import EditablePrice from '../components/EditablePrice';
import { useProject } from '../state/ProjectContext';
import { fmt } from '../calc/heatCalc';
import { getWorkPrice } from '../calc/contractorPricing';

const CONTRACTOR_OPTIONS = [
  { value: 'kostra', label: 'Костра', desc: '' },
  { value: 'tadevosyan', label: 'Тадэвосян', desc: '' },
  { value: 'forteks', label: 'Фортекс', desc: '' },
];

export default function Step8_Contractor() {
  const { state, dispatch } = useProject();
  const data = state.contractorsData;

  if (!data) return <StepCard step={8} title="Расценки подрядчиков"><p>Загрузка...</p></StepCard>;

  const contractor = state.contractor;

  return (
    <StepCard step={8} title="Выбор подрядчика и расценки работ">
      <div className="info-box">
        Выберите подрядчика. При отсутствии цены подставляется значение от другого подрядчика
        (<span style={{ backgroundColor: '#fef9c3', padding: '2px 6px' }}>жёлтый</span>) или рыночная
        (<span style={{ backgroundColor: '#fff7ed', padding: '2px 6px' }}>оранжевый</span>).
        Нажмите на цену для ручного ввода (<span style={{ backgroundColor: '#dcfce7', padding: '2px 6px' }}>зелёный</span>).
      </div>

      <RadioCards
        name="contractor"
        options={CONTRACTOR_OPTIONS}
        value={contractor}
        onChange={v => dispatch({ type: 'SET', payload: { contractor: v } })}
      />

      <div style={{ overflowX: 'auto', marginTop: 16 }}>
        <table>
          <thead>
            <tr>
              <th>№</th>
              <th>Наименование работ</th>
              <th>Ед.</th>
              <th style={{ backgroundColor: contractor === 'kostra' ? '#dbeafe' : '' }}>Костра</th>
              <th style={{ backgroundColor: contractor === 'tadevosyan' ? '#dbeafe' : '' }}>Тадэвосян</th>
              <th style={{ backgroundColor: contractor === 'forteks' ? '#dbeafe' : '' }}>Фортекс</th>
              <th>Выбрано</th>
            </tr>
          </thead>
          <tbody>
            {data.workPrices.map((item, i) => {
              const override = state.workPriceOverrides[item.id];
              const resolved = override != null
                ? { price: override, source: 'manual', sourceLabel: 'ручная' }
                : getWorkPrice(item, contractor, state.priceMatrix);

              return (
                <tr key={item.id}>
                  <td>{i + 1}</td>
                  <td>{item.name}</td>
                  <td>{item.unit}</td>
                  <td style={{ backgroundColor: contractor === 'kostra' ? '#dbeafe' : '' }}>
                    {item.kostra != null ? fmt(item.kostra) : '—'}
                  </td>
                  <td style={{ backgroundColor: contractor === 'tadevosyan' ? '#dbeafe' : '' }}>
                    {item.tadevosyan != null ? fmt(item.tadevosyan) : '—'}
                  </td>
                  <td style={{ backgroundColor: contractor === 'forteks' ? '#dbeafe' : '' }}>
                    {item.forteks != null ? fmt(item.forteks) : '—'}
                  </td>
                  <td>
                    <EditablePrice
                      price={resolved.price}
                      source={resolved.source}
                      sourceLabel={resolved.sourceLabel}
                      onSave={p => dispatch({ type: 'SET_WORK_PRICE_OVERRIDE', id: item.id, price: p })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="export-bar">
        <button className="btn btn-primary" onClick={() => dispatch({ type: 'NEXT_STEP' })}>Далее: выбор брендов →</button>
      </div>
    </StepCard>
  );
}
