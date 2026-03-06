const CONTRACTOR_ORDER = ['kostra', 'tadevosyan', 'forteks'];

export function getWorkPrice(workItem, contractorId, priceMatrix) {
  const price = workItem[contractorId];
  if (price != null) {
    return { price, source: 'contractor', sourceLabel: null };
  }

  // Берём у соседнего подрядчика
  for (const otherId of CONTRACTOR_ORDER) {
    if (otherId !== contractorId && workItem[otherId] != null) {
      const contractors = { kostra: 'Костра', tadevosyan: 'Тадэвосян', forteks: 'Фортекс' };
      return { price: workItem[otherId], source: 'neighbor', sourceLabel: contractors[otherId] };
    }
  }

  // Ищем в рыночной матрице по ключевым словам
  if (priceMatrix) {
    const marketPrice = findMarketPrice(workItem.name, priceMatrix);
    if (marketPrice != null) {
      return { price: marketPrice, source: 'market', sourceLabel: 'рыночная' };
    }
  }

  return { price: 0, source: 'missing', sourceLabel: 'нет данных' };
}

function findMarketPrice(workName, matrix) {
  const lower = workName.toLowerCase();
  for (const [key, val] of Object.entries(matrix)) {
    if (key.startsWith('_')) continue;
    const keyLower = key.toLowerCase().replace(/_/g, ' ');
    if (lower.includes('гидравлическ') && keyLower.includes('гидроиспытание')) return val.typical;
    if (lower.includes('промывка') && keyLower.includes('промывка')) return val.typical;
    if (lower.includes('теплоизоляция') && lower.includes('полиэтилен') && keyLower.includes('впэ')) return val.typical;
    if (lower.includes('теплоизоляция') && lower.includes('минерало') && keyLower.includes('минвата')) return val.typical;
  }
  return null;
}

export function getPriceStyle(source) {
  switch (source) {
    case 'contractor': return { backgroundColor: '#ffffff' };
    case 'neighbor': return { backgroundColor: '#fef9c3' };
    case 'market': return { backgroundColor: '#fff7ed' };
    case 'manual': return { backgroundColor: '#dcfce7' };
    case 'missing': return { backgroundColor: '#fee2e2' };
    default: return {};
  }
}

export function getPriceLabel(source, sourceLabel) {
  switch (source) {
    case 'neighbor': return `от ${sourceLabel}`;
    case 'market': return 'рыночная';
    case 'manual': return 'ручная';
    case 'missing': return 'нет данных';
    default: return '';
  }
}
