(function () {
  'use strict';

  // === CONSTANTS ===
  const HOST_ID = 'pinyin-to-chinese-host';
  const API_URL = 'https://inputtools.google.com/request';
  const MAX_INPUT_LENGTH = 200;

  const DEFAULTS = {
    variant: 'traditional',
    numCandidates: 5,
    autoCopy: false
  };

  const ITC_MAP = {
    traditional: 'zh-hant-t-i0-pinyin',
    simplified: 'zh-t-i0-pinyin'
  };

  // === SETTINGS ===
  let settings = { ...DEFAULTS };

  chrome.storage.sync.get(DEFAULTS, (data) => {
    settings = data;
  });

  chrome.storage.onChanged.addListener((changes) => {
    for (const [key, { newValue }] of Object.entries(changes)) {
      if (key in settings) {
        settings[key] = newValue;
      }
    }
  });

  // === SHADOW DOM SETUP ===
  const host = document.createElement('div');
  host.id = HOST_ID;
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    #pinyin-icon {
      position: fixed;
      display: none;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #4285f4;
      color: white;
      font-size: 14px;
      font-weight: bold;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      pointer-events: auto;
      transition: transform 0.1s ease;
      font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
      user-select: none;
      line-height: 28px;
      text-align: center;
    }
    #pinyin-icon:hover {
      transform: scale(1.1);
      background: #3367d6;
    }

    #pinyin-popup {
      position: fixed;
      display: none;
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      padding: 12px 16px;
      min-width: 120px;
      max-width: 360px;
      pointer-events: auto;
      font-family: 'Microsoft YaHei', 'PingFang SC', -apple-system, sans-serif;
    }

    .pinyin-source {
      font-size: 12px;
      color: #999;
      margin-bottom: 6px;
    }

    .pinyin-result-primary {
      font-size: 22px;
      color: #333;
      margin-bottom: 8px;
      line-height: 1.4;
      word-break: break-all;
    }

    .pinyin-result-alternatives {
      font-size: 13px;
      color: #666;
      margin-bottom: 10px;
      line-height: 1.6;
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .pinyin-alt-item {
      display: inline-block;
      padding: 2px 8px;
      background: #f5f5f5;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .pinyin-alt-item:hover {
      background: #e0e0e0;
    }

    .pinyin-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .pinyin-copy-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 12px;
      font-size: 12px;
      color: #4285f4;
      background: none;
      border: 1px solid #4285f4;
      border-radius: 4px;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.15s;
    }
    .pinyin-copy-btn:hover {
      background: #4285f4;
      color: white;
    }
    .pinyin-copy-btn.copied {
      border-color: #34a853;
      color: #34a853;
    }
    .pinyin-copy-btn.copied:hover {
      background: #34a853;
      color: white;
    }

    .pinyin-loading {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #999;
      font-size: 14px;
    }
    .pinyin-loading-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid #e0e0e0;
      border-top-color: #4285f4;
      border-radius: 50%;
      animation: pinyin-spin 0.6s linear infinite;
    }
    @keyframes pinyin-spin {
      to { transform: rotate(360deg); }
    }

    .pinyin-error {
      color: #d93025;
      font-size: 13px;
    }
  `;
  shadow.appendChild(style);

  // Create icon element
  const iconEl = document.createElement('div');
  iconEl.id = 'pinyin-icon';
  iconEl.textContent = '拼';
  iconEl.title = 'Convert Pinyin to Chinese';
  shadow.appendChild(iconEl);

  // Create popup element
  const popupEl = document.createElement('div');
  popupEl.id = 'pinyin-popup';
  shadow.appendChild(popupEl);

  // === STATE ===
  let currentPinyin = '';
  let abortController = null;

  // === PINYIN UTILITIES ===

  const DIACRITIC_MAP = {
    'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a',
    'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e',
    'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i',
    'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o',
    'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u',
    'ǖ': 'v', 'ǘ': 'v', 'ǚ': 'v', 'ǜ': 'v', 'ü': 'v'
  };

  function looksLikePinyin(text) {
    if (text.length < 1 || text.length > MAX_INPUT_LENGTH) return false;

    // Replace diacritics for checking
    let check = text.toLowerCase();
    for (const [diac, base] of Object.entries(DIACRITIC_MAP)) {
      check = check.replaceAll(diac, base);
    }

    const nonSpace = check.replace(/\s/g, '');
    if (nonSpace.length === 0) return false;

    // At least 60% should be Latin letters or tone numbers
    const letterCount = (nonSpace.match(/[a-z]/g) || []).length;
    if (letterCount / nonSpace.length < 0.6) return false;

    // Must contain at least one vowel (pinyin always has vowels)
    if (!/[aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/i.test(text)) return false;

    // Should not be just a single common English word
    // (skip this check for short text - let user decide by clicking)

    return true;
  }

  function preprocessPinyin(text) {
    let result = text.toLowerCase();

    // Replace diacritical marks with plain ASCII
    for (const [diac, base] of Object.entries(DIACRITIC_MAP)) {
      result = result.replaceAll(diac, base);
    }

    // Strip tone numbers (1-5 after a letter)
    result = result.replace(/([a-z])[1-5]/g, '$1');

    // Normalize whitespace
    result = result.replace(/\s+/g, ' ').trim();

    return result;
  }

  // === API ===

  async function convertPinyin(text, signal) {
    const url = new URL(API_URL);
    url.searchParams.set('text', text);
    url.searchParams.set('itc', ITC_MAP[settings.variant] || ITC_MAP.traditional);
    url.searchParams.set('num', String(settings.numCandidates));

    const response = await fetch(url.toString(), { signal });
    const data = await response.json();

    // Response format: ["SUCCESS",[["nihao",["你好","拟好",...],[],{...}]]]
    if (data[0] !== 'SUCCESS' || !data[1] || !data[1][0]) {
      return [];
    }

    return data[1][0][1]; // Array of candidate strings
  }

  // === UI FUNCTIONS ===

  function showIcon(rect, text) {
    currentPinyin = text;

    // Position to the right and slightly below the selection
    let left = rect.right + 4;
    let top = rect.bottom + 4;

    // If it would go off the right edge, place it to the left of selection
    if (left + 32 > window.innerWidth) {
      left = rect.left - 32;
    }

    // If it would go off the bottom, place it above
    if (top + 32 > window.innerHeight) {
      top = rect.top - 32;
    }

    iconEl.style.left = `${left}px`;
    iconEl.style.top = `${top}px`;
    iconEl.style.display = 'flex';
  }

  function hideIcon() {
    iconEl.style.display = 'none';
  }

  function hidePopup() {
    popupEl.style.display = 'none';
    popupEl.innerHTML = '';
  }

  function hideAll() {
    hideIcon();
    hidePopup();
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  }

  function showLoading() {
    popupEl.innerHTML = `
      <div class="pinyin-loading">
        <div class="pinyin-loading-spinner"></div>
        <span>Converting...</span>
      </div>
    `;
    popupEl.style.display = 'block';
    positionPopup();
  }

  function showError(message) {
    popupEl.innerHTML = `<div class="pinyin-error">${message}</div>`;
    popupEl.style.display = 'block';
    positionPopup();
  }

  function showResults(candidates, sourceText) {
    if (!candidates || candidates.length === 0) {
      showError('No results found');
      return;
    }

    const primary = candidates[0];
    const alternatives = candidates.slice(1);

    let html = `<div class="pinyin-source">${escapeHtml(sourceText)}</div>`;
    html += `<div class="pinyin-result-primary">${escapeHtml(primary)}</div>`;

    if (alternatives.length > 0) {
      html += '<div class="pinyin-result-alternatives">';
      for (const alt of alternatives) {
        html += `<span class="pinyin-alt-item" data-text="${escapeHtml(alt)}">${escapeHtml(alt)}</span>`;
      }
      html += '</div>';
    }

    html += `
      <div class="pinyin-actions">
        <button class="pinyin-copy-btn" data-text="${escapeHtml(primary)}">Copy</button>
      </div>
    `;

    popupEl.innerHTML = html;
    popupEl.style.display = 'block';
    positionPopup();

    // Bind events for alternatives
    popupEl.querySelectorAll('.pinyin-alt-item').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = el.dataset.text;
        popupEl.querySelector('.pinyin-result-primary').textContent = text;
        popupEl.querySelector('.pinyin-copy-btn').dataset.text = text;
      });
    });

    // Bind copy button
    const copyBtn = popupEl.querySelector('.pinyin-copy-btn');
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyToClipboard(copyBtn.dataset.text, copyBtn);
    });

    // Auto-copy if enabled
    if (settings.autoCopy) {
      copyToClipboard(primary, copyBtn);
    }
  }

  function positionPopup() {
    const iconRect = iconEl.getBoundingClientRect();

    // First show it off-screen to measure
    popupEl.style.left = '-9999px';
    popupEl.style.top = '-9999px';

    const popupRect = popupEl.getBoundingClientRect();
    let top = iconRect.bottom + 6;
    let left = iconRect.left;

    // Flip upward if it goes off the bottom
    if (top + popupRect.height > window.innerHeight - 8) {
      top = iconRect.top - popupRect.height - 6;
    }

    // Prevent going off the right edge
    if (left + popupRect.width > window.innerWidth - 8) {
      left = window.innerWidth - popupRect.width - 8;
    }

    // Prevent going off the left edge
    if (left < 8) left = 8;

    popupEl.style.left = `${left}px`;
    popupEl.style.top = `${top}px`;
  }

  // === HELPERS ===

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async function copyToClipboard(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = 'Copy';
      btn.classList.remove('copied');
    }, 1500);
  }

  // === EVENT LISTENERS ===

  // Text selection detection
  document.addEventListener('mouseup', (e) => {
    // Ignore if clicking on our own elements
    if (e.target === host) return;

    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;

      const text = selection.toString().trim();
      if (!text || !looksLikePinyin(text)) return;

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      hidePopup();
      showIcon(rect, text);
    }, 10);
  });

  // Dismiss on click outside
  document.addEventListener('mousedown', (e) => {
    if (e.target === host) return;

    // Check if click is inside our shadow DOM via composedPath
    const path = e.composedPath();
    if (path.includes(iconEl) || path.includes(popupEl)) return;

    hideAll();
  });

  // Dismiss on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideAll();
    }
  });

  // Dismiss on scroll
  let scrollTimeout;
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      hideAll();
    }, 100);
  }, true);

  // Icon click -> convert
  iconEl.addEventListener('click', async (e) => {
    e.stopPropagation();
    e.preventDefault();

    const pinyinText = currentPinyin;
    const processed = preprocessPinyin(pinyinText);

    if (!processed) {
      showError('Invalid pinyin input');
      return;
    }

    // Cancel any in-flight request
    if (abortController) {
      abortController.abort();
    }
    abortController = new AbortController();

    showLoading();

    try {
      const candidates = await convertPinyin(processed, abortController.signal);
      showResults(candidates, pinyinText);
    } catch (err) {
      if (err.name !== 'AbortError') {
        showError('Conversion failed. Check your network connection.');
      }
    }
  });
})();
