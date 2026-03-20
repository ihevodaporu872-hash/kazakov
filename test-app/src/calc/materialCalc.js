// =====================================================================
// Расчёт материалов на основе параметров проекта
// Логика по диаграмме: блоки 5–8 (стояки, PEX, коллекторы, доп. материалы)
// =====================================================================

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

function getNumFloors(state) {
  // Берём floors из проекта или из импортированного state
  let floors = null;
  if (state.projectData && state.selectedBuilding) {
    const bldg = state.projectData.buildings[state.selectedBuilding];
    if (bldg) floors = bldg.floors;
  }
  if (!floors && state.floors) floors = state.floors;
  if (floors) {
    const m = String(floors).match(/(\d+)-(\d+)/);
    if (m) return parseInt(m[2]) - parseInt(m[1]) + 1;
  }
  return 16;
}

// Получить верхний этаж здания (абсолютный номер)
function getTopFloor(state) {
  let floors = null;
  if (state.projectData && state.selectedBuilding) {
    const bldg = state.projectData.buildings[state.selectedBuilding];
    if (bldg) floors = bldg.floors;
  }
  if (!floors && state.floors) floors = state.floors;
  if (floors) {
    const m = String(floors).match(/(\d+)-(\d+)/);
    if (m) return parseInt(m[2]);
  }
  return getNumFloors(state);
}

// Подбор диаметра стояка по формуле:
// d = 18.8 * sqrt((0.86 * Q) / (dT * v))
// Q — тепловая нагрузка на стояк, кВт
// dT — разница температур подачи/обратки, °C
// v — скорость теплоносителя, м/с
// Результат в мм → округляем до стандартного DN
function calcRiserDiameter(heatLoad_kW, schedule, velocity_ms) {
  const [ts, tr] = schedule.split('/').map(Number);
  const dT = ts - tr;
  const v = velocity_ms || 0.7;
  if (dT <= 0 || heatLoad_kW <= 0) return 32;

  const d_mm = 18.8 * Math.sqrt((0.86 * heatLoad_kW) / (dT * v));
  const STD_DN = [15, 20, 25, 32, 40, 50, 65, 80, 100];
  for (const dn of STD_DN) {
    if (dn >= d_mm) return dn;
  }
  return STD_DN[STD_DN.length - 1];
}

// === РАСЧЁТ ДЛИНЫ СТОЯКОВ ПО ЗОНАМ ===
// Каждый стояк идёт от подвала до верхнего этажа своей зоны.
// Длина = верхний_этаж_зоны × высота_этажа + 1м (подземная часть / 1-й этаж выше)
// Для не-верхних зон: +1 этаж (переход/воздухоудаление над зоной)
function calcZoneRiserLengths(zoneBoundaries, topFloor, floorH_m) {
  const zones = [];
  const bounds = Array.isArray(zoneBoundaries) && zoneBoundaries.length > 0
    ? [...zoneBoundaries]
    : [];

  // Верхние этажи каждой зоны
  const zoneTopFloors = [...bounds, topFloor];

  for (let i = 0; i < zoneTopFloors.length; i++) {
    const ztf = zoneTopFloors[i];
    const isLastZone = i === zoneTopFloors.length - 1;
    // Не-верхняя зона: стояк идёт на 1 этаж выше верхнего этажа зоны
    const effectiveFloors = isLastZone ? ztf : ztf + 1;
    const length = Math.round(effectiveFloors * floorH_m + 1); // +1м подвал
    const prevTop = i === 0 ? 0 : zoneTopFloors[i - 1];
    const floorsInZone = ztf - prevTop;

    zones.push({
      zoneNum: i + 1,
      topFloor: ztf,
      floorsInZone,
      riserLength: length,
    });
  }

  return zones;
}

// === РАСХОД ГРУНТОВКИ/КРАСКИ В ЗАВИСИМОСТИ ОТ DN ===
function getPrimerRate(dn) {
  // кг/м.п. грунтовки ГФ-021 по наружному диаметру трубы
  if (dn <= 20) return 0.03;
  if (dn <= 32) return 0.05;
  if (dn <= 50) return 0.08;
  return 0.12;
}

function getPaintRate(dn) {
  // кг/м.п. эмали ПФ-115 (~1.5× от грунтовки)
  if (dn <= 20) return 0.05;
  if (dn <= 32) return 0.08;
  if (dn <= 50) return 0.12;
  return 0.18;
}

// === КОМПЕНСАТОРЫ ПО СП 60.13330 ===
// Максимальное расстояние между неподвижными опорами зависит от DN трубы.
// При превышении — ставится компенсатор сильфонный осевой.
function getMaxCompensatorSpacing(dn) {
  // СП 60.13330 — допустимые расстояния для стальных труб ВГП
  if (dn <= 25) return 12;  // DN15–25: макс 12 м (~4 этажа по 3 м)
  if (dn <= 40) return 15;  // DN32–40: макс 15 м (~5 этажей)
  return 18;                 // DN50+:   макс 18 м (~6 этажей)
}

