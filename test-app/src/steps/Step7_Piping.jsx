import React from 'react';
import StepCard from '../components/StepCard';
import { useProject } from '../state/ProjectContext';
import { fmt } from '../calc/heatCalc';
import {
  calculateProjectMaterials,
  calcRiserDiameter,
  calcZoneRiserLengths,
  calcCompensatorsForRiser,
  calcFixedSupportsForRiser,
  getMaxCompensatorSpacing,
  getNumFloors,
  getTopFloor,
  getPrimerRate,
  getPaintRate,
} from '../calc/materialCalc';

// Цены PEX по производителям и диаметрам (руб/м.п.)
const PEX_BRANDS = {
  pradex:  { name: 'Pradex',  prices: { 16: 180, 20: 250, 25: 350, 32: 480 } },
  rehau:   { name: 'Rehau',   prices: { 16: 320, 20: 420, 25: 560, 32: 750 } },
  sanext:  { name: 'Sanext',  prices: { 16: 210, 20: 280, 25: 400, 32: 550 } },
  everest: { name: 'Эверест', prices: { 16: 150, 20: 200, 25: 300, 32: 420 } },
  eae:     { name: 'EAE',     prices: { 16: 220, 20: 300, 25: 420, 32: 580 } },
};

const PEX_DIAMETERS = [16, 20, 25];

