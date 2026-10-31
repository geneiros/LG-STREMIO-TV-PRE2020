/*
 * Wrapper webOS para o Stremio Web.
 *
 * IMPORTANTE: este ficheiro tem de ser ES5 puro (sem let/const, arrow functions,
 * template strings, Promise, fetch...). As TVs LG anteriores a 2020 usam motores
 * antigos: webOS 1.x/2.x (WebKit/Chromium 34), webOS 3.x (Chromium 38) e
 * webOS 4.x (Chromium 53).
 */
(function () {
  'use strict';

  var PRESETS = [
    {
      id: 'v5',
      name: 'Stremio Web (atual)',
      url: 'https://web.stremio.com/',
      note: 'Precisa de WebAssembly (webOS 5+/Chromium 57+).',
      needsWasm: true
    },
    {
      id: 'v4',
      name: 'Stremio Web v4 (legado)',
      url: 'https://app.strem.io/shell-v4.4/',
      note: 'Interface antiga, mais leve. Pode funcionar em TVs antigas.',
      needsWasm: false
    }
  ];

  var DELAYS = [0, 3, 5, 10, -1]; // -1 = nunca abrir automaticamente
  var STORAGE_KEY = 'stremio-wrapper-config';

  var KEY = {
    LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40,
    ENTER: 13, BACK: 461, ESC: 27, BACKSPACE: 8,
    RED: 403, GREEN: 404, YELLOW: 405, BLUE: 406
  };

  var config = loadConfig();
  var countdownTimer = null;
  var currentScreen = 'splash';
  var focusIndex = 0;

  // ---------- utilitários ----------

  function $(id) { return document.getElementById(id); }

  function loadConfig() {
    var def = { preset: 'v5', customUrl: '', delay: 3 };
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var c = JSON.parse(raw);
        if (c && typeof c === 'object') {
          if (typeof c.preset === 'string') { def.preset = c.preset; }
          if (typeof c.customUrl === 'string') { def.customUrl = c.customUrl; }
          if (typeof c.delay === 'number') { def.delay = c.delay; }
        }
      }
    } catch (e) { /* sem localStorage: usa valores por omissão */ }
    return def;
  }

  function saveConfig() {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch (e) {}
  }

  function findPreset(id) {
    for (var i = 0; i < PRESETS.length; i++) {
      if (PRESETS[i].id === id) { return PRESETS[i]; }
    }
    return null;
  }

  function isValidUrl(u) {
    return /^https?:\/\/[^\s]+$/i.test(u);
  }

  function targetUrl() {
    if (config.preset === 'custom' && isValidUrl(config.customUrl)) {
      return config.customUrl;
    }
    var p = findPreset(config.preset) || PRESETS[0];
    return p.url;
  }

  function targetNeedsWasm() {
    if (config.preset === 'custom') { return false; }
    var p = findPreset(config.preset) || PRESETS[0];
    return p.needsWasm;
  }

  function hasClass(el, c) { return (' ' + el.className + ' ').indexOf(' ' + c + ' ') > -1; }
  function addClass(el, c) { if (!hasClass(el, c)) { el.className = (el.className + ' ' + c).replace(/^\s+/, ''); } }
  function removeClass(el, c) {
    el.className = (' ' + el.className + ' ').replace(' ' + c + ' ', ' ').replace(/^\s+|\s+$/g, '');
  }

  // ---------- deteção de capacidades ----------

  function detect() {
    var ua = navigator.userAgent || '';
    var chrome = ua.match(/Chrome\/(\d+)/);
    var webos = ua.match(/Web0S|webOS/i) ? 'sim' : 'não';
    return {
      ua: ua,
      chrome: chrome ? parseInt(chrome[1], 10) : 0,
      webos: webos,
      wasm: typeof window.WebAssembly === 'object' &&
            typeof window.WebAssembly.instantiate === 'function',
      promise: typeof window.Promise === 'function',
      fetch: typeof window.fetch === 'function',
      online: navigator.onLine !== false
    };
  }

  // ---------- navegação ----------

  function launch() {
    stopCountdown();
    var url = targetUrl();
    $('status').innerHTML = 'A abrir ' + escapeHtml(url) + '…';
    // replace(): a página do wrapper sai do histórico; assim o botão Back no
    // Stremio navega dentro do Stremio e, no início, fecha a app (em vez de
    // voltar a este ecrã e reabrir em ciclo).
    window.location.replace(url);
  }

  function exitApp() {
    stopCountdown();
    try {
      if (window.webOS && typeof window.webOS.platformBack === 'function') {
        window.webOS.platformBack();
        return;
      }
    } catch (e) {}
    window.close();
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ---------- ecrã de arranque ----------

  function stopCountdown() {
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
  }

  function startCountdown(seconds) {
    stopCountdown();
    if (seconds < 0) {
      $('status').innerHTML = 'Prima OK para abrir.';
      return;
    }
    if (seconds === 0) { launch(); return; }
    var left = seconds;
    $('status').innerHTML = 'A abrir em ' + left + ' s…';
    countdownTimer = setInterval(function () {
      left--;
      if (left <= 0) { launch(); return; }
      $('status').innerHTML = 'A abrir em ' + left + ' s…';
    }, 1000);
  }

  function showSplash() {
    var info = detect();
    var url = targetUrl();
    $('target').innerHTML = escapeHtml(url);
    $('diag').innerHTML = escapeHtml(
      'Chromium ' + (info.chrome || '?') +
      ' · WebAssembly: ' + (info.wasm ? 'sim' : 'não') +
      ' · Promise: ' + (info.promise ? 'sim' : 'não') +
      ' · fetch: ' + (info.fetch ? 'sim' : 'não') +
      ' · ' + info.ua
    );

    var warn = $('warning');
    var problems = [];
    if (!info.online) {
      problems.push('A TV parece estar sem ligação à Internet.');
    }
    if (targetNeedsWasm() && !info.wasm) {
      problems.push('O motor web desta TV não suporta WebAssembly, que o Stremio Web atual ' +
        'precisa para funcionar. É provável que fique em ecrã preto. Experimente a ' +
        'interface legada (v4) nas Definições.');
    }

    switchScreen('splash');
    if (problems.length) {
      warn.innerHTML = escapeHtml(problems.join(' '));
      removeClass(warn, 'hidden');
      $('status').innerHTML = 'Escolha uma opção.';
      stopCountdown();
    } else {
      addClass(warn, 'hidden');
      startCountdown(config.delay);
    }
  }

  // ---------- definições ----------

  function renderSettings() {
    var list = $('presets');
    var html = '';
    for (var i = 0; i < PRESETS.length; i++) {
      var p = PRESETS[i];
      html += '<button class="btn focusable' + (config.preset === p.id ? ' selected' : '') +
        '" data-action="preset" data-preset="' + p.id + '">' +
        (config.preset === p.id ? '● ' : '○ ') + escapeHtml(p.name) +
        '<small>' + escapeHtml(p.url + ' — ' + p.note) + '</small></button>';
    }
    html += '<button class="btn focusable' + (config.preset === 'custom' ? ' selected' : '') +
      '" data-action="preset" data-preset="custom">' +
      (config.preset === 'custom' ? '● ' : '○ ') + 'Endereço personalizado' +
      '<small>Usa o endereço escrito abaixo.</small></button>';
    list.innerHTML = html;
    $('custom-url').value = config.customUrl;
    $('delay').innerHTML = config.delay < 0 ? 'Nunca' : (config.delay === 0 ? 'Imediato' : config.delay + ' s');
  }

  function readCustomUrl() {
    config.customUrl = ($('custom-url').value || '').replace(/^\s+|\s+$/g, '');
  }

  function saveSettings() {
    readCustomUrl();
    if (config.preset === 'custom' && !isValidUrl(config.customUrl)) {
      alertStatus('Endereço personalizado inválido (tem de começar por http:// ou https://).');
      return false;
    }
    saveConfig();
    return true;
  }

  function alertStatus(msg) {
    var sub = document.querySelector('#settings .sub');
    sub.innerHTML = escapeHtml(msg);
    sub.style.color = '#ff9aa8';
  }

  // ---------- foco / comando ----------

  function focusables() {
    var screen = $(currentScreen);
    var nodes = screen.querySelectorAll('.focusable');
    var out = [];
    for (var i = 0; i < nodes.length; i++) { out.push(nodes[i]); }
    return out;
  }

  function setFocus(idx) {
    var items = focusables();
    if (!items.length) { return; }
    if (idx < 0) { idx = 0; }
    if (idx >= items.length) { idx = items.length - 1; }
    for (var i = 0; i < items.length; i++) { removeClass(items[i], 'focused'); }
    focusIndex = idx;
    addClass(items[idx], 'focused');
    try { items[idx].focus(); } catch (e) {}
    if (items[idx].scrollIntoView) { try { items[idx].scrollIntoView(false); } catch (e2) {} }
  }

  function switchScreen(name) {
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) { removeClass(screens[i], 'active'); }
    addClass($(name), 'active');
    currentScreen = name;
    if (name === 'settings') {
      stopCountdown();
      renderSettings();
      var sub = document.querySelector('#settings .sub');
      sub.innerHTML = 'Escolha o endereço a abrir no arranque.';
      sub.style.color = '';
    }
    setFocus(0);
  }

  function activate(el) {
    if (!el) { return; }
    var action = el.getAttribute('data-action');
    if (el.tagName === 'INPUT') {
      // Abre o teclado virtual da TV.
      try { el.focus(); el.click(); } catch (e) {}
      return;
    }
    switch (action) {
      case 'open': launch(); break;
      case 'settings': switchScreen('settings'); break;
      case 'exit': exitApp(); break;
      case 'preset':
        readCustomUrl();
        config.preset = el.getAttribute('data-preset');
        var keep = focusIndex;
        renderSettings();
        setFocus(keep);
        break;
      case 'delay':
        var i = 0;
        for (var j = 0; j < DELAYS.length; j++) { if (DELAYS[j] === config.delay) { i = j; } }
        config.delay = DELAYS[(i + 1) % DELAYS.length];
        renderSettings();
        setFocus(focusIndex);
        break;
      case 'save':
        if (saveSettings()) { showSplash(); }
        break;
      case 'save-open':
        if (saveSettings()) { launch(); }
        break;
      case 'back':
        config = loadConfig();
        showSplash();
        break;
    }
  }

  function onKeyDown(e) {
    var code = e.keyCode;
    var items = focusables();
    var active = items[focusIndex];
    var inInput = active && active.tagName === 'INPUT' && document.activeElement === active;

    // Qualquer tecla cancela a contagem decrescente, exceto OK (que abre já).
    if (currentScreen === 'splash' && code !== KEY.ENTER) { stopCountdown(); $('status').innerHTML = 'Prima OK para abrir.'; }

    if (inInput && (code === KEY.LEFT || code === KEY.RIGHT || code === KEY.BACKSPACE)) {
      return; // deixa o campo de texto tratar o cursor
    }

    switch (code) {
      case KEY.UP:
        if (currentScreen === 'splash') { switchScreen('settings'); }
        else { setFocus(focusIndex - 1); }
        break;
      case KEY.DOWN:
        setFocus(focusIndex + 1);
        break;
      case KEY.LEFT:
        setFocus(focusIndex - 1);
        break;
      case KEY.RIGHT:
        setFocus(focusIndex + 1);
        break;
      case KEY.ENTER:
        if (inInput) { readCustomUrl(); setFocus(focusIndex + 1); }
        else { activate(active); }
        break;
      case KEY.RED:
        switchScreen('settings');
        break;
      case KEY.GREEN:
        launch();
        break;
      case KEY.BACK:
      case KEY.ESC:
        if (currentScreen === 'settings') { config = loadConfig(); showSplash(); }
        else { exitApp(); }
        break;
      default:
        return;
    }
    e.preventDefault();
  }

  function onClick(e) {
    // Suporte ao ponteiro do Magic Remote.
    var el = e.target;
    while (el && el !== document.body) {
      if (el.className && hasClass(el, 'focusable')) {
        var items = focusables();
        for (var i = 0; i < items.length; i++) { if (items[i] === el) { setFocus(i); } }
        stopCountdown();
        activate(el);
        return;
      }
      el = el.parentNode;
    }
  }

  function onMouseOver(e) {
    var el = e.target;
    while (el && el !== document.body) {
      if (el.className && hasClass(el, 'focusable')) {
        var items = focusables();
        for (var i = 0; i < items.length; i++) { if (items[i] === el && i !== focusIndex) { setFocus(i); } }
        return;
      }
      el = el.parentNode;
    }
  }

  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('click', onClick, false);
  document.addEventListener('mouseover', onMouseOver, false);

  showSplash();
})();