// Компенсаторы для одного стояка в зоне
function calcCompensatorsForRiser(riserLength, dn) {
  const maxSpacing = getMaxCompensatorSpacing(dn);
  return Math.max(0, Math.ceil(riserLength / maxSpacing) - 1);
}

// Неподвижные опоры = компенсаторы + 1 (между каждыми двумя НО — один компенсатор)
function calcFixedSupportsForRiser(compensators) {
  return compensators > 0 ? compensators + 1 : 0;
}

// Обратная совместимость — старые функции
function calcCompensators(numFloors) {
  return Math.max(0, Math.ceil(numFloors / 4) - 1);
}
function calcFixedSupports(compensators) {
  return compensators > 0 ? compensators + 1 : 0;
}

// =====================================================================
// ОСНОВНОЙ РАСЧЁТ МАТЕРИАЛОВ
// =====================================================================

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
  const numFloors = getNumFloors(state);
  const corridorLen = state.corridorLength_m || 0;
  const routingType = state.pexRoutingType || 'radial';
  const roomsPerApt = state.roomsPerApartment || 2;
  const aptsPerFloor = state.apartmentsPerFloor || Math.ceil(apartments / numFloors);
  const buhtaLen = state.pexBuhtaLength_m || 200;
  const pressMaterial = state.pressFittingMaterial || 'plastic';
  const velocity = state.riserVelocity_ms || 0.7;
  const schedule = state.schedule || '80/60';
  const heatLoad_kW = (state.heatLoad_W || 0) / 1000;
  const zoneBoundaries = state.zoneBoundaries || [];
  const topFloor = getTopFloor(state);

  // ================================================================
  // БЛОК 5: СТАЛЬНЫЕ ТРУБОПРОВОДЫ (СТОЯКИ) — с учётом зон
  // ================================================================

  // Диаметр стояка
  const heatPerRiser = riserPairs > 0 ? heatLoad_kW / (riserPairs * heatingZones) : 0;
  const riserDN = calcRiserDiameter(heatPerRiser, schedule, velocity);
  const maxSpacing = getMaxCompensatorSpacing(riserDN);

  // Расчёт длины стояков по зонам (каждый стояк идёт от подвала)
  const floorH_m = floorH / 1000;
  const zoneData = calcZoneRiserLengths(zoneBoundaries, topFloor, floorH_m);
  const pipesPerPair = 2; // подача + обратка

  // Суммы на 1 пару стояков (подача + обратка = 2 трубы)
  let riserLenPerPair = 0;   // м.п. на 1 пару
  let compPerPair = 0;       // компенсаторов на 1 пару
  let fixedPerPair = 0;      // НО на 1 пару
  let sleevesPerPair = 0;    // гильз на 1 пару
  const zoneDetails = [];

  zoneData.forEach(zone => {
    const zonePairLen = zone.riserLength * pipesPerPair; // длина на 1 пару в зоне
    const compPerRiser = calcCompensatorsForRiser(zone.riserLength, riserDN);
    const fixedPerRiser = calcFixedSupportsForRiser(compPerRiser);
    const sleevePerRiser = Math.round(zone.riserLength / floorH_m);

    riserLenPerPair += zonePairLen;
    compPerPair += compPerRiser * pipesPerPair;
    fixedPerPair += fixedPerRiser * pipesPerPair;
    sleevesPerPair += sleevePerRiser * pipesPerPair;

    zoneDetails.push({
      ...zone,
      zonePairLen,
      compPerRiser,
      fixedPerRiser,
      sleevePerRiser,
    });
  });

  // Итого: умножаем на кол-во пар стояков
  const totalRiserLen = riserLenPerPair * riserPairs;
  const totalCompensators = compPerPair * riserPairs;
  const totalFixedSupports = fixedPerPair * riserPairs;
  const totalFireSleeves = sleevesPerPair * riserPairs;

  // Стояки — общая длина
  if (totalRiserLen > 0) {
    const perPairDesc = zoneDetails.map(z =>
      `Зона ${z.zoneNum} (до ${z.topFloor} эт.): ${z.riserLength} м × 2`
    ).join('; ');
    materials.push({
      num: num++,
      name: `Трубопровод стальной стояков отопления Ду${riserDN}`,
      chars: `${perPairDesc} = ${riserLenPerPair} м/пару × ${riserPairs} пар = ${totalRiserLen} м.п.`,
      unit: 'м.п.',
      qty: totalRiserLen,
      category: 'pipe_steel',
      priceKey: `Трубопровод_Сталь_ВГП_DN${riserDN >= 50 ? riserDN : 32}`,
      section: 'risers'
    });
  }

  // Компенсаторы по СП 60.13330 (макс. расстояние между НО зависит от DN)
  if (totalCompensators > 0) {
    const perPairDesc = zoneDetails.map(z =>
      `Зона ${z.zoneNum}: ${z.compPerRiser} шт/стояк × 2`
    ).join('; ');
    materials.push({
      num: num++,
      name: `Компенсатор сильфонный осевой Ду${riserDN}`,
      chars: `${perPairDesc} = ${compPerPair} шт/пару × ${riserPairs} пар (макс. ${maxSpacing} м, СП 60.13330)`,
      unit: 'шт',
      qty: totalCompensators,
      category: 'pipe_steel',
      priceKey: `Компенсатор_Ду${riserDN >= 50 ? riserDN : 32}`,
      section: 'risers'
    });
  }

  // Неподвижные опоры по СП (между каждыми двумя НО — один компенсатор)
  if (totalFixedSupports > 0) {
    const perPairDesc = zoneDetails.map(z =>
      `Зона ${z.zoneNum}: ${z.fixedPerRiser} шт/стояк × 2`
    ).join('; ');
    materials.push({
      num: num++,
      name: `Неподвижная опора (НО) Ду${riserDN}`,
      chars: `${perPairDesc} = ${fixedPerPair} шт/пару × ${riserPairs} пар (СП 60.13330)`,
      unit: 'шт',
      qty: totalFixedSupports,
      category: 'pipe_steel',
      priceKey: null,
      fixedPrice: 800,
      section: 'risers'
    });
  }

  // Краны шаровые на стояках (по 2 на каждый стояк: верх + низ)
  const ballValves = pipesPerPair * riserPairs * 2 * heatingZones;
  if (ballValves > 0) {
    materials.push({
      num: num++,
      name: `Кран шаровой Ду${riserDN}`,
      chars: `2 (подача+обратка) × ${riserPairs} пар × 2 (верх+низ) × ${heatingZones} зон`,
      unit: 'шт',
      qty: ballValves,
      category: 'valve_thermo',
      priceKey: `Кран_шаровой_DN${riserDN >= 32 ? '25-32' : '15-20'}`,
      section: 'risers'
    });
  }

  // Балансировочные клапаны на стояках
  const balanceValves = riserPairs * 2 * heatingZones;
  if (balanceValves > 0) {
    materials.push({
      num: num++,
      name: `Клапан балансировочный Ду${riserDN}`,
      chars: `На стояках: ${riserPairs} пар × 2 × ${heatingZones} зон`,
      unit: 'шт',
      qty: balanceValves,
      category: 'valve_thermo',
      priceKey: 'Клапан_балансировочный_DN32-50',
      section: 'risers'
    });
  }

  // Воздухоотводчики — в верхних точках каждого стояка (только на подаче)
  const airVents = riserPairs * heatingZones;
  if (airVents > 0) {
    materials.push({
      num: num++,
      name: 'Воздухоотводчик автоматический',
      chars: `Верх стояков: ${riserPairs} пар × ${heatingZones} зон`,
      unit: 'шт',
      qty: airVents,
      category: 'valve_thermo',
      priceKey: 'Воздухоотводчик_авто',
      section: 'risers'
    });
  }

  // Спускники — в нижних точках каждого стояка
  const drains = riserPairs * heatingZones;
  if (drains > 0) {
    materials.push({
      num: num++,
      name: 'Кран спускной (дренажный) DN15',
      chars: `Низ стояков: ${riserPairs} пар × ${heatingZones} зон`,
      unit: 'шт',
      qty: drains,
      category: 'valve_thermo',
      priceKey: null,
      fixedPrice: 350,
      section: 'risers'
    });
  }

  // Грунтовка и покраска стальных труб (расход зависит от DN)
  if (totalRiserLen > 0) {
    const primerRate = getPrimerRate(riserDN);
    const primerKg = Math.ceil(totalRiserLen * primerRate);
    materials.push({
      num: num++,
      name: 'Грунтовка ГФ-021 для стальных труб',
      chars: `${primerRate} кг/м.п. (DN${riserDN}) × ${totalRiserLen} м.п.`,
      unit: 'кг',
      qty: primerKg,
      category: 'misc',
      priceKey: null,
      fixedPrice: 250,
      section: 'risers'
    });
    const paintRate = getPaintRate(riserDN);
    const paintKg = Math.ceil(totalRiserLen * paintRate);
    materials.push({
      num: num++,
      name: 'Эмаль ПФ-115 для стальных труб',
      chars: `${paintRate} кг/м.п. (DN${riserDN}) × ${totalRiserLen} м.п.`,
      unit: 'кг',
      qty: paintKg,
      category: 'misc',
      priceKey: null,
      fixedPrice: 300,
      section: 'risers'
    });
  }

  // Гильзы при проходе через перекрытие + противопожарная пена
  if (totalFireSleeves > 0) {
    const charsLines = zoneDetails.map(z =>
      `Зона ${z.zoneNum}: ${z.sleevePerRiser} перекр. × 2 труб`
    ).join('; ') + ` × ${riserPairs} пар`;
    materials.push({
      num: num++,
      name: `Гильза стальная проходная Ду${riserDN + 20}`,
      chars: charsLines,
      unit: 'шт',
      qty: totalFireSleeves,
      category: 'misc',
      priceKey: null,
      fixedPrice: 180,
      section: 'risers'
    });
    const foamCans = Math.ceil(totalFireSleeves / 20);
    materials.push({
      num: num++,
      name: 'Пена противопожарная монтажная',
      chars: `~1 баллон на 20 проходов`,
      unit: 'шт',
      qty: foamCans,
      category: 'misc',
      priceKey: null,
      fixedPrice: 800,
      section: 'risers'
    });
  }

  // ================================================================
  // БЛОК 6: ЭТАЖНЫЕ КОЛЛЕКТОРЫ (ГРЕБЁНКИ)
  // ================================================================

  // К каждому коллектору: 2 крана + 2 тройника
  const totalManifolds = manifoldOutputs * numFloors;
  if (totalManifolds > 0) {
    // Определяем диаметр коллектора по кол-ву отводов
    const manifoldDN = manifoldOutputs <= 4 ? 32 : manifoldOutputs <= 8 ? 40 : 50;
    materials.push({
      num: num++,
      name: `Коллектор (гребёнка) поэтажный ${manifoldOutputs} отв.`,
      chars: `${manifoldOutputs} отв./этаж × ${numFloors} эт., DN${manifoldDN}`,
      unit: 'компл.',
      qty: totalManifolds,
      category: 'valve_thermo',
      priceKey: null,
      fixedPrice: 3500,
      section: 'collectors'
    });

    // 2 крана на каждый коллектор
    materials.push({
      num: num++,
      name: `Кран шаровой Ду${manifoldDN} (на коллектор)`,
      chars: `2 шт. × ${totalManifolds} коллекторов`,
      unit: 'шт',
      qty: totalManifolds * 2,
      category: 'valve_thermo',
      priceKey: `Кран_шаровой_DN25-32`,
      section: 'collectors'
    });

    // 2 тройника на каждый коллектор
    materials.push({
      num: num++,
      name: `Тройник стальной Ду${manifoldDN}`,
      chars: `2 шт. × ${totalManifolds} коллекторов`,
      unit: 'шт',
      qty: totalManifolds * 2,
      category: 'pipe_steel',
      priceKey: null,
      fixedPrice: 250,
      section: 'collectors'
    });
  }

  // Присоединительные фитинги к PEX Ду20 (на коллекторах)
  const connFittings = totalManifolds * manifoldOutputs * 2; // подача + обратка
  if (connFittings > 0) {
    materials.push({
      num: num++,
      name: 'Фитинг присоединительный PEX Ду20 (на коллектор)',
      chars: `${manifoldOutputs} отв. × 2 (под./обр.) × ${totalManifolds} коллекторов`,
      unit: 'шт',
      qty: connFittings,
      category: 'pipe_pex',
      priceKey: null,
      fixedPrice: 120,
      section: 'collectors'
    });
  }

  // ================================================================
  // БЛОК 7: ГОРИЗОНТАЛЬНАЯ РАЗВОДКА PEX
  // ================================================================

  const overrides = state.pipeLenByDiam || {};

  if (routingType === 'radial') {
    // ---- ЛУЧЕВАЯ РАЗВОДКА (через внутриквартирные коллекторы) ----

    // Внутриквартирные коллекторы
    // Кол-во отводов в квартире = кол-во комнат + 1 (кухня)
    const outputsPerApt = roomsPerApt + 1;
    if (apartments > 0) {
      materials.push({
        num: num++,
        name: `Коллектор внутриквартирный ${outputsPerApt} отв.`,
        chars: `${apartments} квартир × (${roomsPerApt} комнат + 1 кухня), 2 шт/кв. (подача+обратка)`,
        unit: 'компл.',
        qty: apartments * 2,
        category: 'valve_thermo',
        priceKey: null,
        fixedPrice: 2500,
        section: 'pex'
      });

      // Фитинги перехода PEX → коллектор
      const pexToCollFittings = apartments * outputsPerApt * 2;
      materials.push({
        num: num++,
        name: 'Фитинг перехода PEX на коллектор (евроконус)',
        chars: `${apartments} кв. × ${outputsPerApt} отв. × 2`,
        unit: 'шт',
        qty: pexToCollFittings,
        category: 'pipe_pex',
        priceKey: null,
        fixedPrice: 90,
        section: 'pex'
      });
    }

    // PEX d16 — от квартирного коллектора к приборам (~3 м/прибор)
    const pexD16 = overrides[16] != null ? overrides[16] : Math.round(windowCount * 3);
    if (pexD16 > 0) {
      materials.push({
        num: num++,
        name: 'Труба PEX d16',
        chars: `Подводка к приборам (лучевая), ${windowCount} приб. × ~3 м`,
        unit: 'м.п.',
        qty: pexD16,
        category: 'pipe_pex',
        priceKey: 'Трубопровод_PEX_16мм',
        section: 'pex'
      });
    }

    // PEX d20 — от этажного коллектора до квартирного (~5 м/квартиру)
    const pexD20 = overrides[20] != null ? overrides[20] : Math.round(apartments * 5);
    if (pexD20 > 0) {
      materials.push({
        num: num++,
        name: 'Труба PEX d20',
        chars: `От этажного колл. до квартирного, ${apartments} кв. × ~5 м`,
        unit: 'м.п.',
        qty: pexD20,
        category: 'pipe_pex',
        priceKey: 'Трубопровод_PEX_20мм',
        section: 'pex'
      });
    }

    // PEX d25 — магистраль этажная (коридор)
    const pexD25 = overrides[25] != null ? overrides[25]
      : Math.round(corridorLen > 0 ? corridorLen * numFloors * 2 : manifoldOutputs * numFloors * 3);
    if (pexD25 > 0) {
      materials.push({
        num: num++,
        name: 'Труба PEX d25',
        chars: corridorLen > 0
          ? `Магистраль этажная: ${corridorLen} м × ${numFloors} эт. × 2`
          : `Магистраль: ${manifoldOutputs} вых. × ${numFloors} эт. × 3 м`,
        unit: 'м.п.',
        qty: pexD25,
        category: 'pipe_pex',
        priceKey: 'Трубопровод_PEX_25мм',
        section: 'pex'
      });
    }

    var totalPexLen = (pexD16 || 0) + (pexD20 || 0) + (pexD25 || 0);

  } else {
    // ---- ПОПУТНАЯ РАЗВОДКА (через тройники) ----

    // Тройники: (кол-во приборов − кол-во квартир) × 2
    const teeCount = Math.max(0, (windowCount - apartments)) * 2;
    if (teeCount > 0) {
      // Диаметры: 1-й 25-16-20, 2-й 20-16-16, остальные 16-16-16
      const tee25 = Math.min(apartments * 2, teeCount); // по 2 на квартиру (подача+обратка), макс. тройников
      const tee20 = Math.min(apartments * 2, Math.max(0, teeCount - tee25));
      const tee16 = Math.max(0, teeCount - tee25 - tee20);

      if (tee25 > 0) {
        materials.push({
          num: num++,
          name: 'Тройник PEX 25×16×20',
          chars: `1-й тройник от магистрали (подача+обратка)`,
          unit: 'шт',
          qty: tee25,
          category: 'pipe_pex',
          priceKey: null,
          fixedPrice: 280,
          section: 'pex'
        });
      }
      if (tee20 > 0) {
        materials.push({
          num: num++,
          name: 'Тройник PEX 20×16×16',
          chars: `2-й тройник`,
          unit: 'шт',
          qty: tee20,
          category: 'pipe_pex',
          priceKey: null,
          fixedPrice: 220,
          section: 'pex'
        });
      }
      if (tee16 > 0) {
        materials.push({
          num: num++,
          name: 'Тройник PEX 16×16×16',
          chars: `Остальные тройники`,
          unit: 'шт',
          qty: tee16,
          category: 'pipe_pex',
          priceKey: null,
          fixedPrice: 180,
          section: 'pex'
        });
      }
    }

    // PEX d16 — подводки к приборам (~1.5 м/прибор)
    const pexD16 = overrides[16] != null ? overrides[16] : Math.round(windowCount * 1.5);
    if (pexD16 > 0) {
      materials.push({
        num: num++,
        name: 'Труба PEX d16',
        chars: `Подводка к приборам (попутная), ${windowCount} × 1.5 м`,
        unit: 'м.п.',
        qty: pexD16,
        category: 'pipe_pex',
        priceKey: 'Трубопровод_PEX_16мм',
        section: 'pex'
      });
    }

    // PEX d20 — разводка между приборами (~2 м/прибор)
    const pexD20 = overrides[20] != null ? overrides[20] : Math.round(windowCount * 2.0);
    if (pexD20 > 0) {
      materials.push({
        num: num++,
        name: 'Труба PEX d20',
        chars: `Разводка между приборами, ${windowCount} × 2.0 м`,
        unit: 'м.п.',
        qty: pexD20,
        category: 'pipe_pex',
        priceKey: 'Трубопровод_PEX_20мм',
        section: 'pex'
      });
    }

    // PEX d25 — магистраль
    const pexD25 = overrides[25] != null ? overrides[25]
      : Math.round(corridorLen > 0 ? corridorLen * numFloors * 2 : manifoldOutputs * numFloors * 3);
    if (pexD25 > 0) {
      materials.push({
        num: num++,
        name: 'Труба PEX d25',
        chars: corridorLen > 0
          ? `Магистраль: ${corridorLen} м × ${numFloors} эт. × 2`
          : `Магистраль: ${manifoldOutputs} вых. × ${numFloors} эт. × 3 м`,
        unit: 'м.п.',
        qty: pexD25,
        category: 'pipe_pex',
        priceKey: 'Трубопровод_PEX_25мм',
        section: 'pex'
      });
    }

    var totalPexLen = (pexD16 || 0) + (pexD20 || 0) + (pexD25 || 0);
  }

  // ================================================================
  // БЛОК 8: ДОПОЛНИТЕЛЬНЫЕ МАТЕРИАЛЫ
  // ================================================================

  // --- Гофра для PEX внутри квартир ---
  // Примерно 60% от общей длины PEX идёт внутри квартиры
  const gofraPexLen = Math.round(totalPexLen * 0.6);
  if (gofraPexLen > 0) {
    materials.push({
      num: num++,
      name: 'Труба защитная гофрированная (для PEX внутри квартир)',
      chars: `~60% от общей длины PEX`,
      unit: 'м.п.',
      qty: gofraPexLen,
      category: 'misc',
      priceKey: null,
      fixedPrice: 60,
      section: 'additional'
    });
  }

  // --- Теплоизоляция для PEX в межквартирном пространстве ---
  // ~40% от общей длины PEX
  const insulPexLen = Math.round(totalPexLen * 0.4);
  if (insulPexLen > 0) {
    materials.push({
      num: num++,
      name: `Теплоизоляция ВПЭ ${insulThick}мм (для PEX в коридорах)`,
      chars: `~40% от общей длины PEX`,
      unit: 'м.п.',
      qty: insulPexLen,
      category: 'insulation',
      priceKey: insulThick <= 9 ? 'Теплоизоляция_ВПЭ_9мм_d15-22' : 'Теплоизоляция_ВПЭ_13мм_d15-22',
      section: 'additional'
    });
  }

  // --- Теплоизоляция стояков ---
  if (totalRiserLen > 0) {
    materials.push({
      num: num++,
      name: `Теплоизоляция ВПЭ ${insulThick}мм (стояки)`,
      chars: `Стояки: ${totalRiserLen} м.п.`,
      unit: 'м.п.',
      qty: totalRiserLen,
      category: 'insulation',
      priceKey: insulThick <= 9 ? 'Теплоизоляция_ВПЭ_9мм_d28-35' : 'Теплоизоляция_ВПЭ_13мм_d28-35',
      section: 'additional'
    });
  }

  // --- Хомуты (крюки) для крепления PEX к полу ---
  // ~1 хомут на 0.5 м PEX
  const pexClamps = Math.round(totalPexLen * 2);
  if (pexClamps > 0) {
    materials.push({
      num: num++,
      name: 'Хомут (крюк) для крепления PEX к полу',
      chars: `~2 шт/м.п.`,
      unit: 'шт',
      qty: pexClamps,
      category: 'misc',
      priceKey: null,
      fixedPrice: 8,
      section: 'additional'
    });
  }

  // --- Соединительные муфты PEX (через каждую бухту) ---
  // Кол-во муфт = суммарная длина / длина бухты (округляем вниз, -1 т.к. первая без муфты)
  const pexCouplings = Math.max(0, Math.floor(totalPexLen / buhtaLen));
  if (pexCouplings > 0) {
    materials.push({
      num: num++,
      name: 'Муфта соединительная PEX (равного диаметра)',
      chars: `Через каждые ${buhtaLen} м бухты`,
      unit: 'шт',
      qty: pexCouplings,
      category: 'pipe_pex',
      priceKey: null,
      fixedPrice: 150,
      section: 'additional'
    });
  }

  // --- Напрессовочные гильзы PEX ---
  // На каждое соединение PEX — 2 гильзы (вход + выход)
  // Кол-во соединений ≈ windowCount × 2 (подача + обратка) + муфты
  const pressConnections = windowCount * 2 + pexCouplings;
  if (pressConnections > 0) {
    materials.push({
      num: num++,
      name: `Гильза напрессовочная PEX (${pressMaterial === 'metal' ? 'металл' : 'пластик'})`,
      chars: `${windowCount} × 2 (подача+обратка) + ${pexCouplings} муфт`,
      unit: 'шт',
      qty: pressConnections,
      category: 'pipe_pex',
      priceKey: null,
      fixedPrice: pressMaterial === 'metal' ? 45 : 25,
      section: 'additional'
    });
  }

  // --- Крепление стальных трубопроводов (раздельно) ---
  const steelClampCount = Math.round(totalRiserLen / 1.5); // ~1 точка крепления на 1.5 м
  if (steelClampCount > 0) {
    materials.push({
      num: num++,
      name: `Хомут трубный Ду${riserDN}`,
      chars: `Стальные стояки, ~1 шт/1.5 м.п. × ${totalRiserLen} м.п.`,
      unit: 'шт',
      qty: steelClampCount,
      category: 'misc',
      priceKey: null,
      fixedPrice: 45,
      section: 'additional'
    });
    materials.push({
      num: num++,
      name: 'Анкер забивной М8',
      chars: `По 1 на каждый хомут`,
      unit: 'шт',
      qty: steelClampCount,
      category: 'misc',
      priceKey: null,
      fixedPrice: 15,
      section: 'additional'
    });
    materials.push({
      num: num++,
      name: 'Шпилька М8×120',
      chars: `По 1 на каждый хомут`,
      unit: 'шт',
      qty: steelClampCount,
      category: 'misc',
      priceKey: null,
      fixedPrice: 20,
      section: 'additional'
    });
  }

  // --- Теплосчётчики ---
  const heatMeters = state.heatMeterCount || 0;
  if (heatMeters > 0) {
    materials.push({
      num: num++,
      name: 'Теплосчётчик',
      chars: `Офисные/БКТ помещения`,
      unit: 'шт',
      qty: heatMeters,
      category: 'misc',
      priceKey: null,
      fixedPrice: 15000,
      section: 'additional'
    });
  }

  // ================================================================
  // ПРИБОРЫ ОТОПЛЕНИЯ (из спецификации Step 6)
  // ================================================================
  (state.specData || []).forEach(spec => {
    materials.push({
      num: num++,
      name: spec.name,
      chars: spec.chars,
      unit: spec.unit,
      qty: spec.qty,
      category: getCategoryForSpec(spec.name),
      priceKey: getPriceKeyForSpec(spec.name),
      fixedPrice: estimatePrice(spec.name),
      section: 'devices'
    });
  });

  // ================================================================
  // ПНР: опробование, промывка, испытание, сдача
  // ================================================================
  const totalPipeLen = totalRiserLen + totalPexLen;

  materials.push({
    num: num++,
    name: 'Гидравлическое испытание системы',
    chars: `Общая длина трубопроводов: ${totalPipeLen} м.п.`,
    unit: 'м.п.',
    qty: Math.round(totalPipeLen),
    category: 'pnr',
    priceKey: 'ПНР_гидроиспытание',
    section: 'pnr'
  });

  materials.push({
    num: num++,
    name: 'Промывка системы отопления',
    chars: '',
    unit: 'м.п.',
    qty: Math.round(totalPipeLen),
    category: 'pnr',
    priceKey: 'ПНР_промывка',
    section: 'pnr'
  });

  materials.push({
    num: num++,
    name: 'Опробование системы отопления',
    chars: '',
    unit: 'м.п.',
    qty: Math.round(totalPipeLen),
    category: 'pnr',
    priceKey: null,
    fixedPrice: 15,
    section: 'pnr'
  });

  materials.push({
    num: num++,
    name: 'Сдача системы отопления',
    chars: '',
    unit: 'компл.',
    qty: 1,
    category: 'pnr',
    priceKey: null,
    fixedPrice: 25000,
    section: 'pnr'
  });

  return materials;
}

