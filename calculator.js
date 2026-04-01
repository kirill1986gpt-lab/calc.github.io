/**
 * ============================================================
 *  МОДУЛЬ РАСЧЁТА — чистая логика, без зависимости от DOM.
 *  Функция calculate(params, cfg) → объект с детализацией.
 * ============================================================
 */

/**
 * Рассчитывает стоимость навеса.
 *
 * @param {Object} params — параметры выбранные пользователем
 *   length          {number}  — длина навеса, м
 *   width           {number}  — ширина навеса, м
 *   height          {number}  — высота навеса, м
 *   wallBack        {boolean} — зашивка задней стены (ширина)
 *   wallLeft        {boolean} — зашивка левой боковой стены (длина)
 *   wallRight       {boolean} — зашивка правой боковой стены (длина)
 *   wallMaterial    {string}  — key материала стен
 *   hasFriz         {boolean} — нужен ли фриз
 *   frizMaterial    {string}  — key материала фриза
 *   hasCeiling      {boolean} — нужна ли зашивка потолка
 *   ceilingMat      {string}  — key материала потолка
 *   hasDrain        {boolean} — нужен ли водосток
 *   hasLighting     {boolean} — нужно ли освещение
 *   hasHozblok      {boolean} — навес с хозблоком
 *   hozblokLength   {number}  — длина хозблока, м
 *   hozblokWidth    {number}  — ширина хозблока, м
 *   hozblokMaterial {string}  — key материала хозблока (когда стены не выбраны)
 *
 * @param {Object} cfg — объект CONFIG
 * @returns {Object} — детализация расчёта
 */
function calculate(params, cfg) {
  const { length, width, height } = params;

  // 1. Площадь навеса
  const area = length * width;

  // Определение базовой цены за "каркас+кровля" в зависимости от площади
  let currentFramePricePerM2 = cfg.framePricePerM2;
  if (cfg.progressivePrices) {
    const tier = cfg.progressivePrices.find(t => area >= t.minArea);
    if (tier) {
      // Цена каркаса = общая цена по тарифу минус фиксированная цена кровли
      currentFramePricePerM2 = tier.priceTotal - cfg.roofPricePerM2;
    }
  }

  // 2. Базовый каркас
  let frameCost = area * currentFramePricePerM2;
  const heightApplied = height > cfg.heightThreshold;
  if (heightApplied) {
    frameCost *= cfg.heightCoefficient;
  }

  // 3. Кровля — всегда включена
  const roofCost = area * cfg.roofPricePerM2;

  // 4. Зашивка стен
  let wallPerimeter = 0;
  if (params.wallBack)  wallPerimeter += width;
  if (params.wallLeft)  wallPerimeter += length;
  if (params.wallRight) wallPerimeter += length;

  const wallCount = (params.wallBack ? 1 : 0) + (params.wallLeft ? 1 : 0) + (params.wallRight ? 1 : 0);
  const wallArea = wallPerimeter * height;
  let wallCost = 0;
  let wallMaterialName = '—';
  let wallMatObj = null;
  if (wallCount > 0 && params.wallMaterial) {
    wallMatObj = cfg.wallMaterials.find(m => m.key === params.wallMaterial);
    if (wallMatObj) {
      wallCost = wallArea * wallMatObj.pricePerM2;
      wallMaterialName = wallMatObj.name;
    }
  }

  // Названия выбранных стен для детализации
  const wallNames = [];
  if (params.wallBack)  wallNames.push('задняя');
  if (params.wallLeft)  wallNames.push('левая');
  if (params.wallRight) wallNames.push('правая');

  // 5. Фриз — периметр навеса × цена за пог.м
  let frizCost = 0;
  let frizMaterialName = '—';
  if (params.hasFriz && params.frizMaterial) {
    const mat = cfg.wallMaterials.find(m => m.key === params.frizMaterial);
    if (mat) {
      const perimeter = 2 * (length + width);
      frizCost = perimeter * mat.pricePerLinearM;
      frizMaterialName = mat.name;
    }
  }

  // 6. Зашивка потолка
  let ceilingCost = 0;
  let ceilingMaterialName = '—';
  if (params.hasCeiling && params.ceilingMat) {
    const mat = cfg.ceilingMaterials.find(m => m.key === params.ceilingMat);
    if (mat) {
      ceilingCost = area * mat.pricePerM2;
      ceilingMaterialName = mat.name;
    }
  }

  // 7. Водосток = длина навеса × цена за пог.м
  const drainCost = params.hasDrain ? length * cfg.drainPricePerM : 0;

  // 8. Освещение
  let lightingCost = 0;
  if (params.hasLighting) {
    const lc = cfg.lighting;
    const stepsAboveBase = Math.max(0, Math.floor((area - lc.areaStep) / lc.areaStep));
    const lightCoeff = Math.min(1 + stepsAboveBase * lc.stepCoeff, lc.maxCoeff);
    lightingCost = lc.basePrice * lightCoeff;
  }

  // 9. Хозблок
  let hozblokCost = 0;
  let hozblokMaterialName = '—';
  let hozblokDetails = null;
  if (params.hasHozblok) {
    const hL = Math.min(params.hozblokLength, length);
    const hW = Math.min(params.hozblokWidth, width);
    const hH = height;

    // Площадь стен хозблока: периметр × высота
    const hozblokWallArea = 2 * (hL + hW) * hH;

    let materialCost = 0;

    if (params.hozblokMaterial) {
      const mat = cfg.wallMaterials.find(m => m.key === params.hozblokMaterial);
      if (mat) {
        materialCost = hozblokWallArea * mat.pricePerM2;
        hozblokMaterialName = mat.name;
      }
    }

    // Фиксированные расходы + коэффициент трудоёмкости
    const hCfg = cfg.hozblok;
    const fixedCosts = hCfg.doorPrice + hCfg.lightingPrice;
    hozblokCost = (materialCost + fixedCosts) * hCfg.laborCoefficient;

    hozblokDetails = {
      hozblokLength: hL,
      hozblokWidth: hW,
      hozblokHeight: hH,
      hozblokWallArea,
      materialCost,
      fixedCosts,
      laborCoefficient: hCfg.laborCoefficient,
    };
  }

  // 10. Промежуточная сумма
  const subtotal = frameCost + roofCost + wallCost + frizCost + ceilingCost + drainCost + lightingCost + hozblokCost;

  // 11. Коэффициент малого заказа
  const smallOrderApplied = area < cfg.minOrderArea;
  const afterSmallOrder = smallOrderApplied ? subtotal * cfg.smallOrderCoeff : subtotal;

  // 11.5 Скидка за регион
  const regionMultiplier = params.region === 'voronezh' ? 0.8 : 1;
  const afterRegion = afterSmallOrder * regionMultiplier;

  // 12. Финальное округление до шага вверх
  const step = cfg.roundingStep;
  const total = Math.ceil(afterRegion / step) * step;

  return {
    area,
    frameCost,
    heightApplied,
    roofCost,
    wallCount,
    wallNames,
    wallArea,
    wallCost,
    wallMaterialName,
    frizCost,
    frizMaterialName,
    ceilingCost,
    ceilingMaterialName,
    drainCost,
    lightingCost,
    hozblokCost,
    hozblokMaterialName,
    hozblokDetails,
    subtotal,
    smallOrderApplied,
    smallOrderSurcharge: smallOrderApplied ? afterSmallOrder - subtotal : 0,
    total,
  };
}
