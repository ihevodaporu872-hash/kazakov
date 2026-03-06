// Расчёт материалов на основе параметров проекта
// Входные данные: state с параметрами из project_308.json

export function calculateProjectMaterials(state) {
  const materials = [];
  let num = 1;

  const windowCount = state.windowCount || 0;
  const floorH = state.floorHeight_mm || 3000;
  const riserPairs = state.riserPairs || 0;
  const manifoldOutputs = state.manifoldOutputs || 0;
  const heatingZones = state.heatingZones || 1;
  const apartments = state.apartments || 0;
  const insulThick = state.insulationThickness_mm || 13;

  // Определяем кол-во этажей из строки floors (напр. "2-17")
  let numFloors = 16;
  if (state.projectData && state.selectedBuilding) {
    const bldg = state.projectData.buildings[state.selectedBuilding];
    if (bldg && bldg.floors) {
      const m = bldg.floors.match(/(\d+)-(\d+)/);
      if (m) numFloors = parseInt(m[2]) - parseInt(m[1]) + 1;
    }
  }

  // === ТРУБОПРОВОДЫ СТАЛЬНЫЕ ===

  // 1. Стояки отопления (стальные) — пара стояков: подача + обратка
  const riserLen_per = (floorH / 1000) * numFloors;
  const totalRiserLen = riserLen_per * riserPairs * 2;
  if (totalRiserLen > 0) {
    materials.push({
      num: num++,
      name: 'Трубопровод стальной стояков отопления Ду32',
      chars: `${riserPairs} пар × ${numFloors} эт. × ${(floorH/1000).toFixed(1)}м × 2 (подача+обратка)`,
      unit: 'м.п.',
      qty: Math.round(totalRiserLen),
      category: 'pipe_steel',
      priceKey: 'Трубопровод_Сталь_ВГП_DN32'
    });
  }

  // 2. Магистральные трубопроводы стальные (горизонтальная разводка)
  const mainPipeLen = Math.round(apartments * 6);
  if (mainPipeLen > 0) {
    materials.push({
      num: num++,
      name: 'Трубопровод стальной магистральный Ду50',
      chars: `Магистральная разводка, ~6 м.п./квартиру`,
      unit: 'м.п.',
      qty: mainPipeLen,
      category: 'pipe_steel',
      priceKey: 'Трубопровод_Сталь_ВГП_DN50'
    });
  }

  // === ТРУБОПРОВОДЫ PEX (по диаметрам) ===
  const overrides = state.pipeLenByDiam || {};

  // d16 — подводки к приборам (~1.5 м.п. на прибор)
  const pexD16 = overrides[16] != null ? overrides[16] : Math.round(windowCount * 1.5);
  if (pexD16 > 0) {
    materials.push({
      num: num++,
      name: 'Труба PEX d16',
      chars: `Подводка к приборам, ${windowCount} × 1.5 м.п.`,
      unit: 'м.п.',
      qty: pexD16,
      category: 'pipe_pex',
      priceKey: 'Трубопровод_PEX_16мм'
    });
  }

  // d20 — разводка от гребёнки (~2 м.п. на прибор)
  const pexD20 = overrides[20] != null ? overrides[20] : Math.round(windowCount * 2.0);
  if (pexD20 > 0) {
    materials.push({
      num: num++,
      name: 'Труба PEX d20',
      chars: `Разводка от гребёнки, ${windowCount} × 2.0 м.п.`,
      unit: 'м.п.',
      qty: pexD20,
      category: 'pipe_pex',
      priceKey: 'Трубопровод_PEX_20мм'
    });
  }

  // d25 — магистраль этажная
  const pexD25 = overrides[25] != null ? overrides[25] : Math.round(manifoldOutputs * numFloors * 3);
  if (pexD25 > 0) {
    materials.push({
      num: num++,
      name: 'Труба PEX d25',
      chars: `Магистраль этажная, ${manifoldOutputs} вых. × ${numFloors} эт. × 3 м`,
      unit: 'м.п.',
      qty: pexD25,
      category: 'pipe_pex',
      priceKey: 'Трубопровод_PEX_25мм'
    });
  }

  // Труба защитная гофрированная (для всех PEX)
  const totalPexLen = pexD16 + pexD20 + pexD25;
  if (totalPexLen > 0) {
    materials.push({
      num: num++,
      name: 'Труба защитная гофрированная',
      chars: `Для PEX-разводки`,
      unit: 'м.п.',
      qty: totalPexLen,
      category: 'misc',
      priceKey: null,
      fixedPrice: 60
    });
  }

  // === ГРЕБЁНКИ / КОЛЛЕКТОРЫ ===
  const totalManifolds = manifoldOutputs * numFloors;
  if (totalManifolds > 0) {
    materials.push({
      num: num++,
      name: 'Коллектор (гребёнка) поэтажный',
      chars: `${manifoldOutputs} вых./этаж × ${numFloors} эт.`,
      unit: 'шт',
      qty: totalManifolds,
      category: 'valve_thermo',
      priceKey: null,
      fixedPrice: 3500
    });
  }

  // === ПРИБОРЫ ОТОПЛЕНИЯ (из спецификации) ===
  (state.specData || []).forEach(spec => {
    materials.push({
      num: num++,
      name: spec.name,
      chars: spec.chars,
      unit: spec.unit,
      qty: spec.qty,
      category: getCategoryForSpec(spec.name),
      priceKey: getPriceKeyForSpec(spec.name),
      fixedPrice: estimatePrice(spec.name)
    });
  });

  // === ТЕПЛОИЗОЛЯЦИЯ ===
  const insulLen = totalRiserLen + mainPipeLen;
  if (insulLen > 0) {
    materials.push({
      num: num++,
      name: `Теплоизоляция ВПЭ ${insulThick}мм`,
      chars: `Стояки + магистрали: ${Math.round(totalRiserLen)} + ${mainPipeLen} м.п.`,
      unit: 'м.п.',
      qty: Math.round(insulLen),
      category: 'insulation',
      priceKey: insulThick <= 9 ? 'Теплоизоляция_ВПЭ_9мм_d28-35' : 'Теплоизоляция_ВПЭ_13мм_d15-22'
    });
  }

  // === АРМАТУРА ===
  const ballValves = riserPairs * 2 * 2 * heatingZones;
  if (ballValves > 0) {
    materials.push({
      num: num++,
      name: 'Кран шаровой Ду32',
      chars: `На стояках: ${riserPairs} пар × 2 × 2 × ${heatingZones} зон`,
      unit: 'шт',
      qty: ballValves,
      category: 'valve_thermo',
      priceKey: 'Кран_шаровой_DN25-32'
    });
  }

  const balanceValves = riserPairs * 2 * heatingZones;
  if (balanceValves > 0) {
    materials.push({
      num: num++,
      name: 'Клапан балансировочный Ду32',
      chars: `На стояках`,
      unit: 'шт',
      qty: balanceValves,
      category: 'valve_thermo',
      priceKey: 'Клапан_балансировочный_DN32-50'
    });
  }

  const airVents = riserPairs * 2 * heatingZones;
  if (airVents > 0) {
    materials.push({
      num: num++,
      name: 'Воздухоотводчик автоматический',
      chars: `Верх стояков`,
      unit: 'шт',
      qty: airVents,
      category: 'valve_thermo',
      priceKey: 'Воздухоотводчик_авто'
    });
  }

  // === ПНР ===
  const totalPipeLen = totalRiserLen + mainPipeLen + totalPexLen;
  materials.push({
    num: num++,
    name: 'Гидравлическое испытание системы',
    chars: `Общая длина трубопроводов`,
    unit: 'м.п.',
    qty: Math.round(totalPipeLen),
    category: 'pnr',
    priceKey: 'ПНР_гидроиспытание'
  });

  materials.push({
    num: num++,
    name: 'Промывка системы отопления',
    chars: '',
    unit: 'м.п.',
    qty: Math.round(totalPipeLen),
    category: 'pnr',
    priceKey: 'ПНР_промывка'
  });

  return materials;
}