// =====================================================================
// Расчёт объёмов работ
// =====================================================================

export function calculateWorkQuantities(state) {
  const windowCount = state.windowCount || 0;
  const floorH = state.floorHeight_mm || 3000;
  const riserPairs = state.riserPairs || 0;
  const manifoldOutputs = state.manifoldOutputs || 0;
  const apartments = state.apartments || 0;
  const heatingZones = state.heatingZones || 1;
  const overrides = state.pipeLenByDiam || {};
  const routingType = state.pexRoutingType || 'radial';
  const corridorLen = state.corridorLength_m || 0;
  const numFloors = getNumFloors(state);
  const heatLoad_kW = (state.heatLoad_W || 0) / 1000;
  const schedule = state.schedule || '80/60';
  const velocity = state.riserVelocity_ms || 0.7;

  const heatPerRiser = riserPairs > 0 ? heatLoad_kW / (riserPairs * heatingZones) : 0;
  const riserDN = calcRiserDiameter(heatPerRiser, schedule, velocity);
  const zoneBoundaries = state.zoneBoundaries || [];
  const topFloor = getTopFloor(state);
  const floorH_m = floorH / 1000;

  // Зональный расчёт длины стояков
  const zoneData = calcZoneRiserLengths(zoneBoundaries, topFloor, floorH_m);
  const pipesPerPair = 2; // подача + обратка
  const riserLenPerPair = zoneData.reduce((s, z) => s + z.riserLength * pipesPerPair, 0);
  const totalRiserLen = riserLenPerPair * riserPairs;

  // PEX длины
  let pexD16, pexD20, pexD25;
  if (routingType === 'radial') {
    pexD16 = overrides[16] != null ? overrides[16] : Math.round(windowCount * 3);
    pexD20 = overrides[20] != null ? overrides[20] : Math.round(apartments * 5);
    pexD25 = overrides[25] != null ? overrides[25]
      : Math.round(corridorLen > 0 ? corridorLen * numFloors * 2 : manifoldOutputs * numFloors * 3);
  } else {
    pexD16 = overrides[16] != null ? overrides[16] : Math.round(windowCount * 1.5);
    pexD20 = overrides[20] != null ? overrides[20] : Math.round(windowCount * 2.0);
    pexD25 = overrides[25] != null ? overrides[25]
      : Math.round(corridorLen > 0 ? corridorLen * numFloors * 2 : manifoldOutputs * numFloors * 3);
  }

  const totalPexLen = pexD16 + pexD20 + pexD25;
  const totalPipeLen = totalRiserLen + totalPexLen;
  const insulLen = totalRiserLen + Math.round(totalPexLen * 0.4);

  return {
    // Стальные трубопроводы
    [`pipe_steel_${riserDN}`]: totalRiserLen,
    pipe_steel_32: riserDN === 32 ? totalRiserLen : 0,
    pipe_steel_50: riserDN === 50 ? totalRiserLen : 0,
    // PEX
    pipe_pex_16: pexD16,
    pipe_pex_20: pexD20,
    pipe_pex_25: pexD25,
    // Гофра
    gofra: Math.round(totalPexLen * 0.6),
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
    // Компенсаторы (по зонам, по СП 60.13330)
    compensator: zoneData.reduce((s, z) => s + calcCompensatorsForRiser(z.riserLength, riserDN) * pipesPerPair, 0) * riserPairs,
    // Покраска
    painting: totalRiserLen,
    // ПНР
    hydro_test: totalPipeLen,
    test_heating: totalPipeLen,
    flush_heating: totalPipeLen,
    handover_heating: totalPipeLen,
  };
}

