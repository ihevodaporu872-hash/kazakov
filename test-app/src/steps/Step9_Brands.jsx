import React from 'react';
import StepCard from '../components/StepCard';
import EditablePrice from '../components/EditablePrice';
import { useProject } from '../state/ProjectContext';
import { fmt } from '../calc/heatCalc';

export default function Step9_Brands() {
  const { state, dispatch } = useProject();
  const brandsData = state.brandsData;

  if (!brandsData) return <StepCard step={9} title="Выбор брендов"><p>Загрузка...</p></StepCard>;

  const categories = brandsData.categories;

  return (
    <StepCard step={9} title="Выбор брендов материалов">
      <div className="info-box">
        Выберите бренд для каждой категории материалов. Цены из прайсов поставщиков.
        Нажмите на цену для ручной корректировки.
        <span style={{ backgroundColor: '#fff7ed', padding: '2px 6px', marginLeft: 8 }}>Оранжевый</span> — рыночная цена (прайс отсутствует).
      </div>

      {Object.entries(categories).map(([catId, cat]) => {
        const selectedBrand = state.brandSelections[catId] || cat.brands[0]?.id;
        const prices = cat.prices[selectedBrand] || {};

        return (
          <div key={catId} className="brand-category" style={{ marginTop: 20 }}>
            <h4 style={{ fontSize: '0.95rem', marginBottom: 8 }}>{cat.label}</h4>
            <div className="radio-cards" style={{ marginBottom: 12 }}>
              {cat.brands.map(b => (
                <label
                  key={b.id}
                  className={`radio-card ${selectedBrand === b.id ? 'active' : ''}`}
                  onClick={() => dispatch({ type: 'SET_BRAND', category: catId, brand: b.id })}
                  style={{ minWidth: 'auto', padding: '8px 16px' }}
                >
                  <div className="rc-title" style={{ fontSize: '0.9rem' }}>{b.name}</div>
                </label>
              ))}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr><th>Позиция</th><th>Цена, руб</th></tr>
                </thead>
                <tbody>
                  {Object.entries(prices).map(([key, price]) => {
                    const overrideKey = `${catId}_${selectedBrand}_${key}`;
                    const override = state.materialPriceOverrides[overrideKey];
                    const actualPrice = override != null ? override : price;
                    const source = override != null ? 'manual' : 'contractor';

                    return (
                      <tr key={key}>
                        <td>{formatPriceKey(catId, key)}</td>
                        <td>
                          <EditablePrice
                            price={actualPrice}
                            source={source}
                            sourceLabel={null}
                            onSave={p => dispatch({ type: 'SET_MATERIAL_PRICE_OVERRIDE', key: overrideKey, price: p })}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      <div className="export-bar">
        <button className="btn btn-primary" onClick={() => dispatch({ type: 'NEXT_STEP' })}>Далее: итоговая смета →</button>
      </div>
    </StepCard>
  );
}

function formatPriceKey(catId, key) {
  const labels = {
    '11': 'Тип 11', '22': 'Тип 22', '33': 'Тип 33',
    'natural': 'Без вентилятора', 'fan': 'С вентилятором',
    'valve': 'Клапан', 'head': 'Термоголовка',
    'vpe_9': 'ВПЭ 9мм', 'vpe_13': 'ВПЭ 13мм', 'rubber_9': 'Каучук 9мм',
    '16': 'd16', '20': 'd20', '25': 'd25', '32': 'd32', '40': 'd40', '63': 'd63',
    '15': 'DN15', '50': 'DN50', '65': 'DN65', '80': 'DN80', '100': 'DN100',
  };
  return labels[key] || key;
}
