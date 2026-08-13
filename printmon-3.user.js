// ==UserScript==
// @name         Printmon 3 (BETTER PRINTMON)
// @author       kyleldri
// @version      3.1
// @updateURL     https://tamarin.aces.amazon.dev/scripts/printmon-3/install.user.js
// @downloadURL   https://tamarin.aces.amazon.dev/scripts/printmon-3/install.user.js
// @description  Better printmon - custom buttons, ASIN print, bulk, text/barcode labels, Auto-Enter (scan-to-submit) barcodes, image printing, ZPL lab, unified sidebar settings.
// @match        http://localhost:5965/barcodegenerator
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js
// @connect      fcresearch-na.aka.amazon.com
// @connect      *
// ==/UserScript==

(function () {
'use strict';

/* ═══════════════════════════════════════════════════════
   DEV CONFIG - ZEBRA
═══════════════════════════════════════════════════════ */
var ZEBRA_CONFIG = {

  // Dev autoconfig
  // charWidthRatio: how wide each character is estimated vs font size.
  //   Raise  if words still clip on right edge.
  //   Lower to fit more chars per line.
  // autoScaleStart: largest font auto scale tries first, walks down to 18.
  // flowCharsPerLine: chars per line in Flow alignment mode.
  //   Raise for longer text like product descriptions.
  //   Lower for short words at larger sizes.
  charWidthRatio:   0.68,
  autoScaleStart:   250,
  flowCharsPerLine: 55,

  labelProfiles: {
    standard: { label: 'Standard 4×3', labelWidth: 812, labelHeight: 609 },
    small:    { label: 'Small 2×1',    labelWidth: 406, labelHeight: 203 }
  },
  defaultProfile:   'standard',
  marginX:          30,
  marginY:          30,
  fontSize:         { default: 40, min: 18, max: 250, step: 1 },
  charLimit:        { default: 35, min: 3,  max: 60,  step: 1 },
  lineSpacingPad:   8,
  blankLineRatio:   0.6,
  defaultAlignment: 'L',
  maxQty:           20,
  defaultQty:       1,
  timeout:          5000,
  endpoints:        [':9100', '/pstprnt', '/cgi-bin/pstprnt'],
  characterSet:     '^CI28',
  font:             'A0N',
  resultTimeout:    5000,
  debug:            false
};

var ZEBRA_DESC_RULES = {
  standard: [
    { maxChars: 60,   fontSize: 45, charsPerLine: 32 },
    { maxChars: 100,  fontSize: 35, charsPerLine: 38 },
    { maxChars: 150,  fontSize: 35, charsPerLine: 43 },
    { maxChars: 200,  fontSize: 30, charsPerLine: 48 },
    { maxChars: 9999, fontSize: 18, charsPerLine: 54 }
  ],
  small: [
    { maxChars: 60,   fontSize: 28, charsPerLine: 28 },
    { maxChars: 100,  fontSize: 22, charsPerLine: 32 },
    { maxChars: 150,  fontSize: 18, charsPerLine: 38 },
    { maxChars: 9999, fontSize: 14, charsPerLine: 44 }
  ]
};

/* ═══════════════════════════════════════════════════════
   DEV CONFIG - PRINTMON
═══════════════════════════════════════════════════════ */
var PRINTMON_CONFIG = {
  maxQty:        500,
  defaultQty:    1,
  bulkDelay:     300,
  resultTimeout: 5000
};

/* ═══════════════════════════════════════════════════════
   DEV CONFIG - LABEL DESIGNS
   Add/remove border entries freely. 'none' entry should stay.
═══════════════════════════════════════════════════════ */
var LABEL_BORDERS = [
  { value: 'none',    label: 'None'    },
  { value: 'thin',    label: 'Thin'    },
  { value: 'thick',   label: 'Thick'   },
  { value: 'blackband', label: 'Black Band' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'dashed',  label: 'Dashed'  }
];

/* ═══════════════════════════════════════════════════════
   FONT
═══════════════════════════════════════════════════════ */
var _font = document.createElement('link');
_font.rel  = 'stylesheet';
_font.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';
document.head.appendChild(_font);

/* ═══════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════ */
GM_addStyle(`
  *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
  :root {
    --bg:#09090b; --surface:#18181b; --surface-alt:#1e1e22;
    --border:#27272a; --border-h:#3f3f46;
    --text:#fafafa; --text-2:#a1a1aa; --text-3:#71717a;
    --orange:#f59e0b; --orange-h:#d97706;
    --green:#22c55e; --green-h:#16a34a;
    --blue:#3b82f6; --red:#ef4444;
    --purple:#a78bfa; --purple-h:#8b5cf6;
    --zebra:#22c55e; --zebra-h:#16a34a;
    --accent:#f59e0b;
    --sh-lg:0 8px 32px rgba(0,0,0,.5);
    --r:12px; --r-sm:8px; --r-xs:6px;
    --t:.2s ease;
  }
  body {
    font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif !important;
    background:var(--bg) !important; color:var(--text) !important; min-height:100vh;
  }

  /* ── Header ── */
  .pm-hd {
    background:var(--surface); padding:0 20px; height:52px;
    display:flex; align-items:center; justify-content:space-between;
    position:sticky; top:0; z-index:100; border-bottom:1px solid var(--border);
  }
  .pm-hd-left { display:flex; align-items:center; gap:10px; }
  .pm-hd-logo {
    width:32px; height:32px; background:var(--accent); border-radius:8px;
    display:flex; align-items:center; justify-content:center;
    font-weight:800; font-size:12px; color:#000; box-shadow:0 0 12px rgba(245,158,11,.25);
  }
  .pm-hd-name { color:var(--text); font-size:15px; font-weight:700; letter-spacing:-.3px; }
  .pm-hd-name b { color:var(--accent); }
  .pm-hd-v {
    background:var(--surface-alt); color:var(--text-3); padding:2px 8px;
    border-radius:20px; font-size:10px; font-weight:600; border:1px solid var(--border);
  }
  .pm-hd-right { display:flex; align-items:center; gap:6px; }
  .pm-hd-btn {
    background:var(--surface-alt); color:var(--text-2); border:1px solid var(--border);
    padding:6px 12px; border-radius:var(--r-xs); font-size:11px; font-weight:600;
    cursor:pointer; transition:all var(--t); font-family:inherit;
    text-decoration:none; display:inline-flex; align-items:center; gap:4px;
  }
  .pm-hd-btn:hover { background:var(--border); color:var(--text); border-color:var(--border-h); }

  /* ── Status bar ── */
  .pm-st {
    background:var(--surface); border-bottom:1px solid var(--border);
    padding:6px 20px; display:flex; align-items:center; gap:8px;
    font-size:11px; color:var(--text-2);
  }
  .pm-dot { width:7px; height:7px; border-radius:50%; background:var(--text-3); flex-shrink:0; }
  .pm-dot.ok  { background:var(--green);  box-shadow:0 0 6px rgba(34,197,94,.5); }
  .pm-dot.wrn { background:var(--orange); box-shadow:0 0 6px rgba(245,158,11,.5); }
  .pm-dot.err { background:var(--red);    box-shadow:0 0 6px rgba(239,68,68,.5); }

  /* ── Body layout ── */
  .pm-body {
    display:flex; gap:12px; max-width:1100px; margin:0 auto;
    padding:12px 12px 24px; align-items:flex-start;
  }

  /* ── Sidebar ── */
  .pm-sidebar { width:260px; flex-shrink:0; position:sticky; top:68px; }
  .pm-sb-card {
    background:var(--surface); border:1px solid var(--border);
    border-radius:var(--r); padding:14px; margin-bottom:10px; overflow:hidden;
  }
  .pm-sb-title {
    font-size:10px; font-weight:700; color:var(--text-3); text-transform:uppercase;
    letter-spacing:.6px; margin-bottom:12px; display:flex; align-items:center; gap:6px;
  }
  .pm-sb-title-dot { width:6px; height:6px; border-radius:50%; }
  .pm-sb-title-dot.zb { background:var(--zebra); }
  .pm-sb-title-dot.og { background:var(--accent); }

  /* ── Mode toggle ── */
  .pm-mode-toggle {
    display:flex; background:var(--bg); border-radius:var(--r-xs); padding:2px;
    border:1px solid var(--border); margin-bottom:10px;
  }
  .pm-mode-btn {
    flex:1; padding:5px 0; text-align:center; font-size:10px; font-weight:700;
    border:none; background:transparent; color:var(--text-3); cursor:pointer;
    border-radius:4px; transition:all var(--t); font-family:inherit;
    text-transform:uppercase; letter-spacing:.5px;
  }
  .pm-mode-btn.on-pm { background:var(--accent); color:#000; }
  .pm-mode-btn.on-zb { background:var(--zebra);  color:#000; }

  /* ── IP row ── */
  .pm-ip-row { display:flex; align-items:center; gap:6px; margin-bottom:10px; }
  .pm-ip-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
  .pm-ip-dot.ok  { background:var(--green);  box-shadow:0 0 5px rgba(34,197,94,.5); }
  .pm-ip-dot.wrn { background:var(--orange); }
  .pm-ip-dot.err { background:var(--red); }
  .pm-ip-text { font-size:10px; color:var(--text-3); font-family:'SF Mono',Consolas,monospace; }

  /* ── Sidebar inputs ── */
  .pm-sb-fi {
    width:100%; padding:7px 10px; border:1px solid var(--border); border-radius:var(--r-xs);
    font-size:11px; font-family:inherit; background:var(--bg) !important;
    color:var(--text) !important; transition:all var(--t); margin-bottom:10px;
  }
  .pm-sb-fi:focus { outline:none; border-color:var(--accent); box-shadow:0 0 0 2px rgba(245,158,11,.1); }
  .pm-sb-fi::placeholder { color:var(--text-3); }
  select.pm-sb-fi {
    appearance:none; -webkit-appearance:none;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2371717a' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
    background-repeat:no-repeat; background-position:right 8px center;
    padding-right:26px !important; cursor:pointer;
  }

  /* ── Sidebar toggles ── */
  .pm-sb-sw {
    display:flex; background:var(--bg); border-radius:var(--r-xs); padding:2px;
    border:1px solid var(--border); margin-bottom:12px;
  }
  .pm-sb-sw-btn {
    flex:1; padding:5px 0; text-align:center; font-size:10px; font-weight:600;
    border:none; background:transparent; color:var(--text-3); cursor:pointer;
    border-radius:4px; transition:all var(--t); font-family:inherit;
  }
  .pm-sb-sw-btn.on-zb { background:var(--zebra);    color:#000; font-weight:700; }
  .pm-sb-sw-btn.on-ac { background:var(--accent);   color:#000; font-weight:700; }
  .pm-sb-sw-btn.on-bl { background:var(--blue);     color:#fff; font-weight:700; }
  .pm-sb-sw-btn.on-pu { background:var(--purple-h); color:#fff; font-weight:700; }

  /* ── Sidebar sliders ── */
  .pm-sb-slider-row {
    display:flex; align-items:center; gap:6px; margin-bottom:8px;
    min-width:0; overflow:hidden;
  }
  .pm-sb-slider-row label {
    font-size:10px; font-weight:600; color:var(--text-3); width:62px; flex-shrink:0;
  }
  .pm-sb-slider-row input[type="range"] {
    flex:1; min-width:0; width:0; accent-color:var(--accent); cursor:pointer;
    height:3px; border-radius:2px; -webkit-appearance:none; appearance:none;
    background:var(--border-h);
  }
  .pm-sb-slider-row input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance:none; appearance:none; width:12px; height:12px;
    border-radius:50%; background:var(--accent); cursor:pointer; flex-shrink:0;
  }
  .pm-sb-slider-row input[type="range"]::-moz-range-thumb {
    width:12px; height:12px; border-radius:50%; background:var(--accent);
    cursor:pointer; border:none;
  }
  .pm-sb-slider-row .pm-sb-sv {
    font-size:10px; font-weight:700; color:var(--text); width:28px; flex-shrink:0;
    text-align:right; font-family:'SF Mono',Monaco,Consolas,monospace;
  }
  .pm-sb-section-label {
    font-size:10px; font-weight:600; color:var(--text-3); margin-bottom:6px; margin-top:8px;
  }
  .pm-sb-section-label:first-of-type { margin-top:0; }

  /* ── Auto pill ── */
  .pm-auto-pill {
    display:inline-block; background:rgba(167,139,250,.2); color:var(--purple);
    font-size:9px; font-weight:700; padding:1px 6px; border-radius:10px;
    border:1px solid rgba(167,139,250,.3); margin-left:4px; vertical-align:middle;
  }

  /* ── Zebra-only dims when Printmon mode ── */
  .pm-zebra-only { transition:opacity var(--t); }
  .pm-zebra-only.dimmed { opacity:.35; pointer-events:none; }

  /* ── Main ── */
  .pm-main { flex:1; min-width:0; }

  /* ── Tabs ── */
  .pm-tabs {
    display:flex; gap:4px; background:var(--surface); border:1px solid var(--border);
    border-radius:var(--r) var(--r) 0 0; padding:6px 6px 0; overflow-x:auto;
  }
  .pm-tab {
    flex:1; min-width:0; padding:9px 6px 11px; text-align:center;
    font-size:11px; font-weight:600; border:none; background:transparent;
    color:var(--text-3); cursor:pointer; border-radius:var(--r-sm) var(--r-sm) 0 0;
    transition:all var(--t); font-family:inherit; white-space:nowrap;
    display:flex; align-items:center; justify-content:center; gap:5px;
  }
  .pm-tab:hover  { color:var(--text-2); background:rgba(255,255,255,.03); }
  .pm-tab.active { color:var(--text); background:var(--bg); box-shadow:inset 0 2px 0 var(--accent); }
  .pm-tab-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
  .pm-tab-dot.gr { background:var(--green); }
  .pm-tab-dot.bl { background:var(--blue); }
  .pm-tab-dot.zb { background:var(--zebra); }

  /* ── Tab panels ── */
  .pm-tab-panel {
    display:none; background:var(--bg); border:1px solid var(--border); border-top:none;
    border-radius:0 0 var(--r) var(--r); padding:18px; animation:fadeIn .2s ease;
  }
  .pm-tab-panel.active { display:block; }
  @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }

  /* ── Panel headers ── */
  .pm-panel-hd {
    display:flex; align-items:center; gap:10px;
    margin-bottom:18px; padding-bottom:12px; border-bottom:1px solid var(--border);
  }
  .pm-panel-icon {
    width:32px; height:32px; border-radius:var(--r-sm);
    display:flex; align-items:center; justify-content:center;
    font-size:14px; font-weight:800; color:#fff; flex-shrink:0;
  }
  .pm-panel-icon.gr { background:linear-gradient(135deg,#22c55e,#16a34a); }
  .pm-panel-icon.bl { background:linear-gradient(135deg,#3b82f6,#2563eb); }
  .pm-panel-icon.zb { background:linear-gradient(135deg,#22c55e,#15803d); }
  .pm-panel-title { font-size:15px; font-weight:700; color:var(--text); }
  .pm-panel-sub   { font-size:11px; color:var(--text-3); margin-top:1px; }

  /* ── Quick Actions toggle ── */
  .pm-mode2-toggle {
    display:flex; background:var(--bg); border-radius:var(--r-xs); padding:2px;
    border:1px solid var(--border); margin-bottom:14px;
  }
  .pm-mode2-btn {
    flex:1; padding:7px 0; text-align:center; font-size:11px; font-weight:600;
    border:none; background:transparent; color:var(--text-3); cursor:pointer;
    border-radius:4px; transition:all var(--t); font-family:inherit;
  }
  .pm-mode2-btn.on-print   { background:var(--accent); color:#000; font-weight:700; }
  .pm-mode2-btn.on-barcode { background:var(--blue);   color:#fff; font-weight:700; }

  /* ── Preset buttons ── */
  .pm-pg { display:flex; flex-wrap:wrap; gap:6px; min-height:44px; }
  .pm-pg-empty {
    width:100%; text-align:center; padding:24px 12px; color:var(--text-3); font-size:12px;
    background:var(--surface); border-radius:var(--r-sm); border:1px dashed var(--border);
  }
  .pm-pb {
    display:inline-flex; align-items:center; gap:6px; padding:7px 11px;
    background:var(--surface); border:1px solid var(--border); border-radius:var(--r-sm);
    cursor:pointer; font-size:11px; font-weight:600; color:var(--text) !important;
    transition:all var(--t); font-family:inherit; white-space:nowrap; user-select:none;
  }
  .pm-pb:hover    { border-color:var(--accent); background:var(--surface-alt); }
  .pm-pb.selected { border-color:var(--purple-h); background:rgba(139,92,246,.12); }
  .pm-pb-lf { display:flex; align-items:center; gap:7px; }
  .pm-pb-ic {
    width:22px; height:22px; border-radius:var(--r-xs);
    background:rgba(245,158,11,.15); color:var(--accent);
    display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:800;
  }
  .pm-pb-x {
    width:18px; height:18px; background:transparent; border:1px solid transparent;
    border-radius:4px; color:var(--text-3); cursor:pointer;
    display:flex; align-items:center; justify-content:center;
    font-size:11px; transition:all var(--t); line-height:1;
  }
  .pm-pb-x:hover { background:rgba(239,68,68,.15); color:var(--red); border-color:rgba(239,68,68,.3); }

  /* ── Multi-select bar ── */
  .pm-select-bar {
    display:none; margin-top:12px; padding:10px 12px;
    background:var(--surface); border:1px solid var(--purple-h); border-radius:var(--r-sm);
    align-items:center; gap:10px; box-shadow:0 0 0 3px rgba(139,92,246,.1);
  }
  .pm-select-bar.visible { display:flex; }
  .pm-select-bar-label { font-size:11px; color:var(--text-2); flex:1; font-weight:600; }
  .pm-select-bar-qty {
    width:60px; padding:5px 8px; border:1px solid var(--border); border-radius:var(--r-xs);
    font-size:12px; font-weight:700; text-align:center;
    background:var(--bg) !important; color:var(--text) !important; font-family:inherit;
  }
  .pm-select-bar-qty:focus { outline:none; border-color:var(--purple-h); }
  .pm-select-bar-print {
    padding:6px 14px; background:var(--purple-h); color:#fff; border:none;
    border-radius:var(--r-xs); font-size:11px; font-weight:700; cursor:pointer;
    font-family:inherit; transition:all var(--t); white-space:nowrap;
  }
  .pm-select-bar-print:hover { background:#7c3aed; }
  .pm-select-bar-clear {
    padding:6px 10px; background:transparent; color:var(--text-3);
    border:1px solid var(--border); border-radius:var(--r-xs);
    font-size:11px; cursor:pointer; font-family:inherit; transition:all var(--t);
  }
  .pm-select-bar-clear:hover { border-color:var(--border-h); color:var(--text); }

  /* ── Barcode display cards ── */
  .pm-bi {
    position:relative; border:1px solid var(--border); border-radius:var(--r-sm);
    padding:10px; background:var(--surface); transition:all var(--t);
  }
  .pm-bi.dim { opacity:.15; filter:blur(3px); pointer-events:none; }
  .pm-bi.hl  { border-color:var(--accent); box-shadow:0 0 0 3px rgba(245,158,11,.15); }
  .pm-bi-top { display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; }
  .pm-bi-lbl { font-size:11px; font-weight:700; color:var(--text); }
  .pm-bi-acts { display:flex; gap:3px; }
  .pm-bi-act {
    width:24px; height:24px; background:var(--bg); border:1px solid var(--border);
    border-radius:4px; cursor:pointer; display:flex; align-items:center; justify-content:center;
    font-size:9px; font-weight:700; transition:all var(--t); font-family:inherit; color:var(--text-2);
  }
  .pm-bi-act:hover     { border-color:var(--border-h); color:var(--text); }
  .pm-bi-act.del:hover { border-color:var(--red); color:var(--red); }
  .pm-bc { display:block; margin:4px auto; max-width:100%; }

  /* ── Add preset row ── */
  .pm-as { margin-top:14px; padding-top:14px; border-top:1px solid var(--border); display:flex; gap:6px; }

  /* ── Form elements ── */
  .pm-fg { margin-bottom:14px; }
  .pm-fl { display:block; font-size:11px; font-weight:600; color:var(--text-2); margin-bottom:5px; }
  .pm-fi {
    width:100%; padding:9px 12px; border:1px solid var(--border); border-radius:var(--r-xs);
    font-size:13px; font-family:inherit; background:var(--surface) !important;
    color:var(--text) !important; transition:all var(--t);
  }
  .pm-fi:focus { outline:none; border-color:var(--accent); box-shadow:0 0 0 3px rgba(245,158,11,.1); }
  .pm-fi::placeholder { color:var(--text-3); }
  .pm-in {
    flex:1; padding:8px 12px; border:1px solid var(--border); border-radius:var(--r-xs);
    font-size:12px; font-family:inherit; background:var(--surface) !important;
    color:var(--text) !important; transition:all var(--t);
  }
  .pm-in:focus { outline:none; border-color:var(--accent); box-shadow:0 0 0 3px rgba(245,158,11,.1); }
  .pm-in::placeholder { color:var(--text-3) !important; }
  select.pm-fi {
    appearance:none; -webkit-appearance:none;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2371717a' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
    background-repeat:no-repeat; background-position:right 10px center;
    padding-right:28px !important; cursor:pointer;
  }

  /* ── Buttons ── */
  .pm-btn {
    width:100%; padding:10px 14px; border:none; border-radius:var(--r-sm);
    font-size:12px; font-weight:700; cursor:pointer; transition:all var(--t);
    font-family:inherit; letter-spacing:.2px;
  }
  .pm-btn:disabled { opacity:.5; cursor:not-allowed; }
  .pm-btn:active:not(:disabled) { transform:scale(.98); }
  .pm-btn-p { background:var(--accent); color:#000; box-shadow:0 2px 8px rgba(245,158,11,.25); }
  .pm-btn-p:hover { background:var(--orange-h); }
  .pm-btn-z { background:var(--zebra); color:#000; box-shadow:0 2px 8px rgba(34,197,94,.25); }
  .pm-btn-z:hover { background:var(--zebra-h); }
  .pm-btn-o { background:transparent; color:var(--text-2); border:1px solid var(--border); }
  .pm-btn-o:hover { border-color:var(--border-h); color:var(--text); background:var(--surface); }
  .pm-add {
    padding:8px 16px; background:var(--accent); color:#000; border:none;
    border-radius:var(--r-xs); font-size:12px; font-weight:700; cursor:pointer;
    transition:all var(--t); font-family:inherit; white-space:nowrap;
  }
  .pm-add:hover { background:var(--orange-h); }
  .pm-hr { height:1px; background:var(--border); margin:16px 0; }

  /* ── Results ── */
  .pm-res {
    margin-top:10px; padding:9px 12px; border-radius:var(--r-xs);
    font-size:11px; font-weight:600; display:none;
  }
  .pm-res.ok  { display:block; background:rgba(34,197,94,.1);  color:var(--green); border:1px solid rgba(34,197,94,.2); }
  .pm-res.err { display:block; background:rgba(239,68,68,.1);  color:var(--red);   border:1px solid rgba(239,68,68,.2); }

  /* ── ZPL Lab sliders ── */
  .pm-lab-slider-row { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
  .pm-lab-slider-row label { font-size:11px; font-weight:600; color:var(--text-2); width:70px; flex-shrink:0; }
  .pm-lab-slider-row input[type="range"] { flex:1; accent-color:var(--accent); cursor:pointer; }
  .pm-lab-slider-row .pm-lab-sv {
    font-size:11px; font-weight:700; color:var(--text);
    width:30px; text-align:right; font-family:'SF Mono',Monaco,Consolas,monospace;
  }

  /* ── Theme menu ── */
  .pm-theme-menu {
    position:absolute; top:100%; right:0; margin-top:6px;
    background:var(--surface); border:1px solid var(--border);
    border-radius:var(--r-sm); box-shadow:var(--sh-lg); z-index:200; min-width:150px; padding:4px;
  }
  .pm-theme-item {
    padding:8px 12px; font-size:11px; font-weight:600; color:var(--text-2);
    cursor:pointer; transition:all .15s; border-radius:var(--r-xs);
  }
  .pm-theme-item:hover  { background:var(--surface-alt); color:var(--text); }
  .pm-theme-item.active { color:var(--accent); font-weight:700; }

  /* ── Keyboard hints ── */
  .pm-kb {
    max-width:1100px; margin:10px auto 0; padding:0 16px 16px;
    display:flex; gap:14px; flex-wrap:wrap; font-size:10px; color:var(--text-3);
  }
  .pm-kb-item { display:flex; align-items:center; gap:4px; }
  .pm-kbd {
    background:var(--surface); border:1px solid var(--border); padding:2px 6px;
    border-radius:4px; font-family:'SF Mono',Monaco,Consolas,monospace;
    font-size:10px; font-weight:600; color:var(--text-2);
  }

  /* ── Responsive ── */
  @media (max-width:860px) {
    .pm-body { flex-direction:column; }
    .pm-sidebar { width:100%; position:static; }
    .pm-tab { font-size:10px; padding:7px 4px 9px; }
    .pm-tab-panel { padding:14px; }
  }
  ::-webkit-scrollbar { width:5px; }
  ::-webkit-scrollbar-track { background:var(--bg); }
  ::-webkit-scrollbar-thumb { background:var(--border); border-radius:3px; }
  ::-webkit-scrollbar-thumb:hover { background:var(--border-h); }

  /* ── Auto-Enter ── */
  .pm-ae-hint {
    font-size:11px; color:var(--text-3); line-height:1.5; margin-bottom:10px;
    background:var(--surface); border:1px solid var(--border); border-radius:var(--r-xs); padding:9px 11px;
  }
  .pm-ae-kbd {
    display:inline-block; background:var(--bg); border:1px solid var(--border-h);
    border-radius:4px; padding:0 6px; font-family:'SF Mono',Monaco,Consolas,monospace;
    font-weight:700; color:var(--accent);
  }

  /* ── Image print ── */
  .pm-img-drop {
    border:2px dashed var(--border-h); border-radius:var(--r-sm); padding:26px 16px;
    text-align:center; color:var(--text-3); font-size:12px; cursor:pointer;
    transition:all var(--t); background:var(--surface); line-height:1.6;
  }
  .pm-img-drop:hover, .pm-img-drop.drag {
    border-color:var(--accent); color:var(--text-2); background:var(--surface-alt);
  }
  .pm-img-preview-wrap { margin-top:14px; text-align:center; }
  .pm-img-canvas {
    max-width:100%; background:#fff; border:1px solid var(--border);
    border-radius:var(--r-xs); image-rendering:pixelated; image-rendering:crisp-edges;
  }
  .pm-img-eff {
    display:flex; align-items:center; gap:5px; font-size:11px;
    color:var(--text-2); cursor:pointer;
  }
`);

/* ═══════════════════════════════════════════════════════
   BUILD UI
═══════════════════════════════════════════════════════ */
document.title = 'Printmon 3';
document.body.innerHTML = '';
document.body.style.cssText = '';

var borderOptionsHTML = LABEL_BORDERS.map(function(b) {
  return '<option value="' + b.value + '">' + b.label + '</option>';
}).join('');

document.body.innerHTML = [

  /* ══ HEADER ══ */
  '<div class="pm-hd">',
  '  <div class="pm-hd-left">',
  '    <div class="pm-hd-logo" id="hdLogo">BP</div>',
  '    <span class="pm-hd-name">BETTER PRINT<b id="hdBrand">mon 3</b></span>',
  '    <span class="pm-hd-v">v3.1</span>',


  '  </div>',
  '  <div class="pm-hd-right">',
  '    <a class="pm-hd-btn" href="http://localhost:5965/webui">Troubleshoot</a>',
  '    <div style="position:relative;display:inline-block">',
  '      <button class="pm-hd-btn" id="pmThemeBtn">Theme &#9662;</button>',
  '      <div id="pmThemeMenu" class="pm-theme-menu" style="display:none">',
  '        <div class="pm-theme-item" data-theme="default">Zinc (Default)</div>',
  '        <div class="pm-theme-item" data-theme="fcrplus">FCR Plus</div>',
  '        <div class="pm-theme-item" data-theme="blue">Midnight Blue</div>',
  '        <div class="pm-theme-item" data-theme="purple">Purple</div>',
  '        <div class="pm-theme-item" data-theme="red">Crimson</div>',
  '        <div class="pm-theme-item" data-theme="amber">Mocha</div>',
  '        <div class="pm-theme-item" data-theme="oled">Black</div>',
  '        <div class="pm-theme-item" data-theme="light">Light</div>',
  '      </div>',
  '    </div>',
  '  </div>',
  '</div>',

  /* ══ STATUS ══ */
  '<div class="pm-st"><div class="pm-dot" id="sDot"></div><span id="sMsg">Checking...</span></div>',

  /* ══ BODY ══ */
  '<div class="pm-body">',
  '  <div class="pm-sidebar">',

  /* Card: Printer */
  '    <div class="pm-sb-card">',
  '      <div class="pm-sb-title"><span class="pm-sb-title-dot og"></span>Printer</div>',
  '      <div class="pm-mode-toggle">',
  '        <button class="pm-mode-btn" id="modePM">Printmon</button>',
  '        <button class="pm-mode-btn" id="modeZB">Zebra</button>',
  '      </div>',
  '      <div class="pm-ip-row">',
  '        <div class="pm-ip-dot" id="sbIpDot"></div>',
  '        <span class="pm-ip-text" id="sbIpText">Not detected</span>',
  '      </div>',
  '      <input class="pm-sb-fi" type="text" id="zPrinterIP" placeholder="Printer IP (e.g. 10.0.0.50)">',
  '    </div>',

  /* Card: Label Settings */
  '    <div class="pm-sb-card pm-zebra-only" id="sbZebraCard">',
  '      <div class="pm-sb-title"><span class="pm-sb-title-dot zb"></span>Label Settings</div>',

  '      <div class="pm-sb-section-label">Label Size</div>',
  '      <div class="pm-sb-sw" id="sbProfileSw">',
  '        <button class="pm-sb-sw-btn" data-profile="standard">Standard</button>',
  '        <button class="pm-sb-sw-btn" data-profile="small">Small</button>',
  '      </div>',

  '      <div class="pm-sb-section-label">Label Type</div>',
  '      <div class="pm-sb-sw" id="sbTypeSw">',
  '        <button class="pm-sb-sw-btn" data-ltype="barcode">Barcode</button>',
  '        <button class="pm-sb-sw-btn" data-ltype="text">Text Only</button>',
  '      </div>',

  /* Barcode section */
  '      <div id="sbBarcodeSection">',
  '        <div class="pm-sb-section-label">Barcode Type</div>',
  '        <select class="pm-sb-fi" id="sbBarcodeType">',
  '          <option value="code128">Code 128</option>',
  '          <option value="code39">Code 39</option>',
  '          <option value="qr">QR Code</option>',
  '          <option value="datamatrix">DataMatrix</option>',
  '          <option value="ean13">EAN-13</option>',
  '          <option value="upca">UPC-A</option>',
  '        </select>',
  '        <div class="pm-sb-section-label">Barcode Size</div>',
  '        <div class="pm-sb-slider-row">',
  '          <label id="sbBCSizeLabel">Height</label>',
  '          <input type="range" id="sbBCSize" min="30" max="200" step="1" value="90">',
  '          <span class="pm-sb-sv" id="sbBCSizeVal">90</span>',
  '        </div>',
  '        <div class="pm-sb-section-label">Desc Font</div>',
  '        <div class="pm-sb-sw" id="sbDescModeSw">',
  '          <button class="pm-sb-sw-btn" data-desc="auto">Auto</button>',
  '          <button class="pm-sb-sw-btn" data-desc="manual">Manual</button>',
  '        </div>',
  '        <div id="sbDescSliderWrap">',
  '          <div class="pm-sb-slider-row">',
  '            <label>Desc</label>',
  '            <input type="range" id="sbDescFont" min="14" max="70" step="1" value="35">',
  '            <span class="pm-sb-sv" id="sbDescFontVal">35</span>',
  '          </div>',
  '        </div>',
  '      </div>',

  /* Text section */
  '      <div id="sbTextSection">',
  '        <div class="pm-sb-section-label">Font Size <span class="pm-auto-pill" id="sbAutoLabel" style="display:none">AUTO</span></div>',
  '        <div class="pm-sb-sw" id="sbAutoSw" style="margin-bottom:10px">',
  '          <button class="pm-sb-sw-btn" data-auto="off">Manual</button>',
  '          <button class="pm-sb-sw-btn" data-auto="on">Auto</button>',
  '        </div>',
  '        <div id="sbManualSliders">',
  '          <div class="pm-sb-slider-row">',
  '            <label>Size</label>',
  '            <input type="range" id="sbFontSize" min="18" max="250" step="1" value="40">',
  '            <span class="pm-sb-sv" id="sbFontSizeVal">40</span>',
  '          </div>',
  '          <div class="pm-sb-slider-row">',
  '            <label>Char/Line</label>',
  '            <input type="range" id="sbCharLimit" min="3" max="60" step="1" value="35">',
  '            <span class="pm-sb-sv" id="sbCharLimitVal">35</span>',
  '          </div>',
  '        </div>',
  '        <div class="pm-sb-section-label">Alignment</div>',
  '        <div class="pm-sb-sw" id="sbAlignSw">',
  '          <button class="pm-sb-sw-btn" data-align="L">Left</button>',
  '          <button class="pm-sb-sw-btn" data-align="C">Center</button>',
  '          <button class="pm-sb-sw-btn" data-align="R">Right</button>',
  '          <button class="pm-sb-sw-btn" data-align="F">Flow</button>',
  '        </div>',
  '        <div class="pm-sb-section-label">Effects</div>',
  '        <label style="display:flex;align-items:center;gap:8px;font-size:10px;color:var(--text-2);cursor:pointer;margin-bottom:8px">',
  '          <input type="checkbox" id="sbReverse" style="accent-color:var(--accent)"> Reverse (black background)',
  '        </label>',
  '      </div>',

  /* Border */
  '      <div class="pm-sb-section-label">Border</div>',
  '      <select class="pm-sb-fi" id="sbBorder">' + borderOptionsHTML + '</select>',

  '    </div>',  /* end sbZebraCard */
  '  </div>',    /* end sidebar */

  /* ── MAIN ── */
  '  <div class="pm-main">',
  '    <div class="pm-tabs">',
  '      <button class="pm-tab active" data-tab="labelprinter"><span class="pm-tab-dot gr"></span>Label Printer</button>',
  '      <button class="pm-tab" data-tab="autoenter"><span class="pm-tab-dot bl"></span>Auto-Enter</button>',
  '      <button class="pm-tab" data-tab="image"><span class="pm-tab-dot gr"></span>Image</button>',
  '      <button class="pm-tab" data-tab="quickactions"><span class="pm-tab-dot bl"></span>Quick Actions</button>',
  '      <button class="pm-tab" data-tab="zpllab"><span class="pm-tab-dot zb"></span>ZPL Lab</button>',
  '    </div>',

  /* Panel: Label Printer */
  '    <div class="pm-tab-panel active" id="panel-labelprinter">',
  '      <div class="pm-panel-hd">',
  '        <div class="pm-panel-icon gr" id="lpIcon">&#9698;</div>',
  '        <div><div class="pm-panel-title" id="lpTitle">Barcode Labels</div>',
  '        <div class="pm-panel-sub" id="lpSub">ASIN / FNSKU with description, bulk support</div></div>',
  '      </div>',
  '      <div class="pm-fg" id="lpBarcodeGroup">',
  '        <label class="pm-fl" for="fBar">Barcode / ASIN / FNSKU (one per line for bulk)</label>',
  '        <textarea class="pm-fi" id="fBar" rows="2" placeholder="Scan or type&#10;One per line for bulk" style="resize:vertical;font-family:inherit"></textarea>',
  '      </div>',
  '      <div class="pm-fg" id="lpDescGroup">',
  '        <label class="pm-fl" for="fTitle">Description (auto-fetches for ASINs)</label>',
  '        <textarea class="pm-fi" id="fTitle" rows="1" placeholder="Auto-filled or type manually" style="resize:vertical;font-family:inherit"></textarea>',
  '      </div>',
  '      <div class="pm-fg" id="lpTextGroup" style="display:none">',
  '        <label class="pm-fl" for="lpText">Text to print</label>',
  '        <textarea class="pm-fi" id="lpText" rows="3" placeholder="Enter text to print on label" style="resize:vertical;font-family:inherit"></textarea>',
  '      </div>',
  '      <div class="pm-fg" id="lpAutoEnterGroup">',
  '        <label class="pm-img-eff" style="font-size:12px">',
  '          <input type="checkbox" id="fAutoEnter" style="accent-color:var(--accent);width:14px;height:14px">',
  '          Auto-Enter &#9166; &mdash; scanning the printed label presses Enter',
  '        </label>',
  '      </div>',
  '      <div class="pm-fg">',
  '        <label class="pm-fl" for="fQty">Quantity (1–' + PRINTMON_CONFIG.maxQty + ')</label>',
  '        <input class="pm-fi" type="number" id="fQty" min="1" max="' + PRINTMON_CONFIG.maxQty + '" value="' + PRINTMON_CONFIG.defaultQty + '">',
  '      </div>',
  '      <button class="pm-btn pm-btn-p" id="fPrint">Print Labels</button>',
  '      <div class="pm-res" id="fRes"></div>',
  '      <div class="pm-hr"></div>',
  '      <button class="pm-btn pm-btn-o" id="fClear">Clear</button>',
  '    </div>',

  /* Panel: Auto-Enter */
  '    <div class="pm-tab-panel" id="panel-autoenter">',
  '      <div class="pm-panel-hd">',
  '        <div class="pm-panel-icon bl" style="background:linear-gradient(135deg,#a78bfa,#8b5cf6)">&#9166;</div>',
  '        <div><div class="pm-panel-title">Auto-Enter Barcodes</div>',
  '        <div class="pm-panel-sub">Scan to auto-submit — the barcode carries a carriage return (&#9166;)</div></div>',
  '      </div>',
  '      <div class="pm-ae-hint">',
  '        An <b>Auto-Enter</b> barcode ends with a carriage return, so scanning it types the value <i>and</i> presses <span class="pm-ae-kbd">Enter</span> for you — no keyboard needed.',
  '      </div>',
  '      <div class="pm-fg">',
  '        <label class="pm-fl">Quick &#9166; ENTER key barcode</label>',
  '        <div style="font-size:11px;color:var(--text-3);margin-bottom:8px">Prints a standalone &#9166; barcode. Tape it at your station and scan it whenever you need to press Enter.</div>',
  '        <div style="display:flex;gap:6px;align-items:center">',
  '          <input class="pm-fi" type="number" id="aeEnterQty" min="1" max="50" value="1" style="width:90px">',
  '          <button class="pm-btn pm-btn-p" id="aeEnterPrint" style="flex:1">Print &#9166; ENTER Barcode</button>',
  '        </div>',
  '      </div>',
  '      <div class="pm-hr"></div>',
  '      <div class="pm-fg">',
  '        <label class="pm-fl" for="aeData">Custom auto-enter barcode (one per line for bulk)</label>',
  '        <textarea class="pm-fi" id="aeData" rows="2" placeholder="Type or scan data&#10;Each printed barcode auto-submits when scanned" style="resize:vertical;font-family:inherit"></textarea>',
  '      </div>',
  '      <div class="pm-fg">',
  '        <label class="pm-fl" for="aeQty">Quantity (1–50)</label>',
  '        <input class="pm-fi" type="number" id="aeQty" min="1" max="50" value="1">',
  '      </div>',
  '      <button class="pm-btn pm-btn-p" id="aePrint">Print Auto-Enter Barcode(s)</button>',
  '      <div class="pm-res" id="aeRes"></div>',
  '    </div>',

  /* Panel: Image */
  '    <div class="pm-tab-panel" id="panel-image">',
  '      <div class="pm-panel-hd">',
  '        <div class="pm-panel-icon gr">&#128247;</div>',
  '        <div><div class="pm-panel-title">Image Label</div>',
  '        <div class="pm-panel-sub">Print any image — converted to a black &amp; white ZPL graphic (Zebra)</div></div>',
  '      </div>',
  '      <div class="pm-img-drop" id="imgDrop">',
  '        <b>Click, paste, or drop an image here</b><br>',
  '        <span style="font-size:10px">PNG / JPG — auto-converted to black &amp; white for the label printer</span>',
  '      </div>',
  '      <input type="file" id="imgFile" accept="image/*" style="display:none">',
  '      <div class="pm-img-preview-wrap" id="imgPreviewWrap" style="display:none">',
  '        <canvas class="pm-img-canvas" id="imgCanvas"></canvas>',
  '        <div style="font-size:10px;color:var(--text-3);margin-top:4px" id="imgDims"></div>',
  '      </div>',
  '      <div id="imgControls" style="display:none">',
  '        <div class="pm-lab-slider-row" style="margin-top:14px"><label>Width</label><input type="range" id="imgWidth" min="100" max="812" value="812"><span class="pm-lab-sv" id="imgWidthVal">812</span></div>',
  '        <div class="pm-lab-slider-row"><label>Threshold</label><input type="range" id="imgThresh" min="1" max="254" value="128"><span class="pm-lab-sv" id="imgThreshVal">128</span></div>',
  '        <div style="display:flex;flex-wrap:wrap;gap:14px;margin:12px 0">',
  '          <label class="pm-img-eff"><input type="checkbox" id="imgDither" style="accent-color:var(--accent)"> Dither</label>',
  '          <label class="pm-img-eff"><input type="checkbox" id="imgInvert" style="accent-color:var(--accent)"> Invert</label>',
  '          <label class="pm-img-eff"><input type="checkbox" id="imgRotate" style="accent-color:var(--accent)"> Rotate 90°</label>',
  '        </div>',
  '        <div class="pm-fg"><label class="pm-fl" for="imgQty">Quantity (1–50)</label>',
  '          <input class="pm-fi" type="number" id="imgQty" min="1" max="50" value="1"></div>',
  '        <button class="pm-btn pm-btn-z" id="imgPrint">Print Image</button>',
  '        <div style="margin-top:8px;display:flex;gap:6px">',
  '          <button class="pm-btn pm-btn-o" id="imgCopyZpl" style="flex:1">Copy ZPL</button>',
  '          <button class="pm-btn pm-btn-o" id="imgClear"   style="flex:1">Clear</button>',
  '        </div>',
  '      </div>',
  '      <div class="pm-res" id="imgRes"></div>',
  '    </div>',

  /* Panel: Quick Actions */
  '    <div class="pm-tab-panel" id="panel-quickactions">',
  '      <div class="pm-panel-hd">',
  '        <div class="pm-panel-icon bl">&#9733;</div>',
  '        <div><div class="pm-panel-title">Quick Actions</div>',
  '        <div class="pm-panel-sub">Click to print one — check box to select multiple</div></div>',
  '      </div>',
  '      <div class="pm-mode2-toggle">',
  '        <button class="pm-mode2-btn" id="swPrint">Print</button>',
  '        <button class="pm-mode2-btn" id="swBarcode">Barcode</button>',
  '      </div>',
  '      <div class="pm-pg" id="pCon"></div>',
  '      <div class="pm-select-bar" id="qaSelectBar">',
  '        <span class="pm-select-bar-label" id="qaSelectLabel">0 selected</span>',
  '        <input class="pm-select-bar-qty" type="number" id="qaSelectQty" min="1" max="' + ZEBRA_CONFIG.maxQty + '" value="1">',
  '        <button class="pm-select-bar-print" id="qaSelectPrint">Print Selected</button>',
  '        <button class="pm-select-bar-clear" id="qaSelectClear">Clear</button>',
  '      </div>',
  '      <div class="pm-as">',
  '        <input class="pm-in" type="text" id="pNew" placeholder="e.g. Problem Solve, DAMAGE...">',
  '        <button class="pm-add" id="pAdd">+ Add</button>',
  '      </div>',
  '      <div class="pm-res" id="qaRes"></div>',
  '    </div>',

  /* Panel: ZPL Lab */
  '    <div class="pm-tab-panel" id="panel-zpllab">',
  '      <div class="pm-panel-hd">',
  '        <div class="pm-panel-icon zb">&#9881;</div>',
  '        <div><div class="pm-panel-title">ZPL Lab</div>',
  '        <div class="pm-panel-sub">Experimental: QR, borders, reverse, layouts</div></div>',
  '      </div>',
  '      <div class="pm-fg">',
  '        <label class="pm-fl" for="labText">Label Content</label>',
  '        <textarea class="pm-fi" id="labText" rows="2" placeholder="Enter text or data" style="resize:vertical;font-family:inherit"></textarea>',
  '      </div>',
  '      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">',
  '        <div class="pm-fg" style="margin:0"><label class="pm-fl">Barcode Type</label>',
  '          <select class="pm-fi" id="labBarcodeType">',
  '            <option value="none">None</option><option value="code128" selected>Code 128</option>',
  '            <option value="code39">Code 39</option><option value="qr">QR Code</option>',
  '            <option value="datamatrix">DataMatrix</option><option value="ean13">EAN-13</option>',
  '            <option value="upca">UPC-A</option>',
  '          </select></div>',
  '        <div class="pm-fg" style="margin:0"><label class="pm-fl">Border</label>',
  '          <select class="pm-fi" id="labBorder">',
  '            <option value="none">None</option><option value="thin">Thin</option>',
  '            <option value="thick">Thick</option><option value="double">Double</option>',
  '            <option value="rounded">Rounded</option><option value="dashed">Dashed</option>',
  '          </select></div>',
  '      </div>',
  '      <div class="pm-fg" style="margin-top:10px"><label class="pm-fl">Layout</label>',
  '        <select class="pm-fi" id="labLayout">',
  '          <option value="standard">Standard (barcode top, text below)</option>',
  '          <option value="side">Side by side</option>',
  '          <option value="textonly">Text only (centered)</option>',
  '          <option value="dual">Dual (Code128 + QR)</option>',
  '        </select></div>',
  '      <div class="pm-fg"><label class="pm-fl">Effects</label>',
  '        <div style="display:flex;flex-wrap:wrap;gap:12px">',
  '          <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text-2);cursor:pointer"><input type="checkbox" id="labReverse" style="accent-color:var(--accent)"> Reverse</label>',
  '          <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text-2);cursor:pointer"><input type="checkbox" id="labMirror"  style="accent-color:var(--accent)"> Mirror</label>',
  '          <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text-2);cursor:pointer"><input type="checkbox" id="labRotate"  style="accent-color:var(--accent)"> Rotate 90°</label>',
  '          <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text-2);cursor:pointer"><input type="checkbox" id="labDate"    style="accent-color:var(--accent)"> Timestamp</label>',
  '        </div></div>',
  '      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">',
  '        <div class="pm-lab-slider-row" style="margin:0"><label>Font</label><input type="range" id="labFont" min="20" max="120" value="40"><span class="pm-lab-sv" id="labFontVal">40</span></div>',
  '        <div class="pm-lab-slider-row" style="margin:0"><label>BC Height</label><input type="range" id="labBCHeight" min="30" max="200" value="90"><span class="pm-lab-sv" id="labBCHVal">90</span></div>',
  '      </div>',
  '      <div class="pm-fg"><label class="pm-fl" for="labQty">Quantity</label>',
  '        <input class="pm-fi" type="number" id="labQty" min="1" max="50" value="1"></div>',
  '      <button class="pm-btn pm-btn-z" id="labPrint">Print Lab Label</button>',
  '      <div style="margin-top:8px;display:flex;gap:6px">',
  '        <button class="pm-btn pm-btn-o" id="labPreview" style="flex:1">Copy ZPL</button>',
  '        <button class="pm-btn pm-btn-o" id="labClear"   style="flex:1">Clear</button>',
  '      </div>',
  '      <div class="pm-res" id="labRes"></div>',
  '    </div>',

  '  </div>',  // end .pm-main
  '</div>',    // end .pm-body

  '<div class="pm-kb">',
  '  <div class="pm-kb-item"><span class="pm-kbd">Alt+B</span> Focus barcode</div>',
  '  <div class="pm-kb-item"><span class="pm-kbd">Alt+P</span> Print</div>',
  '  <div class="pm-kb-item"><span class="pm-kbd">Alt+F</span> Fetch title</div>',
  '  <div class="pm-kb-item"><span class="pm-kbd">Ctrl+Enter</span> Print from field</div>',
  '</div>'

].join('\n');

    /* ═══════════════════════════════════════════════════════
     TAB SWITCHING
  ═══════════════════════════════════════════════════════ */
  var tabs   = document.querySelectorAll('.pm-tab');
  var panels = document.querySelectorAll('.pm-tab-panel');
  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      var target = this.getAttribute('data-tab');
      tabs.forEach(function(t)   { t.classList.remove('active'); });
      panels.forEach(function(p) { p.classList.remove('active'); });
      this.classList.add('active');
      var panel = document.getElementById('panel-' + target);
      if (panel) panel.classList.add('active');
    });
  });
  function switchToTab(name) {
    tabs.forEach(function(t)   { t.classList.remove('active'); });
    panels.forEach(function(p) { p.classList.remove('active'); });
    var t = document.querySelector('.pm-tab[data-tab="' + name + '"]');
    var p = document.getElementById('panel-' + name);
    if (t) t.classList.add('active');
    if (p) p.classList.add('active');
  }

  /* ═══════════════════════════════════════════════════════
     THEMES
  ═══════════════════════════════════════════════════════ */
  var THEMES = { //Themes mostly from FCR plus script
    default: { bg:'#09090b', surface:'#18181b', surfaceAlt:'#1e1e22', border:'#27272a', borderH:'#3f3f46', text:'#fafafa', text2:'#a1a1aa', text3:'#71717a', accent:'#f59e0b', invertBarcode:true },
    fcrplus: { bg:'#040D12', surface:'#0A1A1F', surfaceAlt:'#0E2429', border:'#183D3D', borderH:'#2C5D5D', text:'#E0E0E0', text2:'#93A8A8', text3:'#5C7878', accent:'#f59e0b', invertBarcode:true },
    blue:    { bg:'#0a0e1a', surface:'#111827', surfaceAlt:'#1a2235', border:'#1e3a5f', borderH:'#2d5a8a', text:'#c8d6e5', text2:'#8899aa', text3:'#556677', accent:'#3b82f6', invertBarcode:true },
    purple:  { bg:'#0a0008', surface:'#120010', surfaceAlt:'#1a0018', border:'#35063e', borderH:'#4a0854', text:'#d4c6f0', text2:'#9980b3', text3:'#664488', accent:'#a78bfa', invertBarcode:true },
    red:     { bg:'#120808', surface:'#1a0f0f', surfaceAlt:'#221414', border:'#3d1818', borderH:'#5d2c2c', text:'#f0c6c6', text2:'#b38888', text3:'#7a5555', accent:'#f87171', invertBarcode:true },
    amber:   { bg:'#120e08', surface:'#1a150f', surfaceAlt:'#221c14', border:'#3d2a18', borderH:'#967969', text:'#f0dfc6', text2:'#b3a088', text3:'#7a6e55', accent:'#f59e0b', invertBarcode:true },
    oled:    { bg:'#000000', surface:'#0a0a0a', surfaceAlt:'#111111', border:'#1a1a1a', borderH:'#2a2a2a', text:'#cccccc', text2:'#888888', text3:'#555555', accent:'#f59e0b', invertBarcode:true },
    light:   { bg:'#f4f4f5', surface:'#ffffff', surfaceAlt:'#f0f0f0', border:'#e4e4e7', borderH:'#d4d4d8', text:'#18181b', text2:'#71717a', text3:'#a1a1aa', accent:'#f59e0b', invertBarcode:false }
  };
  var currentTheme = GM_getValue('pm3_theme', 'default');
  function applyTheme(name) {
    var t = THEMES[name] || THEMES.default, r = document.documentElement;
    r.style.setProperty('--bg', t.bg); r.style.setProperty('--surface', t.surface);
    r.style.setProperty('--surface-alt', t.surfaceAlt); r.style.setProperty('--border', t.border);
    r.style.setProperty('--border-h', t.borderH); r.style.setProperty('--text', t.text);
    r.style.setProperty('--text-2', t.text2); r.style.setProperty('--text-3', t.text3);
    if (t.accent) r.style.setProperty('--accent', t.accent);
    document.querySelectorAll('.pm-bc').forEach(function(bc) { bc.style.filter = t.invertBarcode ? 'invert(1)' : 'none'; });
    document.querySelectorAll('.pm-theme-item').forEach(function(item) {
      item.classList.toggle('active', item.getAttribute('data-theme') === name);
    });
    currentTheme = name; GM_setValue('pm3_theme', name);
  }
  var themeBtn = document.getElementById('pmThemeBtn'), themeMenu = document.getElementById('pmThemeMenu');
  themeBtn.addEventListener('click', function(e) { e.stopPropagation(); themeMenu.style.display = themeMenu.style.display === 'none' ? 'block' : 'none'; });
  document.addEventListener('click', function() { themeMenu.style.display = 'none'; });
  themeMenu.addEventListener('click', function(e) { e.stopPropagation(); });
  document.querySelectorAll('.pm-theme-item').forEach(function(item) {
    item.addEventListener('click', function() { applyTheme(this.getAttribute('data-theme')); themeMenu.style.display = 'none'; });
  });
  applyTheme(currentTheme);

  /* ═══════════════════════════════════════════════════════
     STATE
  ═══════════════════════════════════════════════════════ */
  var presets       = GM_getValue('presetButtons',     []);
  var qaMode        = GM_getValue('pm3_qaMode',        'print');
  var printMode     = GM_getValue('pm3_printMode',     'printmon');
  var labelProfile  = GM_getValue('pm3_labelProfile',  ZEBRA_CONFIG.defaultProfile);
  var labelType     = GM_getValue('pm3_labelType',     'barcode');
  var sbBarcodeType = GM_getValue('pm3_sbBarcodeType', 'code128');
  var sbBCSize      = GM_getValue('pm3_sbBCSize',      90);
  var sbFontSize    = GM_getValue('pm3_sbFontSize',    40);
  var sbCharLimit   = GM_getValue('pm3_sbCharLimit',   35);
  var sbAlignment   = GM_getValue('pm3_sbAlignment',   ZEBRA_CONFIG.defaultAlignment);
  var sbDescMode    = GM_getValue('pm3_sbDescMode',    'auto');
  var sbDescFont    = GM_getValue('pm3_sbDescFont',    35);
  var sbBorder      = GM_getValue('pm3_sbBorder',      'none');
  var sbReverse     = GM_getValue('pm3_sbReverse',     false);
  var sbAutoMode    = GM_getValue('pm3_sbAutoMode',    false);
  var fAutoEnter    = GM_getValue('pm3_fAutoEnter',    false);
  var selectedPresets   = [];
  var detectedPrinterIP = '';

  /* ═══════════════════════════════════════════════════════
     HELPERS
  ═══════════════════════════════════════════════════════ */
  function seqId() { var id=''; for(var i=0;i<10;i++) id+=Math.floor(Math.random()*9); return id; }
  function toHex(str) { var out=''; for(var i=0;i<str.length;i++) out+=str.charCodeAt(i).toString(16); return out; }
  function getCookieVal(name) { var v='; '+document.cookie, p=v.split('; '+name+'='); if(p.length===2) return p.pop().split(';').shift(); return null; }
  function esc(str) { var d=document.createElement('div'); d.textContent=str; return d.innerHTML; }
  function setStatus(msg, level) { document.getElementById('sMsg').textContent=msg; var dot=document.getElementById('sDot'); dot.className='pm-dot'; if(level) dot.classList.add(level); }
  function showResult(elId, msg, type) {
    var box=document.getElementById(elId); if(!box) return;
    box.textContent=msg; box.className='pm-res '+type;
    if(type==='ok') setTimeout(function(){ box.className='pm-res'; }, PRINTMON_CONFIG.resultTimeout);
  }

  /* ═══════════════════════════════════════════════════════
     SIDEBAR: IP
  ═══════════════════════════════════════════════════════ */
  function setSidebarIP(ip, level) {
    document.getElementById('sbIpDot').className    = 'pm-ip-dot '+(level||'');
    document.getElementById('sbIpText').textContent = ip||'Not detected';
  }
  function detectPrintmonIP() {
    GM_xmlhttpRequest({
      method:'GET', url:'http://localhost:5965/status?type=webui',
      onload:function(r) {
        try {
          var json=JSON.parse(r.responseText);
          if(json.ipaddress) {
            detectedPrinterIP=json.ipaddress;
            var ipField=document.getElementById('zPrinterIP');
            if(!ipField.value) ipField.value=json.ipaddress;
            setSidebarIP(json.ipaddress,'ok'); GM_setValue('zebraPrinterIP',json.ipaddress);
            setStatus('Printmon connected: '+json.ipaddress,'ok');
          } else { setStatus('Printmon connected','ok'); }
        } catch(e) { setStatus('Printmon connected','ok'); }
      },
      onerror:function() { setStatus('Cannot reach Printmon','err'); }
    });
  }
  function detectZebraPrinter() {
    var cookieIP=getCookieVal('fcmenu-remoteAddr'), ipField=document.getElementById('zPrinterIP');
    if(cookieIP) { ipField.value=cookieIP; detectedPrinterIP=cookieIP; setSidebarIP(cookieIP,'ok'); GM_setValue('zebraPrinterIP',cookieIP); }
    else {
      var saved=GM_getValue('zebraPrinterIP','');
      if(saved) { ipField.value=saved; detectedPrinterIP=saved; setSidebarIP(saved,'wrn'); }
      else { setSidebarIP('Not detected','err'); }
    }
  }
  document.getElementById('zPrinterIP').addEventListener('change', function() {
    var ip=this.value.trim();
    if(ip) { detectedPrinterIP=ip; GM_setValue('zebraPrinterIP',ip); setSidebarIP(ip,'wrn'); }
  });

  /* ═══════════════════════════════════════════════════════
     SIDEBAR: LABEL SETTINGS
  ═══════════════════════════════════════════════════════ */
  function updateProfileUI() {
    document.querySelectorAll('#sbProfileSw .pm-sb-sw-btn').forEach(function(btn) {
      btn.classList.toggle('on-zb', btn.getAttribute('data-profile')===labelProfile);
    });
  }
  document.querySelectorAll('#sbProfileSw .pm-sb-sw-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { labelProfile=this.getAttribute('data-profile'); GM_setValue('pm3_labelProfile',labelProfile); updateProfileUI(); });
  });

  function updateLabelTypeUI() {
    document.querySelectorAll('#sbTypeSw .pm-sb-sw-btn').forEach(function(btn) {
      btn.classList.toggle('on-ac', btn.getAttribute('data-ltype')===labelType);
    });
    var bs=document.getElementById('sbBarcodeSection'), ts=document.getElementById('sbTextSection');
    if(bs) bs.style.display=labelType==='barcode'?'block':'none';
    if(ts) ts.style.display=labelType==='text'?'block':'none';
    updateLabelPrinterPanel();
  }
  document.querySelectorAll('#sbTypeSw .pm-sb-sw-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { labelType=this.getAttribute('data-ltype'); GM_setValue('pm3_labelType',labelType); updateLabelTypeUI(); });
  });

  function updateLabelPrinterPanel() {
    var isText=labelType==='text';
    var icon=document.getElementById('lpIcon'), title=document.getElementById('lpTitle');
    var sub=document.getElementById('lpSub'), fPrint=document.getElementById('fPrint');
    document.getElementById('lpBarcodeGroup').style.display=isText?'none':'block';
    document.getElementById('lpDescGroup').style.display=isText?'none':'block';
    document.getElementById('lpTextGroup').style.display=isText?'block':'none';
    var aeG=document.getElementById('lpAutoEnterGroup'); if(aeG) aeG.style.display=isText?'none':'block';
    if(isText) { icon.textContent='T'; title.textContent='Text Labels'; sub.textContent='Text direct to label — Manual or Auto scale'; }
    else { icon.innerHTML='&#9698;'; title.textContent='Barcode Labels'; sub.textContent='ASIN / FNSKU with description, bulk support'; }
    if(printMode==='zebra') { fPrint.className='pm-btn pm-btn-z'; fPrint.textContent=isText?'Print Text Label':'Print via Zebra'; }
    else { fPrint.className='pm-btn pm-btn-p'; fPrint.textContent='Print Labels'; }
  }

  /* Barcode type */
  var sbBarcodeTypeEl=document.getElementById('sbBarcodeType');
  sbBarcodeTypeEl.value=sbBarcodeType;
  sbBarcodeTypeEl.addEventListener('change', function() { sbBarcodeType=this.value; GM_setValue('pm3_sbBarcodeType',sbBarcodeType); updateBCSizeLabel(); });

  /* BC Size slider */
  var sbBCSizeSlider=document.getElementById('sbBCSize'), sbBCSizeValEl=document.getElementById('sbBCSizeVal');
  sbBCSizeSlider.value=sbBCSize; sbBCSizeValEl.textContent=sbBCSize;
  sbBCSizeSlider.addEventListener('input', function() { sbBCSize=parseInt(this.value); sbBCSizeValEl.textContent=sbBCSize; GM_setValue('pm3_sbBCSize',sbBCSize); });
  function updateBCSizeLabel() {
    var lbl=document.getElementById('sbBCSizeLabel'); if(!lbl) return;
    var isQR=(sbBarcodeType==='qr'||sbBarcodeType==='datamatrix');
    lbl.textContent=isQR?'Magnify':'Height';
    sbBCSizeSlider.min=isQR?'2':'30'; sbBCSizeSlider.max=isQR?'10':'200';
    if(isQR&&sbBCSize>10)  { sbBCSize=5;  sbBCSizeSlider.value=5;  sbBCSizeValEl.textContent=5; }
    if(!isQR&&sbBCSize<30) { sbBCSize=90; sbBCSizeSlider.value=90; sbBCSizeValEl.textContent=90; }
  }

  /* Text font size slider */
  var sbFontSlider=document.getElementById('sbFontSize'), sbFontValEl=document.getElementById('sbFontSizeVal');
  sbFontSlider.value=sbFontSize; sbFontValEl.textContent=sbFontSize;
  sbFontSlider.addEventListener('input', function() { sbFontSize=parseInt(this.value); sbFontValEl.textContent=sbFontSize; GM_setValue('pm3_sbFontSize',sbFontSize); });

  /* Text char/line slider */
  var sbCharSlider=document.getElementById('sbCharLimit'), sbCharValEl=document.getElementById('sbCharLimitVal');
  sbCharSlider.value=sbCharLimit; sbCharValEl.textContent=sbCharLimit;
  sbCharSlider.addEventListener('input', function() { sbCharLimit=parseInt(this.value); sbCharValEl.textContent=sbCharLimit; GM_setValue('pm3_sbCharLimit',sbCharLimit); });

  /* Auto/Manual toggle */
       function updateAutoSw() {
    var btnManual = document.querySelector('#sbAutoSw .pm-sb-sw-btn[data-auto="off"]');
    var btnAuto   = document.querySelector('#sbAutoSw .pm-sb-sw-btn[data-auto="on"]');
    if (btnManual && btnAuto) {
      btnManual.classList.remove('on-ac','on-pu','on-bl','on-zb');
      btnAuto.classList.remove('on-ac','on-pu','on-bl','on-zb');
      if (sbAutoMode) { btnAuto.classList.add('on-pu'); }
      else            { btnManual.classList.add('on-ac'); }
    }
    var sliders = document.getElementById('sbManualSliders');
    if (sliders) sliders.style.display = sbAutoMode ? 'none' : 'block';
    var pill = document.getElementById('sbAutoLabel');
    if (pill) pill.style.display = sbAutoMode ? 'inline' : 'none';
  }

  document.querySelectorAll('#sbAutoSw .pm-sb-sw-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      sbAutoMode = this.getAttribute('data-auto') === 'on';
      GM_setValue('pm3_sbAutoMode', sbAutoMode);
      updateAutoSw();
    });
  });



  /* Alignment */
  function updateAlignUI() {
    document.querySelectorAll('#sbAlignSw .pm-sb-sw-btn').forEach(function(btn) {
      btn.classList.toggle('on-ac', btn.getAttribute('data-align')===sbAlignment);
    });
    updateAutoSw();
  }
  document.querySelectorAll('#sbAlignSw .pm-sb-sw-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { sbAlignment=this.getAttribute('data-align'); GM_setValue('pm3_sbAlignment',sbAlignment); updateAlignUI(); });
  });

  /* Desc mode */
  function updateDescModeUI() {
    document.querySelectorAll('#sbDescModeSw .pm-sb-sw-btn').forEach(function(btn) {
      btn.classList.toggle('on-bl', btn.getAttribute('data-desc')===sbDescMode);
    });
    var wrap=document.getElementById('sbDescSliderWrap');
    if(wrap) wrap.style.display=sbDescMode==='manual'?'block':'none';
  }
  document.querySelectorAll('#sbDescModeSw .pm-sb-sw-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { sbDescMode=this.getAttribute('data-desc'); GM_setValue('pm3_sbDescMode',sbDescMode); updateDescModeUI(); });
  });

  /* Desc font slider */
  var sbDescSlider=document.getElementById('sbDescFont'), sbDescValEl=document.getElementById('sbDescFontVal');
  sbDescSlider.value=sbDescFont; sbDescValEl.textContent=sbDescFont;
  sbDescSlider.addEventListener('input', function() { sbDescFont=parseInt(this.value); sbDescValEl.textContent=sbDescFont; GM_setValue('pm3_sbDescFont',sbDescFont); });

  /* Reverse */
  var sbReverseEl=document.getElementById('sbReverse');
  sbReverseEl.checked=sbReverse;
  sbReverseEl.addEventListener('change', function() { sbReverse=this.checked; GM_setValue('pm3_sbReverse',sbReverse); });

  /* Border */
  var sbBorderEl=document.getElementById('sbBorder');
  sbBorderEl.value=sbBorder;
  sbBorderEl.addEventListener('change', function() { sbBorder=this.value; GM_setValue('pm3_sbBorder',sbBorder); });

  /* Auto-Enter checkbox (Label Printer) */
  var fAutoEnterEl=document.getElementById('fAutoEnter');
  if(fAutoEnterEl){
    fAutoEnterEl.checked=fAutoEnter;
    fAutoEnterEl.addEventListener('change', function(){ fAutoEnter=this.checked; GM_setValue('pm3_fAutoEnter',fAutoEnter); });
  }

  /* ═══════════════════════════════════════════════════════
     PRINT MODE TOGGLE
  ═══════════════════════════════════════════════════════ */
    function updateHeaderBrand() {
    var brand = document.getElementById('hdBrand');
    var logo  = document.getElementById('hdLogo');
    if (!brand || !logo) return;
    if (printMode === 'zebra') {
      brand.textContent = 'Zebra';
      brand.className   = 'zb';
      logo.textContent  = 'BZ';
    } else {
      brand.textContent = 'mon 3';
      brand.className   = '';
      logo.textContent  = 'BP';
    }
  }

  function updateModeUI() {
    document.getElementById('modePM').className='pm-mode-btn'+(printMode==='printmon'?' on-pm':'');
    document.getElementById('modeZB').className='pm-mode-btn'+(printMode==='zebra'?' on-zb':'');
    var zc=document.getElementById('sbZebraCard'); if(zc) zc.classList.toggle('dimmed',printMode!=='zebra');
    updateLabelPrinterPanel();
    updateHeaderBrand();
    if(printMode==='zebra'){ var ip=document.getElementById('zPrinterIP').value.trim()||detectedPrinterIP; setStatus(ip?'Zebra mode: '+ip:'Zebra mode active','ok'); }
    else { detectPrintmonIP(); }
  }
  document.getElementById('modePM').addEventListener('click', function() { printMode='printmon'; GM_setValue('pm3_printMode',printMode); updateModeUI(); });
  document.getElementById('modeZB').addEventListener('click', function() { printMode='zebra';    GM_setValue('pm3_printMode',printMode); updateModeUI(); });

  /* ═══════════════════════════════════════════════════════
     WORD WRAP
  ═══════════════════════════════════════════════════════ */
  function wordWrapText(text, charLimit) {
    var allLines=[], paragraphs=text.split('\n');
    for(var p=0;p<paragraphs.length;p++) {
      var line=paragraphs[p].replace(/\s+/g,' ').trim();
      if(!line){allLines.push('');continue;}
      var words=line.split(' '), current='';
      for(var i=0;i<words.length;i++) {
        var word=words[i];
        if(word.length>charLimit) { if(current){allLines.push(current);current='';} while(word.length>charLimit){allLines.push(word.substring(0,charLimit));word=word.substring(charLimit);} if(word) current=word; }
        else if(!current) { current=word; }
        else if((current+' '+word).length<=charLimit) { current+=' '+word; }
        else { allLines.push(current); current=word; }
      }
      if(current) allLines.push(current);
    }
    return allLines;
  }

  /* ═══════════════════════════════════════════════════════
     AUTO-SCALE FONT
     Dev autoconfig: ZEBRA_CONFIG.charWidthRatio and autoScaleStart
     safeW * 0.92 gives breathing room on right edge.
     longestWord guard prevents mid-word splits.
  ═══════════════════════════════════════════════════════ */
  function autoScaleFont(text, labelWidth, labelHeight) {
    var marginX=ZEBRA_CONFIG.marginX, marginY=ZEBRA_CONFIG.marginY, lsPad=ZEBRA_CONFIG.lineSpacingPad;
    var ratio=ZEBRA_CONFIG.charWidthRatio||0.68;
    var startFs=ZEBRA_CONFIG.autoScaleStart||250;
    var usableW=labelWidth-(marginX*2), usableH=labelHeight-(marginY*2);
    var longestWord=0;
    text.split(/\s+/).forEach(function(w){ if(w.length>longestWord) longestWord=w.length; });
    var safeW=usableW*0.92;
    for(var fs=startFs;fs>=18;fs--) {
      var cpl=Math.max(longestWord, Math.floor(safeW/(fs*ratio)));
      var lines=wordWrapText(text,cpl);
      if(lines.length*(fs+lsPad)<=usableH && (longestWord*fs*ratio)<=usableW*0.95) {
        return {fontSize:fs, charsPerLine:cpl};
      }
    }
    return {fontSize:18, charsPerLine:Math.max(longestWord, Math.floor(safeW/(18*ratio)))};
  }

  /* ═══════════════════════════════════════════════════════
     PRINT ROUTER
  ═══════════════════════════════════════════════════════ */
  function sendPrint(barcode, qty, desc, autoEnter) {
    if(printMode==='zebra') sendPrintZebra(barcode,qty,desc,autoEnter);
    else sendPrintPrintmon(barcode,qty,desc,autoEnter);
  }

  /* ═══════════════════════════════════════════════════════
     PRINTMON PRINT
  ═══════════════════════════════════════════════════════ */
  function sendPrintPrintmon(barcode, qty, desc, autoEnter) {
    /* Auto-Enter: encode the scannable data with a trailing carriage return so a
       keyboard-wedge scanner presses Enter after typing the value. The human-readable
       caption (text) keeps the value without the CR. */
    var dataStr=autoEnter ? (barcode+'\r') : barcode;
    var hex=toHex(dataStr), textHex=toHex(barcode), hexDesc=desc?toHex(desc):'';
    var url='http://localhost:5965/printer?action=print&type=barcode'
      +'&data='+encodeURIComponent(hex)+'&text='+encodeURIComponent(textHex)
      +'&quantity='+encodeURIComponent(parseInt(qty))+'&badgeid='+encodeURIComponent('')
      +'&desc='+encodeURIComponent(hexDesc)+'&seq='+encodeURIComponent(seqId());
    setStatus('Sending: '+barcode+' x'+qty+'...','wrn');
    GM_xmlhttpRequest({
      method:'GET', url:url,
      onload:function(res) {
        if(res.responseText==='valid')        { setStatus('Printed: '+barcode+' x'+qty,'ok'); showResult('fRes','Printed: '+barcode+' x'+qty,'ok'); }
        else if(res.responseText==='invalid') { setStatus('Print failed — check printer','err'); showResult('fRes','Failed. Check printer.','err'); }
        else { setStatus('Unexpected response','err'); showResult('fRes','Unexpected response.','err'); }
      },
      onerror:function() { setStatus('Cannot reach Printmon','err'); showResult('fRes','Cannot connect to Printmon.','err'); }
    });
  }

  /* ═══════════════════════════════════════════════════════
     BORDER ZPL BUILDER
  ═══════════════════════════════════════════════════════ */
  function buildBorderZPL(style, lw, lh) {
    var pad=8;
    switch(style) {
      case 'thin':    return '^FO'+pad+','+pad+'\n^GB'+(lw-pad*2)+','+(lh-pad*2)+',2^FS\n';
      case 'thick':   return '^FO'+pad+','+pad+'\n^GB'+(lw-pad*2)+','+(lh-pad*2)+',5^FS\n';
      case 'blackband': {
           var band = 33; /* width of the solid black band in dots — adjust this number, 33 somewhat colides into barcode */
           return '^FO'+pad+','+pad+'\n^GB'+(lw-pad*2)+','+(lh-pad*2)+','+(lh-pad*2)+',B^FS\n'
           + '^FO'+(pad+band)+','+(pad+band)+'\n^GB'+(lw-(pad+band)*2)+','+(lh-(pad+band)*2)+','+(lh-(pad+band)*2)+',W^FS\n';
      }
      case 'rounded': return '^FO'+pad+','+pad+'\n^GB'+(lw-pad*2)+','+(lh-pad*2)+',3,B,8^FS\n';
      case 'dashed': {
        var d='';
        for(var x=pad;x<lw-pad;x+=20){d+='^FO'+x+','+pad+'\n^GB10,1,2^FS\n';d+='^FO'+x+','+(lh-pad)+'\n^GB10,1,2^FS\n';}
        for(var y=pad;y<lh-pad;y+=20){d+='^FO'+pad+','+y+'\n^GB1,10,2^FS\n';d+='^FO'+(lw-pad)+','+y+'\n^GB1,10,2^FS\n';}
        return d;
      }
      default: return '';
    }
  }

  /* ═══════════════════════════════════════════════════════
     ZEBRA BARCODE LABEL
  ═══════════════════════════════════════════════════════ */
  /* Build the ^FD field for a linear barcode, optionally appending a carriage
     return (Auto-Enter). ^FH lets us encode the CR as its hex value (_0d); any
     literal underscore in the data is escaped (_5f) so it prints verbatim. */
  function aeFieldData(data, autoEnter) {
    if(!autoEnter) return '^FD'+data+'^FS';
    return '^FH_\n^FD'+String(data).replace(/_/g,'_5f')+'_0d^FS';
  }
  function buildSidebarBarcodeZPL(data, lw, y, autoEnter) {
    var size=sbBCSize;
    switch(sbBarcodeType) {
      case 'code39':    { var bx=Math.max(10,Math.round((lw-(data.length*16+30))/2)); return {zpl:'^BY2,3\n^FO'+bx+','+y+'\n^B3N,N,'+size+',Y,N\n'+aeFieldData(data,autoEnter)+'\n',h:size+30}; }
      case 'qr':        { var mag=Math.max(2,Math.min(10,size)),qpx=mag*25,qx=Math.max(10,Math.round((lw-qpx)/2)); return {zpl:'^FO'+qx+','+y+'\n^BQN,2,'+mag+'\n^FDMM,A'+data+'^FS\n',h:qpx+10}; }
      case 'datamatrix':{ var ds=Math.max(4,Math.min(20,size)),dpx=ds*10,dx=Math.max(10,Math.round((lw-dpx)/2)); return {zpl:'^FO'+dx+','+y+'\n^BXN,'+ds+',200\n^FD'+data+'^FS\n',h:dpx+10}; }
      case 'ean13':     { var ex=Math.max(10,Math.round((lw-300)/2)); return {zpl:'^BY2,3\n^FO'+ex+','+y+'\n^BEN,'+size+',Y,N\n^FD'+data.substring(0,12)+'^FS\n',h:size+30}; }
      case 'upca':      { var ux=Math.max(10,Math.round((lw-300)/2)); return {zpl:'^BY2,3\n^FO'+ux+','+y+'\n^BUN,'+size+',Y,N\n^FD'+data.substring(0,11)+'^FS\n',h:size+30}; }
      default: { var bm=3,bw=(11+((data.length+1)*11)+11+13)*bm,bx2=Math.max(10,Math.round((lw-bw)/2)); return {zpl:'^BY'+bm+',3\n^FO'+bx2+','+y+'\n^BCN,'+size+',N,N,N\n'+aeFieldData(data,autoEnter)+'\n',h:size+20}; }
    }
  }

  function sendPrintZebra(barcode, qty, desc, autoEnter) {
    var ip=document.getElementById('zPrinterIP').value.trim()||detectedPrinterIP;
    if(!ip){setStatus('No Zebra IP','err');showResult('fRes','No printer IP.','err');return;}
    var profile=ZEBRA_CONFIG.labelProfiles[labelProfile]||ZEBRA_CONFIG.labelProfiles.standard;
    var lw=profile.labelWidth, lh=profile.labelHeight, asinFs=50, badgeFs=28, y=40;
    var zpl='^XA\n'+ZEBRA_CONFIG.characterSet+'\n^PW'+lw+'\n^LL'+lh+'\n';
      zpl+=buildBorderZPL(sbBorder,lw,lh);
    var bc=buildSidebarBarcodeZPL(barcode,lw,y,autoEnter); zpl+=bc.zpl; y+=bc.h;
    var textX=Math.max(ZEBRA_CONFIG.marginX, Math.round((lw-(barcode.length*asinFs*0.6))/2));
      zpl+='^FO'+textX+','+y+'\n^'+ZEBRA_CONFIG.font+','+asinFs+','+asinFs+'\n^FD'+barcode+'^FS\n'; y+=asinFs+8;
    var badge=getCookieVal('fcmenu-employeeId')||'';
      if(badge){
    var badgeX=Math.max(ZEBRA_CONFIG.marginX, Math.round((lw-(badge.length*badgeFs*0.6))/2));
      zpl+='^FO'+badgeX+','+y+'\n^'+ZEBRA_CONFIG.font+','+badgeFs+','+badgeFs+'\n^FD'+badge+'^FS\n';y+=badgeFs+10;
  }

    if(desc&&desc!=='No Title Found'){
      var df,cl;
      if(sbDescMode==='auto'){
        var rules=ZEBRA_DESC_RULES[labelProfile]||ZEBRA_DESC_RULES.standard,rule=rules[rules.length-1];
        for(var r=0;r<rules.length;r++){if(desc.length<=rules[r].maxChars){rule=rules[r];break;}}
        df=rule.fontSize;cl=rule.charsPerLine;
      } else {df=sbDescFont;cl=Math.max(1,Math.floor((lw-40)/(df*0.6)));}
      var ls=df+5,maxL=Math.max(1,Math.floor((lh-y-40)/ls)),dlines=wordWrapText(desc,cl);
      if(dlines.length>maxL){dlines=dlines.slice(0,maxL);var dl=dlines[dlines.length-1];if(dl.length>3)dlines[dlines.length-1]=dl.substring(0,dl.length-3)+'...';}
        for(var i=0;i<dlines.length;i++){
    var dlineX=Math.max(ZEBRA_CONFIG.marginX, Math.round((lw-(dlines[i].length*df*0.6))/2));
    zpl+='^FO'+dlineX+','+y+'\n^'+ZEBRA_CONFIG.font+','+df+','+df+'\n^FD'+dlines[i]+'^FS\n';
    y+=ls;
  }
    }
    zpl+='^XZ';
    qty=Math.max(1,Math.min(qty||1,ZEBRA_CONFIG.maxQty));
    var fullZpl='',endpoints=ZEBRA_CONFIG.endpoints.map(function(ep){return 'http://'+ip+ep;});
    for(var q=0;q<qty;q++) fullZpl+=zpl+'\n';
    setStatus('Sending to Zebra: '+barcode+' x'+qty+'...','wrn');
    (function tryNext(idx){
      if(idx>=endpoints.length){setStatus('Ready','ok');return;}
      var raw=/:9100/.test(endpoints[idx]);
      GM_xmlhttpRequest({
        method:'POST',url:endpoints[idx],data:fullZpl,headers:{'Content-Type':'text/plain'},timeout:ZEBRA_CONFIG.timeout,
        onload:    function(r){if(r.status>=200&&r.status<400||raw){setStatus('Printed: '+barcode+' x'+qty,'ok');showResult('fRes','Printed '+qty+' label(s)','ok');}else tryNext(idx+1);},
        onerror:   function() {if(raw){setStatus('Printed: '+barcode+' x'+qty,'ok');showResult('fRes','Printed '+qty+' label(s)','ok');}else tryNext(idx+1);},
        ontimeout: function() {if(raw){setStatus('Printed: '+barcode+' x'+qty,'ok');showResult('fRes','Printed '+qty+' label(s)','ok');}else tryNext(idx+1);}
      });
    })(0);
  }

  /* ═══════════════════════════════════════════════════════
     TEXT-ONLY ZPL BUILDER
     Flow: uses flowCharsPerLine from DEV CONFIG + sbFontSize slider.
     Auto: autoScaleFont with safety margins and longest-word guard.
     Manual: sbFontSize + sbCharLimit sliders directly.
  ═══════════════════════════════════════════════════════ */
  function buildTextZPL(text) {
    if(!text) return null;
    var profile=ZEBRA_CONFIG.labelProfiles[labelProfile]||ZEBRA_CONFIG.labelProfiles.standard;
    var lw=profile.labelWidth, lh=profile.labelHeight;
    var marginX=ZEBRA_CONFIG.marginX, marginY=ZEBRA_CONFIG.marginY;
    var blockW=lw-(marginX*2), lsPad=ZEBRA_CONFIG.lineSpacingPad;
    var fontSize, charsPerLine;

        if(sbAlignment==='F' && sbAutoMode) {
      /* Flow + Auto: auto-scale font size, wrap at flowCharsPerLine */
      var scaledFlow = autoScaleFont(text, lw, lh);
      fontSize     = scaledFlow.fontSize;
      charsPerLine = ZEBRA_CONFIG.flowCharsPerLine || 45;
    } else if(sbAlignment==='F') {
      /* Flow manual: use size slider, wrap at flowCharsPerLine */
      fontSize     = sbFontSize;
      charsPerLine = ZEBRA_CONFIG.flowCharsPerLine || 45;
    } else if(sbAutoMode) {
      /* Auto non-flow: full auto-scale */
      var scaled   = autoScaleFont(text,lw,lh);
      fontSize     = scaled.fontSize;
      charsPerLine = scaled.charsPerLine;
    } else {
      /* Manual: use sliders */
      fontSize     = sbFontSize;
      charsPerLine = sbCharLimit;
    }


    var lineH=fontSize+lsPad, y=marginY, lines=wordWrapText(text,charsPerLine);
    var maxLines=Math.max(1,Math.floor((lh-y-30)/lineH));
    if(lines.length>maxLines){lines=lines.slice(0,maxLines);var last=lines[lines.length-1];if(last.length>3)lines[lines.length-1]=last.substring(0,last.length-3)+'...';}
    var fr=sbReverse?'^FR\n':'';
    var zpl='^XA\n'+ZEBRA_CONFIG.characterSet+'\n^PW'+lw+'\n^LL'+lh+'\n';
    zpl+=buildBorderZPL(sbBorder,lw,lh);
    if(sbReverse) zpl+='^FO0,0\n^GB'+lw+','+lh+','+lh+',,0^FS\n';

    var ratio=ZEBRA_CONFIG.charWidthRatio||0.68;
    for(var i=0;i<lines.length;i++){
      if(lines[i]===''){y+=Math.round(lineH*ZEBRA_CONFIG.blankLineRatio);continue;}
      var xPos=marginX;
      if(sbAlignment==='F'){
        xPos=marginX;
      } else {
        var lineLen=Math.round(lines[i].length*fontSize*ratio);
        if(sbAlignment==='C') xPos=Math.max(marginX,Math.round((lw-lineLen)/2));
        if(sbAlignment==='R') xPos=Math.max(marginX,lw-marginX-lineLen);
      }
      zpl+='^FO'+xPos+','+y+'\n^'+ZEBRA_CONFIG.font+','+fontSize+','+fontSize+'\n';
      zpl+=fr+'^FD'+lines[i]+'^FS\n';
      y+=lineH;
    }
    zpl+='^XZ'; return zpl;
  }

  /* ═══════════════════════════════════════════════════════
     SEND TO ZEBRA (shared)
  ═══════════════════════════════════════════════════════ */
  function sendToZebra(zpl, quantity, resultElId, callback) {
    var ip=document.getElementById('zPrinterIP').value.trim()||detectedPrinterIP;
    if(!ip){if(callback)callback(false,'No printer IP.');return;}
    var qty=Math.max(1,Math.min(quantity||1,ZEBRA_CONFIG.maxQty));
    var fullZpl='',endpoints=ZEBRA_CONFIG.endpoints.map(function(ep){return 'http://'+ip+ep;});
    for(var i=0;i<qty;i++) fullZpl+=zpl+'\n';
    (function tryNext(idx){
      if(idx>=endpoints.length){if(callback)callback(false,'');return;}
      var raw=/:9100/.test(endpoints[idx]);
      GM_xmlhttpRequest({
        method:'POST',url:endpoints[idx],data:fullZpl,headers:{'Content-Type':'text/plain'},timeout:ZEBRA_CONFIG.timeout,
        onload:    function(r){if(r.status>=200&&r.status<400||raw){if(resultElId)showResult(resultElId,'Printed '+qty+' label(s)','ok');if(callback)callback(true,'Printed '+qty+' label(s)');}else tryNext(idx+1);},
        onerror:   function() {if(raw){if(resultElId)showResult(resultElId,'Printed '+qty+' label(s)','ok');if(callback)callback(true,'Printed '+qty+' label(s)');}else tryNext(idx+1);},
        ontimeout: function() {if(raw){if(resultElId)showResult(resultElId,'Printed '+qty+' label(s)','ok');if(callback)callback(true,'Printed '+qty+' label(s)');}else tryNext(idx+1);}
      });
    })(0);
  }

  /* ═══════════════════════════════════════════════════════
     QUICK ACTIONS
  ═══════════════════════════════════════════════════════ */
  function updateQAModeUI() {
    document.getElementById('swPrint').className   = 'pm-mode2-btn'+(qaMode==='print'  ?' on-print':'');
    document.getElementById('swBarcode').className = 'pm-mode2-btn'+(qaMode==='barcode'?' on-barcode':'');
    if(qaMode!=='print'){
      selectedPresets=[];
      var bar=document.getElementById('qaSelectBar'); if(bar) bar.classList.remove('visible');
    }
    render();
  }
  document.getElementById('swPrint').addEventListener('click',   function(){ qaMode='print';   GM_setValue('pm3_qaMode',qaMode); updateQAModeUI(); });
  document.getElementById('swBarcode').addEventListener('click', function(){ qaMode='barcode'; GM_setValue('pm3_qaMode',qaMode); updateQAModeUI(); });

    document.getElementById('qaSelectPrint').addEventListener('click', function() {
    if(!selectedPresets.length){showResult('qaRes','No buttons selected.','err');return;}
    var qty=Math.max(1,Math.min(parseInt(document.getElementById('qaSelectQty').value)||1,ZEBRA_CONFIG.maxQty));
    var ip=document.getElementById('zPrinterIP').value.trim()||detectedPrinterIP;
    setStatus('Printing '+selectedPresets.length+' labels x'+qty+'...','wrn');
    showResult('qaRes','Sending '+selectedPresets.length+' label(s) x'+qty+'...','ok');

    if(printMode==='zebra') {
      /* Zebra — fire all jobs at once, no waiting between them */
      var count=0;
      selectedPresets.forEach(function(text) {
        var zpl = labelType==='text' ? buildTextZPL(text) : null;
        if(labelType!=='text') {
          sendPrint(text,qty,'');
          count++;
        } else if(zpl) {
          sendToZebra(zpl,qty,null,function(){});
          count++;
        }
      });
      setStatus('Sent '+count+' label(s) to Zebra','ok');
      showResult('qaRes','Printed '+count+' label(s) x'+qty,'ok');
    } else {
      /* Printmon — sequential with delay  */
      var idx=0;
      (function nextSel(){
        if(idx>=selectedPresets.length){
          setStatus('Done! Printed '+selectedPresets.length+' labels','ok');
          showResult('qaRes','Printed '+selectedPresets.length+' label(s) x'+qty,'ok');
          return;
        }
        var text=selectedPresets[idx]; idx++;
        sendPrint(text,qty,'');
        setTimeout(nextSel,PRINTMON_CONFIG.bulkDelay);
      })();
    }
  });


  document.getElementById('qaSelectClear').addEventListener('click', function() {
    selectedPresets=[];
    document.querySelectorAll('#pCon .pm-pb').forEach(function(b){
      b.classList.remove('selected');
      var chk=b.querySelector('.pm-pb-chk'); if(chk) chk.checked=false;
    });
    updateSelectBar();
  });

  function updateSelectBar() {
    var bar=document.getElementById('qaSelectBar'), lbl=document.getElementById('qaSelectLabel');
    if(!bar||!lbl) return;
    lbl.textContent=selectedPresets.length+' selected';
    bar.classList.toggle('visible',selectedPresets.length>0);
  }

  function save() { GM_setValue('presetButtons', presets); }

  function render() {
    var c=document.getElementById('pCon'); c.innerHTML='';
    if(!presets.length){c.innerHTML='<div class="pm-pg-empty">No presets yet. Add one below.</div>';return;}

    if(qaMode==='barcode'){
      presets.forEach(function(text,i){
        var el=document.createElement('div'); el.className='pm-bi';
        el.innerHTML=['<div class="pm-bi-top">','<span class="pm-bi-lbl">'+esc(text)+'</span>','<div class="pm-bi-acts">','<button class="pm-bi-act js-focus" title="Focus">F</button>','<button class="pm-bi-act del js-del" title="Delete">X</button>','</div></div>','<svg class="pm-bc"></svg>'].join('');
        c.appendChild(el);
        try{JsBarcode(el.querySelector('.pm-bc'),text,{format:'CODE128',width:2,height:50,displayValue:false,margin:5});}
        catch(e){el.querySelector('.pm-bi-lbl').textContent=text+' (invalid barcode)';}
        el.querySelector('.js-focus').addEventListener('click',function(){
          var all=document.querySelectorAll('.pm-bi'),active=el.classList.contains('hl');
          all.forEach(function(n){n.classList.remove('hl','dim');});
          if(!active){all.forEach(function(n){if(n!==el)n.classList.add('dim');});el.classList.add('hl');}
        });
        el.querySelector('.js-del').addEventListener('click',function(){
          if(confirm('Delete "'+text+'"?')){presets.splice(i,1);save();render();}
        });
      });
      return;
    }

    presets.forEach(function(text,i){
      var isChecked=selectedPresets.indexOf(text)!==-1;
      var btn=document.createElement('div');
      btn.className='pm-pb'+(isChecked?' selected':'');
      btn.innerHTML=[
        '<span class="pm-pb-lf">',
        '<input type="checkbox" class="pm-pb-chk" style="accent-color:var(--purple-h);cursor:pointer;width:13px;height:13px;flex-shrink:0"'+(isChecked?' checked':'')+'>',
        '<span class="pm-pb-ic">'+esc(text.charAt(0).toUpperCase())+'</span>',
        esc(text),
        '</span>',
        '<span class="pm-pb-x js-del" title="Delete">×</span>'
      ].join('');
      c.appendChild(btn);

      btn.querySelector('.pm-pb-chk').addEventListener('change',function(e){
        e.stopPropagation();
        var idx2=selectedPresets.indexOf(text);
        if(this.checked){if(idx2===-1)selectedPresets.push(text);btn.classList.add('selected');}
        else{if(idx2!==-1)selectedPresets.splice(idx2,1);btn.classList.remove('selected');}
        updateSelectBar();
      });

      btn.addEventListener('click',function(e){
        if(e.target.closest('.js-del')) return;
        if(e.target.classList.contains('pm-pb-chk')) return;
        if(printMode==='zebra'&&labelType==='text'){
          var ip=document.getElementById('zPrinterIP').value.trim()||detectedPrinterIP;
          if(!ip){showResult('qaRes','No Zebra printer IP set in sidebar.','err');return;}
          var zpl=buildTextZPL(text); if(!zpl) return;
          setStatus('Text label: '+text,'wrn');
          sendToZebra(zpl,1,'qaRes',function(success){if(success)setStatus('Printed: '+text,'ok');});
        } else { sendPrint(text,1,''); }
      });

      btn.querySelector('.js-del').addEventListener('click',function(e){
        e.stopPropagation();
        var si=selectedPresets.indexOf(text); if(si!==-1)selectedPresets.splice(si,1);
        presets.splice(i,1);save();render();updateSelectBar();
      });
    });
  }

  document.getElementById('pAdd').addEventListener('click', addPreset);
  document.getElementById('pNew').addEventListener('keydown',function(e){if(e.key==='Enter')addPreset();});
  function addPreset(){
    var input=document.getElementById('pNew'), val=input.value.trim();
    if(!val){alert('Enter text for the button.');return;}
    presets.push(val);save();render();input.value='';input.focus();
  }

  /* ═══════════════════════════════════════════════════════
     AUTO-FETCH TITLE
  ═══════════════════════════════════════════════════════ */
  var fetchTimeout=null, lastFetched='';
  function autoFetchTitle(){
    var raw=document.getElementById('fBar').value.trim(), barcode=raw.split('\n')[0].trim();
    if(!barcode||barcode.length<5||barcode===lastFetched) return;
    if(!/^[BX][A-Z0-9]{9}$/i.test(barcode)) return;
    lastFetched=barcode; setStatus('Fetching title for '+barcode+'...','wrn');
    GM_xmlhttpRequest({
      method:'GET', url:'https://fcresearch-na.aka.amazon.com/CMH2/results/product?s='+encodeURIComponent(barcode),
      onload:function(res){
        if(res.status!==200){setStatus('Title fetch failed','wrn');return;}
        var doc=new DOMParser().parseFromString(res.responseText,'text/html'), rows=doc.querySelectorAll('tr');
        for(var r=0;r<rows.length;r++){
          var th=rows[r].querySelector('th');
          if(th&&th.textContent.trim()==='Title'){
            var a=rows[r].querySelector('td a');
            if(a){var title=a.textContent.trim();document.getElementById('fTitle').value=title;setStatus('Title: '+title.substring(0,50)+(title.length>50?'...':''),'ok');return;}
          }
        }
        setStatus('No title found for '+barcode,'wrn');
      },
      onerror:function(){setStatus('Title fetch error','wrn');}
    });
  }
  var fBarEl=document.getElementById('fBar');
  fBarEl.addEventListener('blur',autoFetchTitle);
  fBarEl.addEventListener('input',function(){
    clearTimeout(fetchTimeout);
    if(!this.value.trim().includes('\n')&&this.value.trim().length>=10) fetchTimeout=setTimeout(autoFetchTitle,1000);
  });
  fBarEl.addEventListener('keydown',function(e){
    if(e.key==='Enter'&&!e.ctrlKey&&!e.shiftKey){if(!this.value.includes('\n')){clearTimeout(fetchTimeout);fetchTimeout=setTimeout(autoFetchTitle,200);}}
    if(e.key==='Enter'&&e.ctrlKey){e.preventDefault();document.getElementById('fPrint').click();}
  });

  /* ═══════════════════════════════════════════════════════
     LABEL PRINTER — PRINT SUBMIT
  ═══════════════════════════════════════════════════════ */
  document.getElementById('fPrint').addEventListener('click',function(){
    var qty=parseInt(document.getElementById('fQty').value);
    if(isNaN(qty)||qty<1||qty>PRINTMON_CONFIG.maxQty){alert('Quantity must be 1–'+PRINTMON_CONFIG.maxQty+'.');return;}
    if(labelType==='text'){
      if(printMode!=='zebra'){showResult('fRes','Text labels require Zebra mode.','err');return;}
      var text=document.getElementById('lpText').value.trim();
      if(!text){alert('Enter text to print.');return;}
      var ip=document.getElementById('zPrinterIP').value.trim()||detectedPrinterIP;
      if(!ip){showResult('fRes','No printer IP configured.','err');return;}
      var zpl=buildTextZPL(text);
      if(!zpl){showResult('fRes','Failed to build label.','err');return;}
      setStatus('Sending text label...','wrn'); showResult('fRes','Sending '+qty+' label(s)...','ok');
      sendToZebra(zpl,qty,'fRes',function(success){if(success)setStatus('Text label printed x'+qty,'ok');});
      return;
    }
    var raw=document.getElementById('fBar').value.trim();
    if(!raw){alert('Enter a barcode.');return;}
    var desc=document.getElementById('fTitle').value.trim();
    var ae=document.getElementById('fAutoEnter').checked;
    var lines=raw.split('\n').map(function(l){return l.trim();}).filter(function(l){return l.length>0;});
    if(lines.length===1){sendPrint(lines[0],qty,desc,ae);}
    else {
      setStatus('Printing '+lines.length+' labels...','wrn'); showResult('fRes','Sending '+lines.length+' x'+qty+'...','ok');
      var i=0;
      (function next(){
        if(i>=lines.length){setStatus('Done! Printed '+lines.length+' labels','ok');showResult('fRes','Printed '+lines.length+' labels x'+qty,'ok');return;}
        sendPrint(lines[i],qty,desc,ae);i++;setTimeout(next,PRINTMON_CONFIG.bulkDelay);
      })();
    }
  });

  document.getElementById('fClear').addEventListener('click',function(){
    document.getElementById('fBar').value=''; document.getElementById('fTitle').value='';
    document.getElementById('lpText').value=''; document.getElementById('fQty').value=String(PRINTMON_CONFIG.defaultQty);
    document.getElementById('fRes').className='pm-res'; lastFetched='';
  });
  document.getElementById('lpText').addEventListener('keydown',function(e){
    if(e.key==='Enter'&&e.ctrlKey){e.preventDefault();document.getElementById('fPrint').click();}
  });

  /* ═══════════════════════════════════════════════════════
     ZPL LAB
  ═══════════════════════════════════════════════════════ */
  document.getElementById('labFont').addEventListener('input',function(){document.getElementById('labFontVal').textContent=this.value;});
  document.getElementById('labBCHeight').addEventListener('input',function(){document.getElementById('labBCHVal').textContent=this.value;});

  function buildLabBarcodeZPL(type,data,x,y,height,orient,fr){
    switch(type){
      case 'code128':{var mod=3,bw=(11+(data.length*11)+11+13)*mod,bx=Math.max(10,Math.round((812-bw)/2));return '^BY'+mod+',3\n^FO'+bx+','+y+'\n'+fr+'^BC'+orient+','+height+',Y,N,N\n^FD'+data+'^FS\n';}
      case 'code39':  return '^BY2,3\n^FO'+x+','+y+'\n'+fr+'^B3'+orient+',N,'+height+',Y,N\n^FD'+data+'^FS\n';
      case 'qr':     {var mag=Math.max(2,Math.min(10,Math.round(height/20)));return '^FO'+x+','+y+'\n'+fr+'^BQN,2,'+mag+'\n^FDMM,A'+data+'^FS\n';}
      case 'datamatrix':{var rows=Math.max(4,Math.min(20,Math.round(height/10)));return '^FO'+x+','+y+'\n'+fr+'^BXN,'+rows+',200\n^FD'+data+'^FS\n';}
      case 'ean13':   return '^BY2,3\n^FO'+x+','+y+'\n'+fr+'^BE'+orient+','+height+',Y,N\n^FD'+data.substring(0,12)+'^FS\n';
      case 'upca':    return '^BY2,3\n^FO'+x+','+y+'\n'+fr+'^BU'+orient+','+height+',Y,N\n^FD'+data.substring(0,11)+'^FS\n';
      default: return '';
    }
  }

  function buildLabZPL(){
    var text=document.getElementById('labText').value.trim();
    var bcType=document.getElementById('labBarcodeType').value;
    var border=document.getElementById('labBorder').value;
    var layout=document.getElementById('labLayout').value;
    var fontSize=parseInt(document.getElementById('labFont').value);
    var bcHeight=parseInt(document.getElementById('labBCHeight').value);
    var reverse=document.getElementById('labReverse').checked;
    var mirror=document.getElementById('labMirror').checked;
    var rotate=document.getElementById('labRotate').checked;
    var addDate=document.getElementById('labDate').checked;
    if(!text) return null;
    var lw=812,lh=609,orient=rotate?'R':'N',fr=reverse?'^FR\n':'';
    var zpl='^XA\n^CI28\n^PW'+lw+'\n^LL'+lh+'\n';
    if(mirror) zpl+='^POI\n';
    zpl+=buildBorderZPL(border,lw,lh);
    if(reverse) zpl+='^FO0,0\n^GB'+lw+','+lh+','+lh+',,0^FS\n';
    var y=30,cw=lw-60;
    if(layout==='dual'){
      zpl+='^BY2,3\n^FO30,'+y+'\n'+fr+'^BCN,'+bcHeight+',Y,N,N\n^FD'+text+'^FS\n';
      zpl+='^FO580,'+y+'\n'+fr+'^BQN,2,5\n^FDMM,A'+text+'^FS\n'; y+=bcHeight+40;
      wordWrapText(text,Math.floor(cw/(fontSize*0.6))).forEach(function(l){if(y<lh-40){zpl+='^FO30,'+y+'\n'+fr+'^A0'+orient+','+fontSize+','+fontSize+'\n^FD'+l+'^FS\n';y+=fontSize+5;}});
    } else if(layout==='side'){
      var hw=Math.floor(lw/2); zpl+=buildLabBarcodeZPL(bcType,text,30,y,bcHeight,orient,fr); var ty=y;
      wordWrapText(text,Math.max(5,Math.floor((hw-40)/(fontSize*0.6)))).forEach(function(l){if(ty<lh-40){zpl+='^FO'+(hw+20)+','+ty+'\n'+fr+'^A0'+orient+','+fontSize+','+fontSize+'\n^FD'+l+'^FS\n';ty+=fontSize+5;}});
    } else if(layout==='textonly'){
      var tl=wordWrapText(text,Math.max(5,Math.floor(cw/(fontSize*0.6))));
      y=Math.max(30,Math.floor((lh-tl.length*(fontSize+5))/2));
      tl.forEach(function(l){if(y<lh-40){zpl+='^FO30,'+y+'\n'+fr+'^A0'+orient+','+fontSize+','+fontSize+'\n^FB'+cw+',1,0,C,0\n^FD'+l+'^FS\n';y+=fontSize+5;}});
    } else {
      if(bcType!=='none'){zpl+=buildLabBarcodeZPL(bcType,text,30,y,bcHeight,orient,fr);y+=bcHeight+(bcType==='qr'||bcType==='datamatrix'?20:40);}
      wordWrapText(text,Math.max(5,Math.floor(cw/(fontSize*0.6)))).forEach(function(l){if(y<lh-60){zpl+='^FO30,'+y+'\n'+fr+'^A0'+orient+','+fontSize+','+fontSize+'\n^FD'+l+'^FS\n';y+=fontSize+5;}});
    }
    if(addDate){
      var now=new Date();
      var ds=(now.getMonth()+1)+'/'+now.getDate()+'/'+now.getFullYear()+' '+String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
      zpl+='^FO30,'+(lh-35)+'\n'+fr+'^A0N,18,18\n^FD'+ds+'^FS\n';
    }
    zpl+='^XZ'; return zpl;
  }

  document.getElementById('labPrint').addEventListener('click',function(){
    var zpl=buildLabZPL(); if(!zpl){showResult('labRes','Enter text first.','err');return;}
    var qty=Math.max(1,Math.min(parseInt(document.getElementById('labQty').value)||1,50));
    var ip=document.getElementById('zPrinterIP').value.trim()||detectedPrinterIP;
    if(!ip){showResult('labRes','No printer IP in sidebar.','err');return;}
    setStatus('Sending lab label...','wrn'); showResult('labRes','Sending '+qty+' label(s)...','ok');
    var fullZpl='',endpoints=ZEBRA_CONFIG.endpoints.map(function(ep){return 'http://'+ip+ep;});
    for(var i=0;i<qty;i++) fullZpl+=zpl+'\n';
    (function tryNext(idx){
      if(idx>=endpoints.length){setStatus('Zebra unreachable','err');showResult('labRes','Cannot reach printer at '+ip,'err');return;}
      var raw=/:9100/.test(endpoints[idx]);
      GM_xmlhttpRequest({
        method:'POST',url:endpoints[idx],data:fullZpl,headers:{'Content-Type':'text/plain'},timeout:ZEBRA_CONFIG.timeout,
        onload:    function(r){if(r.status>=200&&r.status<400||raw){setStatus('Lab printed x'+qty,'ok');showResult('labRes','Printed '+qty+' label(s)','ok');}else tryNext(idx+1);},
        onerror:   function() {if(raw){setStatus('Lab printed x'+qty,'ok');showResult('labRes','Printed '+qty+' label(s)','ok');}else tryNext(idx+1);},
        ontimeout: function() {if(raw){setStatus('Lab printed x'+qty,'ok');showResult('labRes','Printed '+qty+' label(s)','ok');}else tryNext(idx+1);}
      });
    })(0);
  });

  document.getElementById('labPreview').addEventListener('click',function(){
    var zpl=buildLabZPL(); if(!zpl){showResult('labRes','Enter text first.','err');return;}
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(zpl).then(function(){showResult('labRes','ZPL copied! Paste into labelary.com/viewer.html','ok');});
    } else {
      var ta=document.createElement('textarea'); ta.value=zpl; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      showResult('labRes','ZPL copied! Paste into labelary.com/viewer.html','ok');
    }
  });

  document.getElementById('labClear').addEventListener('click',function(){
    ['labText','labBarcodeType','labBorder','labLayout'].forEach(function(id){
      document.getElementById(id).value=id==='labBarcodeType'?'code128':id==='labBorder'?'none':id==='labLayout'?'standard':'';
    });
    document.getElementById('labFont').value='40'; document.getElementById('labFontVal').textContent='40';
    document.getElementById('labBCHeight').value='90'; document.getElementById('labBCHVal').textContent='90';
    document.getElementById('labQty').value='1';
    ['labReverse','labMirror','labRotate','labDate'].forEach(function(id){document.getElementById(id).checked=false;});
    document.getElementById('labRes').className='pm-res';
  });
  document.getElementById('labText').addEventListener('keydown',function(e){
    if(e.key==='Enter'&&e.ctrlKey){e.preventDefault();document.getElementById('labPrint').click();}
  });

  /* ═══════════════════════════════════════════════════════
     AUTO-ENTER BARCODES
     A scannable barcode that ends with a carriage return (CR) so a
     keyboard-wedge scanner presses Enter after typing the value.
     Zebra: Code128 with the CR hex-encoded via ^FH (_0d).
     Printmon: the CR is appended to the encoded data string.
  ═══════════════════════════════════════════════════════ */
  function buildAutoEnterZPL(data, caption) {
    var profile=ZEBRA_CONFIG.labelProfiles[labelProfile]||ZEBRA_CONFIG.labelProfiles.standard;
    var lw=profile.labelWidth, lh=profile.labelHeight;
    var y=40, mod=3, bcH=120;
    var zpl='^XA\n'+ZEBRA_CONFIG.characterSet+'\n^PW'+lw+'\n^LL'+lh+'\n';
    zpl+=buildBorderZPL(sbBorder,lw,lh);
    var approxChars=String(data).length+1; /* +1 for the CR */
    var bw=(11+(approxChars*11)+11+13)*mod;
    var bx=Math.max(10,Math.round((lw-bw)/2));
    zpl+='^BY'+mod+',3\n^FO'+bx+','+y+'\n^BCN,'+bcH+',N,N,N\n'+aeFieldData(data,true)+'\n';
    y+=bcH+24;
    var cap=caption||(data||'ENTER');
    var capFs=52;
    var capX=Math.max(ZEBRA_CONFIG.marginX, Math.round((lw-(cap.length*capFs*0.6))/2));
    zpl+='^FO'+capX+','+y+'\n^'+ZEBRA_CONFIG.font+','+capFs+','+capFs+'\n^FD'+cap+'^FS\n';
    zpl+='^XZ';
    return zpl;
  }
  function printAutoEnterList(lines, qty, resId) {
    if(!lines.length) return;
    if(printMode==='zebra'){
      var ip=document.getElementById('zPrinterIP').value.trim()||detectedPrinterIP;
      if(!ip){ showResult(resId,'No Zebra printer IP set in sidebar.','err'); return; }
      setStatus('Printing '+lines.length+' auto-enter barcode(s)...','wrn');
      lines.forEach(function(d){ sendToZebra(buildAutoEnterZPL(d, d||'ENTER'), qty, null, function(){}); });
      setStatus('Sent '+lines.length+' auto-enter label(s)','ok');
      showResult(resId,'Printed '+lines.length+' auto-enter barcode(s) x'+qty,'ok');
    } else {
      setStatus('Printing '+lines.length+' auto-enter barcode(s)...','wrn');
      var i=0;
      (function next(){
        if(i>=lines.length){ setStatus('Done! '+lines.length+' auto-enter barcode(s)','ok'); showResult(resId,'Printed '+lines.length+' auto-enter barcode(s) x'+qty,'ok'); return; }
        sendPrintPrintmon(lines[i], qty, '', true); i++; setTimeout(next, PRINTMON_CONFIG.bulkDelay);
      })();
    }
  }
  document.getElementById('aeEnterPrint').addEventListener('click', function(){
    var qty=Math.max(1,Math.min(parseInt(document.getElementById('aeEnterQty').value)||1,50));
    printAutoEnterList([''], qty, 'aeRes'); /* '' => barcode carrying only a CR */
  });
  document.getElementById('aePrint').addEventListener('click', function(){
    var raw=document.getElementById('aeData').value.trim();
    if(!raw){ showResult('aeRes','Enter data first.','err'); return; }
    var qty=Math.max(1,Math.min(parseInt(document.getElementById('aeQty').value)||1,50));
    var lines=raw.split('\n').map(function(l){return l.trim();}).filter(function(l){return l.length>0;});
    if(!lines.length){ showResult('aeRes','Enter data first.','err'); return; }
    printAutoEnterList(lines, qty, 'aeRes');
  });
  document.getElementById('aeData').addEventListener('keydown', function(e){
    if(e.key==='Enter'&&e.ctrlKey){ e.preventDefault(); document.getElementById('aePrint').click(); }
  });

  /* ═══════════════════════════════════════════════════════
     IMAGE PRINTING
     Raster an uploaded/pasted/dropped image to 1-bit and print it as a
     ZPL ^GFA graphic. Set bits (1) print black. Uses the Zebra IP path.
  ═══════════════════════════════════════════════════════ */
  (function initImageTab(){
    var drop=document.getElementById('imgDrop');
    if(!drop) return;
    var srcImg=null;
    var fileInput=document.getElementById('imgFile');
    var canvas=document.getElementById('imgCanvas');
    var previewWrap=document.getElementById('imgPreviewWrap');
    var controls=document.getElementById('imgControls');
    var dimsEl=document.getElementById('imgDims');
    var wSlider=document.getElementById('imgWidth'),  wVal=document.getElementById('imgWidthVal');
    var tSlider=document.getElementById('imgThresh'), tVal=document.getElementById('imgThreshVal');
    var ditherEl=document.getElementById('imgDither'), invertEl=document.getElementById('imgInvert'), rotateEl=document.getElementById('imgRotate');

    function loadDataURL(url){
      var im=new Image();
      im.onload=function(){ srcImg=im; previewWrap.style.display='block'; controls.style.display='block'; document.getElementById('imgRes').className='pm-res'; render(); };
      im.onerror=function(){ showResult('imgRes','Could not load that image.','err'); };
      im.src=url;
    }
    function loadFile(file){
      if(!file||!/^image\//.test(file.type||'')){ showResult('imgRes','That is not an image file.','err'); return; }
      var fr=new FileReader();
      fr.onload=function(){ loadDataURL(fr.result); };
      fr.onerror=function(){ showResult('imgRes','Could not read that file.','err'); };
      fr.readAsDataURL(file);
    }

    drop.addEventListener('click', function(){ fileInput.click(); });
    fileInput.addEventListener('change', function(){ if(this.files&&this.files[0]) loadFile(this.files[0]); this.value=''; });
    drop.addEventListener('dragover', function(e){ e.preventDefault(); drop.classList.add('drag'); });
    drop.addEventListener('dragleave', function(){ drop.classList.remove('drag'); });
    drop.addEventListener('drop', function(e){ e.preventDefault(); drop.classList.remove('drag'); if(e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]); });
    document.addEventListener('paste', function(e){
      var panel=document.getElementById('panel-image');
      if(!panel||!panel.classList.contains('active')) return;
      var items=(e.clipboardData&&e.clipboardData.items)||[];
      for(var i=0;i<items.length;i++){ if(items[i].type&&items[i].type.indexOf('image')===0){ var f=items[i].getAsFile(); if(f){ loadFile(f); e.preventDefault(); return; } } }
    });

    /* Rasterize current image + settings to a 1-bit map. 1 = black dot. */
    function process(){
      if(!srcImg) return null;
      var rotate=rotateEl.checked;
      var natW=srcImg.naturalWidth||srcImg.width, natH=srcImg.naturalHeight||srcImg.height;
      if(!natW||!natH) return null;
      var srcW=rotate?natH:natW, srcH=rotate?natW:natH;
      var targetW=Math.max(8, parseInt(wSlider.value)||812);
      var w=targetW, h=Math.max(1, Math.round(srcH*(targetW/srcW)));
      var off=document.createElement('canvas'); off.width=w; off.height=h;
      var octx=off.getContext('2d');
      octx.fillStyle='#fff'; octx.fillRect(0,0,w,h);
      octx.save();
      if(rotate){ octx.translate(w,0); octx.rotate(Math.PI/2); octx.drawImage(srcImg,0,0,h,w); }
      else { octx.drawImage(srcImg,0,0,w,h); }
      octx.restore();
      var d=octx.getImageData(0,0,w,h).data, n=w*h;
      var thresh=parseInt(tSlider.value)||128, dither=ditherEl.checked, invert=invertEl.checked;
      var gray=new Float32Array(n);
      for(var i=0;i<n;i++){ var a=d[i*4+3]; gray[i]=a<128?255:(0.299*d[i*4]+0.587*d[i*4+1]+0.114*d[i*4+2]); }
      var bits=new Uint8Array(n);
      if(dither){
        for(var yy=0;yy<h;yy++){ for(var xx=0;xx<w;xx++){ var idx=yy*w+xx, oldp=gray[idx], newp=oldp<thresh?0:255, err=oldp-newp; bits[idx]=newp<128?1:0;
          if(xx+1<w) gray[idx+1]+=err*7/16;
          if(yy+1<h){ if(xx>0) gray[idx+w-1]+=err*3/16; gray[idx+w]+=err*5/16; if(xx+1<w) gray[idx+w+1]+=err/16; }
        } }
      } else {
        for(var j=0;j<n;j++) bits[j]=gray[j]<thresh?1:0;
      }
      if(invert){ for(var k=0;k<n;k++) bits[k]=bits[k]?0:1; }
      return { w:w, h:h, bits:bits };
    }

    function render(){
      var m=process(); if(!m) return;
      canvas.width=m.w; canvas.height=m.h;
      var cctx=canvas.getContext('2d'), out=cctx.createImageData(m.w,m.h), od=out.data;
      for(var i=0;i<m.w*m.h;i++){ var v=m.bits[i]?0:255; od[i*4]=v; od[i*4+1]=v; od[i*4+2]=v; od[i*4+3]=255; }
      cctx.putImageData(out,0,0);
      if(dimsEl) dimsEl.textContent=m.w+' × '+m.h+' dots  (~'+(m.w/203).toFixed(1)+'" × '+(m.h/203).toFixed(1)+'" @203dpi)';
    }

    function toZPL(){
      var m=process(); if(!m) return null;
      var bytesPerRow=Math.ceil(m.w/8), total=bytesPerRow*m.h;
      var HEX='0123456789ABCDEF', out=new Array(total*2), p=0;
      for(var y=0;y<m.h;y++){
        var rowBase=y*m.w;
        for(var bcol=0;bcol<bytesPerRow;bcol++){
          var byte=0, base=bcol*8;
          for(var bit=0;bit<8;bit++){ var x=base+bit; if(x<m.w && m.bits[rowBase+x]) byte|=(0x80>>bit); }
          out[p++]=HEX.charAt(byte>>4); out[p++]=HEX.charAt(byte&0x0f);
        }
      }
      var profile=ZEBRA_CONFIG.labelProfiles[labelProfile]||ZEBRA_CONFIG.labelProfiles.standard;
      var lw=profile.labelWidth, lh=profile.labelHeight;
      var x=Math.max(0,Math.round((lw-m.w)/2));
      var zpl='^XA\n'+ZEBRA_CONFIG.characterSet+'\n^PW'+lw+'\n^LL'+lh+'\n';
      zpl+=buildBorderZPL(sbBorder,lw,lh);
      zpl+='^FO'+x+',20\n^GFA,'+total+','+total+','+bytesPerRow+','+out.join('')+'^FS\n';
      zpl+='^XZ';
      return { zpl:zpl, tall:(m.h>lh-20) };
    }

    wSlider.addEventListener('input', function(){ wVal.textContent=this.value; render(); });
    tSlider.addEventListener('input', function(){ tVal.textContent=this.value; render(); });
    ditherEl.addEventListener('change', render);
    invertEl.addEventListener('change', render);
    rotateEl.addEventListener('change', render);

    document.getElementById('imgPrint').addEventListener('click', function(){
      if(!srcImg){ showResult('imgRes','Load an image first.','err'); return; }
      var built=toZPL(); if(!built){ showResult('imgRes','Could not build the label.','err'); return; }
      var ip=document.getElementById('zPrinterIP').value.trim()||detectedPrinterIP;
      if(!ip){ showResult('imgRes','No Zebra printer IP set in sidebar. Image printing uses ZPL (Zebra).','err'); return; }
      var qty=Math.max(1,Math.min(parseInt(document.getElementById('imgQty').value)||1,50));
      setStatus('Sending image label...','wrn');
      showResult('imgRes','Sending '+qty+' label(s)...'+(built.tall?' (image taller than label — may clip)':''),'ok');
      sendToZebra(built.zpl, qty, 'imgRes', function(ok){ setStatus(ok?'Image printed x'+qty:'Image print failed', ok?'ok':'err'); });
    });

    document.getElementById('imgCopyZpl').addEventListener('click', function(){
      if(!srcImg){ showResult('imgRes','Load an image first.','err'); return; }
      var built=toZPL(); if(!built){ showResult('imgRes','Could not build the label.','err'); return; }
      if(navigator.clipboard&&navigator.clipboard.writeText){
        navigator.clipboard.writeText(built.zpl).then(function(){ showResult('imgRes','ZPL copied! Paste into labelary.com/viewer.html','ok'); }, function(){ showResult('imgRes','Copy failed.','err'); });
      } else {
        var ta=document.createElement('textarea'); ta.value=built.zpl; document.body.appendChild(ta); ta.select(); try{document.execCommand('copy');}catch(e){} document.body.removeChild(ta);
        showResult('imgRes','ZPL copied! Paste into labelary.com/viewer.html','ok');
      }
    });

    document.getElementById('imgClear').addEventListener('click', function(){
      srcImg=null; previewWrap.style.display='none'; controls.style.display='none';
      document.getElementById('imgRes').className='pm-res';
      wSlider.value=812; wVal.textContent='812';
      tSlider.value=128; tVal.textContent='128';
      ditherEl.checked=false; invertEl.checked=false; rotateEl.checked=false;
      if(dimsEl) dimsEl.textContent='';
    });
  })();

  /* ═══════════════════════════════════════════════════════
     KEYBOARD SHORTCUTS
  ═══════════════════════════════════════════════════════ */
  document.addEventListener('keydown',function(e){
    if(!e.altKey) return;
    switch(e.key){
      case 'b': e.preventDefault(); document.getElementById('fBar').focus(); switchToTab('labelprinter'); break;
      case 'p': e.preventDefault(); document.getElementById('fPrint').click(); break;
      case 'f': e.preventDefault(); autoFetchTitle(); break;
    }
  });

  /* ═══════════════════════════════════════════════════════
     INIT
  ═══════════════════════════════════════════════════════ */
  updateProfileUI();
  updateAlignUI();
  updateDescModeUI();
  updateLabelTypeUI();
  updateBCSizeLabel();
  updateAutoSw();
  updateModeUI();
  updateQAModeUI();
  detectZebraPrinter();

})();