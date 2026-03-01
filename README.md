<div align="center">

<img src="src/icons/icon128.png" alt="Pinyin to Chinese" width="80">

# Pinyin to Chinese

**Select pinyin text on any webpage and instantly convert it to Chinese characters.**

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285f4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-34a853?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-f7df1e?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![API](https://img.shields.io/badge/API-Google%20Input%20Tools-4285f4)](https://www.google.com/inputtools/)

</div>

---

## Features

- **Text Selection Conversion** — Select pinyin text (e.g. `ni hao`) on any webpage, a floating icon appears, click to convert
- **Traditional & Simplified** — Toggle between 繁體 and 簡體 output
- **Multiple Candidates** — Shows alternative candidates, click to switch
- **Copy to Clipboard** — One-click copy, or enable auto-copy in settings
- **Pinyin Formats** — Handles `ni hao`, `nǐ hǎo`, and `ni3hao3`
- **Shadow DOM** — Isolated UI, won't conflict with any webpage styles

## Demo

> Select `wo xi huan xue zhong wen` → click **拼** → **我喜歡學中文**

## Installation

1. Clone this repository
   ```bash
   git clone https://gitlab.com/zac15987/pinyin-to-chinese.git
   ```
2. Open Chrome → navigate to `chrome://extensions/`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** → select the `src` folder

## Usage

1. **Select** any pinyin text on a webpage
2. A blue **拼** icon appears near the selection
3. **Click** the icon to convert
4. **Copy** the result or click an alternative candidate

## Settings

Click the extension icon in the toolbar to open settings:

| Setting | Default | Options |
|---------|---------|---------|
| **Output** | 繁體 (Traditional) | 繁體 / 簡體 |
| **Candidates** | 4 | 1 – 9 |
| **Auto Copy** | Off | On / Off |

> Settings sync across devices via `chrome.storage.sync` and take effect immediately.

## Project Structure

```
pinyin-to-chinese/
├── src/
│   ├── manifest.json    # Manifest V3 config
│   ├── content.js       # Selection detection, API, popup UI
│   ├── content.css      # Host element positioning
│   ├── popup.html       # Settings page
│   ├── popup.js         # Settings logic
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
├── LICENSE
└── README.md
```

## API Reference

Uses [Google Input Tools API](https://www.google.com/inputtools/) for conversion:

| Mode | `itc` Parameter |
|------|-----------------|
| Traditional | `zh-hant-t-i0-pinyin` |
| Simplified | `zh-t-i0-pinyin` |

## License

This project is licensed under the [MIT License](LICENSE).