// =====================================================================
// Получение цен материалов
// =====================================================================

export function getMaterialPrice(item, priceMatrix, brandsData, brandSelections) {
  // 1. price_matrix
  if (item.priceKey && priceMatrix && priceMatrix[item.priceKey]) {
    return { price: priceMatrix[item.priceKey].typical, source: 'market' };
  }

  // 2. brands
  if (item.category && brandsData?.categories?.[item.category]) {
    const cat = brandsData.categories[item.category];
    const brand = brandSelections[item.category];
    if (brand && cat.prices[brand]) {
      const prices = cat.prices[brand];
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

// =====================================================================
// Вспомогательные для спецификации
// =====================================================================

function getCategoryForSpec(name) {
  const n = name.toLowerCase();
  if (n.includes('радиатор')) return 'radiator_steel';
  if (n.includes('конвектор')) return 'convector_infloor';
  if (n.includes('термоголовка')) return 'valve_thermo';
  if (n.includes('клапан')) return 'valve_thermo';
  if (n.includes('воздухоотвод') || n.includes('маевского')) return 'valve_thermo';
  if (n.includes('кронштейн')) return 'misc';
  if (n.includes('rlv') || n.includes('ниппел') || n.includes('евроконус') || n.includes('l-образн')) return 'valve_thermo';
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
  if (n.includes('rlv-k')) return 2800;
  if (n.includes('rlv') || n.includes('ra-n')) return 1500;
  if (n.includes('ниппел')) return 200;
  if (n.includes('евроконус')) return 300;
  if (n.includes('l-образн')) return 400;
  return 500;
}

// Экспорт для использования в UI
export {
  calcRiserDiameter,
  calcCompensators,
  calcFixedSupports,
  calcZoneRiserLengths,
  calcCompensatorsForRiser,
  calcFixedSupportsForRiser,
  getMaxCompensatorSpacing,
  getNumFloors,
  getTopFloor,
  getPrimerRate,
  getPaintRate,
};
