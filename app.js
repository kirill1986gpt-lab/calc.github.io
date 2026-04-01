/**
 * ============================================================
 *  APP.JS — UI-логика калькулятора навеса
 *  Привязка событий, рендер результатов.
 * ============================================================
 */

(function () {
  'use strict';

  /* ── DOM-ссылки ──────────────────────────────────────── */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const els = {
    lengthRange:  $('#length-range'),
    lengthNum:    $('#length-num'),
    widthRange:   $('#width-range'),
    widthNum:     $('#width-num'),
    heightRange:  $('#height-range'),
    heightNum:    $('#height-num'),
    regionSelect: $('#region-select'),

    wallBack:       $('#wall-back'),
    wallBackCheck:  $('#wall-back-check'),
    wallLeft:       $('#wall-left'),
    wallLeftCheck:  $('#wall-left-check'),
    wallRight:      $('#wall-right'),
    wallRightCheck: $('#wall-right-check'),
    wallMaterial:   $('#wall-material'),
    wallWrap:       $('#wall-material-wrap'),

    hasFriz:        $('#has-friz'),
    frizCheck:      $('#friz-check'),
    frizMaterial:   $('#friz-material'),
    frizWrap:       $('#friz-material-wrap'),

    hasCeiling:      $('#has-ceiling'),
    ceilingMaterial: $('#ceiling-material'),
    ceilingWrap:     $('#ceiling-material-wrap'),
    ceilingCheck:    $('#ceiling-check'),

    hasDrain:     $('#has-drain'),
    drainCheck:   $('#drain-check'),

    hasLighting:    $('#has-lighting'),
    lightingCheck:  $('#lighting-check'),

    hasHozblok:         $('#has-hozblok'),
    hozblokCheck:       $('#hozblok-check'),
    hozblokOptions:     $('#hozblok-options'),
    hozblokLengthRange: $('#hozblok-length-range'),
    hozblokLengthNum:   $('#hozblok-length-num'),
    hozblokWidthRange:  $('#hozblok-width-range'),
    hozblokWidthNum:    $('#hozblok-width-num'),
    hozblokMaterial:    $('#hozblok-material'),
    hozblokMaterialWrap:$('#hozblok-material-wrap'),

    totalPrice:   $('#total-price'),
    totalArea:    $('#total-area'),
    smallNotice:  $('#small-order-notice'),

    detailToggle: $('#detail-toggle'),
    detailBreak:  $('#detail-breakdown'),
    detailTbody:  $('#detail-tbody'),

    ctaOrder: $('#cta-order'),
    ctaFix:   $('#cta-fix'),

    modal:         $('#lead-modal'),
    modalClose:    $('#modal-close'),
    modalFormContent: $('#modal-form-content'),
    modalSuccess:  $('#modal-success'),
    leadForm:      $('#lead-form'),
    leadSubmit:    $('#lead-submit'),
    leadName:      $('#lead-name'),
    leadPhone:     $('#lead-phone'),
    leadLocation:  $('#lead-location'),
    leadComment:   $('#lead-comment'),
  };

  /* ── Инициализация: генерация <option> из конфига ─────── */
  function populateSelect(selectEl, materials) {
    selectEl.innerHTML = '';
    materials.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.key;
      opt.textContent = m.name;
      selectEl.appendChild(opt);
    });
  }

  /* ── Утилиты ─────────────────────────────────────────── */
  function formatPrice(n) {
    return n.toLocaleString('ru-RU') + ' ₽';
  }

  function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  /* ── Состояние ───────────────────────────────────────── */
  let lastResult = null;

  /* ── Собрать параметры из UI ─────────────────────────── */
  function gatherParams() {
    return {
      length:         parseFloat(els.lengthNum.value)  || CONFIG.limits.length.default,
      width:          parseFloat(els.widthNum.value)    || CONFIG.limits.width.default,
      height:         parseFloat(els.heightNum.value)   || CONFIG.limits.height.default,
      region:         els.regionSelect.value,
      wallBack:       els.wallBack.checked,
      wallLeft:       els.wallLeft.checked,
      wallRight:      els.wallRight.checked,
      wallMaterial:   els.wallMaterial.value,
      hasFriz:        els.hasFriz.checked,
      frizMaterial:   els.frizMaterial.value,
      hasCeiling:     els.hasCeiling.checked,
      ceilingMat:     els.ceilingMaterial.value,
      hasDrain:       els.hasDrain.checked,
      hasLighting:    els.hasLighting.checked,
      hasHozblok:     els.hasHozblok.checked,
      hozblokLength:  parseFloat(els.hozblokLengthNum.value)  || CONFIG.limits.hozblokLength.default,
      hozblokWidth:   parseFloat(els.hozblokWidthNum.value)   || CONFIG.limits.hozblokWidth.default,
      hozblokMaterial:els.hozblokMaterial.value,
    };
  }

  /* ── Ограничить размеры хозблока размерами навеса ───── */
  function enforceHozblokLimits() {
    const navesLength = parseFloat(els.lengthNum.value) || CONFIG.limits.length.default;
    const navesWidth  = parseFloat(els.widthNum.value)  || CONFIG.limits.width.default;

    // Обновить max для хозблока
    els.hozblokLengthRange.max = navesLength;
    els.hozblokLengthNum.max   = navesLength;
    els.hozblokWidthRange.max  = navesWidth;
    els.hozblokWidthNum.max    = navesWidth;

    // Если текущее значение больше max — зажать
    let hL = parseFloat(els.hozblokLengthNum.value);
    if (hL > navesLength) {
      hL = navesLength;
      els.hozblokLengthNum.value   = hL;
      els.hozblokLengthRange.value = hL;
    }

    let hW = parseFloat(els.hozblokWidthNum.value);
    if (hW > navesWidth) {
      hW = navesWidth;
      els.hozblokWidthNum.value   = hW;
      els.hozblokWidthRange.value = hW;
    }
  }

  /* ── Управление видимостью материала хозблока ───────── */
  function updateHozblokMaterialVisibility() {
    if (els.hasHozblok.checked) {
      els.hozblokMaterialWrap.classList.add('visible');
    } else {
      els.hozblokMaterialWrap.classList.remove('visible');
    }
  }

  /* ── Обновить всё ────────────────────────────────────── */
  function update() {
    enforceHozblokLimits();
    updateHozblokMaterialVisibility();

    const params = gatherParams();
    const res = calculate(params, CONFIG);
    lastResult = { params, res };

    // Итоговая цена
    els.totalPrice.textContent = formatPrice(res.total);
    els.totalPrice.classList.remove('bump');
    void els.totalPrice.offsetWidth; // reflow
    els.totalPrice.classList.add('bump');

    // Площадь
    els.totalArea.textContent = `Площадь: ${res.area.toFixed(1)} м²`;

    // Уведомление о малом заказе
    els.smallNotice.classList.toggle('visible', res.smallOrderApplied);

    // Детализация
    renderDetails(res);
  }

  /* ── Рендер таблицы детализации ──────────────────────── */
  function renderDetails(res) {
    const rows = [
      ['Каркас' + (res.heightApplied ? ' (с коэф. высоты)' : ''), res.frameCost],
      ['Кровля (профнастил)', res.roofCost],
      [`Зашивка стен${res.wallCount > 0 ? ' (' + res.wallNames.join(', ') + ')' : ''} — ${res.wallMaterialName}`, res.wallCost],
      ['Фриз — ' + res.frizMaterialName, res.frizCost],
      ['Зашивка потолка — ' + res.ceilingMaterialName, res.ceilingCost],
      ['Водосток', res.drainCost],
      ['Освещение', res.lightingCost],
      ['Хозблок — ' + res.hozblokMaterialName, res.hozblokCost],
    ];

    if (res.smallOrderApplied) {
      rows.push(['Транспортные расходы', res.smallOrderSurcharge]);
    }

    let html = '';
    rows.forEach(([label, cost]) => {
      const cls = cost === 0 ? ' class="zero"' : '';
      html += `<tr><td${cls}>${label}</td><td${cls}>${formatPrice(Math.round(cost))}</td></tr>`;
    });
    html += `<tr class="total-row"><td>Итого</td><td>${formatPrice(res.total)}</td></tr>`;
    els.detailTbody.innerHTML = html;
  }



  /* ── Привязка слайдер ↔ поле ─────────────────────────── */
  function bindRangeNum(range, num, limitsKey) {
    const lim = CONFIG.limits[limitsKey];

    range.addEventListener('input', () => {
      num.value = range.value;
      update();
    });

    num.addEventListener('input', () => {
      let v = parseFloat(num.value);
      if (isNaN(v) || v < lim.min) v = lim.min;
      const currentMax = parseFloat(range.max) || lim.max;
      if (v > currentMax) v = currentMax;
      range.value = v;
      update();
    });

    num.addEventListener('blur', () => {
      let v = parseFloat(num.value);
      if (isNaN(v) || v < lim.min) {
        v = lim.min;
      }
      const currentMax = parseFloat(range.max) || lim.max;
      v = clamp(v, lim.min, currentMax);
      // Snap to step
      v = Math.round(v / lim.step) * lim.step;
      v = parseFloat(v.toFixed(2));
      num.value = v;
      range.value = v;
      update();
    });
  }

  /* ── Чекбокс-обёртка ─────────────────────────────────── */
  function bindCheckRow(checkRowEl, inputEl, wrapEl) {
    // Установить начальное состояние
    if (inputEl.checked) checkRowEl.classList.add('active');

    checkRowEl.addEventListener('click', (e) => {
      e.preventDefault();
      inputEl.checked = !inputEl.checked;
      checkRowEl.classList.toggle('active', inputEl.checked);
      if (wrapEl) wrapEl.classList.toggle('visible', inputEl.checked);

      update();
    });
  }

  /* ── Выбор сторон зашивки ────────────────────────────── */
  function initWallChecks() {
    const wallPairs = [
      [els.wallBackCheck,  els.wallBack],
      [els.wallLeftCheck,  els.wallLeft],
      [els.wallRightCheck, els.wallRight],
    ];
    wallPairs.forEach(([rowEl, inputEl]) => {
      rowEl.addEventListener('click', (e) => {
        e.preventDefault();
        inputEl.checked = !inputEl.checked;
        rowEl.classList.toggle('active', inputEl.checked);
        // Показать / скрыть выбор материала
        const anyWall = els.wallBack.checked || els.wallLeft.checked || els.wallRight.checked;
        els.wallWrap.classList.toggle('visible', anyWall);

        update();
      });
    });
  }

  /* ── Навес с хозблоком ──────────────────────────────── */
  function initHozblok() {
    els.hozblokCheck.addEventListener('click', (e) => {
      e.preventDefault();
      els.hasHozblok.checked = !els.hasHozblok.checked;
      els.hozblokCheck.classList.toggle('active', els.hasHozblok.checked);
      els.hozblokOptions.classList.toggle('visible', els.hasHozblok.checked);

      update();
    });
  }

  /* ── Модальное окно ──────────────────────────────────── */
  function openModal() {
    els.modal.classList.add('open');
    els.modalFormContent.style.display = '';
    els.modalSuccess.classList.remove('visible');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    els.modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  /* ── Маска для телефона ──────────────────────────────── */
  function initPhoneMask(inputEl) {
    inputEl.addEventListener('input', function (e) {
      if (e.target.value.length === 1 && e.target.value === '8') {
        e.target.value = '7';
      }
      let x = e.target.value.replace(/\D/g, '').match(/(\d{0,1})(\d{0,3})(\d{0,3})(\d{0,2})(\d{0,2})/);
      if (!x) return;
      if (!x[1]) {
        e.target.value = '';
        return;
      }
      if (x[1] !== '7') {
        x[1] = '7';
      }
      
      let formatted = '+7';
      if (x[2]) formatted += ' (' + x[2];
      if (x[3]) formatted += ') ' + x[3];
      if (x[4]) formatted += '-' + x[4];
      if (x[5]) formatted += '-' + x[5];
      
      e.target.value = formatted;
    });
    
    inputEl.addEventListener('keydown', function(e) {
      if (e.key === 'Backspace' && e.target.value.length <= 4) {
        e.target.value = '';
      }
    });
  }

  async function submitLead(e) {
    if (e) e.preventDefault();

    // Защита от спам-ботов (honeypot)
    if (els.leadForm) {
      const honey = els.leadForm.querySelector('[name="_honey"]').value;
      if (honey) {
        console.warn('Spam bot detected');
        return;
      }
    }

    const name     = els.leadName.value.trim();
    const phone    = els.leadPhone.value.trim();
    const location = els.leadLocation.value.trim();
    const comment  = els.leadComment.value.trim();

    // Проверка корректности телефона (должно быть 18 символов: +7 (XXX) XXX-XX-XX)
    if (!name || phone.length < 18 || !location) {
      alert('Пожалуйста, корректно заполните имя, номер телефона и локацию.');
      return;
    }

    const params = lastResult?.params || {};
    const res = lastResult?.res || {};
    const totalPrice = res.total || 0;
    
    // Формируем текстовую детализацию
    const detailsRows = [];
    if (res.frameCost !== undefined) {
      detailsRows.push(`Каркас${res.heightApplied ? ' (с коэф. высоты)' : ''}: ${formatPrice(Math.round(res.frameCost))}`);
      detailsRows.push(`Кровля (профнастил): ${formatPrice(Math.round(res.roofCost))}`);
      if (res.wallCount > 0) detailsRows.push(`Зашивка стен (${res.wallNames.join(', ')}) — ${res.wallMaterialName}: ${formatPrice(Math.round(res.wallCost))}`);
      else detailsRows.push(`Зашивка стен: ${formatPrice(Math.round(res.wallCost))}`);
      detailsRows.push(`Фриз — ${res.frizMaterialName}: ${formatPrice(Math.round(res.frizCost))}`);
      detailsRows.push(`Зашивка потолка — ${res.ceilingMaterialName}: ${formatPrice(Math.round(res.ceilingCost))}`);
      detailsRows.push(`Водосток: ${formatPrice(Math.round(res.drainCost))}`);
      detailsRows.push(`Освещение: ${formatPrice(Math.round(res.lightingCost))}`);
      detailsRows.push(`Хозблок — ${res.hozblokMaterialName}: ${formatPrice(Math.round(res.hozblokCost))}`);
      if (res.smallOrderApplied) detailsRows.push(`Транспортные расходы: ${formatPrice(res.smallOrderSurcharge)}`);
    }
    const detailsString = detailsRows.length > 0 ? detailsRows.join('\n') : 'Нет данных расчета';

    // Текст сообщения для Telegram
    const tgMessage = `
🔥 *Новая заявка (Калькулятор навеса)*
👤 Имя: ${name}
📞 Телефон: ${phone}
📍 Локация: ${location}
💬 Комментарий: ${comment || 'Нет'}

📏 *Размеры:* ${params.length || 0}x${params.width || 0}x${params.height || 0}м
💰 *Итоговая стоимость:* ${formatPrice(totalPrice)}

📋 *Детализация:*
${detailsString}
    `.trim();

    // Отправка в Telegram
    const tgSubmit = fetch('https://api.telegram.org/bot7057481204:AAFaYJipL7yeh1OcS0nW6s92tsqMe6oCFBA/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: '734659908',
        text: tgMessage,
        parse_mode: 'Markdown'
      })
    });

    // Отправка на почту wladimirterzi@yandex.ru через FormSubmit API
    const emailSubmit = fetch('https://formsubmit.co/ajax/wladimirterzi@yandex.ru', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        name: name,
        phone: phone,
        location: location,
        comment: comment,
        _subject: 'Новая заявка на навес с калькулятора',
        _captcha: 'false',
        'Итог расчета': formatPrice(totalPrice),
        'Размеры': `${params.length || 0}x${params.width || 0}x${params.height || 0}м`,
        'Детализация': detailsString
      })
    });

    try {
      const originalSubmitText = els.leadSubmit.textContent;
      els.leadSubmit.textContent = 'Отправка...';
      els.leadSubmit.disabled = true;

      await Promise.all([tgSubmit, emailSubmit]);

      els.leadSubmit.textContent = originalSubmitText;
      els.leadSubmit.disabled = false;

      // Показать успех
      els.modalFormContent.style.display = 'none';
      els.modalSuccess.classList.add('visible');
  
      setTimeout(() => {
        closeModal();
        if (els.leadForm) els.leadForm.reset();
      }, 2500);

    } catch (err) {
      console.error('Ошибка отправки:', err);
      alert('Произошла ошибка при отправке заявки. Попробуйте снова.');
      els.leadSubmit.textContent = 'Отправить заявку';
      els.leadSubmit.disabled = false;
    }
  }

  /* ── Детализация toggle ──────────────────────────────── */
  function initDetailToggle() {
    els.detailToggle.addEventListener('click', () => {
      const isOpen = els.detailBreak.classList.toggle('open');
      els.detailToggle.classList.toggle('open', isOpen);
      els.detailToggle.childNodes[0].textContent = isOpen ? 'Скрыть детализацию ' : 'Показать детализацию ';
    });
  }

  /* ═══════════════════════════════════════════════════════
   *  INIT
   * ═══════════════════════════════════════════════════════ */
  function init() {
    // Заполнить <select> из конфига
    populateSelect(els.wallMaterial,     CONFIG.wallMaterials);
    populateSelect(els.frizMaterial,     CONFIG.wallMaterials);
    populateSelect(els.ceilingMaterial,  CONFIG.ceilingMaterials);
    populateSelect(els.hozblokMaterial,  CONFIG.wallMaterials);

    // Привязать слайдеры навеса
    bindRangeNum(els.lengthRange, els.lengthNum, 'length');
    bindRangeNum(els.widthRange,  els.widthNum,  'width');
    bindRangeNum(els.heightRange, els.heightNum,  'height');

    // Привязать слайдеры хозблока
    bindRangeNum(els.hozblokLengthRange, els.hozblokLengthNum, 'hozblokLength');
    bindRangeNum(els.hozblokWidthRange,  els.hozblokWidthNum,  'hozblokWidth');

    // Привязать чекбоксы
    bindCheckRow(els.frizCheck,     els.hasFriz,     els.frizWrap);
    bindCheckRow(els.ceilingCheck,  els.hasCeiling,  els.ceilingWrap);
    bindCheckRow(els.drainCheck,    els.hasDrain,    null);
    bindCheckRow(els.lightingCheck, els.hasLighting,  null);

    // Стороны зашивки
    initWallChecks();

    // Хозблок
    initHozblok();

    // Выбор материала → пересчёт
    els.regionSelect.addEventListener('change', update);
    els.wallMaterial.addEventListener('change', update);
    els.frizMaterial.addEventListener('change', update);
    els.ceilingMaterial.addEventListener('change', update);
    els.hozblokMaterial.addEventListener('change', update);

    // Детализация
    initDetailToggle();

    // Маска телефона
    if (els.leadPhone) initPhoneMask(els.leadPhone);

    // CTA
    els.ctaOrder.addEventListener('click', openModal);
    els.ctaFix.addEventListener('click', openModal);
    els.modalClose.addEventListener('click', closeModal);
    els.modal.addEventListener('click', (e) => { if (e.target === els.modal) closeModal(); });
    if (els.leadForm) els.leadForm.addEventListener('submit', submitLead);

    // Первичный расчёт
    update();
  }

  // Запуск
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