export default function Step7_Piping() {
  const { state, dispatch } = useProject();

  const brand = state.pipeBrand && PEX_BRANDS[state.pipeBrand] ? state.pipeBrand : 'pradex';
  const brandData = PEX_BRANDS[brand];
  const numFloors = getNumFloors(state);
  const nDevices = state.windowCount || 0;
  const routingType = state.pexRoutingType || 'radial';
  const apartments = state.apartments || 0;
  const corridorLen = state.corridorLength_m || 0;
  const manifoldOutputs = state.manifoldOutputs || 0;
  const riserPairs = state.riserPairs || 0;
  const heatingZones = state.heatingZones || 1;
  const heatLoad_kW = (state.heatLoad_W || 0) / 1000;
  const schedule = state.schedule || '80/60';
  const velocity = state.riserVelocity_ms || 0.7;
  const floorH = state.floorHeight_mm || 3000;
  const roomsPerApt = state.roomsPerApartment || 2;

  // === СТОЯКИ (зональный расчёт) ===
  const heatPerRiser = riserPairs > 0 ? heatLoad_kW / (riserPairs * heatingZones) : 0;
  const riserDN = calcRiserDiameter(heatPerRiser, schedule, velocity);
  const topFloor = getTopFloor(state);
  const zoneBoundaries = state.zoneBoundaries || [];
  const floorH_m = floorH / 1000;
  const zoneData = calcZoneRiserLengths(zoneBoundaries, topFloor, floorH_m);
  const pipesPerPair = 2; // подача + обратка
  const maxSpacing = getMaxCompensatorSpacing(riserDN);

  let riserLenPerPair = 0;
  let compPerPairTotal = 0;
  let fixedPerPairTotal = 0;
  let sleevesPerPairTotal = 0;

  zoneData.forEach(z => {
    const comp = calcCompensatorsForRiser(z.riserLength, riserDN);
    const fixed = calcFixedSupportsForRiser(comp);
    const sleeves = Math.round(z.riserLength / floorH_m);
    riserLenPerPair += z.riserLength * pipesPerPair;
    compPerPairTotal += comp * pipesPerPair;
    fixedPerPairTotal += fixed * pipesPerPair;
    sleevesPerPairTotal += sleeves * pipesPerPair;
  });

  const totalRiserLen = riserLenPerPair * riserPairs;
  const totalCompensators = compPerPairTotal * riserPairs;
  const totalFixedSupports = fixedPerPairTotal * riserPairs;
  const totalFireSleeves = sleevesPerPairTotal * riserPairs;

  // === PEX длины ===
  const overrides = state.pipeLenByDiam || {};
  let pexByDiam;
  if (routingType === 'radial') {
    pexByDiam = {
      16: { label: 'Подводка к приборам (от кварт. коллектора)', auto: Math.round(nDevices * 3) },
      20: { label: 'От этажного колл. до квартирного', auto: Math.round(apartments * 5) },
      25: { label: 'Магистраль этажная', auto: Math.round(corridorLen > 0 ? corridorLen * numFloors * 2 : manifoldOutputs * numFloors * 3) },
    };
  } else {
    pexByDiam = {
      16: { label: 'Подводка к приборам', auto: Math.round(nDevices * 1.5) },
      20: { label: 'Разводка между приборами', auto: Math.round(nDevices * 2.0) },
      25: { label: 'Магистраль этажная', auto: Math.round(corridorLen > 0 ? corridorLen * numFloors * 2 : manifoldOutputs * numFloors * 3) },
    };
  }

  let totalPipeCost = 0;
  let totalFittingCost = 0;

  const rows = PEX_DIAMETERS.map(d => {
    const auto = pexByDiam[d]?.auto || 0;
    const qty = overrides[d] != null ? overrides[d] : auto;
    const pipePrice = brandData.prices[d] || 0;
    const fittingPrice = Math.round(pipePrice * 0.4);
    const pipeCost = qty * pipePrice;
    const fittingCost = qty * fittingPrice;
    totalPipeCost += pipeCost;
    totalFittingCost += fittingCost;
    return { d, label: pexByDiam[d]?.label || '', qty, auto, pipePrice, fittingPrice, pipeCost, fittingCost };
  });

  const totalPexLen = rows.reduce((s, r) => s + r.qty, 0);

  // === Коллекторы (лучевая) / тройники (попутная) ===
  const aptCollectors = routingType === 'radial' ? apartments * 2 : 0;
  const teeCount = routingType === 'series' ? Math.max(0, (nDevices - apartments)) * 2 : 0;

  const updateLen = (d, val) => {
    dispatch({
      type: 'SET',
      payload: { pipeLenByDiam: { ...overrides, [d]: parseFloat(val) || 0 } }
    });
  };

  return (
    <StepCard step={7} title="Трубопроводы и материалы">

      {/* === СЕКЦИЯ: СТОЯКИ === */}
      <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>Стальные стояки</h3>
      <div className="info-box">
        Диаметр стояка: <code>d = 18.8 × √((0.86 × Q) / (ΔT × v))</code><br />
        Q на стояк = <strong>{heatPerRiser.toFixed(1)} кВт</strong>,
        v = <strong>{velocity} м/с</strong> → <strong>DN{riserDN}</strong><br />
        Макс. расстояние между НО (СП 60.13330): <strong>{maxSpacing} м</strong> для DN{riserDN}
      </div>

      {/* Детализация по зонам */}
      {zoneData.length > 1 && (
        <div className="info-box" style={{ marginTop: 8, fontSize: '0.85rem' }}>
          <strong>Расчёт по зонам (каждый стояк идёт от подвала):</strong>
          <table style={{ width: 'auto', marginTop: 6 }}>
            <thead>
              <tr>
                <th>Зона</th>
                <th>Этажи</th>
                <th>Длина стояка</th>
                <th>Комп./стояк</th>
                <th>НО/стояк</th>
                <th>Труб (подача+обратка)</th>
                <th>На 1 пару</th>
                <th>× {riserPairs} пар</th>
              </tr>
            </thead>
            <tbody>
              {zoneData.map((z, i) => {
                const comp = calcCompensatorsForRiser(z.riserLength, riserDN);
                const fixed = calcFixedSupportsForRiser(comp);
                const prevTop = i === 0 ? 0 : zoneData[i - 1].topFloor;
                return (
                  <tr key={z.zoneNum}>
                    <td>Зона {z.zoneNum}</td>
                    <td>{prevTop + 1}–{z.topFloor} эт.</td>
                    <td><strong>{z.riserLength} м</strong> (от подвала +1м)</td>
                    <td>{comp} шт</td>
                    <td>{fixed} шт</td>
                    <td>2</td>
                    <td><strong>{z.riserLength * 2} м</strong></td>
                    <td><strong>{z.riserLength * 2 * riserPairs} м</strong></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Позиция</th><th>Характеристики</th><th>Кол-во</th></tr></thead>
          <tbody>
            <tr>
              <td>Стояки Ду{riserDN}</td>
              <td>{zoneData.map(z => `Зона ${z.zoneNum}: ${z.riserLength}м × 2`).join('; ')} × {riserPairs} пар</td>
              <td><strong>{totalRiserLen} м.п.</strong></td>
            </tr>
            <tr>
              <td>Компенсаторы Ду{riserDN}</td>
              <td>По СП 60.13330, через каждые {maxSpacing} м</td>
              <td><strong>{totalCompensators} шт</strong></td>
            </tr>
            <tr>
              <td>Неподвижные опоры Ду{riserDN}</td>
              <td>= компенсаторы + 1 на стояк (СП 60.13330)</td>
              <td><strong>{totalFixedSupports} шт</strong></td>
            </tr>
            <tr><td>Гильзы проходные</td><td>Проход через перекрытия</td><td><strong>{totalFireSleeves} шт</strong></td></tr>
            <tr><td>Краны шаровые Ду{riserDN}</td><td>2 × {riserPairs} пар × 2 (верх+низ) × {heatingZones} зон</td><td><strong>{pipesPerPair * riserPairs * 2 * heatingZones} шт</strong></td></tr>
            <tr><td>Воздухоотводчики</td><td>Верх стояков: {riserPairs} пар × {heatingZones} зон</td><td><strong>{riserPairs * heatingZones} шт</strong></td></tr>
            <tr><td>Спускники DN15</td><td>Низ стояков: {riserPairs} пар × {heatingZones} зон</td><td><strong>{riserPairs * heatingZones} шт</strong></td></tr>
          </tbody>
        </table>
      </div>

      {/* === СЕКЦИЯ: КОЛЛЕКТОРЫ === */}
      <h3 style={{ fontSize: '1rem', marginTop: 24, marginBottom: 12 }}>Этажные коллекторы</h3>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Позиция</th><th>Характеристики</th><th>Кол-во</th></tr></thead>
          <tbody>
            <tr><td>Коллектор поэтажный {manifoldOutputs} отв.</td><td>{manifoldOutputs} отв./этаж × {numFloors} эт.</td><td><strong>{manifoldOutputs * numFloors} компл.</strong></td></tr>
            <tr><td>Краны на коллекторы</td><td>2 шт. × {manifoldOutputs * numFloors} коллекторов</td><td><strong>{manifoldOutputs * numFloors * 2} шт</strong></td></tr>
            <tr><td>Фитинги присоед. PEX Ду20</td><td>На коллекторах</td><td><strong>{manifoldOutputs * numFloors * manifoldOutputs * 2} шт</strong></td></tr>
          </tbody>
        </table>
      </div>

      {/* === СЕКЦИЯ: РАЗВОДКА PEX === */}
      <h3 style={{ fontSize: '1rem', marginTop: 24, marginBottom: 12 }}>
        Разводка PEX — {routingType === 'radial' ? 'лучевая (через коллектор)' : 'попутная (через тройники)'}
      </h3>

      {routingType === 'radial' && apartments > 0 && (
        <div className="info-box">
          Внутриквартирные коллекторы: <strong>{apartments} кв. × 2 (подача+обратка) = {aptCollectors} шт</strong><br />
          Отводов в квартире: <strong>{roomsPerApt} комнат + 1 кухня = {roomsPerApt + 1}</strong>
        </div>
      )}

      {routingType === 'series' && (
        <div className="info-box">
          Тройники PEX: <strong>({nDevices} приборов − {apartments} квартир) × 2 = {teeCount} шт</strong><br />
          Диаметры: 1-й 25×16×20, 2-й 20×16×16, остальные 16×16×16
        </div>
      )}

      <div className="form-row" style={{ marginBottom: 16, marginTop: 12 }}>
        <div className="form-group">
          <label>Производитель PEX</label>
          <select value={brand} onChange={e => dispatch({ type: 'SET', payload: { pipeBrand: e.target.value } })}>
            {Object.entries(PEX_BRANDS).map(([id, b]) => (
              <option key={id} value={id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Материал напрессовочных гильз</label>
          <select value={state.pressFittingMaterial || 'plastic'} onChange={e => dispatch({ type: 'SET', payload: { pressFittingMaterial: e.target.value } })}>
            <option value="plastic">Пластик</option>
            <option value="metal">Металл</option>
          </select>
        </div>
        <div className="form-group">
          <label>Длина бухты PEX, м</label>
          <select value={state.pexBuhtaLength_m || 200} onChange={e => dispatch({ type: 'SET', payload: { pexBuhtaLength_m: parseInt(e.target.value) } })}>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
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
              <td colSpan={2} style={{ fontWeight: 600, textAlign: 'right' }}>Итого PEX:</td>
              <td><strong>{fmt(totalPexLen)} м.п.</strong></td>
              <td colSpan={2}></td>
              <td><strong>{fmt(totalPipeCost)}</strong></td>
              <td><strong>{fmt(totalFittingCost)}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* === СЕКЦИЯ: ДОП. МАТЕРИАЛЫ === */}
      <h3 style={{ fontSize: '1rem', marginTop: 24, marginBottom: 12 }}>Дополнительные материалы</h3>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Позиция</th><th>Расчёт</th><th>Кол-во</th></tr></thead>
          <tbody>
            <tr><td>Гофра защитная (PEX внутри квартир)</td><td>~60% от {fmt(totalPexLen)} м.п.</td><td><strong>{fmt(Math.round(totalPexLen * 0.6))} м.п.</strong></td></tr>
            <tr><td>Теплоизоляция ВПЭ (PEX в коридорах)</td><td>~40% от {fmt(totalPexLen)} м.п.</td><td><strong>{fmt(Math.round(totalPexLen * 0.4))} м.п.</strong></td></tr>
            <tr><td>Теплоизоляция ВПЭ (стояки)</td><td>Стальные стояки</td><td><strong>{fmt(totalRiserLen)} м.п.</strong></td></tr>
            <tr><td>Хомуты крепления PEX к полу</td><td>~2 шт/м.п.</td><td><strong>{fmt(Math.round(totalPexLen * 2))} шт</strong></td></tr>
            <tr><td>Муфты соединительные PEX</td><td>Через каждые {state.pexBuhtaLength_m || 200} м бухты</td><td><strong>{Math.max(0, Math.floor(totalPexLen / (state.pexBuhtaLength_m || 200)))} шт</strong></td></tr>
            <tr><td>Гильзы напрессовочные ({(state.pressFittingMaterial || 'plastic') === 'metal' ? 'металл' : 'пластик'})</td><td>{nDevices} × 2 + муфты</td><td><strong>{nDevices * 2 + Math.max(0, Math.floor(totalPexLen / (state.pexBuhtaLength_m || 200)))} шт</strong></td></tr>
            <tr><td>Хомут трубный Ду{riserDN}</td><td>~1 шт/1.5 м.п. стояка</td><td><strong>{Math.round(totalRiserLen / 1.5)} шт</strong></td></tr>
            <tr><td>Анкер забивной М8</td><td>По 1 на хомут</td><td><strong>{Math.round(totalRiserLen / 1.5)} шт</strong></td></tr>
            <tr><td>Шпилька М8×120</td><td>По 1 на хомут</td><td><strong>{Math.round(totalRiserLen / 1.5)} шт</strong></td></tr>
            <tr><td>Грунтовка ГФ-021</td><td>{getPrimerRate(riserDN)} кг/м.п. (DN{riserDN}) × {totalRiserLen} м.п.</td><td><strong>{Math.ceil(totalRiserLen * getPrimerRate(riserDN))} кг</strong></td></tr>
            <tr><td>Эмаль ПФ-115</td><td>{getPaintRate(riserDN)} кг/м.п. (DN{riserDN}) × {totalRiserLen} м.п.</td><td><strong>{Math.ceil(totalRiserLen * getPaintRate(riserDN))} кг</strong></td></tr>
            <tr><td>Гильзы проходные + пена п/п</td><td>Проход через перекрытия</td><td><strong>{totalFireSleeves} шт + {Math.ceil(totalFireSleeves / 20)} баллонов</strong></td></tr>
          </tbody>
        </table>
      </div>

      {/* === СЕКЦИЯ: ПНР === */}
      <h3 style={{ fontSize: '1rem', marginTop: 24, marginBottom: 12 }}>ПНР (пуско-наладка)</h3>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Позиция</th><th>Объём</th></tr></thead>
          <tbody>
            <tr><td>Гидравлическое испытание</td><td><strong>{fmt(totalRiserLen + totalPexLen)} м.п.</strong></td></tr>
            <tr><td>Промывка системы</td><td><strong>{fmt(totalRiserLen + totalPexLen)} м.п.</strong></td></tr>
            <tr><td>Опробование системы</td><td><strong>{fmt(totalRiserLen + totalPexLen)} м.п.</strong></td></tr>
            <tr><td>Сдача системы</td><td><strong>1 компл.</strong></td></tr>
          </tbody>
        </table>
      </div>

      <div className="export-bar">
        <button className="btn btn-primary" onClick={() => dispatch({ type: 'NEXT_STEP' })}>Далее: расценки подрядчиков →</button>
      </div>
    </StepCard>
  );
}