function getCategoryForSpec(name) {
  const n = name.toLowerCase();
  if (n.includes('радиатор')) return 'radiator_steel';
  if (n.includes('конвектор')) return 'convector_infloor';
  if (n.includes('термоголовка')) return 'valve_thermo';
  if (n.includes('клапан')) return 'valve_thermo';
  if (n.includes('воздухоотвод') || n.includes('маевского')) return 'valve_thermo';
  if (n.includes('кронштейн')) return 'misc';
  return 'misc';
}

function getPriceKeyForSpec(name) {
  const n = name.toLowerCase();
  if (n.includes('радиатор') && n.includes('22')) return 'Радиатор_стальной_22тип';
  if (n.includes('радиатор') && n.includes('11')) return 'Радиатор_стальной_11тип';
  if (n.includes('радиатор') && n.includes('33')) return 'Радиатор_стальной_33тип';
  if (n.includes('радиатор')) return 'Радиатор_стальной_22тип';
  if (n.includes('конвектор') && n.includes('вент')) return 'Конвектор_внутрипольный_с_вент';
  if (n.includes('конвектор')) return 'Конвектор_внутрипольный_без_вент';
  if (n.includes('термоголовка')) return 'Термоголовка';
  if (n.includes('клапан') && n.includes('термо')) return 'Клапан_термостатический_DN15-20';
  if (n.includes('воздухоотвод') || n.includes('маевского')) return 'Кран_Маевского';
  return null;
}

function estimatePrice(name) {
  const n = name.toLowerCase();
  if (n.includes('радиатор')) return 8500;
  if (n.includes('конвектор')) return 30000;
  if (n.includes('термоголовка')) return 1000;
  if (n.includes('клапан')) return 1200;
  if (n.includes('воздухоотвод') || n.includes('маевского')) return 200;
  if (n.includes('кронштейн')) return 150;
  return 500;
}

// Расчёт объёмов работ по параметрам проекта
export function calculateWorkQuantities(state) {
  const windowCount = state.windowCount || 0;
  const floorH = state.floorHeight_mm || 3000;
  const riserPairs = state.riserPairs || 0;
  const manifoldOutputs = state.manifoldOutputs || 0;
  const apartments = state.apartments || 0;
  const overrides = state.pipeLenByDiam || {};

  let numFloors = 16;
  if (state.projectData && state.selectedBuilding) {
    const bldg = state.projectData.buildings[state.selectedBuilding];
    if (bldg && bldg.floors) {
      const m = bldg.floors.match(/(\d+)-(\d+)/);
      if (m) numFloors = parseInt(m[2]) - parseInt(m[1]) + 1;
    }
  }

  const totalRiserLen = Math.round((floorH / 1000) * numFloors * riserPairs * 2);
  const mainPipeLen = Math.round(apartments * 6);
  const pexD16 = overrides[16] != null ? overrides[16] : Math.round(windowCount * 1.5);
  const pexD20 = overrides[20] != null ? overrides[20] : Math.round(windowCount * 2.0);
  const pexD25 = overrides[25] != null ? overrides[25] : Math.round(manifoldOutputs * numFloors * 3);
  const totalPexLen = pexD16 + pexD20 + pexD25;
  const totalPipeLen = totalRiserLen + mainPipeLen + totalPexLen;
  const insulLen = totalRiserLen + mainPipeLen;

  return {
    // Стальные трубопроводы
    pipe_steel_32: totalRiserLen,
    pipe_steel_50: mainPipeLen,
    // PEX
    pipe_pex_16: pexD16,
    pipe_pex_20: pexD20,
    pipe_pex_25: pexD25,
    // Гофра
    gofra: totalPexLen,
    // Коллектор
    collector: manifoldOutputs * numFloors,
    // Приборы
    radiator_install: windowCount,
    register_install: windowCount,
    // Узлы
    bottom_conn: windowCount,
    end_node: riserPairs * 2,
    // Изоляция
    insulation_pe: insulLen,
    insulation_mw_110: insulLen,
    // ПНР
    hydro_test: totalPipeLen,
    test_heating: totalPipeLen,
    flush_heating: totalPipeLen,
    handover_heating: totalPipeLen,
  };
}

export function getMaterialPrice(item, priceMatrix, brandsData, brandSelections) {
  // 1. Попробовать из price_matrix
  if (item.priceKey && priceMatrix && priceMatrix[item.priceKey]) {
    return { price: priceMatrix[item.priceKey].typical, source: 'market' };
  }

  // 2. Попробовать из brands
  if (item.category && brandsData?.categories?.[item.category]) {
    const cat = brandsData.categories[item.category];
    const brand = brandSelections[item.category];
    if (brand && cat.prices[brand]) {
      const prices = cat.prices[brand];
      // Для PEX — ищем по диаметру из имени
      if (item.category === 'pipe_pex') {
        const dMatch = item.name.match(/d(\d+)/);
        if (dMatch && prices[dMatch[1]]) {
          return { price: prices[dMatch[1]], source: 'brand' };
        }
      }
      const firstPrice = Object.values(prices)[0];
      if (firstPrice) return { price: firstPrice, source: 'brand' };
    }
  }

  // 3. Фиксированная цена
  if (item.fixedPrice) return { price: item.fixedPrice, source: 'estimate' };

  return { price: 0, source: 'missing' };
}
