// ==UserScript==
// @name         FCR Plus
// @version      1.8.0
// @description  FcResearch All-in-one - The Orginal FCR plus script
// @author       kyleldri

// @match        *://fcresearch-na.aka.amazon.com/*
// @match        *://fcresearch-eu.aka.amazon.com/*
// @match        *://fcresearch-fe.aka.amazon.com/*
// @match        *://fcresearch-jp.aka.amazon.com/*
// @match        *://qi-fcresearch-na.corp.amazon.com/*
// @match        *://qi-fcresearch-eu.corp.amazon.com/*
// @match        *://qi-fcresearch-fe.corp.amazon.com/*
// @match        *://qi-fcresearch-jp.corp.amazon.com/*
// @match        *://qifcr.na.aftx.amazonoperations.app/*
// @match        *://qifcr.eu.aftx.amazonoperations.app/*
// @match        *://qifcr.fe.aftx.amazonoperations.app/*
// @match        *://qifcr.jp.aftx.amazonoperations.app/*

// @icon          https://drive-render.corp.amazon.com/view/kyleldri@/Untitled.png
// @updateURL     https://tamarin.aces.amazon.dev/scripts/fcr-plus/install.user.js
// @downloadURL   https://tamarin.aces.amazon.dev/scripts/fcr-plus/install.user.js

// @connect      mksg5of8j9.execute-api.us-east-1.amazonaws.com
// @connect      localhost
// @connect      fcresearch-na.aka.amazon.com
// @connect      fcresearch-eu.aka.amazon.com
// @connect      fcresearch-fe.aka.amazon.com
// @connect      qifcr.na.aftx.amazonoperations.app
// @connect      qifcr.eu.aftx.amazonoperations.app
// @connect      qifcr.fe.aftx.amazonoperations.app
// @connect      prepmanager-iad.amazon.com
// @connect      prepmanager-dub.amazon.com
// @connect      prepmanager-jp.amazon.com
// @connect      fba-fnsku-commingling-console-na.aka.amazon.com
// @connect      fba-fnsku-commingling-console-eu.aka.amazon.com
// @connect      fba-fnsku-commingling-console-fe.aka.amazon.com
// @connect      aftfreightlabelprinterapp-na.aka.amazon.com
// @connect      aftfreightlabelprinterapp-eu.aka.amazon.com
// @connect      aftfreightlabelprinterapp-fe.aka.amazon.com
// @connect      frxprinter.na.aftx.amazonoperations.app
// @connect      frxprinter.eu.aftx.amazonoperations.app
// @connect      frxprinter.fe.aftx.amazonoperations.app
// @connect      fc-inbound-dock-execution-service-na-usg1-iad.iad.proxy.amazon.com
// @connect      aft-atlisapp-iad.aka.amazon.com
// @connect      pandash.amazon.com
// @connect      rno-tools.corp.amazon.com
// @connect      qi-fcresearch-na.corp.amazon.com
// @connect      qi-fcresearch-eu.corp.amazon.com
// @connect      qi-fcresearch-fe.corp.amazon.com
// @connect      procurementportal-fe.corp.amazon.com
// @connect      tamarin.aces.amazon.dev
// @connect      *
// @run-at       document-end
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @require https://cdnjs.cloudflare.com/ajax/libs/jquery-cookie/1.4.1/jquery.cookie.min.js
// @require      https://cdn.jsdelivr.net/npm/jsbarcode@3.11.0/dist/JsBarcode.all.min.js

// ==/UserScript==



/* globals Printmon3 - main file in above */

//alternative links:(not always up to date) https://axzile.corp.amazon.com/-/carthamus/script/fcr-plus

/*

================================================================================
 CHANGELOG
================================================================================
[1.8.0]
 - [New] More FE region support

[1.7.10 and .12] - beta
 - [New] Atlis check added - checks both bin type and prep that is attached to PO.
 - revamped image hover, shows title now and includes showing books etc.
 - [new-beta] Addeed vendor performed check (from prep manager) - will prob remove
 - @match to include jp region

[1.7.9]
 - Report log/troubleshoot added within report bug button in settings
 - Fix a few bugs, utliziing @connect incase user denies request.

[1.7.8]
 - Intro page - space UI design - can be turned off (:
 - [NEW] Price List - show listing of price of individual items in inventory + total amount
 - [NEW] Arnold - Check arnold per asin in inventory.

[1.7.7]
 - [fixed] Research Prep no longer shows false 'No Prep' when prepmanager is broken.
   Non-200 responses, missing prep data, and network failures now show a red ERROR
   pill instead. (prepmanager's own JS regression / outages were being misread as No Prep.)

[1.7.6]
 - [fixed] badge photo endpoint has deprecrated, fcresearch still hasnt updated - fixed that for NA endpoint?
 - [New] Tool: Check Expiration Date - shows expiration dates on inventory coded: red (expired/under 30 days), orange (30-180 days), green (6+ months)
 - [New] Tool: Get ASIN Weights (Purchase Order Items) - shows per ASIN unit weight: green (<25 lbs), orange (25-49.99 lbs), red (50+ lbs)
 - Calculate Weight (Inventory) now also shows per ASIN weight along side the container total; EU/kg regions supported.
 - Tools dropdown no longer clips off screen on smaller windows
 - Tools dropdown border improved for better visibility against page content


[1.7.5.4] -
 - frx printing, Changed to 60 days (previously 90days) - shipments only last 60 days not 90days


[1.7.5.3] -
 -UI updates - tools Ui has been updated to display as Pill.
 -Themes has custom colors added to it

[1.7.5.2] -
 - UI Polish: dialogs (Printmon, Zebra, Barcode, image hover) now respect dark mode theme
 - Tools dropdown: removed orange glow, now uses theme accent shadow
 - FRX dropdown adapts to dark mode
 - RNO light-mode row color improved (raw blue to styled navy)
 - expiredMessage uses CSS class instead of inline style
 - Print shortcut placeholder consistency fix
 - Intro Page Redone - adding the feature settings there

[1.7.4] -
 -zebra print brings menu on right click for asins.

================================================================================
*/


(function () {
  'use strict';


  /*
   * ===========================================================
   *  TABLE OF CONTENTS
   * ===========================================================
   *
   *  [S1]  CONFIG & CONSTANTS
   *  [S2]  UTILITIES
   *  [S3]  STYLES (single dark theme + tw-* Tailwind utility layer + tokens)
   *  [S4]  PRINTING powered by Printmon
   *  [S5]  PREP
   *  [S6]  PROFILER (RNO)
   *  [S7]  HAZMAT
   *  [S8]  WEIGHT & UTILIZATION
   *  [S8b] EXPIRATION DATE CHECK (tools: inventory)
   *  [S8c] PRICE LOOKUP (tools: inventory)
   *  [S9]  CSV EXPORT
   *  [S11] UI (Sidebar, Context Menu)
   *  [S13] PRINTMON 3
   *  [S15] Printing powered by Zebra ZPL
   *  [S17] OPEN CONTAINER
   *  [SBOOT] INIT (boot)
   *
   *  Ctrl+F any [S#] tag to jump to that section.
   *  Nothing runs until boot() at the bottom.
   * ===========================================================
   */


  // ======= [S1] CONFIG & CONSTANTS =======

  var FC = null;
  var REGION = GM_getValue('userRegion', 'NA');
    var FC_TYPE = GM_getValue('userFCType', 'default');
    var FC_TYPES = {
    'default': { name: 'Default' },
    'amxl': { name: 'AMXL' }
    };
  var IS_AFTX = window.location.hostname.includes('aftx.amazonoperations.app');


    // Single fixed dark theme. The former 7-theme picker, custom-theme editor,
    // and text-color options were removed in the CSS overhaul.
    var THEME = 'fcrplus';
    var TEXT_COLOR = 'default';
    var THEMES = {
        fcrplus: { name: 'FCR Plus', bg: '#040D12', surface: '#0A1A1F', accent: '#183D3D', hover: '#2C5D5D', text: '#E0E0E0' }
    };
    var TEXT_COLORS = {
        'default': { name: 'Theme Default', value: null }
    };

   var CONFIG = {
        printHost: 'http://localhost:5965/printer',
        palletMaxWeight: 1500,
        cageMaxWeight: 500,
        cageVolume: 91873.03125,
        cartVolume: 53228.675,
        rnoTokenLifetime: 300000,
        cacheDuration: 30 * 60 * 1000,
        showCondition: true, // false = skip condition lookup on zebra labels - latecy around 1-3 seconds.
        marketplace: { NA: 'US', EU: 'GB', FE: 'AU' },
        marketplaceId: { NA: '1', EU: '3', FE: '111172' },
        retailDomain: { NA: 'amazon.com', EU: 'amazon.co.uk', FE: 'amazon.com.au' },
    urls: {
    fcresearch: {
        NA:      'https://fcresearch-na.aka.amazon.com',
        EU:      'https://fcresearch-eu.aka.amazon.com',
        FE:      'https://fcresearch-fe.aka.amazon.com',
        NA_AFTX: 'https://qifcr.na.aftx.amazonoperations.app',
        EU_AFTX: 'https://qifcr.eu.aftx.amazonoperations.app',
        FE_AFTX: 'https://qifcr.fe.aftx.amazonoperations.app'
    },
    prepmanager: {
        NA: 'https://prepmanager-iad.amazon.com',
        EU: 'https://prepmanager-dub.amazon.com',
        FE: 'https://prepmanager-jp.amazon.com'
    },
    commingling: {
        NA: 'https://fba-fnsku-commingling-console-na.aka.amazon.com',
        EU: 'https://fba-fnsku-commingling-console-eu.aka.amazon.com',
        FE: 'https://fba-fnsku-commingling-console-fe.aka.amazon.com'
    },
    dockExecution: {
        NA: 'https://fc-inbound-dock-execution-service-na-usg1-iad.iad.proxy.amazon.com',
        EU: 'https://fc-inbound-dock-execution-service-na-usg1-iad.iad.proxy.amazon.com'
    },
    procurement: {
        NA: 'https://procurementportal-na.corp.amazon.com',
        EU: 'https://procurementportal-eu.corp.amazon.com',
        FE: 'https://procurementportal-fe.corp.amazon.com'
    }
}

    };

    // =========================================================================
    // FCR Plus inline pill system (replaces ^^row injections for Prep/Hazmat/RNO/Manual)
    // -------------------------------------------------------------------------
    // Pill text truncates beyond this character limit; full text shown on hover.
    // Adjust as needed.
    var PILL_TRUNCATE = 100; // character limit
    // =========================================================================
    var Pills = (function () {
        // Tooltip uses position:fixed and a single shared element attached to <body>
        // so it is never clipped by table overflow / row height.
        var sharedTip = null;

        GM_addStyle(
            // Pill container sits below the ASIN text inside the same cell.
            // width:0 + overflow:visible means the table layout algorithm sees 0px
            // intrinsic width from this element (so columns stay at their natural
            // ASIN-only widths), but pills still render visually via overflow.
            '.fcrplus-pill-row {'
            +   'display:block;width:0;overflow:visible;'
            +   'margin-top:3px;line-height:1.6;white-space:nowrap;'
            + '}'
            + '.fcrplus-pill {'
            +   'display:inline-block;vertical-align:middle;'
            +   'margin:1px 4px 1px 0;padding:2px 8px;'
            +   'border-radius:10px;font-size:11px;font-weight:bold;'
            +   'white-space:nowrap;'
            +   'cursor:default;'
            +   'box-shadow:0 1px 2px rgba(0,0,0,0.25);'
            + '}'
            + '#fcrplus-pill-tip {'
            +   'display:none;position:fixed;z-index:2147483647;'
            +   'min-width:200px;max-width:480px;'
            +   'padding:8px 12px;border-radius:6px;'
            +   'background:#1a1a1a;color:#fff;font-weight:normal;'
            +   'font-size:12px;line-height:1.55;white-space:normal;'
            +   'box-shadow:0 6px 20px rgba(0,0,0,0.7);'
            +   'border:1px solid rgba(255,255,255,0.25);'
            +   'pointer-events:none;'
            + '}'
        );

        function ensureTip() {
            if (sharedTip) return sharedTip;
            sharedTip = document.createElement('div');
            sharedTip.id = 'fcrplus-pill-tip';
            document.body.appendChild(sharedTip);
            return sharedTip;
        }

        function showTip(pill) {
            var full = pill.getAttribute('data-fcrplus-full');
            if (!full) return;
            var tip = ensureTip();
            tip.textContent = full;
            tip.style.display = 'block';
            // Place below pill; flip above if off-screen
            var rect = pill.getBoundingClientRect();
            var tipRect = tip.getBoundingClientRect();
            var top = rect.bottom + 6;
            if (top + tipRect.height > window.innerHeight - 8) {
                top = rect.top - tipRect.height - 6;
                if (top < 8) top = 8;
            }
            var left = rect.left;
            if (left + tipRect.width > window.innerWidth - 8) {
                left = window.innerWidth - tipRect.width - 8;
            }
            if (left < 8) left = 8;
            tip.style.top = top + 'px';
            tip.style.left = left + 'px';
        }

        function hideTip() {
            if (sharedTip) sharedTip.style.display = 'none';
        }

        function truncate(s) {
            if (s === null || s === undefined) return '';
            s = String(s);
            return s.length > PILL_TRUNCATE ? s.slice(0, PILL_TRUNCATE - 1) + '\u2026' : s;
        }

        // opts: { kind, label, text, full, bg, fg }
        // If label is empty/falsy, the pill renders just the text with no bold prefix.
        function add(row, opts) {
            if (!row || !opts) return null;
            var asinCell = row.children[1] || (row.cells && row.cells[1]) || row.children[0];
            if (!asinCell) return null;

            // Container holds all pills for this cell on its own block line below the ASIN text.
            var container = asinCell.querySelector('.fcrplus-pill-row');
            if (!container) {
                container = document.createElement('div');
                container.className = 'fcrplus-pill-row';
                asinCell.appendChild(container);
            }

            var existing = container.querySelector('.fcrplus-pill[data-fcrplus-pill="' + opts.kind + '"]');
            if (existing) existing.remove();

            var pill = document.createElement('span');
            pill.className = 'fcrplus-pill';
            pill.setAttribute('data-fcrplus-pill', opts.kind);
            pill.style.background = opts.bg || '#444';
            pill.style.color = opts.fg || '#fff';

            var fullText = opts.full || opts.text || '';
            var shortText = truncate(opts.text || '');
            if (opts.label) {
                pill.innerHTML = '<b>' + opts.label + ':</b>\u00a0' + shortText;
            } else {
                pill.textContent = shortText;
            }

            // Always attach full text. Hover shows it via the shared fixed tooltip,
            // so table cells with overflow:hidden never clip it.
            if (fullText) {
                pill.setAttribute('data-fcrplus-full', fullText);
                pill.addEventListener('mouseenter', function () { showTip(pill); });
                pill.addEventListener('mouseleave', hideTip);
            }

            container.appendChild(pill);
            return pill;
        }

        function clear(kind, root) {
            var scope = root || document;
            var sel = kind ? '.fcrplus-pill[data-fcrplus-pill="' + kind + '"]' : '.fcrplus-pill';
            scope.querySelectorAll(sel).forEach(function (p) { p.remove(); });
            // Remove any pill containers left empty after clearing.
            scope.querySelectorAll('.fcrplus-pill-row').forEach(function (c) {
                if (!c.querySelector('.fcrplus-pill')) c.remove();
            });
        }

        return { add: add, clear: clear };
    })();

var FEATURES = {
    // Global
    darkMode: { default: true, label: 'Dark Mode', category: 'global' },
    // Product Page
    asinPrinting: { default: true, label: 'ASIN Printing', category: 'product' },
    prepFunctionality: { default: true, label: 'Prep Functionality', category: 'product' },
    rnoProfiler: { default: true, label: 'RNO ASIN Profiler', category: 'product' },
    // Inventory Tools
    rnoSizeProfiler: { default: true, label: 'RNO Size Profiler', category: 'tool' },
    hazmatLevels: { default: true, label: 'Hazmat Levels', category: 'tool' },
    weightCalculator: { default: true, label: 'Weight Calculator', category: 'tool' },
    containerUtilization: { default: true, label: 'Container Utilization', category: 'tool' },
    csvExport: { default: true, label: 'CSV Export', category: 'tool' },
    asinLevelPrep: { default: true, label: 'ASIN Level Prep', category: 'tool' },
    researchPrep: { default: true, label: 'Research Prep', category: 'tool' },
    expirationDate: { default: true, label: 'Expiration Date Check', category: 'tool' },
    priceLookup: { default: true, label: 'Price Lookup', category: 'tool' }
};

  var HAZMAT_COLORS = {
    0: '#999999', 1: '#33CC02', 2: '#FFE103', 3: '#FFBF03',
    4: '#FF8002', 5: '#FF4001', 6: '#ED0700', 7: '#AD03DE', 8: '#3333FF'
  };
  var HAZMAT_MARKETPLACES = ['US', 'GB', 'DE', 'IE', 'FR', 'ES', 'IT', 'CA', 'MX', 'IN', 'JP', 'AU', 'BR', 'TR', 'AE', 'SA', 'EG', 'SG', 'NL', 'SE', 'PL', 'BE'];
      //product table sortable, weight, mastercase conveyour color
    var ATTRIBUTE_COLORS = {
    positive: '#33CC02',   // attribute is true/good - color green
    negative: '#8B0000',   // attribute is false/bad dark red
    overweight: '#8B0000'  // weight > 49.99 lbs - dark red
};


  var PREP_KEYWORDS = [
    'No Prep','Amazon Fresh','Bagutte','Bread','Bread Packing',
    'Cookies Large Packing','Cookies Small Packing','Danish',
    'Defrost Packing','Fish Packing','Shellfish Packing',
    'Sweet Viennoiserie Packing','Viennoiserie Packing',
    'block_cheese','deli_cheese','deli_meat','deli_salad',
    'pack','rotisserie','sandwich','slack_out','trim','wedge_cheese',
    'Debundling','Multi Part Assembly','Multi-volume component placard',
    'Multibundle','Omake','Set Creation','Sorting','Hazmat Prep',
    'Gemologist','High Defect Check',
    'Local Language Label Check - UK only',
    'Organic Label Check - UK only','QA Check',
    'Tax Stamp Check - UK only','Transfer 8',
    'Cardboard footprint','Counterfeit Check',
    'Cover opening in package','Folding','Hang garment',
    'Jewelry inspection','Mask barcodes on outer case','Refund Tag',
    'Remove eaches from inner boxes','Remove from hanger',
    'Remove multi-unit wrapping','Research',
    'A-Envelope Boxing','Boxing','Bubble wrap/Bubble bag',
    'Inner wrapping with thin polyethylene',
    'Inner wrapping with tissue paper','Opaque covering',
    'Outer wrapping with thick polyethylene',
    'Pulp Paper Tray','Stuffing','Bagging',
    'Cellophane wrapping','Collar/Shrink band',
    'Multi-volume set taping/banding','Shrinkwrap','cap_sealing',
    'Asin Stickering','Blank stickering',
    'Colors may vary stickering','Flip tag','LPN Stickering',
    'Manufacturer Part Id Stickering','Rubber banding',
    'Sharp label stickering','Sold as set stickering',
    'Suffocation warning stickering','Taping',
    'Amazon watch warranty insert','Watch Full Inspection',
    'Watch Visual Inspection','Watch care and return insert'
  ];

   var PRINT_MODE = GM_getValue('printMode', 'printmon'); // 'printmon' or 'zebra'  //s15
   var VERSION = GM_info.script.version;



  // ======= [S2] UTILITIES =======
  //
  //

  function getURL(service, path) {
    var url = CONFIG.urls[service];
    if (!url) return '';
    if (typeof url === 'string') return url + (path || '');


    var key = IS_AFTX ? (REGION + '_AFTX') : REGION;
    return (url[key] || url[REGION] || url.NA) + (path || '');
  }


  function getMarketplace() {
    return CONFIG.marketplace[REGION] || CONFIG.marketplace.NA;
  }

  function getFCFromURL() {
    var match = window.location.pathname.match(/\/([A-Z0-9]{3,4})\//);
    return match ? match[1] : null;
  }

  function getFC() {
    FC = FC || getFCFromURL();
    return FC;
  }

  function featureOn(name) {
    return $.cookie('cfg-' + name) === '1';
  }

  function initCookies() {
    Object.keys(FEATURES).forEach(function (key) {
      if (typeof $.cookie('cfg-' + key) === 'undefined') {
        $.cookie('cfg-' + key, FEATURES[key].default ? '1' : '0', { expires: 365 });
      }
    });
  }

  function debounce(fn, delay) {
    var timer;
    return function () {
      var ctx = this, args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, delay);
    };
  }

  function waitForEl(selector, timeout) {
    timeout = timeout || 5000;
    return new Promise(function (resolve, reject) {
      var el = document.querySelector(selector);
      if (el) return resolve(el);

      var obs = new MutationObserver(function () {
        var found = document.querySelector(selector);
        if (found) { obs.disconnect(); resolve(found); }
      });
      obs.observe(document.body, { childList: true, subtree: true });
      setTimeout(function () {
        obs.disconnect();
        reject(new Error('Timeout: ' + selector + ' not found in ' + timeout + 'ms'));
      }, timeout);
    });
  }

  // Polling based element watcher (used for table sort triggers)
  function waitForKeyElements(selector, callback, oneTime, iframeSelector) {
    var targetNodes, btargetsFound;
    if (typeof iframeSelector === 'undefined') {
      targetNodes = $(selector);
    } else {
      targetNodes = $(iframeSelector).contents().find(selector);
    }
    if (targetNodes && targetNodes.length > 0) {
      btargetsFound = true;
      targetNodes.each(function () {
        var jThis = $(this);
        if (!jThis.data('alreadyFound')) {
          var cancelFound = callback(jThis);
          if (cancelFound) { btargetsFound = false; }
          else { jThis.data('alreadyFound', true); }
        }
      });
    } else {
      btargetsFound = false;
    }
    var controlObj = waitForKeyElements.controlObj || {};
    var controlKey = selector.replace(/[^\w]/g, '_');
    var timeControl = controlObj[controlKey];
    if (btargetsFound && oneTime && timeControl) {
      clearInterval(timeControl);
      delete controlObj[controlKey];
    } else if (!timeControl) {
      timeControl = setInterval(function () {
        waitForKeyElements(selector, callback, oneTime, iframeSelector);
      }, 300);
      controlObj[controlKey] = timeControl;
    }
    waitForKeyElements.controlObj = controlObj;
  }

  function asciihex(str) {
    return str.split('').map(function (c) { return c.charCodeAt(0).toString(16); }).join('');
  }

  function genId() {
    return Math.random().toString(36).substr(2, 10);
  }

  function getCookie(name) {
    var row = document.cookie.split('; ').find(function (r) { return r.startsWith(name + '='); });
    return row ? row.split('=')[1] : null;
  }

    function expandDataTable(tableId) {
            var wrapper = document.querySelector(tableId + '_wrapper');
            if (!wrapper) return;
            var scrollBody = wrapper.querySelector('.dataTables_scrollBody');
            if (!scrollBody) return;
            var table = scrollBody.querySelector('table');
            if (!table) return;
            var newHeight = table.offsetHeight + 20;
            var current = parseInt(scrollBody.style.maxHeight || scrollBody.style.height) || 0;
            if (newHeight > current) {
                scrollBody.style.maxHeight = newHeight + 'px';
                scrollBody.style.height = newHeight + 'px';
            }
        }

  /** Scroll a DataTable to bottom to force lazy load, then resolve */
  function loadAllTableRows() {
    return new Promise(function (resolve) {
      var wrapper = document.querySelector('#table-inventory_wrapper');
      if (!wrapper) { resolve(); return; }

      var scroller = wrapper.querySelector('.dataTables_scrollBody');
      if (!scroller) { resolve(); return; }

      var prevHeight = 0, staleCount = 0;
      (function tick() {
        if (scroller.scrollHeight === prevHeight) staleCount++;
        else staleCount = 0;

        if (staleCount >= 8) { resolve(); return; }

        prevHeight = scroller.scrollHeight;
        scroller.scrollTop = scroller.scrollHeight;
        setTimeout(tick, 500);
      })();
    });
  }

  /** Fetch a product page from FCR, return parsed document */
  function fetchProductPage(asin, fc) {
    return new Promise(function (resolve, reject) {
      GM_xmlhttpRequest({
        method: 'POST',
        url: getURL('fcresearch') + '/' + fc + '/results/product',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        data: 's=' + asin,
        onload: function (r) {
          resolve(new DOMParser().parseFromString(r.responseText, 'text/html'));
        },
        onerror: reject
      });
    });
  }

  /** Read a row from a product keyvalue table by header text. Returns td text or null. */
  function readProductField(doc, fieldName) {
    var rows = doc.querySelectorAll('table.a-keyvalue tr');
    for (var i = 0; i < rows.length; i++) {
      var th = rows[i].querySelector('th');
      if (th && th.textContent.trim() === fieldName) {
        var td = rows[i].querySelector('td');
        return td ? td.textContent.trim() : null;
      }
    }
    return null;
  }

  /** Parse "12.5 x 8.3 x 4.2" into { max, mid, min } sorted descending */
  function parseDimensions(text) {
    if (!text) return null;
    var dims = text.split(/\s*x\s*/i).map(parseFloat).filter(function (n) { return !isNaN(n); });
    if (dims.length < 3) return null;
    dims.sort(function (a, b) { return b - a; });
    return { max: dims[0], mid: dims[1], min: dims[2] };
  }

  /** Collect ASIN + row pairs from an inventory table body */
  function collectInventoryAsins(tbody) {
    return Array.from(tbody.querySelectorAll('tr')).map(function (row) {
      var cell = row.querySelector('td:nth-child(2)');
      if (!cell) return null;
      var link = cell.querySelector('a');
      return { asin: link ? link.textContent.trim() : cell.textContent.trim(), row: row };
    }).filter(Boolean);
  }
  function showToast(message, type) {
    var existing = document.getElementById('fcr-toast');
    if (existing) {
        clearTimeout(existing._fcrTimer);
        existing.remove();
    }
    var el = document.createElement('div');
    el.id = 'fcr-toast';
    var bg = type === 'error' ? '#3a1414' : type === 'warning' ? '#3a2d0a' : type === 'success' ? '#1a3a1a' : '#183D3D';
    var bd = type === 'error' ? '#cc3333' : type === 'warning' ? '#f37d15' : type === 'success' ? '#33CC02' : '#2C5D5D';
    var icon = type === 'error' ? '✖ ' : type === 'warning' ? '⚠ ' : type === 'success' ? '✔ ' : 'ℹ ';
    el.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:2147483647;'
        + 'padding:10px 18px;border-radius:6px;font-family:Arial,sans-serif;font-size:13px;font-weight:600;'
        + 'background:' + bg + ';color:#E0E0E0;border:1px solid ' + bd + ';'
        + 'box-shadow:0 4px 20px rgba(0,0,0,0.55);max-width:380px;line-height:1.4;'
        + 'opacity:0;transition:opacity 0.2s ease,transform 0.2s ease;transform:translateY(8px);pointer-events:none;';
    el.textContent = icon + message;
    document.body.appendChild(el);
    requestAnimationFrame(function () {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
    });
    el._fcrTimer = setTimeout(function () {
        el.style.opacity = '0';
        el.style.transform = 'translateY(8px)';
        setTimeout(function () { if (el.parentNode) el.remove(); }, 220);
    }, 3600);
  }


  // --- Bug Report Diagnostic ---
  // Two logs: _actionLog tracks FCR Plus operations (print, tools, etc.) with outcomes.
  // _errorLog captures page level JS errors, warnings, network issues for context.
  var _actionLog = [];
  var _errorLog = [];

  function logAction(action, detail) {
    _actionLog.push({ time: new Date().toLocaleTimeString(), action: action, detail: detail || '' });
    if (_actionLog.length > 80) _actionLog.shift();
  }

  function logError(source, msg) {
    var entry = '[' + new Date().toLocaleTimeString() + '] ' + source + ': ' + msg;
    _errorLog.push(entry);
    if (_errorLog.length > 50) _errorLog.shift();
  }

  // Capture ALL uncaught JS errors on the page (not just this script)
  window.addEventListener('error', function (e) {
    var file = e.filename ? e.filename.split('/').pop() : 'unknown';
    logError('JS Error', e.message + ' | ' + file + ':' + e.lineno);
  });

  // Capture unhandled promise rejections (network, fetch, async failures)
  window.addEventListener('unhandledrejection', function (e) {
    var msg = e.reason ? (e.reason.message || e.reason.stack || String(e.reason)) : 'Unknown rejection';
    if (msg.length > 300) msg = msg.substring(0, 300) + '...';
    logError('Promise', msg);
  });

  // Intercept console.error
  var _origConsoleError = console.error;
  console.error = function () {
    var args = Array.prototype.slice.call(arguments);
    var msg = args.map(function (a) {
      if (typeof a === 'string') return a;
      if (a instanceof Error) return a.message + (a.stack ? ' | ' + a.stack.split('\n')[1] : '');
      try { return JSON.stringify(a); } catch (e) { return String(a); }
    }).join(' ');
    if (msg.length > 300) msg = msg.substring(0, 300) + '...';
    logError('ERROR', msg);
    _origConsoleError.apply(console, arguments);
  };

  // Intercept console.warn (mixed content, CSP, deprecations show here)
  var _origConsoleWarn = console.warn;
  console.warn = function () {
    var args = Array.prototype.slice.call(arguments);
    var msg = args.map(function (a) {
      if (typeof a === 'string') return a;
      try { return JSON.stringify(a); } catch (e) { return String(a); }
    }).join(' ');
    if (msg.length > 300) msg = msg.substring(0, 300) + '...';
    logError('WARN', msg);
    _origConsoleWarn.apply(console, arguments);
  };

  // Capture failed network requests (fetch API)
  var _origFetch = window.fetch;
  if (_origFetch) {
    window.fetch = function () {
      var url = arguments[0];
      if (typeof url === 'object' && url.url) url = url.url;
      return _origFetch.apply(this, arguments).then(function (response) {
        if (!response.ok) {
          logError('Network', response.status + ' ' + response.statusText + ' | ' + url);
        }
        return response;
      }).catch(function (err) {
        logError('Network', 'Failed: ' + (err.message || err) + ' | ' + url);
        throw err;
      });
    };
  }

  // Capture XMLHttpRequest failures (covers page scripts, not GM_xmlhttpRequest)
  var _origXHROpen = XMLHttpRequest.prototype.open;
  var _origXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this._diagUrl = url;
    this._diagMethod = method;
    return _origXHROpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    var xhr = this;
    xhr.addEventListener('error', function () {
      logError('XHR', xhr._diagMethod + ' failed | ' + xhr._diagUrl);
    });
    xhr.addEventListener('load', function () {
      if (xhr.status >= 400) {
        logError('XHR', xhr.status + ' ' + xhr._diagMethod + ' | ' + xhr._diagUrl);
      }
    });
    return _origXHRSend.apply(this, arguments);
  };

  function gatherDiagnostics() {
    var settings = {};
    Object.keys(FEATURES).forEach(function (key) {
      settings[key] = featureOn(key) ? 'ON' : 'OFF';
    });

    var report = [];
    report.push('=== FCR Plus Bug Report ===');
    report.push('Version: ' + VERSION);
    report.push('Page: ' + window.location.href);
    report.push('Protocol: ' + window.location.protocol);
    report.push('Region: ' + REGION);
    report.push('FC: ' + (getFC() || 'unknown'));
    report.push('Print Mode: ' + getPrintMode());
    report.push('Printer IP (cookie): ' + (getCookie('fcmenu-remoteAddr') || 'none'));
    report.push('Badge (cookie): ' + (getCookie('fcmenu-employeeId') || 'none'));
    report.push('Theme: ' + GM_getValue('theme', 'dark'));
    report.push('Browser: ' + navigator.userAgent);
    report.push('Timestamp: ' + new Date().toISOString());
    report.push('');
    report.push('--- Features ---');
    Object.keys(settings).forEach(function (key) {
      report.push('  ' + key + ': ' + settings[key]);
    });
    report.push('');
    if (_actionLog.length) {
      report.push('--- Action Log (' + _actionLog.length + ' events) ---');
      _actionLog.forEach(function (e) {
        report.push('  [' + e.time + '] ' + e.action + (e.detail ? ' | ' + e.detail : ''));
      });
    } else {
      report.push('--- Action Log ---');
      report.push('  (empty: reproduce the issue, then open this report)');
    }
    if (_errorLog.length) {
      report.push('');
      report.push('--- Page Errors (' + _errorLog.length + ') ---');
      _errorLog.forEach(function (e) { report.push('  ' + e); });
    }
    return report.join('\n');
  }


  // Probe key domains to detect blocked requests (Tampermonkey @connect denials)
  function probeConnectivity(callback) {
    var domains = [
      { name: 'Printmon', url: CONFIG.printHost },
      { name: 'FCResearch', url: getURL('fcresearch') },
      { name: 'PrepManager', url: getURL('prepmanager') },
      { name: 'Commingling', url: getURL('commingling') }
    ];
    var results = [];
    var pending = domains.length;

    domains.forEach(function (d) {
      GM_xmlhttpRequest({
        method: 'HEAD',
        url: d.url,
        timeout: 3000,
        onload: function (r) {
          results.push(d.name + ': reachable (status ' + r.status + ')');
          if (--pending === 0) callback(results);
        },
        onerror: function (r) {
          var reason = (r.status === 0 && !r.responseText) ? 'BLOCKED (domain not allowed in Tampermonkey)' : 'unreachable (network error)';
          results.push(d.name + ': ' + reason);
          if (--pending === 0) callback(results);
        },
        ontimeout: function () {
          results.push(d.name + ': timeout (service may be down or blocked)');
          if (--pending === 0) callback(results);
        }
      });
    });
  }

  function showBugReportDialog() {
    var existing = document.getElementById("fcrp-bugreport-backdrop");
    if (existing) existing.remove();

    var currentMode = getPrintMode();
    var altMode = currentMode === "zebra" ? "printmon" : "zebra";

    var backdrop = document.createElement("div");
    backdrop.id = "fcrp-bugreport-backdrop";
    backdrop.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:2147483646;display:flex;align-items:center;justify-content:center;";

    var modal = document.createElement("div");
    modal.style.cssText = "background:#1a1a2e;border:2px solid #ff9900;border-radius:8px;padding:24px;max-width:560px;width:90%;max-height:85vh;overflow-y:auto;font-family:Arial,sans-serif;color:#e0e0e0;box-shadow:0 8px 32px rgba(0,0,0,0.6);";

    var troubleHTML = ""
      + "<h3 style=\"margin:0 0 12px;color:#ff9900;font-size:16px;\">Having Issues?</h3>"
      + "<p style=\"margin:0 0 14px;font-size:12px;color:#aaa;\">Try these fixes before reporting a bug.</p>"
      + "<div style=\"background:#0d0d1a;border:1px solid #333;border-radius:6px;padding:14px;margin-bottom:12px;\">"
      + "<p style=\"margin:0 0 8px;font-size:13px;font-weight:700;color:#fff;\">Printing not working?</p>"
      + "<ul style=\"margin:0 0 10px;padding-left:18px;font-size:11px;color:#bbb;line-height:1.6;\">"
      + "<li>Currently using: <strong style=\"color:#ff9900;\">" + currentMode + "</strong></li>"
      + "<li>If printing fails, try switching to <strong>" + altMode + "</strong> below</li>"
      + "<li>Printmon: must be installed and running on your computer</li>"
      + "<li>Zebra: requires being logged into the computer (uses printer IP from login)</li>"
      + "</ul>"
      + "<button id=\"fcrp-switch-print\" style=\"padding:6px 14px;background:#ff9900;color:#fff;border:none;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;\">Switch to " + altMode + "</button>"
      + "<button id=\"fcrp-test-print\" style=\"margin-left:8px;padding:6px 14px;background:#2e7d32;color:#fff;border:none;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;\">Test Print</button>"
      + "</div>"
      + "<div style=\"background:#0d0d1a;border:1px solid #333;border-radius:6px;padding:14px;margin-bottom:12px;\">"
      + "<p style=\"margin:0 0 8px;font-size:13px;font-weight:700;color:#fff;\">Features not working? (Prep, Profiler, etc.)</p>"
      + "<ul style=\"margin:0 0 10px;padding-left:18px;font-size:11px;color:#bbb;line-height:1.6;\">"
      + "<li>Make sure the script is up to date</li>"
      + "<li>If Tampermonkey asked to allow a domain and you denied it, requests will fail silently</li>"
      + "<li>Fix: Tampermonkey Dashboard > FCR Plus > Settings > remove denied domains under Connect</li>"
      + "<li>Or: uninstall and reinstall the script (resets all permissions)</li>"
      + "</ul>"
      + "<button id=\"fcrp-update-check\" style=\"padding:6px 14px;background:#1565c0;color:#fff;border:none;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;\">Check for Update</button>"
      + "</div>"
      + "<div style=\"border-top:1px solid #333;padding-top:14px;margin-top:4px;\">"
      + "<p style=\"margin:0 0 8px;font-size:13px;font-weight:700;color:#fff;\">Still broken? Copy diagnostics below and send a report.</p>"
      + "</div>";

    modal.innerHTML = troubleHTML;

    var diag = gatherDiagnostics();
    var textarea = document.createElement("textarea");
    textarea.value = diag;
    textarea.readOnly = true;
    textarea.style.cssText = "width:100%;height:160px;resize:vertical;font-family:Consolas,monospace;font-size:10px;background:#0d0d1a;color:#ccc;border:1px solid #333;border-radius:4px;padding:10px;margin-bottom:12px;";

    probeConnectivity(function (results) {
      textarea.value = diag + "\n\n--- Connectivity Check ---\n  " + results.join("\n  ");
    });

    modal.appendChild(textarea);

    var btnRow = document.createElement("div");
    btnRow.style.cssText = "display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;";

    var closeBtn = document.createElement("button");
    closeBtn.textContent = "Close";
    closeBtn.style.cssText = "padding:8px 14px;background:#333;color:#ccc;border:1px solid #555;border-radius:4px;font-size:11px;cursor:pointer;";
    closeBtn.addEventListener("click", function () { backdrop.remove(); });

    var copyBtn = document.createElement("button");
    copyBtn.textContent = "Copy Diagnostics";
    copyBtn.style.cssText = "padding:8px 14px;background:#ff9900;color:#fff;border:none;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;";
    copyBtn.addEventListener("click", function () {
      textarea.select();
      document.execCommand("copy");
      copyBtn.textContent = "Copied!";
      setTimeout(function () { copyBtn.textContent = "Copy Diagnostics"; }, 1500);
    });

    var reportBtn = document.createElement("button");
    reportBtn.textContent = "Open Report Page";
    reportBtn.style.cssText = "padding:8px 14px;background:#c62828;color:#fff;border:none;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;";
    reportBtn.addEventListener("click", function () {
      window.open("https://tamarin.harmony.a2z.com/script/fcr-plus/report-bug", "_blank");
    });

    btnRow.appendChild(closeBtn);
    btnRow.appendChild(copyBtn);
    btnRow.appendChild(reportBtn);
    modal.appendChild(btnRow);

    backdrop.appendChild(modal);
    backdrop.addEventListener("click", function (e) { if (e.target === backdrop) backdrop.remove(); });
    document.body.appendChild(backdrop);

    // Wire troubleshooter buttons
    document.getElementById("fcrp-switch-print").addEventListener("click", function () {
      setPrintMode(altMode);
      this.textContent = "Switched to " + altMode + "!";
      this.style.background = "#2e7d32";
      showToast("Print mode switched to " + altMode + ". Try printing again.", "success");
    });

    document.getElementById("fcrp-test-print").addEventListener("click", function () {
      var testBtn = this;
      testBtn.textContent = "Sending...";
      testBtn.disabled = true;
      if (getPrintMode() === "zebra") {
        var zpl = "^XA^FO50,50^A0N,40,40^FDTest Label^FS^XZ";
        Zebra.sendToPrinter(zpl, 1, function (ok, msg) {
          testBtn.textContent = ok ? "Success!" : "Failed";
          testBtn.style.background = ok ? "#2e7d32" : "#c62828";
        });
      } else {
        Printing.sendPrintXHR("TEST", 1, "FCR Plus Test");
        testBtn.textContent = "Sent (check printer)";
        setTimeout(function () { testBtn.textContent = "Test Print"; testBtn.disabled = false; }, 2000);
      }
    });

    document.getElementById("fcrp-update-check").addEventListener("click", function () {
      window.open("https://tamarin.aces.amazon.dev/scripts/fcr-plus/install.user.js", "_blank");
    });
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.fcrp-bug-report-btn');
    if (btn) { e.preventDefault(); showBugReportDialog(); }
  });



   ///check for update delete code block if you want to stop asking
   function checkForUpdate() {
    var lastCheck = GM_getValue('lastUpdateCheck', 0);
    var ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - lastCheck < ONE_WEEK) return;

    GM_xmlhttpRequest({
        method: 'GET',
        url: 'https://tamarin.aces.amazon.dev/scripts/fcr-plus/install.user.js',
        onload: function (r) {
            GM_setValue('lastUpdateCheck', Date.now());
            var match = r.responseText.match(/@version\s+([\d.]+)/);
            if (!match) return;
            var remote = match[1];
            if (remote === VERSION) return;
            var dismissed = GM_getValue('dismissedVersion', '');
            if (remote === dismissed) return;
            var remoteParts = remote.split('.').map(Number);
            var localParts = VERSION.split('.').map(Number);
            for (var i = 0; i < Math.max(remoteParts.length, localParts.length); i++) {
                var rp = remoteParts[i] || 0;
                var lp = localParts[i] || 0;
                if (rp > lp) {
                    if (confirm('FCR Plus update available!\n\nYour version: ' + VERSION + '\nLatest version: ' + remote + '\n\nUpdate now?')) {
                        window.open('https://tamarin.aces.amazon.dev/scripts/fcr-plus/install.user.js', '_blank');
                    } else {
                        GM_setValue('dismissedVersion', remote);
                    }
                    return;
                }
                if (rp < lp) return;
            }
        },
        onerror: function () {}
    });
}




  // ======= [S3] STYLES =======
  //
  // All CSS strings live here. The rest of the codebase stays logic-only.
  //*Note: some css are useless after qi change. old aka link is still actively working.


    var Styles = (function () {

    var base = ''
      // --- Global typography ---
      + 'h6 { font-weight: 700; text-transform: uppercase; font-size: 12px; line-height: 1px; padding-bottom: 1px; }'

      // --- Top nav bar: FC logo and search box alignment ---
      + '.logo-fc, .logo-research { font-size: 20px; }'
      + '.aui-nav-search { margin-left: auto; margin-right: -210px; }'

      // --- Tools dropdown (injected into inventory/PO section headers) ---
      + '.tools-dropdown-container { display: inline-block; position: relative; margin-left: 10px; vertical-align: middle; }'
      + '.tools-dropdown-btn { background: white; border-radius: 999px; box-shadow: rgba(0,0,0,0.2) 0 10px 20px -10px; color: #183D3D; cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 700; padding: 4px 12px; border: 1px solid #183D3D; user-select: none; }'
      + '.tools-dropdown-btn:hover { background: #f0f0f0; }'
      + '.tools-dropdown-menu { position: fixed; background: rgba(255,255,255,0.97); border: 2px solid #232f3e; border-radius: 6px; box-shadow: 0 8px 24px rgba(0,0,0,0.3); z-index: 99999; min-width: 180px; padding: 4px 0; }'
      + '.tools-dropdown-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.15); backdrop-filter: blur(2px); z-index: 99998; }'
      + '.tools-dropdown-item { padding: 6px 14px; cursor: pointer; font-size: 12px; font-weight: 600; color: #183D3D; white-space: nowrap; transition: background-color 0.15s; }'
      + '.tools-dropdown-item:hover { background-color: #e8f4f8; }'
      + '.tools-dropdown-item.disabled { color: #aaa; cursor: default; pointer-events: none; }'
      + '.tools-dropdown-separator { border-top: 1px solid #eee; margin: 3px 0; }'
      + '.tools-results { display: inline-block; margin-left: 8px; font-size: 13px; font-weight: 700; vertical-align: middle; }'

      // --- Sidebar: Settings/Menu buttons container ---
      + '.fcr-menu-container { display: flex; justify-content: flex-start; margin-bottom: 10px; margin-left: -10px; }'
      + '.fcr-sidebar-button { padding: 4px 8px; font-size: 14px; background-color: #f0f0f0; color: #333; display: inline-flex; align-items: center; justify-content: center; border: 1px solid #ccc; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; font-weight: 900; transition: all 0.3s; margin-right: 10px; border-radius: 3px; }'
      + '.fcr-sidebar-button:hover { background-color: #e0e0e0; }'

      // --- Sidebar: Settings panel (toggle checkboxes area) ---
      + '#settings-info { background-color: #fff; border: 1px solid #ccc; color: #333; }'
      + '#settings-info label, #extra-settings-content label { color: #333; }'
      + '#settings-info label:hover, #extra-settings-content label:hover { background-color: #f0f0f0; }'





      // --- Sidebar: "Tools Dropdown Items" collapsible section ---
      + '#extra-toggle-button { background-color: #f0f0f0; color: #333; border: 1px solid #ccc; }'
      + '#extra-toggle-button:hover { background-color: #e0e0e0; }'
      + '#extra-settings-content { background-color: #f9f9f9; border: 1px solid #ddd; color: #333; }'
      + '#extra-settings-content p { color: #666; }'

      // --- Sidebar: Quick links menu panel ---
      + '#quick-links-menu { background-color: #fff; border: 1px solid #ccc; }'
      + '.quick-links-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; }'
      + '.quick-link-button { text-align: center; padding: 4px 3px; background-color: #f0f0f0; color: #333 !important; text-decoration: none; border-radius: 3px; font-size: 11px; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border: 1px solid #ccc; }'
      + '.quick-link-button:hover { background-color: #e0e0e0; }'

      // --- FRX: Print input row injected into shipment table cells ---
      + '.input-container { display: flex; align-items: center; width: 100%; padding: 2px; }'
      + '.input-container span { flex-grow: 1; margin-right: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }'
      + '.input-container input { width: 60px; margin-right: 5px; padding: 2px; }'
      + '.input-container button { padding: 2px 5px; }'

      // --- Badge photo popup (appears on hover over usernames in history tables) ---
      + '.badgePhoto { display: none; position: fixed; top: 100px; left: 100px; background-color: #f37d15; border: 1px solid #ccc; padding: 2px; z-index: 10; }'
      + '.badgePhoto img { width: 150px; height: auto; }'
      + 'td:hover .badgePhoto { display: block; }'

      // --- Right-click context menu (injected on ASIN/PO right-click) ---
      + '.custom-context-menu { background: #183D3D; border: 1px solid #040D12; border-radius: 4px; box-shadow: 0 4px 16px rgba(0,0,0,0.60); padding: 8px 0; min-width: 150px; max-width: 280px; isolation: isolate; }'
      + '.custom-context-menu .menu-item { color: #E0E0E0; cursor: pointer; padding: 8px 16px; font-size: 14px; transition: background-color 0.2s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }'
      + '.custom-context-menu .menu-item:hover { background-color: #2C5D5D; }'
      + '.custom-context-menu hr { border: none; border-top: 1px solid #040D12; margin: 4px 0; }'

      // --- Barcode modal (from "Show Barcode" in context menu) ---
      + '.barcode-modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000; }'
      + '.barcode-content { background: white; padding: 20px; border-radius: 5px; text-align: center; }'
      + '.barcode-close { margin-top: 10px; padding: 5px 15px; background: #183D3D; color: #E0E0E0; border: none; border-radius: 3px; cursor: pointer; }'
      + '.barcode-close:hover { background: #2C5D5D; }'

     // rno inventory/po style
      + '.rno-size-profile-row td { background-color: #e8f0fb; color: #1a5276; }'
      + '.asin-profile-row td { background-color: #f0f0f0; color: green; }'
      // --- FCR Plus: themed hover image popup ---
      + '.asin-image-container { background-color: #fff; border: 1px solid #ccc; }'

      // --- FCR Plus: printmon loading dialog ---
      + '.fcrp-dialog-loading { background-color: #fff; border: 2px solid #232f3e; color: #000; padding: 20px; }'

      // --- FCR Plus: FRX expired message ---
      + '.frx-expired-msg { font-size:11px; color:#b45309; font-style:italic; margin-left:8px; }'

    ;

        function buildDarkCSS(t) {
        return ''
        + 'body, .a-cal-labels, .a-popover-inner, #side-bar { background-color: ' + t.bg + '; color: ' + t.text + '; }'
        + 'table.a-bordered tr:nth-child(2n+1) { background-color: ' + t.surface + '; }'
        + 'table.a-bordered tr:nth-child(2n) { background-color: ' + t.bg + '; }'
        + '.prep-instructions-row td { background-color: ' + t.surface + ' !important; }'
        + 'table.a-bordered tr.odd td { background-color: ' + t.surface + ' !important; }'
        + 'table.a-bordered tr.even td { background-color: ' + t.bg + ' !important; }'
        + '.rno-size-profile-row td { background-color: ' + t.surface + ' !important; color: #5b9bd5 !important; }'
        + '.asin-profile-row td { background-color: ' + t.surface + ' !important; color: #33CC02 !important; }'
        + 'table.a-bordered td, table.a-bordered th { border-bottom: 1px solid ' + t.surface + '; }'
        + 'table.a-bordered { border: 1px solid ' + t.surface + '; }'
        + 'table.a-bordered tr:last-child td { border-color: ' + t.surface + '; }'
        + 'table.a-bordered tr:first-child th { background: ' + t.surface + '; color: ' + t.text + '; border-color: ' + t.surface + '; }'
        + 'table.a-keyvalue td, table.a-keyvalue th { border-top: 1px solid ' + t.accent + '; }'
        + 'table.a-keyvalue { border-bottom: 1px solid ' + t.accent + '; }'
        + '.a-keyvalue th { background-color: ' + t.accent + ' !important; color: ' + t.text + ' !important; }'
        + '.a-box, .a-cal-na, #fcrp_cfg, table.a-keyvalue th { background-color: ' + t.surface + '; border: 1px ' + t.accent + ' solid; color: ' + t.text + '; }'
        + '.a-box { border-top-color: ' + t.accent + ' !important; }'
        + '.a-box-title .a-box-inner, .a-popover-header, .aui-nav-row { color: ' + t.text + '; background: ' + t.surface + '; background: linear-gradient(to bottom, ' + t.surface + ', ' + t.accent + '); }'
        + '.p, .a-popover-inner, body a { color: ' + t.text + ' !important; }'
        + '.a-nostyle, .a-nostyle span, .logo-fc, .logo-research { color: ' + t.text + ' !important; }'
        + 'h6 { color: ' + t.text + '; }'
        + '.a-search input { color: ' + t.text + '; background-color: ' + t.surface + ' !important; border: 1px solid ' + t.accent + '; }'
        + 'a.a-link-section-expander { background-color: ' + t.surface + ' !important; }'
        + 'a.a-link-section-expander:hover, a.a-link-section-expander:focus { background-color: ' + t.accent + '; }'
        + '.a-expander-content { background-color: ' + t.surface + '; }'
        + '.a-section-expander-inner, .sidebar-expander-header { border-top: 1px solid ' + t.accent + '; }'
        + '.fcr-menu-container { display: flex; justify-content: flex-start; margin-bottom: 10px; margin-left: -10px; }'
        + '.fcr-sidebar-button { padding: 4px 8px; font-size: 14px; background-color: ' + t.accent + '; color: ' + t.text + '; text-shadow: 0 2px 0 rgb(0 0 0 / 25%); display: inline-flex; align-items: center; justify-content: center; position: relative; border: 0; z-index: 1; user-select: none; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; white-space: unset; text-decoration: none; font-weight: 900; transition: background-color 0.18s ease, box-shadow 0.18s ease; margin-right: 10px; }'
        + '.fcr-sidebar-button:before { background-color: ' + t.accent + ' !important; box-shadow: 0 -4px rgb(0 0 0 / 50%) inset, 0 4px rgb(255 255 255 / 20%) inset, -4px 0 rgb(255 255 255 / 20%) inset, 4px 0 rgb(0 0 0 / 50%) inset; }'
        + '.fcr-sidebar-button:hover:before { box-shadow: 0 -4px rgb(0 0 0 / 70%) inset, 0 4px rgb(255 255 255 / 8%) inset, -4px 0 rgb(255 255 255 / 8%) inset, 4px 0 rgb(0 0 0 / 70%) inset; }'
        + '#settings-info { background-color: ' + t.surface + '; border: 1px solid ' + t.accent + ' !important; color: ' + t.text + '; }'
        + '#settings-info label, #extra-settings-content label { color: ' + t.text + '; }'
        + '#settings-info label:hover, #extra-settings-content label:hover { background-color: ' + t.accent + '; }'
        + '#region-selector, #fc-type-selector, #theme-selector, #text-color-selector, #print-mode-selector { background-color: ' + t.bg + '; color: ' + t.text + '; border: 1px solid ' + t.accent + '; }'
        + '#extra-toggle-button { background-color: ' + t.accent + '; color: ' + t.text + '; border: none; }'
        + '#extra-toggle-button:hover { background-color: ' + t.hover + '; }'
        + '#extra-settings-content { background-color: ' + t.bg + '; border: 1px solid ' + t.accent + '; color: ' + t.text + '; }'
        + '#extra-settings-content p { color: #888; }'
        + '#quick-links-menu { background-color: ' + t.surface + '; border: 1px solid ' + t.accent + ' !important; }'
        + '.quick-links-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; }'
        + '.quick-link-button { text-align: center; padding: 4px 3px; background-color: ' + t.accent + '; color: ' + t.text + ' !important; text-decoration: none; border-radius: 3px; font-size: 11px; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }'
        + '.quick-link-button:hover { background-color: ' + t.hover + '; }'
        + '#printmonContainer { background-color: ' + t.surface + '; border: 1px solid ' + t.accent + '; padding: 3px; border-radius: 5px; }'
        + '#printmonContainer input[type="text"], #printmonContainer input[type="number"] { background-color: ' + t.bg + '; color: ' + t.text + '; border: 1px solid ' + t.accent + '; padding: 5px; margin-right: 5px; }'
        + '#printmonContainer input[type="text"]::placeholder { color: #888; }'
        + '#printmonShortcut { background-color: ' + t.accent + '; color: ' + t.text + '; border: none; padding: 5px 10px; cursor: pointer; transition: background-color 0.3s; }'
        + '#printmonShortcut:hover { background-color: ' + t.hover + '; }'
        + '.tools-dropdown-btn { background: ' + t.accent + '; box-shadow: 0 2px 8px rgba(0,0,0,0.35); color: white; border: 0; }'
        + '.tools-dropdown-btn:hover { background: ' + t.hover + '; }'
        + '.tools-dropdown-menu { position: fixed; background: ' + t.surface + '; border: 2px solid ' + t.accent + '; border-radius: 6px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); z-index: 99999; min-width: 180px; padding: 4px 0; }'
        + '.tools-dropdown-item { color: ' + t.text + '; }'
        + '.tools-dropdown-item:hover { background-color: ' + t.accent + '; }'
        + '.tools-dropdown-separator { border-top-color: ' + t.accent + '; }'
        + '.asin-image-container { background-color: ' + t.surface + ' !important; border: 1px solid ' + t.accent + ' !important; }'
        + '.fcrp-dialog-loading { background-color: ' + t.surface + ' !important; border-color: ' + t.accent + ' !important; color: ' + t.text + ' !important; }'
        + '[id^="print-dialog-"] { background-color: ' + t.surface + ' !important; border-color: ' + t.accent + ' !important; color: ' + t.text + ' !important; }'
        + '[id^="print-dialog-"] h3 { color: ' + t.text + ' !important; border-bottom-color: ' + t.accent + ' !important; }'
        + '[id^="print-dialog-"] p, [id^="print-dialog-"] strong { color: ' + t.text + ' !important; }'
        + '[id^="print-dialog-"] #qtyNum { background-color: ' + t.bg + ' !important; color: ' + t.text + ' !important; border-color: ' + t.accent + ' !important; }'
        + '[id^="print-dialog-"] #cancelBtn { background-color: ' + t.surface + ' !important; color: ' + t.text + ' !important; border-color: ' + t.accent + ' !important; }'
        + '#print-dialog-backdrop { background-color: rgba(0,0,0,0.6) !important; }'
        + '.zfcr-dialog { background-color: ' + t.surface + ' !important; border-color: ' + t.accent + ' !important; color: ' + t.text + ' !important; }'
        + '.zfcr-dialog h3, .zfcr-dialog-code { color: ' + t.text + ' !important; }'
        + '.zfcr-dialog-field, .zfcr-dialog-field strong { color: ' + t.text + ' !important; }'
        + '.zfcr-dialog-title { color: ' + t.text + ' !important; opacity:0.7; }'
        + '.zfcr-dialog-divider, .zfcr-dialog-actions { border-top-color: ' + t.accent + ' !important; }'
        + '.zfcr-dialog-row label, .zfcr-printer-row, .zfcr-printer-row label { color: ' + t.text + ' !important; }'
        + '.zfcr-qty-input, .zfcr-printer-select { background-color: ' + t.bg + ' !important; color: ' + t.text + ' !important; border-color: ' + t.accent + ' !important; }'
        + '.zfcr-mode-switch { background: ' + t.accent + ' !important; }'
        + '.zfcr-mode-btn { color: ' + t.text + '; }'
        + '.zfcr-mode-btn.active { background: ' + t.hover + ' !important; color: ' + t.text + ' !important; box-shadow: none !important; }'
        + '.zfcr-btn-cancel { background: ' + t.surface + ' !important; color: ' + t.text + ' !important; border-color: ' + t.accent + ' !important; }'
        + '.zfcr-adjust-row .adj-label, .zfcr-adjust-row .adj-value { color: ' + t.text + '; }'
        + '.zfcr-adjust-reset { background: ' + t.surface + ' !important; color: ' + t.text + ' !important; border-color: ' + t.accent + ' !important; }'
        + '.zfcr-status-msg.success { background: #1a3a1a !important; color: #a3e8a3 !important; }'
        + '.zfcr-status-msg.info { background: ' + t.accent + ' !important; color: ' + t.text + ' !important; }'
        + '.zfcr-status-msg.error { background: #3a1414 !important; color: #e8a3a3 !important; }'
        + '.zfcr-btn-group { border-color: ' + t.accent + ' !important; }'
        + '.zfcr-print-btn { background: ' + t.accent + ' !important; color: ' + t.text + ' !important; }'
        + '.zfcr-print-btn:hover { background: ' + t.hover + ' !important; }'
        + '.zfcr-arrow-btn { background: ' + t.surface + ' !important; color: ' + t.text + ' !important; border-left-color: ' + t.accent + ' !important; }'
        + '.zfcr-arrow-btn:hover { background: ' + t.accent + ' !important; }'
        + '.frx-split-btn .frx-dropdown { background: ' + t.surface + ' !important; border-color: ' + t.accent + ' !important; }'
        + '.frx-split-btn .frx-dropdown-item { color: ' + t.text + ' !important; }'
        + '.frx-split-btn .frx-dropdown-item:hover { background: ' + t.accent + ' !important; }'
        + '.frx-split-btn .frx-dropdown-item.active { background: ' + t.hover + ' !important; }'
        + '.barcode-content { background-color: ' + t.surface + ' !important; color: ' + t.text + '; }'
        + '.barcode-close { background-color: ' + t.accent + ' !important; color: ' + t.text + '; }'
        + '.barcode-close:hover { background-color: ' + t.hover + ' !important; }'
        ;
    }



    // --- Tailwind-style design tokens + utility layer ---
    // Inlined (CSP-safe, no CDN). Prefixed with `tw-` so utilities never collide
    // with the host FCResearch page's own classes. New/redesigned FCR UI is built
    // from these tokens + utilities instead of ad-hoc inline styles.
    var P = THEMES.fcrplus;
    var tailwind =
        ':root{'
        + '--fcr-bg:' + P.bg + ';--fcr-surface:' + P.surface + ';--fcr-surface-2:#0E2429;'
        + '--fcr-accent:' + P.accent + ';--fcr-hover:' + P.hover + ';'
        + '--fcr-text:' + P.text + ';--fcr-text-dim:#93A8A8;--fcr-text-mute:#5C7878;'
        + '--fcr-border:' + P.accent + ';--fcr-danger:#b45309;--fcr-success:#33CC02;--fcr-warn:#f59e0b;'
        + '--fcr-radius:8px;--fcr-radius-sm:6px;--fcr-shadow:0 8px 24px rgba(0,0,0,.5);'
        + "--fcr-font:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}"
        /* display / flex / grid */
        + '.tw-flex{display:flex}.tw-inline-flex{display:inline-flex}.tw-grid{display:grid}'
        + '.tw-block{display:block}.tw-inline-block{display:inline-block}.tw-hidden{display:none}'
        + '.tw-flex-col{flex-direction:column}.tw-flex-row{flex-direction:row}.tw-flex-wrap{flex-wrap:wrap}'
        + '.tw-items-center{align-items:center}.tw-items-start{align-items:flex-start}.tw-items-end{align-items:flex-end}'
        + '.tw-justify-center{justify-content:center}.tw-justify-between{justify-content:space-between}'
        + '.tw-justify-start{justify-content:flex-start}.tw-justify-end{justify-content:flex-end}'
        + '.tw-flex-1{flex:1 1 0%}.tw-grow{flex-grow:1}.tw-shrink-0{flex-shrink:0}'
        /* gap */
        + '.tw-gap-1{gap:4px}.tw-gap-2{gap:8px}.tw-gap-3{gap:12px}.tw-gap-4{gap:16px}'
        /* padding / margin */
        + '.tw-p-0{padding:0}.tw-p-1{padding:4px}.tw-p-2{padding:8px}.tw-p-3{padding:12px}.tw-p-4{padding:16px}'
        + '.tw-px-2{padding-left:8px;padding-right:8px}.tw-px-3{padding-left:12px;padding-right:12px}'
        + '.tw-py-1{padding-top:4px;padding-bottom:4px}.tw-py-2{padding-top:8px;padding-bottom:8px}'
        + '.tw-m-0{margin:0}.tw-mt-1{margin-top:4px}.tw-mt-2{margin-top:8px}.tw-mt-3{margin-top:12px}'
        + '.tw-mb-1{margin-bottom:4px}.tw-mb-2{margin-bottom:8px}.tw-mb-3{margin-bottom:12px}'
        + '.tw-ml-2{margin-left:8px}.tw-mr-2{margin-right:8px}.tw-mx-auto{margin-left:auto;margin-right:auto}'
        /* sizing */
        + '.tw-w-full{width:100%}.tw-w-auto{width:auto}.tw-max-w-full{max-width:100%}.tw-h-full{height:100%}'
        /* typography */
        + '.tw-text-xs{font-size:11px}.tw-text-sm{font-size:12px}.tw-text-base{font-size:14px}.tw-text-lg{font-size:16px}'
        + '.tw-font-medium{font-weight:500}.tw-font-semibold{font-weight:600}.tw-font-bold{font-weight:700}'
        + '.tw-uppercase{text-transform:uppercase}.tw-tracking-wide{letter-spacing:.04em}'
        + '.tw-text-center{text-align:center}.tw-text-left{text-align:left}.tw-text-right{text-align:right}'
        + '.tw-truncate{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
        /* text colors */
        + '.tw-text{color:var(--fcr-text)}.tw-text-dim{color:var(--fcr-text-dim)}.tw-text-mute{color:var(--fcr-text-mute)}'
        + '.tw-text-accent{color:var(--fcr-hover)}.tw-text-danger{color:var(--fcr-danger)}.tw-text-success{color:var(--fcr-success)}'
        /* backgrounds */
        + '.tw-bg-bg{background:var(--fcr-bg)}.tw-bg-surface{background:var(--fcr-surface)}.tw-bg-surface-2{background:var(--fcr-surface-2)}'
        + '.tw-bg-accent{background:var(--fcr-accent)}.tw-bg-transparent{background:transparent}'
        /* border / radius / shadow */
        + '.tw-border{border:1px solid var(--fcr-border)}.tw-border-accent{border-color:var(--fcr-accent)}.tw-border-0{border:0}'
        + '.tw-rounded{border-radius:var(--fcr-radius)}.tw-rounded-sm{border-radius:var(--fcr-radius-sm)}.tw-rounded-full{border-radius:999px}'
        + '.tw-shadow{box-shadow:var(--fcr-shadow)}'
        /* misc */
        + '.tw-cursor-pointer{cursor:pointer}.tw-select-none{user-select:none}.tw-transition{transition:all .18s ease}'
        + '.tw-relative{position:relative}.tw-absolute{position:absolute}.tw-fixed{position:fixed}.tw-z-10{z-index:10}'
        /* composed component helpers */
        + '.tw-card{background:var(--fcr-surface);border:1px solid var(--fcr-accent);border-radius:var(--fcr-radius);color:var(--fcr-text)}'
        + '.tw-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:7px 14px;border:0;border-radius:var(--fcr-radius-sm);font:600 12px/1 var(--fcr-font);cursor:pointer;transition:background .18s ease}'
        + '.tw-btn-accent{background:var(--fcr-accent);color:var(--fcr-text)}.tw-btn-accent:hover{background:var(--fcr-hover)}'
        + '.tw-btn-ghost{background:transparent;color:var(--fcr-text);border:1px solid var(--fcr-accent)}.tw-btn-ghost:hover{background:var(--fcr-accent)}'
        + '.tw-input{width:100%;padding:8px 10px;background:var(--fcr-bg);color:var(--fcr-text);border:1px solid var(--fcr-accent);border-radius:var(--fcr-radius-sm);font:14px var(--fcr-font);box-sizing:border-box}'
        + '.tw-input::placeholder{color:var(--fcr-text-mute)}'
        + '.tw-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;font:600 11px var(--fcr-font);background:var(--fcr-accent);color:var(--fcr-text)}'
        ;

    function applyBase() {
      GM_addStyle(tailwind);
      GM_addStyle(base);
    }

           function applyDark() {
        var existing = document.getElementById('dark-mode-style');
        if (featureOn('darkMode')) {
            var t = THEMES[THEME] || THEMES.fcrplus;
            var textOverride = TEXT_COLORS[TEXT_COLOR] ? TEXT_COLORS[TEXT_COLOR].value : null;
            var finalText = textOverride || t.text;
            var themed = JSON.parse(JSON.stringify(t));
            themed.text = finalText;
            var css = buildDarkCSS(themed);
            if (existing) {
                existing.textContent = css;
            } else {
                $('<style id="dark-mode-style">').text(css).appendTo('body');
            }
        } else {
            if (existing) existing.remove();
        }
    }


    return { applyBase: applyBase, applyDark: applyDark };
  })();



  // ======= [S4] PRINTING =======
  //
  // ASIN/barcode printing via Printmon (localhost:5965).
  // Includes: print dialog, alt+click, printmon shortcut bar.

    // --- Print mode router ---  //s15
function getPrintMode() {
    return GM_getValue('printMode', 'printmon');
}  //s15

function setPrintMode(mode) {
    GM_setValue('printMode', mode);
    PRINT_MODE = mode;
}  //s15

function routePrint(code, quantity, description) {
    if (PRINT_MODE === 'zebra') {  //s15
        Zebra.quickPrint(code, quantity, description);  //s15
    } else {  //s15
        Printing.sendPrintXHR(code, quantity, description);  //s4
    }  //s15
}

function routePrintDialog(code, type, title) {
    if (PRINT_MODE === 'zebra') {  //s15
        Zebra.showDialog(code, type, title);  //s15
    } else {  //s15
        Printing.showDialog(code, type, title);  //s4
    }  //s15
}

function routePrintFromMenu(asin) {
    if (PRINT_MODE === 'zebra') {
        Zebra.handlePrintFromMenu(asin);
    } else {
        Printing.handlePrintFromMenu(asin);
    }
}

////////////////////////////////////////////////////

  var Printing = (function () {



   function sendPrintXHR(code, quantity, description) {
    var encoded = asciihex(code.trim());
    var badge = $.cookie('fcmenu-employeeId') || '';
    var desc = description ? asciihex(description) : '';
    var params = 'action=print&type=barcode'
        + '&data=' + encoded
        + '&text=' + encoded
        + '&quantity=' + quantity
        + '&badgeid=' + badge
        + '&desc=' + desc + '&seq=' + genId();

      var requestUrl = CONFIG.printHost + '?' + params;
      logAction('PRINT', 'Sending to Printmon | code: ' + code + ' | qty: ' + quantity + ' | url: ' + requestUrl);

      GM_xmlhttpRequest({
        method: 'GET',
        url: requestUrl,
        timeout: 5000,
        onload: function (r) {
          if (r.responseText === 'valid') {
            logAction('PRINT OK', 'Printmon accepted | code: ' + code + ' | status: ' + r.status);
          } else if (r.responseText === 'invalid') {
            logAction('PRINT FAIL', 'Printmon rejected | code: ' + code + ' | status: ' + r.status + ' | response: ' + r.responseText);
            showToast('Print failed: ' + code + ' — check printer connection', 'error');
          } else {
            logAction('PRINT FAIL', 'Unexpected response | status: ' + r.status + ' | body: ' + (r.responseText || '(empty)').substring(0, 100) + ' | url: ' + requestUrl);
            showToast('Printmon not detected — is it installed and running?', 'error');
          }
        },
        onerror: function (r) {
          logAction('PRINT FAIL', 'Connection refused | url: ' + requestUrl + ' | error: ' + (r.error || 'network error') + ' | status: ' + (r.status || 0));
          showToast('Cannot connect to Printmon — make sure it is running', 'error');
        },
        ontimeout: function () {
          logAction('PRINT FAIL', 'Timed out after 5s | url: ' + requestUrl + ' | Printmon may be hung or not running');
          showToast('Printmon timed out — is it running?', 'error');
        }
      });
    }


    function fetchTitle(asin) {
      var fc = $.cookie('fcmenu-warehouseId');
      if (!fc) return Promise.resolve('No Title Found');

      return fetchProductPage(asin, fc).then(function (doc) {
        return readProductField(doc, 'Title') || 'No Title Found';
      }).catch(function () { return 'No Title Found'; });
    }

    function showDialog(code, type, title) {
      $('#print-dialog-backdrop, [id^="print-dialog-"]').remove();

      var backdrop = $('<div id="print-dialog-backdrop">').css({
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999
      });

      var dialog = $('<div id="print-dialog-' + code + '">').css({
    position: 'fixed', top: '50%', left: '50%',
    transform: 'translate(-50%,-50%)',
    backgroundColor: '#fff', padding: '25px',
    border: '2px solid #232f3e', borderRadius: '8px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)', zIndex: 10000,
    color: '#000', fontFamily: 'Arial, sans-serif',
    minWidth: '400px', maxWidth: '500px'
  }).html(
    '<div style="margin-bottom:10px"><span style="display:inline-block;font-size:9px;font-weight:700;background:#ff9900;color:#fff;padding:2px 8px;border-radius:3px;text-transform:uppercase;letter-spacing:.5px">Print via Printmon</span></div>'
    + '<h3 style="margin:0 0 15px;color:#232f3e;font-size:18px;border-bottom:2px solid #ff9900;padding-bottom:10px">'
    + 'Print ' + type + ': <span style="color:#ff9900">' + code + '</span></h3>'
    + '<p style="margin:15px 0;color:#000;font-size:14px;line-height:1.5">'
    + '<strong style="color:#232f3e">Title:</strong> ' + title + '</p>'
    + '<div style="margin:20px 0;display:flex;align-items:center;gap:10px">'
    + '<label for="qtyNum" style="color:#232f3e;font-weight:bold;font-size:14px">Quantity:</label>'
    + '<input type="number" id="qtyNum" min="1" max="50" value="1" style="padding:8px 12px;width:80px;border:2px solid #ddd;border-radius:4px;font-size:14px">'
    + '<button id="printBtn" style="padding:10px 20px;cursor:pointer;background-color:#ff9900;border:none;border-radius:4px;color:white;font-weight:bold;font-size:14px;box-shadow:0 2px 5px rgba(255,153,0,0.3)">Print</button>'
    + '</div>'
    + '<div style="text-align:right;margin-top:25px;padding-top:15px;border-top:1px solid #eee">'
    + '<button id="cancelBtn" style="padding:10px 20px;cursor:pointer;background-color:#f0f0f0;border:1px solid #ccc;border-radius:4px;color:#333;font-size:14px;font-weight:600">Cancel</button>'
    + '</div>'
  );

      $('body').append(backdrop).append(dialog);


      $('#printBtn').hover(
        function () { $(this).css({ backgroundColor: '#e88b00', boxShadow: '0 4px 8px rgba(255,153,0,0.4)', transform: 'translateY(-1px)' }); },
        function () { $(this).css({ backgroundColor: '#ff9900', boxShadow: '0 2px 5px rgba(255,153,0,0.3)', transform: 'translateY(0)' }); }
      );
      $('#cancelBtn').hover(
        function () { $(this).css({ backgroundColor: '#e0e0e0', borderColor: '#999' }); },
        function () { $(this).css({ backgroundColor: '#f0f0f0', borderColor: '#ccc' }); }
      );
      $('#qtyNum').focus(function () { $(this).css('borderColor', '#ff9900'); })
                  .blur(function () { $(this).css('borderColor', '#ddd'); });

      var close = function () { dialog.remove(); backdrop.remove(); };
      setTimeout(function () { backdrop.click(close); }, 50);
      $('#cancelBtn').click(close);
      $('#printBtn').click(function () {
        var qty = parseInt($('#qtyNum').val(), 10);
        if (qty > 0) { sendPrintXHR(code, qty, title); close(); }
        else { alert('Please enter a quantity greater than 0'); }
      });
      $('#qtyNum').keypress(function (e) { if (e.key === 'Enter') $('#printBtn').click(); });
      $('#qtyNum').focus().select();
    }

    /** Used by context menu to print an ASIN with title lookup */
      function handlePrintFromMenu(asin) {
        var loading = $('<div class="fcrp-dialog-loading">').css({
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        borderRadius: '8px', boxShadow: '0 4px 24px rgba(0,0,0,0.45)',
        zIndex: 10001, fontFamily: 'Arial, sans-serif'
    }).html('<p style="margin:0">Loading ASIN info…</p>');
    $('body').append(loading);

    Printing.fetchTitle(asin).then(function (title) {
        loading.remove();
        showDialog(asin, 'ASIN', title);
    }).catch(function () {
        loading.remove();
        showDialog(asin, 'ASIN', 'No Title Found');
        });
      }


   function addButtons() {
    if (!featureOn('asinPrinting')) return;

    waitForEl('table').then(function (table) {
        if (!table.rows[0].cells[0].innerText.includes('ASIN')) return;

        var asinLink = table.rows[0].cells[1].querySelector('a');
        if (!asinLink) return;

        var asin = asinLink.textContent.trim();
        var title = 'No Title Found';
        var fnsku = '';

        for (var i = 1; i < table.rows.length; i++) {
            var header = table.rows[i].cells[0].innerText.trim();
            if (header === 'Title') {
                var cell = table.rows[i].cells[1];
                var link = cell.querySelector('a');
                title = link ? link.textContent.trim() : cell.textContent.trim();
            }
            if (header === 'FNSku') {
                var fLink = table.rows[i].cells[1].querySelector('a');
                if (fLink) fnsku = fLink.textContent.trim();
            }
        }

        // --- If both ASIN and FNSKU exist, only show FNSKU print button ---  //s15
        if (fnsku && fnsku !== asin) {  //s15
            addBtnToRow(table.rows[1], fnsku, 'FNSku', title);  //s15
        } else {  //s15
            addBtnToRow(table.rows[0], asin, 'ASIN', title);
            if (fnsku) addBtnToRow(table.rows[1], fnsku, 'FNSku', title);
        }  //s15
      });
    }


           function addBtnToRow(row, code, type, title) {
        var cell = row.cells[1];
        if (!cell || cell.querySelector('.asin-print-button') || cell.querySelector('.zfcr-btn-group')) return;

        if (PRINT_MODE === 'zebra') { //s15
            Zebra.addButtonGroup(cell, code, type, title); //s15
            return; //s15
        } //s15

        var btn = document.createElement('button'); //s4
        btn.textContent = 'Print'; //s4
        btn.className = 'asin-print-button'; //s4
        btn.style.marginLeft = '10px'; //s4
        btn.addEventListener('click', function () { showDialog(code, type, title); }); //s4
        cell.appendChild(btn); //s4
    }


      function initAltClick() {

      document.body.addEventListener('click', function (e) {
        if (!e.altKey || e.ctrlKey) return;
        var text = e.target.innerText.split('\n')[0].trim();

        if (text.includes('LPN')) {
          if (confirm('Barcode: ' + text + '\n\nLPNs are unique and should not be printed.\nPress OK to continue.')) {
            routePrint(text, 1, '');  //s15
          }
          return;
        }

        var asinMatch = text.match(/\b(B0|X0)[A-Z0-9]{8}\b/);
        if (asinMatch) {
          fetchTitle(asinMatch[0]).then(function (title) {
            routePrint(asinMatch[0], 1, title);  //s15
          });
        } else {
         routePrint(text, 1, ''); //s15
        }
      });
    }

    function initShortcutBar(leftOffset) {
      if (document.querySelector('#printmonContainer')) return;
      if (window.location.href.includes('/search')) return;

      var container = document.createElement('div');
      container.id = 'printmonContainer';
      container.style.cssText = 'display:inline-block;position:fixed;left:' + leftOffset + 'px;top:10px;z-index:1000';

      var input = document.createElement('input');
      input.type = 'text';
      input.id = 'barcodeSearchText';
      input.placeholder = 'Print Shortcut';
      input.autocomplete = 'off';
      input.style.cssText = 'width:140px';

      var qty = document.createElement('input');
      qty.type = 'number';
      qty.id = 'barcodeSearchQuantity';
      qty.value = '1';
      qty.min = '1';
      qty.style.cssText = 'width:50px;margin-left:5px';

      var btn = document.createElement('button');
      btn.id = 'printmonShortcut';
      btn.textContent = 'Print';
      btn.style.cssText = 'height:22px;font-size:12px;padding:2px 5px;margin-left:5px';

      container.appendChild(input);
      container.appendChild(qty);
      container.appendChild(btn);
      document.body.appendChild(container);

      function doPrint() {
        var code = input.value.trim();
        if (!code) return;

        var qtyVal = parseInt(qty.value, 10) || 1;
        var asinMatch = code.match(/^(B0|X0)[A-Z0-9]{8}$/i);

        if (asinMatch) {
            // B0/X0 detected — fetch title first, then print with title
            input.value = '';
            input.focus();
            input.placeholder = 'Fetching title...';

            Printing.fetchTitle(code.toUpperCase()).then(function (title) {
                if (PRINT_MODE === 'zebra') {  //s15
                    Zebra.quickPrint(code.toUpperCase(), qtyVal, title);  //s15
                } else {  //s15
                    sendPrintXHR(code.toUpperCase(), qtyVal, title);  //s4
                }  //s15
                input.placeholder = 'Print Shortcut';
            }).catch(function () {
                // Title fetch failed — print without title rather than blocking
                if (PRINT_MODE === 'zebra') {  //s15
                    Zebra.quickPrint(code.toUpperCase(), qtyVal, '');  //s15
                } else {  //s15
                    sendPrintXHR(code.toUpperCase(), qtyVal, '');  //s4
                }  //s15
                input.placeholder = 'Print Shortcut';
            });
        } else {
            // Not an ASIN — print immediately (LPN, container, etc.)
            if (PRINT_MODE === 'zebra') {  //s15
                Zebra.quickPrint(code, qtyVal, '');  //s15
            } else {  //s15
                sendPrintXHR(code, qtyVal, '');  //s4
            }  //s15
            input.value = '';
            input.focus();
        }
      }

      btn.onclick = doPrint;
      input.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); doPrint(); }
      });
    }

    return {
      sendPrintXHR: sendPrintXHR,
      fetchTitle: fetchTitle,
      showDialog: showDialog,
      handlePrintFromMenu: handlePrintFromMenu,
      addButtons: addButtons,
      initAltClick: initAltClick,
      initShortcutBar: initShortcutBar
    };
  })();


      // ======= [S5] PREP =======
    //
    // ASIN-level and Research-level prep instructions.
    // Auto-display on product pages, batch processing for PO tables.

    var Prep = (function () {
        var tablesProcessed = new WeakSet();
        var added = false;

        function findISD() {
            var pattern = /\b\d{10,18}\b/;
            var section = document.querySelector('div[data-section-type="shipment"]');
            if (section) {
                var rows = section.querySelectorAll('tbody tr');
                for (var i = 0; i < rows.length; i++) {
                    var cells = rows[i].querySelectorAll('td');
                    if (cells.length > 1) {
                        var m = cells[1].textContent.match(pattern);
                        if (m) return m[0];
                    }
                }
            }
            var bodyMatch = document.body.innerText.match(pattern);
            return bodyMatch ? bodyMatch[0] : null;
        }

                function fetchAsinLevel(asin) {
            var url = getURL('prepmanager') + '/view/' + asin + '?region=' + REGION;
            return new Promise(function (resolve, reject) {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    onload: function (r) {
                        if (r.status !== 200) {
                            resolve('ERROR: Status ' + r.status);
                            return;
                        }
                        var doc = new DOMParser().parseFromString(r.responseText, 'text/html');
                        var instructionsDiv = doc.querySelector('#instructions');
                        if (!instructionsDiv) {
                            resolve('ERROR: ASIN not found');
                            return;
                        }
                        var items = Array.from(instructionsDiv.querySelectorAll('ul > li'));
                        if (!items.length) {
                            resolve('No Prep');
                            return;
                        }
                        var result = items
                            .map(function (el) { return el.textContent.trim(); })
                            .filter(function (t) {
                                return PREP_KEYWORDS.includes(t) || t.includes('Asin') || t.includes('Bubble');
                            })
                            .map(function (t) {
                                if (t.includes('Asin')) return 'Asin Stickering';
                                if (t.includes('Bubble')) return 'Bubble wrap/Bubble bag';
                                return t;
                            })
                            .join(', ');
                        resolve(result || 'No Prep');
                    },
                    onerror: function () {
                        resolve('ERROR: Network failure');
                    }
                });
            });
        }


        // original version: fetchResearch (ISD/shipment based, broken by prepmanager JS regression)
        // Kept for when prepmanager fixes their jQuery.browser bug
        function fetchResearch(isd, asin) {
            var fc = getFC();
            if (!fc) return Promise.reject(new Error('No FC'));
            var url = getURL('prepmanager') + '/research?fc=' + fc + '&isd=' + isd + '&productBarcode=' + asin;
            return new Promise(function (resolve, reject) {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    onload: function (r) {
                        if (r.status !== 200) { resolve({ instructions: 'ERROR: Status ' + r.status, isPrep: 'unknown' }); return; }
                        var doc = new DOMParser().parseFromString(r.responseText, 'text/html');
                        var div = doc.querySelector('#instructions');
                        if (!div) { resolve({ instructions: 'ERROR: No prep data (verify shipment)', isPrep: 'unknown' }); return; }
                        var matched = [];
                        var hasAmazon = false;
                        var hasUnknown = false;
                        div.querySelectorAll('ul > li').forEach(function (item) {
                            var instructionText = item.childNodes[0].textContent.trim();
                            var respItem = Array.from(item.querySelectorAll('ul li')).find(function (li) {
                                return li.textContent.includes('Prep Responsibility:');
                            });
                            var responsibility = respItem ? (respItem.querySelector('strong') || {}).textContent : 'Unknown';
                            PREP_KEYWORDS.forEach(function (kw) {
                                if (instructionText.toLowerCase().includes(kw.toLowerCase())) {
                                    if (responsibility === 'AMAZON_PERFORMED' || responsibility === 'VENDOR_PERFORMED') {
                                        var entry = kw + ' - ' + responsibility;
                                        if (responsibility === 'AMAZON_PERFORMED') {
                                            var certItem = Array.from(item.querySelectorAll('ul li')).find(function (li) {
                                                return li.textContent.includes('Certified Level:');
                                            });
                                            var cert = certItem ? (certItem.querySelector('strong') || {}).textContent : 'Unknown';
                                            entry += '(Certified Level: ' + cert + ')';
                                            hasAmazon = true;
                                        }
                                        matched.push(entry);
                                    } else {
                                        hasUnknown = true;
                                        matched.push(kw + ' - Unknown');
                                    }
                                }
                            });
                        });
                        if (!matched.length) resolve({ instructions: 'No Prep', isPrep: false });
                        else if (hasUnknown && !hasAmazon) resolve({ instructions: matched, isPrep: 'unknown' });
                        else resolve({ instructions: matched, isPrep: hasAmazon });
                    },
                    onerror: function () { resolve({ instructions: 'ERROR: Network failure', isPrep: 'unknown' }); }
                });
            });
        }

        // v2: vendor endpoint, no shipment needed. Gets prep via /vendor/{vendorCode}/{asin}
        // Reads the history table for the latest entry (most recent date).
        // AMAZON_PERFORMED = always pink for visibility (not fully accurate against actual PO).
        function fetchVendorState(asin, vendorCode) {
            var url = getURL('prepmanager') + '/vendor/' + vendorCode + '/' + asin + '?region=' + REGION;
            return new Promise(function (resolve) {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    timeout: 10000,
                    onload: function (r) {
                        if (r.status !== 200) { resolve({ instructions: 'ERROR: Status ' + r.status, isPrep: 'unknown' }); return; }
                        var doc = new DOMParser().parseFromString(r.responseText, 'text/html');

                        // Read history table: get the latest row (last in tbody, sorted by date ascending)
                        var rows = doc.querySelectorAll('#vendorPrepHistory tbody tr');
                        if (!rows.length) { resolve({ instructions: 'No Prep', isPrep: false }); return; }

                        // Last row is most recent
                        var latest = rows[rows.length - 1];
                        var cells = latest.querySelectorAll('td');
                        // cells[0] = Instructions (ul > li), cells[1] = Global Vendor State, cells[2] = Modified Date
                        var instrItems = [];
                        var lis = cells[0] ? cells[0].querySelectorAll('li') : [];
                        for (var i = 0; i < lis.length; i++) { instrItems.push(lis[i].textContent.trim()); }
                        var vendorState = cells[1] ? cells[1].textContent.trim() : '';

                        // AMAZON_PERFORMED = always pink for visibility (not fully accurate against actual PO)
                        if (vendorState === 'AMAZON_PERFORMED') {
                            var realInstr = instrItems.filter(function (s) { return s && s !== 'no_prep'; });
                            var display = realInstr.length ? realInstr.join(', ') : 'Amazon Performed';
                            display += ' (' + vendorState + ')';
                            resolve({ instructions: display, isPrep: true });
                            return;
                        }

                        // Non-AMAZON_PERFORMED: gray pill
                        var allInstr = instrItems.filter(function (s) { return s && s !== 'no_prep'; });
                        var grayDisplay = allInstr.length ? allInstr.join(', ') : 'No Prep';
                        if (vendorState) grayDisplay += ' (' + vendorState + ')';
                        resolve({ instructions: grayDisplay, isPrep: false });
                    },
                    onerror: function () { resolve({ instructions: 'ERROR: Network failure', isPrep: 'unknown' }); },
                    ontimeout: function () { resolve({ instructions: 'ERROR: Timeout', isPrep: 'unknown' }); }
                });
            });
        }

                function processRows(rows, resultsEl, useResearch) {
            resultsEl.textContent = 'Loading prep...';
            resultsEl.style.color = '';

            var isd = null;
            if (useResearch) {
                isd = findISD();
                if (!isd) {
                    alert('Shipment ID not found. Research Prep requires a Shipment section on the page.');
                    resultsEl.textContent = '';
                    return;
                }
            }

            document.querySelectorAll('.prep-instructions-row').forEach(function (r) { r.remove(); });
            Pills.clear('prep');

            var counts = { prep: 0, noPrep: 0, unknown: 0 };

            var promises = Array.from(rows).map(function (row) {
                var asinCell = row.children[1];
                var img = asinCell.querySelector('img');
                var link = asinCell.querySelector('a');
                var asin = img ? img.getAttribute('data-asin') : (link ? link.textContent : asinCell.textContent.trim());

                var fetcher;
                if (useResearch) {
                    fetcher = fetchResearch(isd, asin);
                } else {
                    fetcher = fetchAsinLevel(asin);
                }

                return fetcher.then(function (result) {
                    var instructions, isPrep;
                    if (useResearch) {
                        instructions = Array.isArray(result.instructions) ? result.instructions.join(', ') : result.instructions;
                        isPrep = result.isPrep;
                    } else {
                        instructions = result;
                        isPrep = (result !== 'No Prep');
                    }

                    // Pill colors (hardcoded, theme-independent)
                    var pillBg, pillFg, pillText, pillLabel;
                    if (instructions.startsWith('ERROR:')) {
                        pillBg = '#cc1414'; pillFg = '#ffffff'; pillText = instructions; pillLabel = 'Prep';
                        counts.unknown++;
                    } else if (isPrep === 'unknown') {
                        pillBg = '#FFEB3B'; pillFg = '#000000'; pillText = instructions; pillLabel = 'Prep';
                        counts.unknown++;
                    } else if (isPrep) {
                        // Pink on black. Color alone communicates 'this is prep', so no label prefix.
                        pillBg = '#000000'; pillFg = '#FFC0CB'; pillText = instructions; pillLabel = '';
                        counts.prep++;
                    } else {
                        pillBg = '#37474F'; pillFg = '#B0BEC5'; pillText = 'Not Prep'; pillLabel = '';
                        counts.noPrep++;
                    }

                    Pills.add(row, {
                        kind: 'prep',
                        label: pillLabel,
                        text: pillText,
                        full: pillText,
                        bg: pillBg,
                        fg: pillFg
                    });
                }).catch(function (err) {
                    console.error('Prep error for ' + asin + ':', err);
                });
            });

            Promise.all(promises).then(function () {
                resultsEl.textContent = 'Prep: ' + counts.prep + ' | No Prep: ' + counts.noPrep + ' | Unknown: ' + counts.unknown;
                expandDataTable('#table-purchase-order-item');
                expandDataTable('#table-inventory');
            });
        }

        function processRowsVendor(rows, resultsEl) {
            resultsEl.textContent = 'Loading vendor state...';
            resultsEl.style.color = '';

            document.querySelectorAll('.prep-instructions-row').forEach(function (r) { r.remove(); });
            Pills.clear('prep');

            var counts = { prep: 0, noPrep: 0, unknown: 0 };

            var promises = Array.from(rows).map(function (row) {
                var asinCell = row.children[1];
                var img = asinCell.querySelector('img');
                var link = asinCell.querySelector('a');
                var asin = img ? img.getAttribute('data-asin') : (link ? link.textContent : asinCell.textContent.trim());

                var vendorCell = row.children[2];
                var vendorCode = vendorCell ? vendorCell.textContent.trim() : '';
                var fetcher;
                if (!vendorCode) {
                    fetcher = Promise.resolve({ instructions: 'ERROR: No vendor code', isPrep: 'unknown' });
                } else {
                    fetcher = fetchVendorState(asin, vendorCode);
                }

                return fetcher.then(function (result) {
                    var instructions = Array.isArray(result.instructions) ? result.instructions.join(', ') : result.instructions;
                    var isPrep = result.isPrep;

                    var pillBg, pillFg, pillText, pillLabel;
                    if (instructions.startsWith('ERROR:')) {
                        pillBg = '#cc1414'; pillFg = '#ffffff'; pillText = instructions; pillLabel = 'Prep';
                        counts.unknown++;
                    } else if (isPrep === 'unknown') {
                        pillBg = '#FFEB3B'; pillFg = '#000000'; pillText = instructions; pillLabel = 'Prep';
                        counts.unknown++;
                    } else if (isPrep) {
                        pillBg = '#000000'; pillFg = '#FFC0CB'; pillText = instructions; pillLabel = '';
                        counts.prep++;
                    } else {
                        pillBg = '#37474F'; pillFg = '#B0BEC5'; pillText = 'No Prep'; pillLabel = '';
                        counts.noPrep++;
                    }

                    Pills.add(row, {
                        kind: 'prep',
                        label: pillLabel,
                        text: pillText,
                        full: pillText,
                        bg: pillBg,
                        fg: pillFg
                    });
                }).catch(function (err) {
                    console.error('Vendor state error for ' + asin + ':', err);
                });
            });

            Promise.all(promises).then(function () {
                resultsEl.textContent = 'Prep: ' + counts.prep + ' | No Prep: ' + counts.noPrep + ' | Unknown: ' + counts.unknown;
                expandDataTable('#table-purchase-order-item');
            });
        }


        function autoAdd() {
            if (!featureOn('prepFunctionality')) return;

            waitForEl('table[data-row-id]').then(function (table) {
                var tables = [table];
                tables.forEach(function (table) {
                    if (table.querySelector('.prep-instructions-row')) return;
                    if (tablesProcessed.has(table)) return;

                    var asinRow = Array.from(table.rows).find(function (r) {
                        return r.cells[0].textContent.trim() === 'ASIN';
                    });
                    if (!asinRow) return;

                    tablesProcessed.add(table);

                    var cell = asinRow.cells[1];
                    var asin = cell.querySelector('a') ? cell.querySelector('a').textContent.trim() : cell.textContent.trim();

                    setTimeout(function () {
                        if (table.querySelector('.prep-instructions-row')) return;

                        fetchAsinLevel(asin).then(function (instructions) {
                            if (table.querySelector('.prep-instructions-row')) return;

                            var titleRow;
                            for (var i = 0; i < table.rows.length; i++) {
                                if (table.rows[i].cells[0].textContent.trim() === 'Title') {
                                    titleRow = table.rows[i];
                                    break;
                                }
                            }
                            if (!titleRow) return;

                            var newRow = document.createElement('tr');
                            newRow.className = 'prep-instructions-row';
                            var th = document.createElement('th');
                            var td = document.createElement('td');

                            th.textContent = 'Prep:';
                            th.style.fontWeight = 'bold';
                            td.textContent = instructions;
                            td.style.fontWeight = 'bold';
                            if (instructions.startsWith('ERROR:')) {
                                td.style.color = 'white';
                                td.style.backgroundColor = '#ff0000';
                            } else if (instructions !== 'No Prep') {
                                td.style.color = 'pink';
                                td.style.backgroundColor = 'black';
                            } else {
                                td.style.color = '#f37d15';
                            }


                            newRow.className = table.rows[0].className;
                            th.className = table.rows[0].cells[0].className;
                            td.className = table.rows[0].cells[1].className;

                            newRow.appendChild(th);
                            newRow.appendChild(td);
                            titleRow.parentNode.insertBefore(newRow, titleRow.nextSibling);
                        }).catch(function (err) {
                            console.error('Prep error for ASIN ' + asin + ':', err);
                            tablesProcessed.delete(table);
                        });
                    }, 1000);
                });
            }).catch(function () {});

            added = true;
        }

        return {
            autoAdd: autoAdd,
            processRows: processRows,
            processRowsVendor: processRowsVendor,
            findISD: findISD,
            resetAdded: function () { added = false; },
            wasAdded: function () { return added; }
        };
    })();



    // ======= [S6] PROFILER (Manual + RNO) ======= //note: manual needs to go, math based only.
    //
    // Bin type classification from dimensions (manual) and
    // RNO ASIN profiler (official tool, needs one time auth).

    var Profiler = (function () {
        var rnoToken = null;
        var rnoTokenTime = 0;
        var asinCache = new Map();
        var fcCode = null;
        var rnoChecked = false;



        // --- RNO profiler (official tool) ---
        function getRNOToken(fc) {
            if (rnoToken && (Date.now() - rnoTokenTime < CONFIG.rnoTokenLifetime)) {
                return Promise.resolve(rnoToken);
            }
            return new Promise(function (resolve) {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: 'https://rno-tools.corp.amazon.com/kiosk/asin_profile/app?fc=' + fc,
                    withCredentials: true,
                    onload: function (r) {
                        var doc = new DOMParser().parseFromString(r.responseText, 'text/html');
                        var el = doc.querySelector('#csrf_token');
                        var token = el ? el.value : null;
                        if (token) { rnoToken = token; rnoTokenTime = Date.now(); }
                        resolve(token);
                    },
                    onerror: function () { resolve(null); }
                });
            });
        }

        function rnoLookup(asin, fc, token) {
            return new Promise(function (resolve) {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: 'https://rno-tools.corp.amazon.com/kiosk/asin_profile/app?fc=' + fc,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Origin': 'https://rno-tools.corp.amazon.com',
                        'Referer': 'https://rno-tools.corp.amazon.com/kiosk/asin_profile/app?fc=' + fc
                    },
                    data: 'csrf_token=' + encodeURIComponent(token) + '&scanner=' + encodeURIComponent(asin) + '&fc=' + fc,
                    withCredentials: true,
                    onload: function (r) {
                        try {
                            var doc = new DOMParser().parseFromString(r.responseText, 'text/html');
                            var desc = doc.querySelector('.asinDescription');
                            if (desc) {
                                var h1 = desc.querySelector('h1');
                                var type = h1 ? h1.textContent.trim() : null;
                                if (type && !type.includes('Scanned')) {
                                    resolve({ asin: asin, storageType: type });
                                    return;
                                }
                            }
                            resolve(null);
                        } catch (e) { resolve(null); }
                    },
                    onerror: function () { resolve(null); }
                });
            });
        }

                        function processRNOBatch(resultsEl, tableId) {
            tableId = tableId || '#table-inventory';
            resultsEl.textContent = 'Loading...';
            resultsEl.style.color = '';
            var fc = getFC();
            if (!fc) { resultsEl.textContent = 'Error: No FC'; resultsEl.style.color = 'red'; return; }

            getRNOToken(fc).then(function (token) {
                if (!token) { resultsEl.textContent = 'Auth Error'; resultsEl.style.color = 'red'; return; }

                loadAllTableRows().then(function () {
                    var tbody = document.querySelector(tableId + ' tbody');
                    if (!tbody) { resultsEl.textContent = 'No table found'; resultsEl.style.color = 'red'; return; }
                    document.querySelectorAll('.rno-size-profile-row').forEach(function (r) { r.remove(); });
                    Pills.clear('rno');

                    var items = collectInventoryAsins(tbody).filter(function (item) {
                        return !item.row.classList.contains('rno-size-profile-row');
                    });

                    var total = items.length;
                    var done = 0;
                    var BATCH = 50;

                    (function nextBatch(i) {
                        if (i >= items.length) {
                            resultsEl.textContent = 'RNO Profile done (' + done + ')';
                            expandDataTable(tableId);
                            return;
                        }
                        var batch = items.slice(i, i + BATCH);
                        Promise.all(batch.map(function (item) { return rnoLookup(item.asin, fc, token); }))
                            .then(function (results) {
                                results.forEach(function (r, idx) {
                                    if (!r || !r.storageType) return;
                                    var row = batch[idx].row;
                                    // Strip any HTML (e.g. <button>) for the pill short text
                                    var storageText = String(r.storageType).replace(/<[^>]*>/g, '').trim();
                                    Pills.add(row, {
                                        kind: 'rno',
                                        label: 'RNO',
                                        text: storageText,
                                        full: 'RNO AsinProfiler (' + r.asin + '): ' + storageText,
                                        bg: '#0D47A1', // blue (hardcoded, theme-independent)
                                        fg: '#ffffff'
                                    });
                                });
                                done += batch.length;
                                resultsEl.textContent = 'Processing... (' + done + '/' + total + ')';
                                nextBatch(i + BATCH);
                            });
                    })(0);
                });
            });
        }



        // --- Auto RNO on product pages ---
        function checkRNOAccess() {
            return new Promise(function (resolve) {
                if (rnoChecked) { resolve(true); return; }
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: 'https://rno-tools.corp.amazon.com/kiosk/asin_profile/app',
                    withCredentials: true,
                    onload: function (r) {
                        if (r.status === 200) { rnoChecked = true; resolve(true); }
                        else { resolve(false); }
                    },
                    onerror: function () { resolve(false); }
                });
            });
        }

        function detectFC() {
            return new Promise(function (resolve, reject) {
                var pathMatch = window.location.pathname.match(/\/([A-Z]{3}[0-9])\/|\/([A-Z]{4})\//i);
                if (pathMatch) {
                    var fc = (pathMatch[1] || pathMatch[2]);
                    if (fc) { resolve(fc); return; }
                }

                GM_xmlhttpRequest({
                    method: 'GET',
                    url: 'https://rno-tools.corp.amazon.com/kiosk/asin_profile/app',
                    withCredentials: true,
                    headers: { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8' },
                    onload: function (r) {
                        if (r.status !== 200) { reject('Failed: ' + r.status); return; }
                        var currentUrl = window.location.href;
                        var patterns = [/\/([A-Z]{3}[0-9])\//, /fc=([A-Z]{3}[0-9])/i, /([A-Z]{3}[0-9])/];
                        for (var p = 0; p < patterns.length; p++) {
                            var m = currentUrl.match(patterns[p]);
                            if (m && m[1]) { resolve(m[1]); return; }
                        }
                        var doc = new DOMParser().parseFromString(r.responseText, 'text/html');
                        var sel = doc.querySelector('select[name="fc"]');
                        if (sel) {
                            var opt = sel.querySelector('option[selected]');
                            if (opt) { resolve(opt.value); return; }
                        }
                        reject('Could not detect FC');
                    },
                    onerror: function () {
                        var m = window.location.href.match(/\/([A-Z]{3}[0-9])\//);
                        if (m && m[1]) { resolve(m[1]); return; }
                        reject('Error accessing RNO tools');
                    }
                });
            });
        }

        function displayRNOResult(storageType, titleRow, isError, isLoading) {
            if (!titleRow || !storageType) return;

            var existing = titleRow.parentNode.querySelector('tr[data-storage-type]');
            if (existing) existing.remove();

            var newRow = document.createElement('tr');
            newRow.setAttribute('data-storage-type', 'true');

            var th = document.createElement('td');
            var td = document.createElement('td');

            // Tooltip container for header
            var container = document.createElement('div');
            container.style.position = 'relative';
            container.style.display = 'inline-block';

            var text = document.createElement('span');
            text.textContent = 'AsinProfiler:';
            text.style.fontWeight = 'bold';

            var tooltip = document.createElement('div');
            tooltip.textContent = 'RNO Asin Profiler - Requires you to open the official website to authenticate. Then its safe to close that page.';
            tooltip.style.cssText = 'visibility:hidden;position:absolute;z-index:1;bottom:125%;left:50%;transform:translateX(-50%);'
                + 'background-color:#183D3D;color:#E0E0E0;text-align:center;padding:5px;border-radius:6px;width:200px;font-size:12px;'
                + 'opacity:0;transition:opacity 0.3s';

            container.appendChild(text);
            container.appendChild(tooltip);
            container.addEventListener('mouseenter', function () { tooltip.style.visibility = 'visible'; tooltip.style.opacity = '1'; });
            container.addEventListener('mouseleave', function () { tooltip.style.visibility = 'hidden'; tooltip.style.opacity = '0'; });

            th.appendChild(container);

            if (typeof storageType === 'string' && storageType.includes('<button')) {
                td.innerHTML = isLoading ? storageType : storageType + ' (FC: ' + (fcCode || 'Unknown') + ')';
            } else {
                td.textContent = isLoading ? storageType : storageType + ' (FC: ' + (fcCode || 'Unknown') + ')';
            }

            td.style.color = isError ? 'red' : (isLoading ? 'blue' : 'green');
            td.style.fontWeight = 'bold';

            newRow.appendChild(th);
            newRow.appendChild(td);
            titleRow.parentNode.insertBefore(newRow, titleRow.nextSibling);
        }

                function getProductInfoFromPage() {
            var table = document.querySelector('table[data-row-id]');
            if (!table) return null;
            var rows = table.getElementsByTagName('tr');
            var asin = null;
            var fnsku = null;
            var titleRow = null;

            for (var i = 0; i < rows.length; i++) {
                var th = rows[i].querySelector('th');
                if (!th) continue;
                var header = th.textContent.trim();

                if (header === 'ASIN') {
                    var asinTd = rows[i].querySelector('td');
                    if (asinTd) {
                        var asinLink = asinTd.querySelector('a');
                        asin = asinLink ? asinLink.textContent.trim() : asinTd.textContent.trim();
                    }
                }
                if (header === 'FNSku') {
                    var fnskuTd = rows[i].querySelector('td');
                    if (fnskuTd) {
                        var fnskuLink = fnskuTd.querySelector('a');
                        fnsku = fnskuLink ? fnskuLink.textContent.trim() : fnskuTd.textContent.trim();
                    }
                }
                if (header === 'Title') {
                    titleRow = rows[i];
                }
            }

            if (!titleRow) return null;

            var code = fnsku || asin;
            if (!code) return null;
           ///verify what rno is using
            console.log('[FCR+] RNO Profiler using ' + (fnsku ? 'FNSku' : 'ASIN') + ': ' + code);
            return { asin: code, titleRow: titleRow };
        }


        function checkAsin(asin, titleRow) {
            checkRNOAccess().then(function (hasAccess) {
                if (!hasAccess) {
                    displayRNOResult('Please authenticate at rno-tools.corp.amazon.com/kiosk/asin_profile/select_fc first', titleRow, true, false);
                    return;
                }

                var cached = asinCache.get(asin);
                if (cached && (Date.now() - cached.timestamp < CONFIG.cacheDuration)) {
                    displayRNOResult(cached.storageType, titleRow, false, false);
                    return;
                }

                var fcPromise;
                if (fcCode) {
                    fcPromise = Promise.resolve(fcCode);
                } else {
                    displayRNOResult('Detecting FC...', titleRow, false, true);
                    fcPromise = detectFC().then(function (fc) { fcCode = fc; return fc; });
                }

                fcPromise.then(function (fc) {
                    displayRNOResult('Checking ASIN for ' + fc + '...', titleRow, false, true);
                    return getRNOToken(fc).then(function (token) {
                        if (!token) throw new Error('No CSRF token found');
                        return rnoLookup(asin, fc, token);
                    });
                }).then(function (result) {
                    if (result && result.storageType) {
                        asinCache.set(asin, { storageType: result.storageType, timestamp: Date.now() });
                        displayRNOResult(result.storageType, titleRow, false, false);
                    } else {
                        var authMsg = '<span>Please authenticate: </span>'
                            + '<button onclick="window.open(\'https://rno-tools.corp.amazon.com/kiosk/asin_profile/select_fc\', \'_blank\')"'
                            + ' style="background:#183D3D;color:#E0E0E0;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;margin-left:5px;font-weight:bold">'
                            + 'Open RNO asinprofiler</button>';
                        displayRNOResult(authMsg, titleRow, true, false);
                    }
                }).catch(function (err) {
                    displayRNOResult('Error: ' + err, titleRow, true, false);
                });
            });
        }

        function autoRNO() {
            if (!featureOn('rnoProfiler')) return;
            waitForEl('table[data-row-id]').then(function () {
                var info = getProductInfoFromPage();
                if (info) checkAsin(info.asin, info.titleRow);
            }).catch(function () {});
        }

        function cleanup() {
            asinCache.clear();
            fcCode = null;
            rnoChecked = false;
        }

        return {
            processRNOBatch: processRNOBatch,
            autoRNO: autoRNO,
            cleanup: cleanup
        };
    })();




    // ======= [S7] HAZMAT =======
  //
  // Hazmat level checker via PanDash API.
  // PanDash only accepts B0 ASINs. PO item tables can contain
  // X0 FNSKUs, so those get resolved to B0 via the product page
  // (the data-row-id attribute or ASIN field).

  var Hazmat = (function () {

    var hazmatMap = new Map();

    function getFCRestriction(fc) {
      return new Promise(function (resolve) {
        GM_xmlhttpRequest({
          method: 'GET',
          url: 'https://pandash.amazon.com/GridServlet?fc=' + fc,
          responseType: 'json',
          headers: {
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': 'https://pandash.amazon.com/'
          },
          onload: function (r) {
            if (r.status === 200 && r.response) {
              resolve(r.response.restriction || 'MEDIUM');
            } else { resolve('MEDIUM'); }
          },
          onerror: function () { resolve('MEDIUM'); }
        });
      });
    }

    /**
     * Resolve any code to a B0 ASIN.
     * - B0 codes pass through as-is.
     * - X0 (FNSKU) codes get looked up via the product page.
     *   The product table has data-row-id="B0..." or an ASIN row.
     */
    function resolveToAsin(code, fc) {
      if (/^B[A-Z0-9]{9}$/.test(code)) return Promise.resolve(code);

      return fetchProductPage(code, fc).then(function (doc) {
        // Try data-row-id first (fastest, always B0)
        var table = doc.querySelector('table[data-row-id]');
        if (table) {
          var rowId = table.getAttribute('data-row-id');
          if (rowId && /^B[A-Z0-9]{9}$/.test(rowId)) return rowId;
        }
        // Fallback: read ASIN field from keyvalue table
        var asinText = readProductField(doc, 'ASIN');
        if (asinText) {
          var match = asinText.trim().match(/^B[A-Z0-9]{9}$/);
          if (match) return match[0];
        }
        return null;
      }).catch(function () { return null; });
    }

    function process(section, resultsEl) {
      resultsEl.textContent = 'Loading hazmat...';
      resultsEl.style.color = '';

      var fc = getFC();
      if (!fc) { resultsEl.textContent = 'Error: No FC'; resultsEl.style.color = 'red'; return; }

      getFCRestriction(fc).then(function (restriction) {

        document.querySelectorAll('.hazmat-instructions-row').forEach(function (r) { r.remove(); });
        Pills.clear('hazmat');

        var tableId = section === 'inventory' ? '#table-inventory' : '#table-purchase-order-item';
        var rows = document.querySelectorAll(tableId + ' tbody tr');

        // Collect codes from table. PO tables may have X0 FNSKUs.
        // We track each unique code and which rows it appears in.
        var codeToRows = {};
        rows.forEach(function (row) {
          if (
            row.classList.contains('prep-instructions-row') ||
            row.classList.contains('hazmat-instructions-row') ||
            row.classList.contains('asin-profile-row') ||
            row.classList.contains('rno-size-profile-row')
          ) return;

          var asinCell = row.querySelector('td:nth-child(2)');
          if (!asinCell) return;
          var link = asinCell.querySelector('a');
          var code = link ? link.textContent.trim() : asinCell.textContent.trim();
          if (!code) return;

          if (!codeToRows[code]) codeToRows[code] = [];
          codeToRows[code].push(row);
        });

        var codes = Object.keys(codeToRows);
        if (!codes.length) {
          resultsEl.textContent = 'No items found';
          resultsEl.style.color = 'red';
          return;
        }

        // Resolve all codes to B0 ASINs
        // codeToAsin maps original code -> B0 asin (or null if unresolvable)
        resultsEl.textContent = 'Resolving ASINs...';

        var resolvePromises = codes.map(function (code) {
          return resolveToAsin(code, fc).then(function (asin) {
            return { original: code, asin: asin };
          });
        });

        Promise.all(resolvePromises).then(function (mappings) {

          // Build lookup: original code -> B0 asin
          var codeToAsin = {};
          var uniqueAsins = new Set();
          var unresolvedCount = 0;

          mappings.forEach(function (m) {
            if (m.asin) {
              codeToAsin[m.original] = m.asin;
              uniqueAsins.add(m.asin);
            } else {
              unresolvedCount++;
            }
          });

          if (!uniqueAsins.size) {
            resultsEl.textContent = 'No ASINs resolved';
            resultsEl.style.color = 'red';
            return;
          }

          resultsEl.textContent = 'Fetching hazmat data...';

          var marketplace = GM_getValue('hazmatMarketplace', getMarketplace());
          var login = (document.querySelector('span.aok-float-right.a-text-bold') || {}).textContent || 'unknown';
          var a = new Date();
          var filename = login + '_' + restriction + '-hazmat-FC_' + a.getFullYear() + (a.getMonth() + 1)
            + a.getDate() + a.getHours() + a.getMinutes() + a.getSeconds() + a.getMilliseconds();
          var source = restriction + '-hazmat-FC';

          var postData = 'language=default&source=' + source
            + '&marketPlaces=' + marketplace
            + '&asins=' + Array.from(uniqueAsins).join('+')
            + '&sidx=product.asin&rows=99999&page=1&sord=desc'
            + '&isExportOnly=FALSE&fileName=' + filename
            + '&fc=' + fc + '&pandashservice=';

          GM_xmlhttpRequest({
            method: 'POST',
            url: 'https://pandash.amazon.com/GridServlet?fc=' + fc,
            responseType: 'json',
            data: postData,
            headers: {
              'Accept': 'application/json, text/javascript, */*; q=0.01',
              'Accept-Language': 'en-US,en;q=0.5',
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'X-Requested-With': 'XMLHttpRequest',
              'Origin': 'https://pandash.amazon.com',
              'Referer': 'https://pandash.amazon.com/',
              'Sec-Fetch-Dest': 'empty',
              'Sec-Fetch-Mode': 'cors',
              'Sec-Fetch-Site': 'same-origin'
            },
            onload: function (r) {
              if (!r.response) { resultsEl.textContent = 'Error: PanDash returned no response (auth may be required)'; return; }
              if (!r.response.rows || r.response.rows.length === 0) {
                resultsEl.textContent = 'No hazmat data found for ' + marketplace + '. Try a different marketplace.';
                resultsEl.style.color = '#c46200';
                return;
              }

              // Build hazmat lookup by B0 ASIN
              hazmatMap.clear();
              r.response.rows.forEach(function (row) {
                hazmatMap.set(row.asin, [row.level, row.message]);
              });

              // Walk every original code, find its B0, look up hazmat, inject row
              codes.forEach(function (code) {
                var b0 = codeToAsin[code];
                if (!b0 || !hazmatMap.has(b0)) return;

                var data = hazmatMap.get(b0);
                var level = data[0];

                codeToRows[code].forEach(function (row) {
                  var pillText = 'Level ' + level;
                  var pillFull = 'Hazmat Level ' + level;
                  if (code !== b0) {
                    pillText += ' (' + code + '\u2192' + b0 + ')';
                    pillFull += '  (' + code + ' \u2192 ' + b0 + ')';
                  }
                  Pills.add(row, {
                    kind: 'hazmat',
                    label: 'Hazmat',
                    text: pillText,
                    full: pillFull,
                    bg: HAZMAT_COLORS[level] || '#999',
                    fg: '#000'
                  });
                });
              });

              resultsEl.innerHTML = '';
              var statusSpan = document.createElement('span');
              statusSpan.textContent = 'Hazmat (';
              resultsEl.appendChild(statusSpan);

              // Marketplace dropdown inline
              var mpSelect = document.createElement('select');
              mpSelect.style.cssText = 'font-size:11px;padding:0 2px;border:1px solid #ccc;border-radius:3px;background:#fff;cursor:pointer;margin:0 1px;';
              HAZMAT_MARKETPLACES.forEach(function (mp) {
                var opt = document.createElement('option');
                opt.value = mp; opt.textContent = mp;
                if (mp === marketplace) opt.selected = true;
                mpSelect.appendChild(opt);
              });
              mpSelect.addEventListener('change', function () {
                GM_setValue('hazmatMarketplace', mpSelect.value);
                process(section, resultsEl);
              });
              resultsEl.appendChild(mpSelect);

              var afterSpan = document.createElement('span');
              var afterText = ' | ' + fc + ')';
              if (unresolvedCount > 0) afterText += ' | ' + unresolvedCount + ' unresolved';
              afterSpan.textContent = afterText;
              resultsEl.appendChild(afterSpan);

              expandDataTable(tableId);
            },
            onerror: function () {
              resultsEl.textContent = 'Hazmat error: PanDash unreachable (' + marketplace + ')';
              resultsEl.style.color = 'red';
            }
          });
        });
      });
    }

    return { process: process };
  })();



  // ======= [S8] WEIGHT & UTILIZATION =======
  //
  // Container weight calculator and cage/cart utilization %.
  // Also: pallet/cage capacity on product pages.

  var Weight = (function () {

    var palletAdded = false;
    var cageAdded = false;

    function getAsinWeight(asin, fc) {
      return fetchProductPage(asin, fc).then(function (doc) {
        var weightText = readProductField(doc, 'Weight') || '';
        var weight = parseFloat(weightText.split(' ')[0]) || 0;
        var lower = weightText.toLowerCase();
        var unit = (lower.includes('kg') || lower.includes('kilogram')) ? 'kg' : 'lbs';
        return { weight: weight, unit: unit };
      }).catch(function () { return { weight: 0, unit: 'lbs' }; });
    }

    function getAsinDims(asin, fc) {
      return fetchProductPage(asin, fc).then(function (doc) {
        var dimText = readProductField(doc, 'Dimensions') || readProductField(doc, 'Dimensiones');
        var dims = parseDimensions(dimText);
        if (!dims) return null;
        return { height: dims.min, length: dims.max, width: dims.mid };
      }).catch(function () { return null; });
    }

    // Per-item weight pill color: green < 25 lbs, orange 25-49.99 lbs, red 50+ lbs
    var WEIGHT_PILL_THRESHOLDS = { light: 25, heavy: 50 };

    function weightPillColor(weightLbs) {
      if (weightLbs >= WEIGHT_PILL_THRESHOLDS.heavy) return '#c62828';
      if (weightLbs >= WEIGHT_PILL_THRESHOLDS.light) return '#ef6c00';
      return '#2e7d32';
    }

    function calcWeight(resultsEl) {
      resultsEl.textContent = 'Calculating...';
      resultsEl.style.color = '';

      var fc = getFC();
      if (!fc) { resultsEl.textContent = 'Error: No FC'; resultsEl.style.color = 'red'; return; }

      var rows = document.querySelectorAll('#table-inventory tbody tr');
      var asinQuantities = {};
      var asinRows = {};
      var asins = [];

      rows.forEach(function (row) {
        if (row.classList.contains('prep-instructions-row') ||
            row.classList.contains('hazmat-instructions-row') ||
            row.classList.contains('rno-size-profile-row') ||
            row.classList.contains('asin-profile-row')) return;

        var asinCell = row.querySelector('td:nth-child(2) > a');
        var qtyCell = row.querySelector('td:nth-child(6)');
        var qty = qtyCell ? parseInt(qtyCell.innerText) || 0 : 0;
        var asin = asinCell ? asinCell.innerText.trim() : '';
        if (!asin) return;

        if (!asinQuantities[asin]) {
          asinQuantities[asin] = qty;
          asinRows[asin] = [row];
          asins.push(asin);
        } else {
          asinQuantities[asin] += qty;
          asinRows[asin].push(row);
        }
      });

      Pills.clear('weight');

      Promise.all(asins.map(function (a) { return getAsinWeight(a, fc); }))
        .then(function (results) {
          var primaryUnit = 'lbs';
          for (var i = 0; i < results.length; i++) {
            if (results[i].weight > 0 && results[i].unit === 'kg') { primaryUnit = 'kg'; break; }
          }

          var total = 0;
          results.forEach(function (r, idx) {
            var w = r.weight;
            if (primaryUnit === 'kg' && r.unit === 'lbs') w *= 0.453592;
            else if (primaryUnit === 'lbs' && r.unit === 'kg') w *= 2.20462;
            total += w * asinQuantities[asins[idx]];

            // Per ASIN weight pill on each row this ASIN appears in
            if (r.weight > 0) {
              var displayW = Math.round(w * 100) / 100;
              var lbsVal = primaryUnit === 'kg' ? Math.round(w * 2.20462 * 100) / 100 : displayW;
              var pillText = primaryUnit === 'kg'
                ? displayW + ' kg (' + lbsVal + ' lbs)'
                : displayW + ' lbs';
              var pillFull = primaryUnit === 'kg'
                ? 'Unit weight: ' + displayW + ' kg (' + lbsVal + ' lbs)'
                : 'Unit weight: ' + displayW + ' lbs (' + (Math.round(displayW * 0.453592 * 100) / 100) + ' kg)';
              var pillBg = weightPillColor(lbsVal);

              asinRows[asins[idx]].forEach(function (row) {
                Pills.add(row, {
                  kind: 'weight',
                  label: 'Wt',
                  text: pillText,
                  full: pillFull,
                  bg: pillBg,
                  fg: '#fff'
                });
              });
            }
          });

          var rounded = Math.round(total * 10) / 10;
          var display, weightLbs;
          if (primaryUnit === 'kg') {
            var lbs = Math.round(rounded * 2.20462 * 10) / 10;
            display = 'Total: ' + rounded + ' kg (' + lbs + ' lbs)';
            weightLbs = lbs;
          } else {
            var kg = Math.round(rounded * 0.453592 * 10) / 10;
            display = 'Total: ' + rounded + ' lbs (' + kg + ' kg)';
            weightLbs = rounded;
          }

          var color = '#3df70a';
          if (weightLbs > 500) color = 'red';
          else if (weightLbs >= 400) color = '#d3731e';

          resultsEl.innerHTML = display;
          resultsEl.style.color = color;
          expandDataTable('#table-inventory');
        });
    }

    // PO version: per ASIN weight pills only (no container total)
    function getAsinWeightPills(resultsEl) {
      resultsEl.textContent = 'Fetching weights...';
      resultsEl.style.color = '';

      var fc = getFC();
      if (!fc) { resultsEl.textContent = 'Error: No FC'; resultsEl.style.color = 'red'; return; }

      var tableId = '#table-purchase-order-item';
      var rows = document.querySelectorAll(tableId + ' tbody tr');
      var codeToRows = {};
      var codes = [];

      rows.forEach(function (row) {
        if (row.classList.contains('prep-instructions-row') ||
            row.classList.contains('hazmat-instructions-row') ||
            row.classList.contains('rno-size-profile-row') ||
            row.classList.contains('asin-profile-row')) return;

        var asinCell = row.querySelector('td:nth-child(2)');
        if (!asinCell) return;
        var link = asinCell.querySelector('a');
        var code = link ? link.textContent.trim() : asinCell.textContent.trim();
        if (!code) return;

        if (!codeToRows[code]) { codeToRows[code] = [row]; codes.push(code); }
        else { codeToRows[code].push(row); }
      });

      if (!codes.length) {
        resultsEl.textContent = 'No items found';
        resultsEl.style.color = 'red';
        return;
      }

      Pills.clear('weight');

      Promise.all(codes.map(function (code) { return getAsinWeight(code, fc); }))
        .then(function (results) {
          var primaryUnit = 'lbs';
          for (var i = 0; i < results.length; i++) {
            if (results[i].weight > 0 && results[i].unit === 'kg') { primaryUnit = 'kg'; break; }
          }

          var found = 0;
          results.forEach(function (r, idx) {
            if (r.weight <= 0) return;
            found++;

            var w = r.weight;
            if (primaryUnit === 'kg' && r.unit === 'lbs') w *= 0.453592;
            else if (primaryUnit === 'lbs' && r.unit === 'kg') w *= 2.20462;

            var displayW = Math.round(w * 100) / 100;
            var lbsVal = primaryUnit === 'kg' ? Math.round(w * 2.20462 * 100) / 100 : displayW;
            var pillText = primaryUnit === 'kg'
              ? displayW + ' kg (' + lbsVal + ' lbs)'
              : displayW + ' lbs';
            var pillFull = primaryUnit === 'kg'
              ? 'Unit weight: ' + displayW + ' kg (' + lbsVal + ' lbs)'
              : 'Unit weight: ' + displayW + ' lbs (' + (Math.round(displayW * 0.453592 * 100) / 100) + ' kg)';
            var pillBg = weightPillColor(lbsVal);

            codeToRows[codes[idx]].forEach(function (row) {
              Pills.add(row, {
                kind: 'weight',
                label: 'Wt',
                text: pillText,
                full: pillFull,
                bg: pillBg,
                fg: '#fff'
              });
            });
          });

          resultsEl.textContent = 'Weights: ' + found + '/' + codes.length + ' found';
          resultsEl.style.color = found > 0 ? '' : 'red';
          expandDataTable(tableId);
        });
    }

    function calcUtilization(resultsEl) {
      resultsEl.textContent = 'Calculating...';
      resultsEl.style.color = '';

      var fc = getFC();
      if (!fc) { resultsEl.textContent = 'Error: No FC'; resultsEl.style.color = 'red'; return; }

      var containerValue = window.location.href.split('=')[1] || '';
      var rows = document.querySelectorAll('#table-inventory tbody tr');
      if (!rows.length) { resultsEl.textContent = 'No data'; resultsEl.style.color = 'red'; return; }

      var asinQuantities = {};
      var asins = [];
      rows.forEach(function (row) {
        var asinCell = row.querySelector('td:nth-child(2) > a');
        var qtyCell = row.querySelector('td:nth-child(6)');
        var qty = qtyCell ? parseInt(qtyCell.innerText) || 0 : 0;
        var asin = asinCell ? asinCell.innerText.trim() : '';
        if (asin) {
          if (!asinQuantities[asin]) { asinQuantities[asin] = qty; asins.push(asin); }
          else { asinQuantities[asin] += qty; }
        }
      });

      Promise.all(asins.map(function (a) { return getAsinDims(a, fc); }))
        .then(function (results) {
          var totalCubic = 0;
          results.forEach(function (dims, idx) {
            if (dims) {
              totalCubic += dims.height * dims.width * dims.length * (asinQuantities[asins[idx]] || 0);
            }
          });

          var type, util;
          if (containerValue.startsWith('tscage')) {
            type = 'Cage';
            util = (totalCubic / CONFIG.cageVolume) * 100;
          } else {
            type = 'Cart';
            util = (totalCubic / CONFIG.cartVolume) * 100;
          }

          var pct = util.toFixed(1);
          var color = '#3df70a';
          if (util > 100) color = 'red';
          else if (util > 85) color = '#f37d15';
          else if (util < 50) color = '#FFD700';

          resultsEl.innerHTML = type + ': <span style="color:' + color + ';font-weight:bold">' + pct + '%</span>';
        });
    }

    function resetFlags() {
      palletAdded = false;
      cageAdded = false;
    }

    return {
      calcWeight: calcWeight,
      getAsinWeightPills: getAsinWeightPills,
      calcUtilization: calcUtilization,
      resetFlags: resetFlags
    };
  })();


  // ======= [S8b] EXPIRATION DATE CHECK =======
  // Looks up expiration dates for FCSKUs in inventory table
  // Uses the same product page approach as my Bulk Container Weight Calculator.

  var Expiration = (function () {

    // Color coding: red = expired or within 30 days, orange = 30-180 days, green = 6+ months
    var RED_DAYS = 30;
    var ORANGE_DAYS = 180;

    function parseDate(str) {
      if (!str) return null;
      var d = new Date(str);
      return isNaN(d.getTime()) ? null : d;
    }

    // Strip timestamp to just the date portion (YYYY-MM-DD) - Prob should display format for users if not in NA (/≧▽≦)/
    function formatDate(str) {
      if (!str) return '';
      return str.replace(/T.*$/, '').trim();
    }

    function getColor(dateStr) {
      var d = parseDate(dateStr);
      if (!d) return { bg: '#666', fg: '#fff', status: 'unknown' };
      var now = new Date();
      var diffMs = d.getTime() - now.getTime();
      var diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays < 0) return { bg: '#c62828', fg: '#fff', status: 'expired' };
      if (diffDays <= RED_DAYS) return { bg: '#c62828', fg: '#fff', status: diffDays + ' days left' };
      if (diffDays <= ORANGE_DAYS) return { bg: '#ef6c00', fg: '#fff', status: diffDays + ' days left' };
      return { bg: '#2e7d32', fg: '#fff', status: '' };
    }

    function process(resultsEl) {
      resultsEl.textContent = 'Checking expirations...';
      resultsEl.style.color = '';

      var fc = getFC();
      if (!fc) { resultsEl.textContent = 'Error: No FC'; resultsEl.style.color = 'red'; return; }

      Pills.clear('expdate');

      var rows = document.querySelectorAll('#table-inventory tbody tr');
      var fcskuToRows = {};

      rows.forEach(function (row) {
        if (
          row.classList.contains('prep-instructions-row') ||
          row.classList.contains('hazmat-instructions-row') ||
          row.classList.contains('asin-profile-row') ||
          row.classList.contains('rno-size-profile-row')
        ) return;

        // FCSKU is in column 4
        var fcskuCell = row.querySelector('td:nth-child(4)');
        if (!fcskuCell) return;
        var link = fcskuCell.querySelector('a');
        var fcsku = link ? link.textContent.trim() : fcskuCell.textContent.trim();
        if (!fcsku) return;

        if (!fcskuToRows[fcsku]) fcskuToRows[fcsku] = [];
        fcskuToRows[fcsku].push(row);
      });

      var fcskus = Object.keys(fcskuToRows);
      if (!fcskus.length) {
        resultsEl.textContent = 'No FCSKUs found';
        resultsEl.style.color = 'red';
        return;
      }

      resultsEl.textContent = 'Fetching ' + fcskus.length + ' FCSKU(s)...';

      var completed = 0;
      var expiredCount = 0;
      var warningCount = 0;
      var foundCount = 0;

      // Process sequentially in small batches to avoid hammering the server LOL
      var BATCH = 5;
      var idx = 0;

      function nextBatch() {
        if (idx >= fcskus.length) {
          // Done: show summary
          if (!foundCount) {
            resultsEl.textContent = 'No expiration found';
            resultsEl.style.color = '#666';
            return;
          }
          var parts = [foundCount + ' expiration(s) loaded'];
          if (expiredCount) parts.push(expiredCount + ' expired');
          if (warningCount) parts.push(warningCount + ' expiring soon');
          resultsEl.textContent = parts.join(' | ');
          resultsEl.style.color = expiredCount ? '#c62828' : (warningCount ? '#ef6c00' : '#2e7d32');
          return;
        }

        var batch = fcskus.slice(idx, idx + BATCH);
        idx += BATCH;

        var promises = batch.map(function (fcsku) {
          return fetchProductPage(fcsku, fc).then(function (doc) {
            var dateStr = readProductField(doc, 'Expiration Date') || '';
            return { fcsku: fcsku, date: dateStr };
          }).catch(function () {
            return { fcsku: fcsku, date: '' };
          });
        });

        Promise.all(promises).then(function (results) {
          results.forEach(function (r) {
            completed++;
            var rows = fcskuToRows[r.fcsku];
            if (!rows) return;

            // Skip items with no expiration date (not expiration tracked)
            if (!r.date) return;

            foundCount++;
            var color = getColor(r.date);
            if (color.status === 'expired') expiredCount++;
            else if (color.bg === '#ef6c00') warningCount++;

            var displayDate = formatDate(r.date);
            rows.forEach(function (row) {
              Pills.add(row, {
                kind: 'expdate',
                label: 'Expiration',
                text: displayDate,
                full: 'Expiration: ' + displayDate + ' [YYYY-MM-DD]' + (color.status ? ' (' + color.status + ')' : ''),
                bg: color.bg,
                fg: color.fg
              });
            });
          });

          resultsEl.textContent = 'Checking ' + completed + '/' + fcskus.length + '...';
          nextBatch();
        });
      }

      nextBatch();
    }

    return { process: process };
  })();


  // ======= [S8c] PRICE LOOKUP =======
  // Fetches List Price from FCResearch product pages, shows per-item pills and container total.

  var Price = (function () {

    function parsePrice(text) {
      if (!text) return null;
      var cleaned = text.replace(/[^0-9.,]/g, '');
      if (cleaned.indexOf(',') > -1 && cleaned.indexOf('.') === -1) {
        cleaned = cleaned.replace(',', '.');
      }
      if (cleaned.indexOf(',') > -1 && cleaned.indexOf('.') > -1) {
        cleaned = cleaned.replace(/,/g, '');
      }
      var val = parseFloat(cleaned);
      return isNaN(val) ? null : val;
    }

    function parseCurrency(text) {
      if (!text) return '$';
      var match = text.match(/[$£€]|USD|GBP|EUR|CAD/);
      return match ? match[0] : '$';
    }

    var PRICE_THRESHOLDS = { mid: 200, high: 500 };

    function pricePillColor(price) {
      if (price >= PRICE_THRESHOLDS.high) return '#c62828';
      if (price >= PRICE_THRESHOLDS.mid) return '#FFE103';
      return '#2e7d32';
    }

    function formatPrice(val, currency) {
      var fixed = val.toFixed(2);
      if (currency === '£') return '£' + fixed;
      if (currency === '€') return '€' + fixed;
      return '$' + fixed;
    }

    function process(resultsEl) {
      resultsEl.textContent = 'Looking up prices...';
      resultsEl.style.color = '';

      var fc = getFC();
      if (!fc) { resultsEl.textContent = 'Error: No FC'; resultsEl.style.color = 'red'; return; }

      var rows = document.querySelectorAll('#table-inventory tbody tr');
      var asinQuantities = {};
      var asinRows = {};
      var asins = [];

      rows.forEach(function (row) {
        if (row.classList.contains('prep-instructions-row') ||
            row.classList.contains('hazmat-instructions-row') ||
            row.classList.contains('rno-size-profile-row') ||
            row.classList.contains('asin-profile-row')) return;

        var asinCell = row.querySelector('td:nth-child(2) > a');
        var qtyCell = row.querySelector('td:nth-child(6)');
        var qty = qtyCell ? parseInt(qtyCell.innerText) || 0 : 0;
        var asin = asinCell ? asinCell.innerText.trim() : '';
        if (!asin) return;

        if (!asinQuantities[asin]) {
          asinQuantities[asin] = qty;
          asinRows[asin] = [row];
          asins.push(asin);
        } else {
          asinQuantities[asin] += qty;
          asinRows[asin].push(row);
        }
      });

      if (!asins.length) {
        resultsEl.textContent = 'No ASINs found';
        resultsEl.style.color = 'orange';
        return;
      }

      Pills.clear('price');

      var completed = 0;
      var priceData = {};
      var currency = '$';
      var missing = 0;

      var BATCH_SIZE = 5;
      var queue = asins.slice();

      function nextBatch() {
        if (!queue.length) {
          finalize();
          return;
        }

        var batch = queue.splice(0, BATCH_SIZE);
        Promise.all(batch.map(function (asin) {
          return fetchProductPage(asin, fc).then(function (doc) {
            var priceText = readProductField(doc, 'List Price');
            var val = parsePrice(priceText);
            if (val !== null) {
              priceData[asin] = val;
              currency = parseCurrency(priceText);
            } else {
              missing++;
            }
            completed++;
            resultsEl.textContent = 'Looking up prices... ' + completed + '/' + asins.length;
          }).catch(function () {
            missing++;
            completed++;
            resultsEl.textContent = 'Looking up prices... ' + completed + '/' + asins.length;
          });
        })).then(function () {
          nextBatch();
        });
      }

      function finalize() {
        var total = 0;

        asins.forEach(function (asin) {
          var val = priceData[asin];
          if (val !== undefined) {
            total += val * asinQuantities[asin];

            var pillText = formatPrice(val, currency);

            asinRows[asin].forEach(function (row) {
              Pills.add(row, {
                kind: 'price',
                label: 'Price',
                text: pillText,
                bg: pricePillColor(val),
                fg: '#fff'
              });
            });
          } else {
            asinRows[asin].forEach(function (row) {
              Pills.add(row, {
                kind: 'price',
                label: 'Price',
                text: 'N/A',
                bg: '#757575',
                fg: '#fff'
              });
            });
          }
        });

        var display = 'Total Value: ' + formatPrice(total, currency);
        if (missing > 0) display += ' (' + missing + ' missing)';

        var color = '#3df70a';
        if (missing > asins.length / 2) color = '#d3731e';

        resultsEl.innerHTML = display;
        resultsEl.style.color = color;
        expandDataTable('#table-inventory');
      }

      nextBatch();
    }

    return { process: process };
  })();



    // ======= [S9] CSV EXPORT =======

  var CSV = (function () {

    function exportCSV(tableId, resultsEl) {

      // Determine which table and header source to use
      var table, headerRow;

      if (tableId === 'inventory') {
        table = document.querySelector('#table-inventory');
        headerRow = document.querySelector('#table-inventory_wrapper .dataTables_scrollHead thead tr');
          } else if (tableId === 'po') {
        table = document.querySelector('#table-purchase-order-item');
        headerRow = document.querySelector('#table-purchase-order-item_wrapper .dataTables_scrollHead thead tr')
            || document.querySelector('#table-purchase-order-item thead tr');
               } else if (tableId === 'inventory-history') {
        table = document.querySelector('#table-inventory-history');
        headerRow = document.querySelector('#table-inventory-history_wrapper .dataTables_scrollHead thead tr');
      }

    if (!table) { alert('No table found to export'); return; }

      if (!headerRow) { alert('Could not find table headers'); return; }

      var csv = [];

      // Headers
      var headers = [];
      headerRow.querySelectorAll('th').forEach(function (th) {
        headers.push(th.textContent.trim().replace(/\n/g, ' '));
      });
      csv.push(headers.join(','));

      // Rows - skip injected prep/hazmat/profile rows
      table.querySelector('tbody').querySelectorAll('tr').forEach(function (row) {
        if (
          row.classList.contains('prep-instructions-row') ||
          row.classList.contains('hazmat-instructions-row') ||
          row.classList.contains('asin-profile-row') ||
          row.classList.contains('rno-size-profile-row')
        ) return;

        var rowData = [];
        row.querySelectorAll('td').forEach(function (td) {
          var text = td.textContent.trim().replace(/\s+/g, ' ').replace(/"/g, '""');
          if (text.includes(',') || text.includes('"') || text.includes('\n')) {
            text = '"' + text + '"';
          }
          rowData.push(text);
        });

        // Only push rows that actually have data
        if (rowData.length > 0) csv.push(rowData.join(','));
      });

      var blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
      var link = document.createElement('a');
      var url = URL.createObjectURL(blob);
      var ts = new Date().toISOString().replace(/[:\.]/g, '-').slice(0, -5);
      var fc = getFC() || 'unknown';
      var label = tableId === 'po' ? 'purchase-order' : 'inventory';

      link.setAttribute('href', url);
      link.setAttribute('download', label + '_' + fc + '_' + ts + '.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (resultsEl) {
        resultsEl.textContent = 'Exported!';
        setTimeout(function () { resultsEl.textContent = ''; }, 3000);
      }
    }

    return {
      exportInventory: function (resultsEl) { exportCSV('inventory', resultsEl); },
      exportPO: function (resultsEl) { exportCSV('po', resultsEl); },
      exportInventoryHistory: function (resultsEl) { exportCSV('inventory-history', resultsEl); }

    };
  })();




// ======= [S11] UI =======
  //
  // Sidebar, context menu, image hover,
  // badge photos, tools dropdowns, SSCC glance, intro page, tab icon.

  var UI = (function () {

    // --- Tab icon ---

    function tabIcon() {
      var link = document.createElement('link');
      link.rel = 'icon';
      link.href = 'https://drive-render.corp.amazon.com/view/kyleldri@/Untitled.png';
      document.head.appendChild(link);
    }

    // --- Intro page ---

   function introPage() {
    if (!window.location.href.includes('/search')) return;

    // --- Inline intro page styles ---
    GM_addStyle([
        '#fcrp-intro { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 960px; margin: 30px auto; padding: 0 20px; color: #E0E0E0; }',
        '#fcrp-intro * { box-sizing: border-box; }',

        // Hero
        '.fcrp-hero { text-align: center !important; margin-bottom: 36px !important; font-family: "Amazon Ember", "AmazonEmberModern", Arial, sans-serif !important; text-rendering: optimizeLegibility !important; -webkit-font-smoothing: antialiased !important; }',
        '.fcrp-hero h1 { font-size: 48px !important; font-weight: 800 !important; color: #E0E0E0 !important; margin: 0 0 8px !important; font-family: "Amazon Ember", "AmazonEmberModern", Arial, sans-serif !important; letter-spacing: -1px !important; }',
        '.fcrp-hero h1 .hl { color: #f37d15 !important; }',
        '.fcrp-hero h1::after { display: none !important; }',
        '.fcrp-hero .sub { font-size: 14px !important; color: #888 !important; margin: 0 0 6px !important; font-family: "Amazon Ember", "AmazonEmberModern", Arial, sans-serif !important; }',
        '.fcrp-hero .ver { display: inline-block !important; font-size: 11px !important; background: rgba(243,125,21,0.15) !important; color: #f37d15 !important; padding: 2px 10px !important; border-radius: 12px !important; font-weight: 600 !important; font-family: "Amazon Ember", "AmazonEmberModern", Arial, sans-serif !important; }',
        '.fcrp-hero .ver-status { font-size: 11px !important; margin-left: 8px !important; color: #888 !important; font-family: "Amazon Ember", "AmazonEmberModern", Arial, sans-serif !important; }',

        // Bulk actions
        '.fcrp-bulk { display: flex; justify-content: center; gap: 8px; margin: 18px 0 28px; flex-wrap: wrap; }',
        '.fcrp-bulk button { padding: 6px 16px; border-radius: 4px; border: 1px solid #2C5D5D; background: #183D3D; color: #E0E0E0; font-size: 12px; font-weight: 600; cursor: pointer; transition: background 0.15s, border-color 0.15s; }',
        '.fcrp-bulk button:hover { background: #2C5D5D; border-color: #3D7575; }',
        '.fcrp-bulk .btn-danger { border-color: #8B0000; background: #3a1414; }',
        '.fcrp-bulk .btn-danger:hover { background: #5a1a1a; border-color: #cc3333; }',
        '.fcrp-bulk .btn-success { border-color: #33CC02; background: #1a3a1a; }',
        '.fcrp-bulk .btn-success:hover { background: #2a4a2a; }',

        // Sections
        '.fcrp-section { background: #0A1A1F; border: 1px solid #183D3D; border-radius: 8px; padding: 20px; margin-bottom: 20px; }',
        '.fcrp-section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #f37d15; margin: 0 0 14px; padding-bottom: 10px; border-bottom: 1px solid #183D3D; }',

        // Toggle grid
        '.fcrp-toggle-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; }',
        '@media (max-width: 600px) { .fcrp-toggle-grid { grid-template-columns: 1fr; } }',
        '.fcrp-toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; border-radius: 4px; transition: background 0.12s; }',
        '.fcrp-toggle-row:hover { background: rgba(24,61,61,0.4); }',
        '.fcrp-toggle-label { font-size: 13px; color: #ccc; font-weight: 500; }',
        '.fcrp-toggle-label .cat-tag { font-size: 9px; background: rgba(255,255,255,0.08); color: #888; padding: 1px 5px; border-radius: 3px; margin-left: 6px; font-weight: 600; text-transform: uppercase; vertical-align: middle; }',

        // Toggle switch
        '.fcrp-switch { position: relative; width: 36px; height: 20px; flex-shrink: 0; }',
        '.fcrp-switch input { opacity: 0; width: 0; height: 0; }',
        '.fcrp-switch .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: #333; border-radius: 20px; transition: background 0.2s; }',
        '.fcrp-switch .slider:before { content: ""; position: absolute; width: 14px; height: 14px; left: 3px; bottom: 3px; background: #888; border-radius: 50%; transition: transform 0.2s, background 0.2s; }',
        '.fcrp-switch input:checked + .slider { background: #2C5D5D; }',
        '.fcrp-switch input:checked + .slider:before { transform: translateX(16px); background: #33CC02; }',

        // Preferences row
        '.fcrp-prefs { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }',
        '.fcrp-pref { display: flex; flex-direction: column; gap: 5px; }',
        '.fcrp-pref label { font-size: 11px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }',
        '.fcrp-pref select { padding: 7px 10px; font-size: 13px; background: #040D12; color: #E0E0E0; border: 1px solid #183D3D; border-radius: 5px; cursor: pointer; transition: border-color 0.15s; }',
        '.fcrp-pref select:hover { border-color: #2C5D5D; }',
        '.fcrp-pref select:focus { outline: none; border-color: #f37d15; }',

        // Feature cards
        '.fcrp-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }',
        '.fcrp-card { background: #040D12; border: 1px solid #183D3D; border-radius: 6px; padding: 14px; transition: border-color 0.15s, transform 0.15s; }',
        '.fcrp-card:hover { border-color: #2C5D5D; transform: translateY(-1px); }',
        '.fcrp-card-icon { font-size: 20px; margin-bottom: 6px; }',
        '.fcrp-card h4 { font-size: 13px; color: #E0E0E0; margin: 0 0 6px; font-weight: 700; }',
        '.fcrp-card ul { list-style: none; padding: 0; margin: 0; }',
        '.fcrp-card li { font-size: 11px; color: #999; padding: 2px 0; padding-left: 12px; position: relative; }',
        '.fcrp-card li::before { content: "\u2022"; position: absolute; left: 0; color: #2C5D5D; }',

        // Scripts section
        '.fcrp-scripts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }',
        '@media (max-width: 600px) { .fcrp-scripts { grid-template-columns: 1fr; } }',
        '.fcrp-script-item { display: flex; flex-direction: column; padding: 10px 12px; background: #040D12; border: 1px solid #183D3D; border-radius: 5px; transition: border-color 0.15s; }',
        '.fcrp-script-item:hover { border-color: #f37d15; }',
        '.fcrp-script-item a { color: #f37d15; text-decoration: none; font-weight: 700; font-size: 12px; }',
        '.fcrp-script-item p { margin: 3px 0 0; font-size: 10px; color: #777; line-height: 1.3; }',

        // Footer
        '.fcrp-footer { text-align: center; padding: 20px 0 10px; border-top: 1px solid #183D3D; margin-top: 10px; }',
        '.fcrp-footer a { display: inline-block; padding: 6px 14px; background: #183D3D; color: #E0E0E0; text-decoration: none; border-radius: 4px; font-size: 11px; font-weight: 600; margin: 4px; transition: background 0.15s; }',
        '.fcrp-footer a:hover { background: #2C5D5D; }',
        '.fcrp-credit { font-size: 11px; color: #555; margin-top: 12px; }'
    ].join('\n'));


    // --- Feature definitions for toggles ---
    var featureDescriptions = {
        asinPrinting: 'Print buttons on ASIN/FNSku rows',
        darkMode: 'Dark theme with color options',
        prepFunctionality: 'Auto prep instructions on product pages',
        rnoProfiler: 'RNO ASIN profiler on product pages',
        rnoSizeProfiler: 'RNO size profiler in inventory tools',
        hazmatLevels: 'Hazmat level lookup via PanDash',
        weightCalculator: 'Pallet/cage weight calculator',
        containerUtilization: 'Container fill % calculator',
        csvExport: 'Export inventory/PO tables to CSV',
        asinLevelPrep: 'ASIN-level prep in tools dropdown',
        researchPrep: 'Research prep (requires shipment)',
        expirationDate: 'Expiration date check for FCSKUs in inventory'
    };

    var myScripts = [
        { name: 'FCR Plus Tab Extension', author: 'kyleldri', url: 'https://tamarin.harmony.a2z.com/script/fcr-plus-tab-extension', desc: 'Multi tab viewer for FCResearch' },
        { name: 'Printmon 3', author: 'kyleldri', url: 'https://tamarin.harmony.a2z.com/script/printmon-3', desc: 'Custom print buttons, onscreen barcode' },
        { name: 'FCResearch Hazmat (with classification)', author: 'kyleldri', url: 'https://tamarin.harmony.a2z.com/script/fcresearch-hazmat', desc: 'This is Classification version with hazmat levels and export included.' },
        { name: 'LPN Grading Condition', author: 'kyleldri', url: 'https://tamarin.harmony.a2z.com/script/lpn-grading-condition', desc: 'Shows grading of LPN items' },
        { name: 'Dockmaster Parser', author: 'kyleldri', url: 'https://tamarin.harmony.a2z.com/script/ddeterminator-built-for-tns', desc: 'Scrape ASINs from POs, prep, bin type' },
        { name: 'Transshipment Hub Parser', author: 'kyleldri', url: 'https://tamarin.harmony.a2z.com/script/transshipment-hub-parser', desc: 'Scrape/Parses transshipment hub shipments - Parsing ZZ FCSKUs into asins, weight, velocity, Opitonal: RNO bin type, hazmat' },
        { name: 'Bulk Container Weight Calculator', author: 'kyleldri', url: 'https://tamarin.harmony.a2z.com/script/bulk-container-weight-calculator', desc: 'Calculate weight per container from FCResearch with CSV export and expandable details' },
        { name: 'Sideline Buddy', author: ' kyleldri credit: lsangvan for bulk tools', url: 'https://tamarin.harmony.a2z.com/script/sideline-buddy', desc: 'Sideline App helper: Bulk tools, supports NA/EU regions. dark mode themes, copy/paste buttons, hazmat check, container contents preview, tote weight tracking, Zebra ZPL printing, ASIN profile, and more. All features toggleable in Settings.' }
    ];

    var featureCards = [
        { icon: '', title: 'Printing', items: ['Printmon + Zebra ZPL support', 'Alt+Click to print any text', 'Print shortcut bar', 'Right-click print menu'] },
        { icon: '', title: 'ASIN Profiling', items: ['Auto RNO profiler', 'RNO size profiler', 'Bin type detection'] },
        { icon: '', title: 'Inventory Tools', items: ['Hazmat level checker', 'Weight calculator', 'Expiration date check', 'CSV export', 'Container utilization %'] },
        { icon: '', title: 'Prep', items: ['Auto ASIN-level prep', 'Research prep (PO-based)', 'Prep responsibility shown'] },
        { icon: '', title: 'UI Enhancements', items: ['Dark mode', 'Right-click context menu', 'Tailwind-styled UI'] },
        { icon: '', title: 'Other', items: ['Auto-sort tables', 'SSCC quick glance', 'Product attribute highlights', 'Custom quick links'] }
    ];

    // --- Build toggle rows ---
    function buildToggleRow(key) {
        var cfg = FEATURES[key];
        var checked = featureOn(key) ? ' checked' : '';
        var desc = featureDescriptions[key] || cfg.label.replace('Enable ', '');
        var catNames = { global: 'global', product: 'product page', tool: 'tool', po: 'PO/shipment' };
        var catLabel = catNames[cfg.category] ? '<span class="cat-tag">' + catNames[cfg.category] + '</span>' : '';
        return '<div class="fcrp-toggle-row">'
            + '<span class="fcrp-toggle-label">' + cfg.label.replace('Enable ', '') + catLabel + '</span>'
            + '<label class="fcrp-switch"><input type="checkbox" data-fcrp-key="' + key + '"' + checked + '><span class="slider"></span></label>'
            + '</div>';
    }

    var togglesHTML = '';
    Object.keys(FEATURES).forEach(function (key) {
        togglesHTML += buildToggleRow(key);
    });

    // --- Build feature cards ---
    var cardsHTML = '';
    featureCards.forEach(function (card) {
        var items = card.items.map(function (i) { return '<li>' + i + '</li>'; }).join('');
        cardsHTML += '<div class="fcrp-card"><div class="fcrp-card-icon">' + card.icon + '</div><h4>' + card.title + '</h4><ul>' + items + '</ul></div>';
    });

    // --- Build scripts list ---
    var scriptsHTML = '';
    myScripts.forEach(function (s) {
        scriptsHTML += '<div class="fcrp-script-item">'
            + '<a href="' + s.url + '" target="_blank">' + s.name + '</a>'
            + (s.author ? '<span style="display:block;font-size:10px;opacity:0.5;margin-top:1px">by ' + s.author + '</span>' : '')
            + '<p>' + s.desc + '</p>'
            + '</div>';
    });

    // --- Assemble intro page ---
    var html = '<div id="fcrp-intro">'

        // Hero title
        + '<div class="fcrp-hero">'
        + '<h1>FCR <span class="hl">Plus</span></h1>'
        + '<p class="sub">All-in-one FC Research Enhancement</p>'
        + '<span class="ver">v' + VERSION + '</span>'
        + '<span class="ver-status" id="fcrp-ver-status"></span>'
        + '</div>'

        // Bulk actions
        + '<div class="fcrp-bulk">'
        + '<button class="btn-success" id="fcrp-enable-all">\u2714 Enable All</button>'
        + '<button id="fcrp-disable-all">\u2716 Disable All</button>'
        + '<button class="btn-danger" id="fcrp-reset-defaults">\u21ba Reset to Defaults</button>'
        + '</div>'

        // Preferences
        + '<div class="fcrp-section">'
        + '<div class="fcrp-section-title">Preferences</div>'
        + '<div class="fcrp-prefs">'
        + '<div class="fcrp-pref"><label>Region</label><select id="intro-region-selector">'
        + '<option value="NA"' + (REGION === 'NA' ? ' selected' : '') + '>NA</option>'
        + '<option value="EU"' + (REGION === 'EU' ? ' selected' : '') + '>EU</option>'
        + '<option value="FE"' + (REGION === 'FE' ? ' selected' : '') + '>FE</option>'
        + '</select></div>'
        + '<div class="fcrp-pref"><label>FC Type</label><select id="intro-fc-type-selector">'
        + Object.keys(FC_TYPES).map(function (key) { return '<option value="' + key + '"' + (FC_TYPE === key ? ' selected' : '') + '>' + FC_TYPES[key].name + '</option>'; }).join('')
        + '</select></div>'
        + '<div class="fcrp-pref"><label>Print Mode</label><select id="intro-print-mode-selector">'
        + '<option value="printmon"' + (PRINT_MODE === 'printmon' ? ' selected' : '') + '>Printmon</option>'
        + '<option value="zebra"' + (PRINT_MODE === 'zebra' ? ' selected' : '') + '>Zebra</option>'
        + '</select></div>'
        + '</div>'
        + '</div></div>'

        // Feature toggles
        + '<div class="fcrp-section">'
        + '<div class="fcrp-section-title">Feature Toggles</div>'
        + '<div class="fcrp-toggle-grid">' + togglesHTML + '</div>'
        + '</div>'

        // Feature showcase
        + '<div class="fcrp-section">'
        + '<div class="fcrp-section-title">What\'s Included</div>'
        + '<div class="fcrp-cards">' + cardsHTML + '</div>'
        + '</div>'

        // Other scripts
        + '<div class="fcrp-section">'
        + '<div class="fcrp-section-title">More Tampermonkey Scripts</div>'
        + '<div class="fcrp-scripts">' + scriptsHTML + '</div>'
        + '</div>'

        // Footer
        + '<div class="fcrp-footer">'
        + '<a href="https://tamarin.aces.amazon.dev/scripts/fcr-plus/install.user.js" target="_blank">Check for Update</a>'
       // + '<a href="https://w.amazon.com/bin/view/TamperMonkeyTreasureChest" target="_blank">Tampermonkey Wiki</a>'
        + '<a href="https://rno-tools.corp.amazon.com/kiosk/asin_profile/select_fc" target="_blank">RNO Profiler</a>'
        + '<a href="https://pandash.amazon.com/" target="_blank">PanDash</a>'
        + '<a href="#" class="fcrp-bug-report-btn" style="background:#3a1414;border:1px solid #cc3333">\ud83d\udc1b Report Bug</a>'
        + '<p class="fcrp-credit">Made by kyleldri \u00b7 Report issues via tamarin.harmony.a2z.com</p>'
        + '</div>'

        + '</div>';

    $('body').append(html);



    // --- Event: toggle switches ---
    document.querySelectorAll('[data-fcrp-key]').forEach(function (cb) {
        cb.addEventListener('change', function () {
            var key = this.getAttribute('data-fcrp-key');
            $.cookie('cfg-' + key, this.checked ? '1' : '0', { expires: 365 });
            if (key === 'darkMode') Styles.applyDark();
        });
    });

    // --- Event: preference selectors ---
    document.getElementById('intro-region-selector').addEventListener('change', function () {
        GM_setValue('userRegion', this.value);
        location.reload();
    });
    document.getElementById('intro-fc-type-selector').addEventListener('change', function () {
        GM_setValue('userFCType', this.value);
        location.reload();
    });
    document.getElementById('intro-print-mode-selector').addEventListener('change', function () {
        setPrintMode(this.value);
        showToast('Print mode set to ' + this.value, 'success');
    });

    // --- Event: bulk actions ---
    document.getElementById('fcrp-enable-all').addEventListener('click', function () {
        document.querySelectorAll('[data-fcrp-key]').forEach(function (cb) {
            cb.checked = true;
            $.cookie('cfg-' + cb.getAttribute('data-fcrp-key'), '1', { expires: 365 });
        });
        Styles.applyDark();
        showToast('All features enabled', 'success');
    });

    document.getElementById('fcrp-disable-all').addEventListener('click', function () {
        document.querySelectorAll('[data-fcrp-key]').forEach(function (cb) {
            cb.checked = false;
            $.cookie('cfg-' + cb.getAttribute('data-fcrp-key'), '0', { expires: 365 });
        });
        Styles.applyDark();
        showToast('All features disabled', 'info');
    });

    document.getElementById('fcrp-reset-defaults').addEventListener('click', function () {
        if (!confirm('Reset all features to their default state?')) return;
        Object.keys(FEATURES).forEach(function (key) {
            $.cookie('cfg-' + key, FEATURES[key].default ? '1' : '0', { expires: 365 });
        });
        document.querySelectorAll('[data-fcrp-key]').forEach(function (cb) {
            var key = cb.getAttribute('data-fcrp-key');
            cb.checked = FEATURES[key].default;
        });
        Styles.applyDark();
        showToast('Reset to defaults', 'success');
    });

    // --- Version check on intro page ---
    GM_xmlhttpRequest({
        method: 'GET',
        url: 'https://tamarin.aces.amazon.dev/scripts/fcr-plus/install.user.js',
        onload: function (r) {
            var match = r.responseText.match(/@version\s+([\d.]+)/);
            if (!match) return;
            var remote = match[1];
            var statusEl = document.getElementById('fcrp-ver-status');
            if (!statusEl) return;
            if (remote === VERSION) {
                statusEl.innerHTML = '<span style="color:#33CC02">\u2714 Up to date</span>';
            } else {
                var remoteParts = remote.split('.').map(Number);
                var localParts = VERSION.split('.').map(Number);
                var isNewer = false;
                for (var i = 0; i < Math.max(remoteParts.length, localParts.length); i++) {
                    if ((remoteParts[i] || 0) > (localParts[i] || 0)) { isNewer = true; break; }
                    if ((remoteParts[i] || 0) < (localParts[i] || 0)) break;
                }
                if (isNewer) {
                    statusEl.innerHTML = '<a href="https://tamarin.aces.amazon.dev/scripts/fcr-plus/install.user.js" target="_blank" style="color:#ff4401;font-weight:bold;text-decoration:underline">Update available: v' + remote + '</a>';
                } else {
                    statusEl.innerHTML = '<span style="color:#33CC02">\u2714 Up to date</span>';
                }
            }
        },
        onerror: function () {}
    });
}

    // --- Sidebar ---

    function createSection(title, content) {
      var section = document.createElement('div');
      section.className = 'a-row a-expander-container a-expander-section-container sidebar-expander a-section-expander-container';
      section.innerHTML = '<a aria-expanded="false" role="button" href="javascript:void(0)" data-action="a-expander-toggle"'
        + ' class="a-expander-header a-declarative a-expander-section-header sidebar-expander-header a-link-section-expander a-size-medium"'
        + ' data-a-expander-toggle=\'{"allowLinkDefault":true, "expand_prompt":"", "collapse_prompt":""}\'>'
        + '<i class="a-icon a-icon-section-expand"></i><span class="a-expander-prompt"><h6>' + title + '</h6></span></a>'
        + '<div aria-expanded="false" class="a-expander-content a-expander-section-content a-section-expander-inner">' + content + '</div>';
      return section;
    }

    function sidebar() {
      var originalSidebar = document.getElementById('side-bar');
      if (!originalSidebar) return;

      var newSidebar = originalSidebar.cloneNode(true);
      while (newSidebar.firstChild) newSidebar.removeChild(newSidebar.firstChild);

      var defaultQuickLinks = [
        { name: 'DR SKU', url: 'https://dr-sku.amazon.com/en_US/#!/' },
        { name: 'PANDASH', url: 'https://pandash.amazon.com/' },
        { name: 'IO PRINT', url: 'https://aft-qt-na.aka.amazon.com/app/ioprint?experience=Desktop' },
        { name: 'Asin Profiler', url: 'https://rno-tools.corp.amazon.com/kiosk/asin_profile/select_fc' },
        { name: 'Move Items', url: 'https://aft-qt-na.aka.amazon.com/app/moveitems?experience=Desktop' },
        { name: 'Delete Items', url: 'https://aft-qt-na.aka.amazon.com/app/deleteitems?experience=Desktop' },
        { name: 'ADD Items', url: 'https://aft-problem-solve-website-jlb-iad.iad.proxy.amazon.com/found_item' },
        { name: 'SIDELINE', url: 'https://aft-poirot-website-iad.iad.proxy.amazon.com/' },
        { name: 'unbindHierarchy', url: 'http://tx-b-hierarchy-iad.iad.proxy.amazon.com/unbindHierarchy' },
        { name: 'Sourceability', url: 'https://src-na.corp.amazon.com/' },
        { name: 'DockMaster', url: 'https://fc-inbound-dock-hub-na.aka.amazon.com/en_US/#/dockmaster/search' }
      ];

      function getQuickLinks() {
        var saved = GM_getValue('customQuickLinks', null);
        if (saved) { try { return JSON.parse(saved); } catch (e) { return defaultQuickLinks; } }
        return defaultQuickLinks;
      }
      function saveQuickLinks(links) { GM_setValue('customQuickLinks', JSON.stringify(links)); }
      function resetQuickLinks() { GM_setValue('customQuickLinks', JSON.stringify(defaultQuickLinks)); return defaultQuickLinks; }

      // Build settings checkboxes grouped by category
      var categoryOrder = ['global', 'product', 'tool', 'po'];
      var categoryNames = { global: 'Global', product: 'Product Page', tool: 'Inventory Tools', po: 'Purchase Order / Shipment' };
      var mainSettingsHTML = '';
      var extraSettingsHTML = '';
      categoryOrder.forEach(function (cat) {
        var catHTML = '<div style="margin-top:5px;margin-bottom:2px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;opacity:0.6;padding-left:4px">' + categoryNames[cat] + '</div>';
        var hasItems = false;
        Object.keys(FEATURES).forEach(function (key) {
          var cfg = FEATURES[key];
          if (cfg.category !== cat) return;
          hasItems = true;
          var checked = featureOn(key) ? 'checked' : '';
          catHTML += '<label style="display:flex;align-items:center;padding:2px 4px;margin:1px 0;font-size:11px;cursor:pointer">'
            + '<input type="checkbox" id="enable-' + key + '" ' + checked + ' style="margin-right:5px">'
            + cfg.label + '</label>';
        });
        if (hasItems) mainSettingsHTML += catHTML;
      });

      var menuContent = '<div class="fcr-menu-container">'
        + '<button id="settings-button" class="fcr-sidebar-button" role="button"><span class="text">Settings</span></button>'
        + '<button id="quick-links-button" class="fcr-sidebar-button" role="button"><span class="text">Menu</span></button></div>'


                   // Settings panel
      + '<div id="settings-info" style="display:none;max-height:350px;overflow-y:auto;border-radius:4px;padding:6px;padding-right:14px;margin-top:6px;margin-left:-10px">'
      + '<div style="display:flex;justify-content:center;align-items:center;gap:6px;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.2)">'
      + '<a href="#" class="fcrp-bug-report-btn" '
      + 'style="display:inline-block;padding:3px 10px;background:#c62828;color:#fff !important;font-size:10px;font-weight:bold;'
      + 'border-radius:3px;text-decoration:none;letter-spacing:0.5px;white-space:nowrap">&#128027; Report Bug</a>'
      + '<button id="printmon3-button" style="display:inline-block;padding:7px 5px;background:#ff9900;color:#fff;font-size:10px;font-weight:bold;border-radius:3px;border:none;cursor:pointer;letter-spacing:0.5px;white-space:nowrap">Printmon 3</button></div>'
      + '<a href="' + window.location.origin + (getFC() ? '/' + getFC() : '') + '/search" id="home-link" style="display:block;text-align:center;padding:5px;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.2);background:rgba(243,125,21,0.15);color:#f37d15 !important;border:1px solid rgba(243,125,21,0.4);border-radius:3px;text-decoration:none;font-size:10px;font-weight:bold;letter-spacing:0.5px">&#127968; Home &amp; All Settings</a>'
      // Print mode selector //s15
      + '<div style="display:flex;align-items:center;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.2)">' //s15
      + '<strong style="font-size:11px;margin-right:6px">Print:</strong>'
      + '<select id="print-mode-selector" style="padding:2px 4px;font-size:11px;">'
      + '<option value="printmon"' + (PRINT_MODE === 'printmon' ? ' selected' : '') + '>Printmon</option>' //s15
      + '<option value="zebra"' + (PRINT_MODE === 'zebra' ? ' selected' : '') + '>Zebra</option>' //s15
      + '</select></div>' //s15



      + mainSettingsHTML
      + '</div>'

      // Quick links panel
      + '<div id="quick-links-menu" style="display:none;margin-top:5px;max-height:350px;overflow-y:auto;padding:5px;border-radius:4px">'
      + '<div id="quick-links-grid" class="quick-links-grid"></div>'
      + '<div style="margin-top:5px;padding-top:5px;border-top:1px solid rgba(255,255,255,0.2)">'
      + '<button id="edit-links-toggle" style="width:100%;padding:3px;background:rgba(255,255,255,0.1);color:inherit;border:1px solid rgba(255,255,255,0.2);border-radius:3px;cursor:pointer;font-size:10px">Edit Links</button></div>'
      + '<div id="quick-links-edit-panel" style="display:none;margin-top:5px;padding:5px;background:rgba(0,0,0,0.2);border-radius:3px">'
      + '<div id="edit-links-list" style="max-height:100px;overflow-y:auto;margin-bottom:5px"></div>'
      + '<div style="border-top:1px solid rgba(255,255,255,0.2);padding-top:5px;margin-top:5px">'
      + '<input type="text" id="new-link-name" placeholder="Name" style="width:100%;padding:3px;margin-bottom:3px;background:rgba(255,255,255,0.1);color:inherit;border:1px solid rgba(255,255,255,0.2);border-radius:2px;font-size:10px;box-sizing:border-box">'
      + '<input type="text" id="new-link-url" placeholder="https://..." style="width:100%;padding:3px;margin-bottom:3px;background:rgba(255,255,255,0.1);color:inherit;border:1px solid rgba(255,255,255,0.2);border-radius:2px;font-size:10px;box-sizing:border-box">'
      + '<div style="display:flex;gap:3px">'
      + '<button id="add-link-btn" style="flex:1;padding:3px;background:#2E7D32;color:white;border:none;border-radius:2px;cursor:pointer;font-size:10px">Add</button>'
      + '<button id="reset-links-btn" style="flex:1;padding:3px;background:#c62828;color:white;border:none;border-radius:2px;cursor:pointer;font-size:10px">Reset</button>'
      + '</div></div></div></div>';

      var menuSection = createSection('FCR Plus Menu ' + VERSION, menuContent);
      newSidebar.appendChild(menuSection);

      // Move original sidebar children
      Array.from(originalSidebar.children).forEach(function (child) {
        var heading = child.querySelector('h6, .a-expander-prompt');
        if (!heading || !heading.textContent.includes('Profile')) {
          newSidebar.appendChild(child.cloneNode(true));
        }
      });

      // Profile section last
      var profileSection = Array.from(originalSidebar.children).find(function (child) {
        var h = child.querySelector('h6, .a-expander-prompt');
        return h && h.textContent.includes('Profile');
      });
      if (profileSection) newSidebar.appendChild(profileSection.cloneNode(true));

      originalSidebar.parentNode.replaceChild(newSidebar, originalSidebar);

      // --- Event listeners ---

      function renderQuickLinks() {
        var grid = document.getElementById('quick-links-grid');
        var links = getQuickLinks();
        grid.innerHTML = links.map(function (l) {
          return '<a href="' + l.url + '" target="_blank" class="quick-link-button">' + l.name + '</a>';
        }).join('');
      }

      function renderEditList() {
        var editList = document.getElementById('edit-links-list');
        var links = getQuickLinks();
        editList.innerHTML = links.map(function (l, idx) {
          return '<div style="display:flex;align-items:center;justify-content:space-between;padding:2px 4px;margin:1px 0;background:rgba(255,255,255,0.1);border-radius:2px">'
            + '<span style="font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">' + l.name + '</span>'
            + '<button class="delete-link-btn" data-index="' + idx + '" style="background:#c62828;color:white;border:none;border-radius:2px;padding:1px 5px;font-size:9px;cursor:pointer;margin-left:4px">X</button></div>';
        }).join('');

        editList.querySelectorAll('.delete-link-btn').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var links = getQuickLinks();
            links.splice(parseInt(this.getAttribute('data-index')), 1);
            saveQuickLinks(links);
            renderQuickLinks();
            renderEditList();
          });
        });
      }

      document.getElementById('settings-button').addEventListener('click', function () {
        var si = document.getElementById('settings-info');
        var ql = document.getElementById('quick-links-menu');
        si.style.display = si.style.display === 'none' ? 'block' : 'none';
        ql.style.display = 'none';
      });

      document.getElementById('quick-links-button').addEventListener('click', function () {
        var si = document.getElementById('settings-info');
        var ql = document.getElementById('quick-links-menu');
        if (ql.style.display === 'none') { renderQuickLinks(); ql.style.display = 'block'; }
        else { ql.style.display = 'none'; }
        si.style.display = 'none';
      });

      document.getElementById('edit-links-toggle').addEventListener('click', function () {
        var panel = document.getElementById('quick-links-edit-panel');
        if (panel.style.display === 'none') { renderEditList(); panel.style.display = 'block'; this.textContent = 'Close Editor'; }
        else { panel.style.display = 'none'; this.textContent = 'Edit Links'; }
      });

      document.getElementById('add-link-btn').addEventListener('click', function () {
        var nameInput = document.getElementById('new-link-name');
        var urlInput = document.getElementById('new-link-url');
        var name = nameInput.value.trim();
        var url = urlInput.value.trim();
        if (!name || !url) { showToast('Enter both a name and URL', 'warning'); return; }
        if (!url.match(/^https?:\/\//)) url = 'https://' + url;
        var links = getQuickLinks();
        links.push({ name: name, url: url });
        saveQuickLinks(links);
        nameInput.value = '';
        urlInput.value = '';
        renderQuickLinks();
        renderEditList();
      });

      document.getElementById('reset-links-btn').addEventListener('click', function () {
        if (confirm('Reset all links to defaults?')) { resetQuickLinks(); renderQuickLinks(); renderEditList(); }
      });



     document.getElementById('print-mode-selector').addEventListener('change', function () {  //s15
        setPrintMode(this.value);  //s15
        location.reload();  //s15
     });  //s15

      Object.keys(FEATURES).forEach(function (key) {
        var cb = document.getElementById('enable-' + key);
        if (cb) {
          cb.addEventListener('change', function () {
            $.cookie('cfg-' + key, this.checked ? '1' : '0', { expires: 365 });
            if (key === 'darkMode') Styles.applyDark();
            else location.reload();
          });
        }
      });
            document.getElementById('printmon3-button').addEventListener('click', function () {
                Printmon3.open();
            });
    }

    // --- Context menu ---

    function contextMenu() {
          var ASIN_LINKS = [
        { name: 'Copy', action: function (v) { copyClip(v); } },
        { name: 'Open in New Tab', url: function (v) { return window.location.origin + '/' + $.cookie('fcmenu-warehouseId') + '/results?s=' + v; } },
        { name: 'Print ASIN', action: function (v) { routePrintFromMenu(v); } }, //s15 (was: Printing.handlePrintFromMenu(v))
        { name: 'Show Barcode', action: function (v) { showBarcode(v); } },
        { separator: true },
        { name: 'GetMappings', url: function (v) { return getURL('commingling') + '/tool/fnsku-mappings-tool?getMappingsType=ASIN_MAPPINGS&FNSku=&FNSkus=&merchantId=&MSku=&ASIN=' + v + '&includeInactive=true&submit=get&paginationToken='; } },
        { name: 'Prep Manager', url: function (v) { return getURL('prepmanager') + '/view/' + v + '?region=' + REGION; } },
        { name: 'Procurement', url: function (v) { return getURL('procurement') + '/bp/asin?asin=' + v; } },
        { name: 'PanDash', url: function (v) { return 'https://pandash.amazon.com#' + v; } },
        { name: 'CSI', url: function (v) { return 'https://csi.amazon.com/view?view=simple_product_data_view&item_id=' + v + '&marketplace_id=' + (CONFIG.marketplaceId[REGION] || '1'); } },
        { name: 'Amazon', url: function (v) { return 'https://' + (CONFIG.retailDomain[REGION] || 'amazon.com') + '/dp/' + v; } },
        { name: 'PO Portal', url: function () { return 'https://console.harmony.a2z.com/poportal/'; } }
    ];

    var PO_LINKS = [
        { name: 'Copy', action: function (v) { copyClip(v); } },
        { name: 'Open in New Tab', url: function (v) { return window.location.origin + '/' + $.cookie('fcmenu-warehouseId') + '/results?s=' + v; } },
        { name: 'Print', action: function (v) { var q = prompt('How many labels?', '1'); if (q && parseInt(q) > 0) Printing.sendPrintXHR(v, q); } },
        { name: 'Show Barcode', action: function (v) { showBarcode(v); } },
        { separator: true }
    ];

    var DEFAULT_LINKS = [
        { name: 'Copy', action: function (v) { copyClip(v); } },
        { name: 'Open in New Tab', url: function (v) { return window.location.origin + '/' + $.cookie('fcmenu-warehouseId') + '/results?s=' + v; } },
        { name: 'Print', action: function (v) { var q = prompt('How many labels?', '1'); if (q && parseInt(q) > 0) Printing.sendPrintXHR(v, q); } },
        { name: 'Show Barcode', action: function (v) { showBarcode(v); } }
    ];


      /* function copyClip(text) {
        var temp = $('<input>');
        $('body').append(temp);
        temp.val(text).select();
        document.execCommand('copy');
        temp.remove();
      } */
    function copyClip(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        var temp = $('<input>');
        $('body').append(temp);
        temp.val(text).select();
        document.execCommand('copy');
        temp.remove();
      }
    }

      function showBarcode(text) {
        $('.barcode-modal').remove();
        var modal = $('<div class="barcode-modal">');
        var content = $('<div class="barcode-content">');
        var canvas = $('<canvas>');
        content.append(canvas);
        var closeBtn = $('<button class="barcode-close">Close</button>');
        content.append(closeBtn);
        modal.append(content);
        $('body').append(modal);
        JsBarcode(canvas[0], text, { format: 'CODE128', width: 2, height: 100, displayValue: true });
        closeBtn.on('click', function () { modal.remove(); });
        modal.on('click', function (e) { if (e.target === this) modal.remove(); });
      }

function buildMenu(event, value, type) {
    if (!value || !value.trim().length) return;
    event.preventDefault();
    event.stopPropagation();

    $('.custom-context-menu').remove();

    var links = type === 'ASIN' ? ASIN_LINKS : (type === 'PO' ? PO_LINKS : DEFAULT_LINKS);
    var menu  = $('<div class="custom-context-menu">');

    menu.css({ position: 'fixed', top: '-9999px', left: '-9999px', visibility: 'hidden', zIndex: '2147483645' });

    links.forEach(function (link) {
        if (link.separator) { menu.append('<hr/>'); return; }
        var item = $('<div class="menu-item">' + link.name + '</div>');
        if (link.action) { item.on('click', function () { link.action(value); menu.remove(); }); }
        else if (link.url) { item.on('click', function () { window.open(link.url(value), '_blank'); menu.remove(); }); }
        menu.append(item);
    });

    $('body').append(menu);

    requestAnimationFrame(function () {
        var mw  = menu.outerWidth(true)  || 220;
        var mh  = menu.outerHeight(true) || 400;
        var ww  = $(window).width();
        var wh  = $(window).height();
        var pad = 10;
        var cx  = event.clientX;
        var cy  = event.clientY;

        var x = cx + pad;
        if (x + mw > ww - pad) x = cx - mw - pad;
        if (x < pad) x = pad;

        var y = cy + pad;
        if (y + mh > wh - pad) y = cy - mh - pad;
        if (y < pad) y = pad;

        x = Math.max(pad, Math.min(x, ww - mw - pad));
        y = Math.max(pad, Math.min(y, wh - mh - pad));

        menu.css({
            top:        y + 'px',
            left:       x + 'px',
            visibility: 'visible',
            position:   'fixed',
            zIndex:     '2147483645'
        });
    });

    $(document).one('click contextmenu', function () { menu.remove(); });
}



      function getSelected() {
        return window.getSelection ? window.getSelection().toString() : '';
      }

      $(document).on('contextmenu', function (e) {
        if (getSelected().length > 0) return true;
        if ($(e.target).is('input, select, textarea, button')) return true;

        var $target = $(e.target);
        var text = '';
        var $link = $target.is('a') ? $target : $target.closest('a');
        text = ($link.length ? $link : $target).text().trim();

        if (!text || text.length > 200) return true;

        var match;
        if ((match = text.match(/\b(B0|X0)[A-Z0-9]{8}\b/))) { buildMenu(e, match[0], 'ASIN'); return false; }
        if ((match = text.match(/\b[0-9][A-Z0-9]{7}\b/))) { buildMenu(e, match[0], 'PO'); return false; }
        if (text.length < 50) { buildMenu(e, text, 'DEFAULT'); return false; }
        return true;
      });
    }

    // --- Image hover on ASINs ---



    // --- SSCC quick glance ---

    function ssccGlance() {
      var section = document.querySelector('div[data-section-type="sscc-info"]');
      if (!section) return;

      var table = section.querySelector('#table-sscc-info');
      if (!table) return;

      var firstLink = table.querySelector('tbody tr td:first-child a');
      if (!firstLink) return;
      var asin = firstLink.textContent;

      var infoLink = section.querySelector('.a-box-inner table.a-keyvalue tbody tr:first-child td:last-child a');
      if (infoLink) {
        infoLink.textContent = asin;
        infoLink.href = '/' + (getFC() || 'CMH2') + '/results?s=' + asin;
      }

      var navLink = document.querySelector('a[href="#sscc-info-nav"]');
      if (navLink) navLink.innerHTML = '<i class="s-icon-status"></i>SSCC Information (' + asin + ')';
    }

    // --- Product attribute highlighting ---

   function attributeHighlight() {
    waitForKeyElements('div [data-section-type="product"] .a-keyvalue', function () {
        var invert = FC_TYPE === 'amxl';

        ['Sortable', 'Conveyable', 'Very High Value', 'Master Case'].forEach(function (attr) {
            var header = $('.a-keyvalue th:contains("' + attr + '")');
            var row = header.parent();
            var isFalse = row.find('td').text().trim() === 'false';
            var bad = (attr === 'Sortable' || attr === 'Conveyable') ? (invert ? !isFalse : isFalse) : isFalse;
            row.css('background-color', bad ? ATTRIBUTE_COLORS.negative : ATTRIBUTE_COLORS.positive);
        });

        var weightHeader = $('.a-keyvalue th:contains("Weight")');
        if (weightHeader.length) {
            var val = parseFloat(weightHeader.parent().find('td').text());
            if (val > 49.99) weightHeader.parent().css('background-color', ATTRIBUTE_COLORS.overweight);
        }
    });
}


    // --- Tools dropdowns ---

    function closeAllDropdowns() {
      document.querySelectorAll('.tools-dropdown-menu').forEach(function (m) { m.style.display = 'none'; });
    }

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.tools-dropdown-container')) closeAllDropdowns();
    });

    function createToolsDropdown(sectionId, items) {
      var header = document.querySelector('[data-section-type="' + sectionId + '"] .section-title');
      if (!header || header.querySelector('.tools-dropdown-container')) return;

      var enabled = items.filter(function (item) { return item.separator || item.enabled(); });
      if (!enabled.length) return;

      var container = document.createElement('div');
      container.className = 'tools-dropdown-container';

      var btn = document.createElement('button');
      btn.className = 'tools-dropdown-btn';
      btn.textContent = 'Tools \u25BC';
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var menu = container.querySelector('.tools-dropdown-menu');
        var isOpen = menu.style.display === 'block';
        closeAllDropdowns();
        if (!isOpen) {
          // Position menu, clamped to viewport
          var rect = btn.getBoundingClientRect();
          menu.style.display = 'block';
          var menuRect = menu.getBoundingClientRect();
          var top = rect.bottom + 2;
          var left = rect.left;
          if (top + menuRect.height > window.innerHeight - 8) {
            top = rect.top - menuRect.height - 2;
            if (top < 8) top = 8;
          }
          if (left + menuRect.width > window.innerWidth - 8) {
            left = window.innerWidth - menuRect.width - 8;
          }
          if (left < 8) left = 8;
          menu.style.top = top + 'px';
          menu.style.left = left + 'px';
        }
      });

      var menu = document.createElement('div');
      menu.className = 'tools-dropdown-menu';
      menu.style.display = 'none';

      var resultsSpan = document.createElement('span');
      resultsSpan.className = 'tools-results';
      resultsSpan.id = 'tools-results-' + sectionId;

      enabled.forEach(function (item) {
        if (item.separator) {
          var sep = document.createElement('div');
          sep.className = 'tools-dropdown-separator';
          menu.appendChild(sep);
        } else {
          var menuItem = document.createElement('div');
          menuItem.className = 'tools-dropdown-item';
          menuItem.textContent = item.label;
          if (item.tooltip) menuItem.title = item.tooltip;
          menuItem.addEventListener('click', function (e) {
            e.stopPropagation();
            menu.style.display = 'none';
            item.action(resultsSpan);
          });
          menu.appendChild(menuItem);
        }
      });

      container.appendChild(btn);
      container.appendChild(menu);
      header.appendChild(container);
      header.appendChild(resultsSpan);
    }

            function inventoryDropdown() {
            var containerVal = (window.location.href.split('=')[1] || '');
            var isContainer = containerVal.startsWith('tscage') || containerVal.startsWith('tscart');

            createToolsDropdown('inventory', [
                { label: 'RNO Asin Profiler', enabled: function () { return featureOn('rnoSizeProfiler'); }, action: function (r) { Profiler.processRNOBatch(r, '#table-inventory'); } },
                { separator: true, enabled: function () { return true; } },
                { label: 'ASIN Level Prep', enabled: function () { return featureOn('asinLevelPrep'); }, action: function (r) {
                    var tbody = document.querySelector('#table-inventory tbody');
                    if (tbody) {
                        var rows = Array.from(tbody.querySelectorAll('tr:not(.prep-instructions-row):not(.rno-size-profile-row):not(.asin-profile-row):not(.hazmat-instructions-row)'));
                        Prep.processRows(rows, r, false);
                    }
                }},
                { label: 'Research Prep', enabled: function () { return featureOn('researchPrep'); }, tooltip: 'Vendor prep lookup (PO Items section only)', action: function (r) {
                    alert('Research Prep is available in the Purchase Order Items section (uses vendor code from PO table).');
                }},
                { separator: true, enabled: function () { return true; } },
                { label: 'Show Hazmat Levels', enabled: function () { return featureOn('hazmatLevels'); }, action: function (r) { Hazmat.process('inventory', r); } },
                { label: 'Calculate Weight', enabled: function () { return featureOn('weightCalculator'); }, action: function (r) { Weight.calcWeight(r); } },
                { label: 'Container Utilization', enabled: function () { return featureOn('containerUtilization') && isContainer; }, action: function (r) { Weight.calcUtilization(r); } },
                { label: 'Check Expiration Date', enabled: function () { return featureOn('expirationDate'); }, action: function (r) { Expiration.process(r); } },
                { label: 'Price Lookup', enabled: function () { return featureOn('priceLookup'); }, action: function (r) { Price.process(r); } },
                { separator: true, enabled: function () { return true; } },
                { label: 'Export to CSV', enabled: function () { return featureOn('csvExport'); }, action: function (r) { CSV.exportInventory(r); } }
            ]);
        }


             function poDropdown() {
            createToolsDropdown('purchase-order-item', [
                { label: 'RNO Asin Profiler', enabled: function () { return featureOn('rnoSizeProfiler'); }, action: function (r) { Profiler.processRNOBatch(r, '#table-purchase-order-item'); } },
                { separator: true, enabled: function () { return true; } },
                {
                    label: 'ASIN Level Prep',
                    enabled: function () { return featureOn('asinLevelPrep'); },
                    action: function (r) {
                        var section = document.querySelector('[data-section-type="purchase-order-item"]');
                        if (section) {
                            var rows = Array.from(section.querySelector('#table-purchase-order-item tbody').querySelectorAll('tr:not(.prep-instructions-row):not(.rno-size-profile-row):not(.hazmat-instructions-row)'));
                            Prep.processRows(rows, r, false);
                        }
                    }
                },
                {
                    label: 'Vendor State Prep',
                    enabled: function () { return featureOn('researchPrep'); },
                    tooltip: 'Checks vendor prep state per ASIN (uses vendor code from PO table)',
                    action: function (r) {
                        var section = document.querySelector('[data-section-type="purchase-order-item"]');
                        if (section) {
                            var rows = Array.from(section.querySelector('#table-purchase-order-item tbody').querySelectorAll('tr:not(.prep-instructions-row):not(.rno-size-profile-row):not(.hazmat-instructions-row)'));
                            Prep.processRowsVendor(rows, r);
                        }
                    }
                },
                {
                    label: 'Research Prep',
                    enabled: function () { return featureOn('researchPrep'); },
                    tooltip: 'Checks prep based on PO shipment (requires Shipment section)',
                    action: function (r) {
                        var isd = Prep.findISD();
                        if (!getFC()) { alert('Unable to determine FC.'); return; }
                        if (!isd) { alert('No valid ISD/SHIPMENT found.'); return; }
                        var section = document.querySelector('[data-section-type="purchase-order-item"]');
                        if (section) {
                            var rows = Array.from(section.querySelector('#table-purchase-order-item tbody').querySelectorAll('tr:not(.prep-instructions-row):not(.rno-size-profile-row):not(.hazmat-instructions-row)'));
                            Prep.processRows(rows, r, true);
                        }
                    }
                },
                { separator: true, enabled: function () { return true; } },
                {
                    label: 'Show Hazmat Levels',
                    enabled: function () { return featureOn('hazmatLevels'); },
                    action: function (r) { Hazmat.process('po', r); }
                },
                {
                    label: 'Get ASIN Weights',
                    enabled: function () { return featureOn('weightCalculator'); },
                    action: function (r) { Weight.getAsinWeightPills(r); }
                },
                { separator: true, enabled: function () { return true; } },
                {
                    label: 'Export to CSV',
                    enabled: function () { return featureOn('csvExport'); },
                    action: function (r) { CSV.exportPO(r); }
                }
            ]);
        }



    function inventoryHistoryDropdown() {
        createToolsDropdown('inventory-history', [
            { label: 'Export to CSV', enabled: function () { return featureOn('csvExport'); }, action: function (r) { CSV.exportInventoryHistory(r); } }
        ]);
    }


    // --- Header Enhancement (experimental) ---

    function headerEnhance() {
      // Skip intro/search page (has its own layout)
      if (window.location.href.includes('/search')) return;

      var nav = document.querySelector('.aui-nav-row');
      if (!nav) return;

      // Replace logo with FCR Plus branding
      var logoFC = nav.querySelector('.logo-fc');
      var logoRes = nav.querySelector('.logo-research');
      var warehouseId = nav.querySelector('.warehouse-id');
      if (logoFC && logoRes) {
        var fc = getFC() || '';
        logoFC.textContent = 'FCR';
        logoFC.style.fontWeight = '900';
        logoRes.textContent = ' Plus';
        if (warehouseId) {
          warehouseId.textContent = fc;
          warehouseId.style.marginLeft = '6px';
        }
      }

      // Search history dropdown in header
      var searchInput = document.getElementById('search');
      var searchBtn = document.getElementById('search-button');
      if (searchInput && searchBtn) {
        var histBtn = document.createElement('span');
        histBtn.innerHTML = '\u2261'; // horizontal bar
        histBtn.title = 'Search History';
        histBtn.style.cssText = 'cursor:pointer;font-size:18px;margin-left:8px;vertical-align:middle;opacity:0.7;transition:opacity 0.2s';
        histBtn.addEventListener('mouseenter', function () { histBtn.style.opacity = '1'; });
        histBtn.addEventListener('mouseleave', function () { histBtn.style.opacity = '0.7'; });
        searchBtn.parentNode.insertBefore(histBtn, searchBtn.nextSibling);

        var historyDropdown = document.createElement('div');
        var t = (THEMES[THEME] || THEMES.fcrplus);
        historyDropdown.style.cssText = 'display:none;position:absolute;top:100%;right:0;width:280px;background:' + t.surface + ';border:1px solid ' + t.accent + ';border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.4);z-index:99999;max-height:260px;overflow-y:auto;margin-top:4px';

        var searchWrap = searchInput.closest('.aui-nav-search') || searchInput.closest('.a-search') || searchInput.parentNode;
        searchWrap.style.position = 'relative';
        searchWrap.appendChild(historyDropdown);

        function getHeaderHistory() {
          // Read from sidebar #history-list (server-rendered, most reliable source)
          var items = [];
          var histList = document.getElementById('history-list');
          if (histList) {
            var links = histList.querySelectorAll('a');
            for (var i = 0; i < links.length; i++) {
              items.push(links[i].textContent.trim());
            }
          }
          return items;
        }

        function renderHeaderHistory() {
          var items = getHeaderHistory();
          historyDropdown.innerHTML = '';
          if (!items.length) {
            var empty = document.createElement('div');
            empty.textContent = 'No search history';
            empty.style.cssText = 'padding:10px;font-size:11px;color:' + t.text + ';opacity:0.5;text-align:center';
            historyDropdown.appendChild(empty);
          } else {
            var pinned = getPinnedSearches();
            // Show pinned first
            var sorted = items.slice().sort(function (a, b) {
              var aP = pinned.indexOf(a) !== -1;
              var bP = pinned.indexOf(b) !== -1;
              if (aP && !bP) return -1;
              if (!aP && bP) return 1;
              return 0;
            });
            sorted.forEach(function (item) {
              var isPinned = pinned.indexOf(item) !== -1;
              var row = document.createElement('a');
              row.textContent = item;
              row.href = '#';
              row.style.cssText = 'display:block;padding:7px 12px;font-size:12px;cursor:pointer;color:' + t.text + ';border-bottom:1px solid ' + t.accent + '44;transition:background 0.15s;text-decoration:none;position:relative;padding-right:28px' + (isPinned ? ';border-left:2px solid #f37d15' : '');
              row.addEventListener('mouseenter', function () { row.style.background = t.accent + '44'; });
              row.addEventListener('mouseleave', function () { row.style.background = ''; });
              row.addEventListener('click', function (e) {
                e.preventDefault();
                searchInput.value = item;
                searchInput.focus();
                searchInput.select();
                historyDropdown.style.display = 'none';
                histOpen = false;
              });

              // Pin star
              var pinStar = document.createElement('span');
              pinStar.textContent = isPinned ? '★' : '☆';
              pinStar.title = isPinned ? 'Unpin' : 'Pin to top';
              pinStar.style.cssText = 'position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:12px;opacity:' + (isPinned ? '1;color:#f37d15' : '0.4') + ';cursor:pointer';
              pinStar.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                var pins = getPinnedSearches();
                var idx = pins.indexOf(item);
                if (idx !== -1) { pins.splice(idx, 1); } else { pins.push(item); }
                setPinnedSearches(pins);
                renderHeaderHistory();
                // Also refresh sidebar pins
                if (typeof enhanceSearchHistory === 'function') enhanceSearchHistory();
              });

              row.appendChild(pinStar);
              historyDropdown.appendChild(row);
            });
          }
        }

        var histOpen = false;
        histBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          histOpen = !histOpen;
          if (histOpen) {
            renderHeaderHistory();
            historyDropdown.style.display = 'block';
          } else {
            historyDropdown.style.display = 'none';
          }
        });

        document.addEventListener('click', function () {
          if (histOpen) {
            histOpen = false;
            historyDropdown.style.display = 'none';
          }
        });
      }


    }

    function enhanceSearchHistory() {
      var historyList = document.getElementById('history-list');
      if (!historyList) return;

      var searchInput = document.getElementById('search');
      var pinned = getPinnedSearches();

      // Inject pin styles once
      if (!document.getElementById('fcrp-pin-styles')) {
        var style = document.createElement('style');
        style.id = 'fcrp-pin-styles';
        style.textContent = '#history-list li { position: relative; padding-right: 22px; }'
          + '#history-list li .fcrp-pin { position: absolute; right: 2px; top: 50%; transform: translateY(-50%); cursor: pointer; font-size: 12px; opacity: 0.3; transition: opacity 0.15s; }'
          + '#history-list li:hover .fcrp-pin { opacity: 0.8; }'
          + '#history-list li .fcrp-pin.pinned { opacity: 1; color: #f37d15; }'
          + '#history-list li.fcrp-pinned { border-left: 2px solid #f37d15; padding-left: 6px; }';
        document.head.appendChild(style);
      }

      // Collect entries from server-rendered list
      var items = Array.from(historyList.querySelectorAll('li'));
      var entries = items.map(function (li) {
        var a = li.querySelector('a');
        if (!a) return null;
        return { text: a.textContent.trim(), href: a.getAttribute('href'), el: li };
      }).filter(Boolean);

      // Sort: pinned first
      entries.sort(function (a, b) {
        var aPin = pinned.indexOf(a.text) !== -1;
        var bPin = pinned.indexOf(b.text) !== -1;
        if (aPin && !bPin) return -1;
        if (!aPin && bPin) return 1;
        return 0;
      });

      // Rebuild
      historyList.innerHTML = '';
      entries.forEach(function (entry) {
        var li = document.createElement('li');
        var isPinned = pinned.indexOf(entry.text) !== -1;
        if (isPinned) li.className = 'fcrp-pinned';

        var a = document.createElement('a');
        a.href = entry.href;
        a.textContent = entry.text;

        // Click to populate input for editing (ctrl+click = normal nav)
        a.addEventListener('click', function (e) {
          if (e.ctrlKey || e.metaKey) return;
          e.preventDefault();
          if (searchInput) {
            searchInput.value = entry.text;
            searchInput.focus();
            searchInput.select();
          }
        });

        // Pin star
        var pin = document.createElement('span');
        pin.className = 'fcrp-pin' + (isPinned ? ' pinned' : '');
        pin.textContent = isPinned ? '★' : '☆';
        pin.title = isPinned ? 'Unpin' : 'Pin to top';
        pin.addEventListener('click', function (e) {
          e.stopPropagation();
          e.preventDefault();
          var pins = getPinnedSearches();
          var idx = pins.indexOf(entry.text);
          if (idx !== -1) {
            pins.splice(idx, 1);
          } else {
            pins.push(entry.text);
          }
          setPinnedSearches(pins);
          enhanceSearchHistory();
        });

        li.appendChild(a);
        li.appendChild(pin);
        historyList.appendChild(li);
      });
    }

    function getPinnedSearches() {
      try { return JSON.parse(GM_getValue('pinnedSearches', '[]')); } catch (e) { return []; }
    }

    function setPinnedSearches(pins) {
      GM_setValue('pinnedSearches', JSON.stringify(pins));
    }




    return {
        tabIcon: tabIcon,
        introPage: introPage,
        sidebar: sidebar,
        contextMenu: contextMenu,
        ssccGlance: ssccGlance,
        attributeHighlight: attributeHighlight,
        inventoryDropdown: inventoryDropdown,
        poDropdown: poDropdown,
        inventoryHistoryDropdown: inventoryHistoryDropdown,
        headerEnhance: headerEnhance,
        enhanceSearchHistory: enhanceSearchHistory
    };

  })();


    // ======= [S13] PRINTMON 3 (SLIM) =======
    // In page modal: Label Printer
    // Full standalone: https://tamarin.aces.amazon.dev/scripts/printmon-3/install.user.js
    var Printmon3 = (function () {

    var PM3_CFG = {
      charWidthRatio: 0.68,
      autoScaleStart: 250,
      lineSpacingPad: 8,
      labelProfiles: {
        standard: { labelWidth:812, labelHeight:609 },
        small:    { labelWidth:406, labelHeight:203 }
      },
      marginX:30, marginY:30, maxQty:50,
      characterSet:'^CI28', font:'A0N'
    };

    // State
    var overlay = null;
    var pm3Mode = 'zebra'; // 'zebra' or 'printmon'
    var labelType = 'barcode';
    var labelProfile = 'standard';
    var pm3Alignment = 'C';
    var pm3AutoScale = true;
    var pm3Reverse = false;
    var pm3FontSize = 40;
    var pm3CharLimit = 35;


    // --- Auto scale: start at 250, shrink until text fits label ---
    function autoScaleFont(text, lw, lh) {
      var mX = PM3_CFG.marginX, mY = PM3_CFG.marginY;
      var lp = PM3_CFG.lineSpacingPad;
      var ratio = PM3_CFG.charWidthRatio;
      var startFs = PM3_CFG.autoScaleStart;
      var usW = lw - mX * 2;
      var usH = lh - mY * 2;
      // find longest word (cannot break inside a word)
      var longestWord = 0;
      text.split(/\s+/).forEach(function(w) { if (w.length > longestWord) longestWord = w.length; });
      var sw = usW * 0.92;
      for (var fs = startFs; fs >= 18; fs--) {
        var cpl = Math.max(longestWord, Math.floor(sw / (fs * ratio)));
        var lines = wrapText(text, cpl);
        if (lines.length * (fs + lp) <= usH && (longestWord * fs * ratio) <= usW * 0.95) {
          return { fontSize: fs, charsPerLine: cpl };
        }
      }
      return { fontSize: 18, charsPerLine: Math.max(longestWord, Math.floor(sw / (18 * ratio))) };
    }

    // --- ZPL ---
    function wrapText(text, cpl) {
      var words = text.split(' '); var lines = []; var line = '';
      for (var i = 0; i < words.length; i++) {
        if (line.length + words[i].length + 1 > cpl && line.length > 0) {
          lines.push(line); line = words[i];
        } else { line += (line ? ' ' : '') + words[i]; }
      }
      if (line) lines.push(line);
      return lines;
    }

    function buildBarcodeZPL(code, qty) {
      var p = PM3_CFG.labelProfiles[labelProfile];
      var lw = p.labelWidth, lh = p.labelHeight;
      var mx = PM3_CFG.marginX, my = PM3_CFG.marginY;
      var bcH = Math.min(120, lh - 200);
      var x = pm3Alignment === 'C' ? Math.round((lw - 300) / 2) : pm3Alignment === 'R' ? lw - 300 - mx : mx;
      var zpl = '^XA\n' + PM3_CFG.characterSet + '\n^PW' + lw + '\n^LL' + lh + '\n';
      zpl += '^FO' + x + ',' + my + '\n^BY3^BCN,' + bcH + ',Y,N,N^FD' + code + '^FS\n^XZ';
      var out = '';
      for (var i = 0; i < qty; i++) out += zpl + '\n';
      return out;
    }

    function buildTextZPL(text, qty) {
      if (!text) return '';
      var p = PM3_CFG.labelProfiles[labelProfile];
      var lw = p.labelWidth, lh = p.labelHeight;
      var mx = PM3_CFG.marginX, my = PM3_CFG.marginY;
      var lp = PM3_CFG.lineSpacingPad;
      var fs, cpl;
      if (pm3AutoScale) {
        var sc = autoScaleFont(text, lw, lh);
        fs = sc.fontSize; cpl = sc.charsPerLine;
      } else {
        fs = pm3FontSize; cpl = pm3CharLimit;
      }
      var lineH = fs + lp;
      var lines = wrapText(text, cpl);
      var ratio = PM3_CFG.charWidthRatio;
      var zpl = '^XA\n' + PM3_CFG.characterSet + '\n^PW' + lw + '\n^LL' + lh + '\n';
      if (pm3Reverse) zpl += '^FO0,0\n^GB' + lw + ',' + lh + ',' + lh + ',,0^FS\n';
      var y = my;
      for (var j = 0; j < lines.length; j++) {
        if (!lines[j]) { y += Math.round(lineH * 0.6); continue; }
        var xPos = mx;
        var ll = Math.round(lines[j].length * fs * ratio);
        if (pm3Alignment === 'C') xPos = Math.max(mx, Math.round((lw - ll) / 2));
        else if (pm3Alignment === 'R') xPos = Math.max(mx, lw - mx - ll);
        zpl += '^FO' + xPos + ',' + y + '\n';
        zpl += '^' + PM3_CFG.font + ',' + fs + ',' + fs + '\n';
        if (pm3Reverse) zpl += '^FR\n';
        zpl += '^FD' + lines[j] + '^FS\n';
        y += lineH;
      }
      zpl += '^XZ';
      var out = '';
      for (var k = 0; k < qty; k++) out += zpl + '\n';
      return out;
    }

    // --- Print dispatch ---
    function sendZebraPrint(zpl, callback) {
      var ip = getCookie('fcmenu-remoteAddr');
      if (!ip) { callback(false, 'No printer detected (log in to workstation)'); return; }
      GM_xmlhttpRequest({
        method: 'POST',
        url: 'http://' + ip + ':9100',
        data: zpl,
        headers: { 'Content-Type': 'text/plain' },
        timeout: 5000,
        onload: function() { callback(true, 'Sent to Zebra ' + ip); },
        onerror: function() {
          // raw TCP :9100 often fires onerror even on success
          callback(true, 'Sent to Zebra ' + ip);
        },
        ontimeout: function() {
          // raw TCP :9100 has no HTTP response, treat timeout as success
          callback(true, 'Sent to Zebra ' + ip);
        }
      });
    }

    function sendPrintmonPrint(code, qty, callback) {
      var encoded = asciihex(code.trim());
      var badge = $.cookie('fcmenu-employeeId') || '';
      var params = 'action=print&type=barcode'
        + '&data=' + encoded
        + '&text=' + encoded
        + '&quantity=' + qty
        + '&badgeid=' + badge
        + '&desc=&seq=' + genId();
      var url = CONFIG.printHost + '?' + params;
      GM_xmlhttpRequest({
        method: 'GET',
        url: url,
        timeout: 5000,
        onload: function(r) {
          if (r.responseText === 'valid') callback(true, 'Sent to Printmon');
          else callback(false, 'Printmon rejected');
        },
        onerror: function() { callback(false, 'Cannot reach Printmon'); },
        ontimeout: function() { callback(false, 'Printmon timed out'); }
      });
    }

    function doPrint(type2, text, codes, qty, callback) {
      if (pm3Mode === 'zebra') {
        var zpl = '';
        if (type2 === 'barcode') {
          codes.forEach(function(c) { zpl += buildBarcodeZPL(c, qty); });
        } else {
          zpl = buildTextZPL(text, qty);
        }
        if (!zpl) { callback(false, 'Nothing to print'); return; }
        sendZebraPrint(zpl, callback);
      } else {
        // Printmon mode
        if (type2 === 'text') {
          callback(false, 'Text labels require Zebra mode');
          return;
        }
        var pending = codes.length; var fail = false; var lastMsg = '';
        codes.forEach(function(c) {
          sendPrintmonPrint(c, qty, function(ok, msg) {
            if (!ok) { fail = true; lastMsg = msg; }
            else lastMsg = msg;
            pending--;
            if (pending <= 0) callback(!fail, lastMsg);
          });
        });
      }
    }

    function showRes(el, msg, ok) {
      el.textContent = msg;
      el.className = 'pm3-res ' + (ok ? 'pm3-res-ok' : 'pm3-res-err');
      el.style.display = 'block';
      setTimeout(function() { el.style.display = 'none'; }, 5000);
    }

    // --- UI ---
    function injectStyles() {
      if (document.getElementById('pm3-slim-css')) return;
      var s = document.createElement('style');
      s.id = 'pm3-slim-css';
      s.textContent = [
'#pm3-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.35);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}',
'#pm3-modal{background:#fff;border:1px solid #ddd;border-radius:10px;width:760px;max-width:95vw;max-height:88vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,.12)}',
'.pm3-hd{background:#fafafa;padding:0 12px;height:38px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e5e5e5;flex-shrink:0}',
'.pm3-hd-left{display:flex;align-items:center;gap:6px}',
'.pm3-hd-logo{width:22px;height:22px;background:#f59e0b;border-radius:4px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:8px;color:#fff}',
'.pm3-hd-name{color:#222;font-size:12px;font-weight:700}',
'.pm3-hd-name b{color:#f59e0b}',
'.pm3-hd-v{color:#999;font-size:8px;font-weight:600;background:#f0f0f0;padding:1px 5px;border-radius:8px}',
'.pm3-promo{font-size:9px;color:#b45309;text-decoration:none;background:#fef3c7;border:1px solid #f59e0b;padding:3px 8px;border-radius:4px;margin-right:6px;font-weight:700;transition:all .15s}',
'.pm3-promo:hover{background:#fde68a;color:#92400e}',
'.pm3-close{background:none;border:none;color:#aaa;font-size:16px;cursor:pointer;padding:2px 6px;border-radius:3px}',
'.pm3-close:hover{color:#e00;background:#fff0f0}',
'.pm3-body{display:flex;gap:8px;padding:8px;overflow-y:auto;flex:1}',
'.pm3-sidebar{width:170px;flex-shrink:0}',
'.pm3-sb-card{background:#fafafa;border:1px solid #eee;border-radius:7px;padding:8px;margin-bottom:5px}',
'.pm3-sb-title{font-size:8px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px}',
'.pm3-mode-toggle{display:flex;background:#f0f0f0;border-radius:4px;padding:2px;margin-bottom:6px}',
'.pm3-mode-btn{flex:1;padding:4px 0;text-align:center;font-size:9px;font-weight:700;border:none;background:transparent;color:#999;cursor:pointer;border-radius:3px;transition:all .15s;font-family:inherit}',
'.pm3-mode-btn.on-pm{background:#f59e0b;color:#fff}',
'.pm3-mode-btn.on-zb{background:#22c55e;color:#fff}',
'.pm3-sb-sw{display:flex;background:#f0f0f0;border-radius:4px;padding:2px;margin-bottom:5px}',
'.pm3-sb-sw-btn{flex:1;padding:3px 0;text-align:center;font-size:9px;font-weight:600;border:none;background:transparent;color:#999;cursor:pointer;border-radius:3px;transition:all .15s;font-family:inherit}',
'.pm3-sb-sw-btn.on{background:#f59e0b;color:#fff;font-weight:700}',
'.pm3-sb-lbl{font-size:8px;font-weight:600;color:#999;margin-bottom:3px;margin-top:3px}',
'.pm3-sb-check{display:flex;align-items:center;gap:5px;font-size:9px;color:#555;cursor:pointer;margin-bottom:4px}',
'.pm3-sb-check input{accent-color:#f59e0b}',
'.pm3-slider-row{display:flex;align-items:center;gap:4px;margin-bottom:4px}',
'.pm3-slider-row label{font-size:8px;font-weight:600;color:#999;width:36px;flex-shrink:0}',
'.pm3-slider-row input[type=range]{flex:1;min-width:0;accent-color:#f59e0b;height:3px;cursor:pointer}',
'.pm3-slider-row .pm3-sv{font-size:9px;font-weight:700;color:#333;width:22px;text-align:right;font-family:Consolas,monospace}',
'.pm3-status{font-size:9px;color:#777;padding:2px 0;display:flex;align-items:center;gap:4px}',
'.pm3-status-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}',
'.pm3-status-dot.ok{background:#22c55e}',
'.pm3-status-dot.err{background:#ef4444}',
'.pm3-main{flex:1;min-width:0}',
'.pm3-tabs{display:flex;gap:2px}',
'.pm3-tab{flex:1;padding:6px 4px;text-align:center;font-size:10px;font-weight:600;border:none;background:#f5f5f5;color:#999;cursor:pointer;border-radius:6px 6px 0 0;transition:all .15s;font-family:inherit;border:1px solid #e5e5e5;border-bottom:none}',
'.pm3-tab:hover{color:#555}',
'.pm3-tab.active{color:#222;background:#fff;border-color:#ddd;box-shadow:inset 0 2px 0 #f59e0b}',
'.pm3-panel{display:none;background:#fff;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 7px 7px;padding:10px}',
'.pm3-panel.active{display:block}',
'.pm3-fg{margin-bottom:7px}',
'.pm3-fl{display:block;font-size:8px;font-weight:600;color:#999;margin-bottom:2px;text-transform:uppercase;letter-spacing:.3px}',
'.pm3-fi{width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:11px;font-family:inherit;background:#fff;color:#222;outline:none;transition:border .15s}',
'.pm3-fi:focus{border-color:#f59e0b}',
'input.pm3-fi[type=number]{color:#222}',
'.pm3-btn{width:100%;padding:7px;border:none;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s;margin-bottom:4px}',
'.pm3-btn-p{background:#22c55e;color:#fff}',
'.pm3-btn-p:hover{background:#16a34a}',
'.pm3-btn-o{background:#f8f8f8;color:#666;border:1px solid #ddd}',
'.pm3-btn-o:hover{border-color:#bbb;color:#333}',
'.pm3-res{font-size:10px;padding:5px 8px;border-radius:4px;margin-top:4px;display:none}',
'.pm3-res-ok{background:#ecfdf5;color:#16a34a;border:1px solid #bbf7d0}',
'.pm3-res-err{background:#fef2f2;color:#dc2626;border:1px solid #fecaca}',
'.pm3-hr{height:1px;background:#eee;margin:7px 0}',
'.pm3-dimmed{opacity:.35;pointer-events:none}'
      ].join('\n');
      document.head.appendChild(s);
    }

    function buildModal() {
      var ip = getCookie('fcmenu-remoteAddr');
      var statusDot = ip ? 'ok' : 'err';
      var statusText = ip ? ip : 'Not detected';

      var div = document.createElement('div');
      div.id = 'pm3-overlay';
      div.innerHTML = [
'<div id="pm3-modal">',
'  <div class="pm3-hd">',
'    <div class="pm3-hd-left">',
'      <div class="pm3-hd-logo">BP</div>',
'      <span class="pm3-hd-name">BETTER PRINT<b>mon 3</b></span>',
'      <span class="pm3-hd-v">slim ai</span>',
'    </div>',
'    <div style="display:flex;align-items:center;gap:6px">',
'      <a class="pm3-promo" href="https://tamarin.aces.amazon.dev/scripts/printmon-3/install.user.js" target="_blank">Full Version</a>',
'      <button class="pm3-close" id="pm3-close">&times;</button>',
'    </div>',
'  </div>',
'  <div class="pm3-body">',
'    <div class="pm3-sidebar">',
'      <div class="pm3-sb-card">',
'        <div class="pm3-sb-title">Printer</div>',
'        <div class="pm3-mode-toggle">',
'          <button class="pm3-mode-btn" id="pm3-modePM">Printmon</button>',
'          <button class="pm3-mode-btn on-zb" id="pm3-modeZB">Zebra</button>',
'        </div>',
'        <div class="pm3-status"><div class="pm3-status-dot ' + statusDot + '"></div><span id="pm3-statusText">' + statusText + '</span></div>',
'      </div>',
'      <div class="pm3-sb-card" id="pm3-zebraCard">',
'        <div class="pm3-sb-title">Label Settings</div>',
'        <div class="pm3-sb-lbl">Size</div>',
'        <div class="pm3-sb-sw" id="pm3-profileSw">',
'          <button class="pm3-sb-sw-btn on" data-v="standard">4x3</button>',
'          <button class="pm3-sb-sw-btn" data-v="small">2x1</button>',
'        </div>',
'        <div class="pm3-sb-lbl">Type</div>',
'        <div class="pm3-sb-sw" id="pm3-typeSw">',
'          <button class="pm3-sb-sw-btn on" data-v="barcode">Barcode</button>',
'          <button class="pm3-sb-sw-btn" data-v="text">Text</button>',
'        </div>',
'        <div class="pm3-sb-lbl">Align</div>',
'        <div class="pm3-sb-sw" id="pm3-alignSw">',
'          <button class="pm3-sb-sw-btn" data-v="L">L</button>',
'          <button class="pm3-sb-sw-btn on" data-v="C">C</button>',
'          <button class="pm3-sb-sw-btn" data-v="R">R</button>',
'        </div>',
'        <label class="pm3-sb-check"><input type="checkbox" id="pm3-reverse"> Reverse (black bg)</label>',
'        <label class="pm3-sb-check"><input type="checkbox" id="pm3-autoScale" checked> Auto scale</label>',
'        <div id="pm3-manualSliders" style="display:none">',
'          <div class="pm3-slider-row"><label>Font</label><input type="range" id="pm3-fontSize" min="18" max="250" value="40"><span class="pm3-sv" id="pm3-fontVal">40</span></div>',
'          <div class="pm3-slider-row"><label>Char</label><input type="range" id="pm3-charLimit" min="3" max="60" value="35"><span class="pm3-sv" id="pm3-charVal">35</span></div>',
'        </div>',
'      </div>',
'    </div>',
'    <div class="pm3-main">',

'      <div class="pm3-panel active" id="pm3-panel-lp" style="border-radius:7px;border-top:1px solid #e5e5e5">',
'        <div class="pm3-fg" id="pm3-barcodeGrp">',
'          <label class="pm3-fl">Barcode / ASIN (one per line for bulk)</label>',
'          <textarea class="pm3-fi" id="pm3-bar" rows="2" placeholder="Scan or type" style="resize:vertical"></textarea>',
'        </div>',
'        <div class="pm3-fg" id="pm3-textGrp" style="display:none">',
'          <label class="pm3-fl">Text to print</label>',
'          <textarea class="pm3-fi" id="pm3-text" rows="3" placeholder="Enter text" style="resize:vertical"></textarea>',
'        </div>',
'        <div class="pm3-fg">',
'          <label class="pm3-fl">Quantity</label>',
'          <input class="pm3-fi" type="number" id="pm3-qty" min="1" max="50" value="1">',
'        </div>',
'        <button class="pm3-btn pm3-btn-p" id="pm3-print">Print</button>',
'        <div class="pm3-res" id="pm3-lpRes"></div>',
'        <div class="pm3-hr"></div>',
'        <button class="pm3-btn pm3-btn-o" id="pm3-clear">Clear</button>',
'      </div>',

'    </div>',
'  </div>',
'</div>'
      ].join('\n');
      return div;
    }

    function bindEvents() {
      var o = overlay;

      // Close
      o.querySelector('#pm3-close').onclick = close;
      o.addEventListener('click', function(e) { if (e.target === o) close(); });

      // Mode toggle
      var modePM = o.querySelector('#pm3-modePM');
      var modeZB = o.querySelector('#pm3-modeZB');
      var zebraCard = o.querySelector('#pm3-zebraCard');
      function setMode(m) {
        pm3Mode = m;
        modePM.className = 'pm3-mode-btn' + (m === 'printmon' ? ' on-pm' : '');
        modeZB.className = 'pm3-mode-btn' + (m === 'zebra' ? ' on-zb' : '');
        zebraCard.classList.toggle('pm3-dimmed', m === 'printmon');
      }
      modePM.onclick = function() { setMode('printmon'); };
      modeZB.onclick = function() { setMode('zebra'); };

      // Switch button groups
      function bindSw(id, cb) {
        o.querySelector('#' + id).onclick = function(e) {
          var btn = e.target.closest('.pm3-sb-sw-btn'); if (!btn) return;
          this.querySelectorAll('.pm3-sb-sw-btn').forEach(function(b) { b.classList.remove('on'); });
          btn.classList.add('on');
          cb(btn.dataset.v);
        };
      }
      bindSw('pm3-profileSw', function(v) { labelProfile = v; });
      bindSw('pm3-typeSw', function(v) {
        labelType = v;
        o.querySelector('#pm3-barcodeGrp').style.display = v === 'barcode' ? '' : 'none';
        o.querySelector('#pm3-textGrp').style.display = v === 'text' ? '' : 'none';
      });
      bindSw('pm3-alignSw', function(v) { pm3Alignment = v; });

      // Checkboxes
      o.querySelector('#pm3-reverse').onchange = function() { pm3Reverse = this.checked; };
      o.querySelector('#pm3-autoScale').onchange = function() {
        pm3AutoScale = this.checked;
        o.querySelector('#pm3-manualSliders').style.display = pm3AutoScale ? 'none' : '';
      };

      // Sliders
      var fSlider = o.querySelector('#pm3-fontSize');
      var fVal = o.querySelector('#pm3-fontVal');
      var cSlider = o.querySelector('#pm3-charLimit');
      var cVal = o.querySelector('#pm3-charVal');
      fSlider.oninput = function() { pm3FontSize = +this.value; fVal.textContent = this.value; };
      cSlider.oninput = function() { pm3CharLimit = +this.value; cVal.textContent = this.value; };



      // Print
      o.querySelector('#pm3-print').onclick = function() {
        var resEl = o.querySelector('#pm3-lpRes');
        var qty = Math.max(1, Math.min(50, +o.querySelector('#pm3-qty').value || 1));
        if (labelType === 'barcode') {
          var raw = o.querySelector('#pm3-bar').value.trim();
          var codes = raw.split(/\n/).map(function(s){return s.trim();}).filter(Boolean);
          if (!codes.length) { showRes(resEl, 'Enter at least one barcode', false); return; }
          doPrint('barcode', '', codes, qty, function(ok, msg) { showRes(resEl, msg, ok); });
        } else {
          var text = o.querySelector('#pm3-text').value.trim();
          if (!text) { showRes(resEl, 'Enter text to print', false); return; }
          doPrint('text', text, [], qty, function(ok, msg) { showRes(resEl, msg, ok); });
        }
      };

      // Clear
      o.querySelector('#pm3-clear').onclick = function() {
        o.querySelector('#pm3-bar').value = '';
        o.querySelector('#pm3-text').value = '';
        o.querySelector('#pm3-qty').value = '1';
      };


    }



    function open() {
      if (overlay) {
        // Refresh printer status on reopen
        var ip = getCookie('fcmenu-remoteAddr');
        var dot = overlay.querySelector('.pm3-status-dot');
        var txt = overlay.querySelector('#pm3-statusText');
        if (dot) dot.className = 'pm3-status-dot ' + (ip ? 'ok' : 'err');
        if (txt) txt.textContent = ip || 'Not detected';
        overlay.style.display = 'flex';
        return;
      }
      injectStyles();
      overlay = buildModal();
      document.body.appendChild(overlay);
      bindEvents();
    }

    function close() {
      if (overlay) overlay.style.display = 'none';
    }

    return { open: open };
    })();







    // ======= [S15] ZEBRA PRINTING =======
//
// Direct Zebra ZPL printing via fcmenu-remoteAddr cookie.
// Uses DialogManager for centered modal UI (matches standalone Zebra script).
// Self-contained — remove this entire section to revert to S4-only.

var Zebra = (function () {

    var PRINTERS = {
        zd621: {
            name: 'Zebra ZD621',
            dpi: 203,
            endpoints: [
                'http://{ip}:9100',
                'http://{ip}/pstprnt',
                'http://{ip}/cgi-bin/pstprnt'
            ],
            timeout: 5000,
            profiles: {
                standard: {
                    label: 'Standard',
                    barcodeHeight: 90, barcodeModule: 3,
                    asinFont: 50, badgeFont: 28,
                    labelWidth: 812, labelHeight: 609,
                    dynamicDesc: true,
                    descRules: [
                        { maxChars: 60, fontSize: 45, charsPerLine: 32 },
                        { maxChars: 100, fontSize: 35, charsPerLine: 38 },
                        { maxChars: 150, fontSize: 35, charsPerLine: 43 },
                        { maxChars: 200, fontSize: 30, charsPerLine: 46 },
                        { maxChars: 9999, fontSize: 18, charsPerLine: 54 }
                    ],
                    descFont: 40, charLimit: 35
                },
                small: {
                    label: 'Small',
                    barcodeHeight: 50, barcodeModule: 2,
                    asinFont: 28, badgeFont: 18,
                    labelWidth: 406, labelHeight: 203,
                    dynamicDesc: true,
                    descRules: [
                        { maxChars: 30, fontSize: 14, charsPerLine: 28 },
                        { maxChars: 60, fontSize: 12, charsPerLine: 32 },
                        { maxChars: 100, fontSize: 11, charsPerLine: 36 },
                        { maxChars: 150, fontSize: 10, charsPerLine: 40 },
                        { maxChars: 200, fontSize: 9, charsPerLine: 44 },
                        { maxChars: 9999, fontSize: 8, charsPerLine: 48 }
                    ],
                    descFont: 14, charLimit: 28
                }
            }
        },
        printer2: {
            name: 'Printer 2', dpi: 203,
            endpoints: ['http://{ip}:9100', 'http://{ip}/pstprnt'],
            timeout: 5000,
            profiles: {
                standard: {
                    label: 'Standard',
                    barcodeHeight: 90, barcodeModule: 3, asinFont: 50, badgeFont: 28,
                    labelWidth: 812, labelHeight: 609, dynamicDesc: true,
                    descRules: [
                        { maxChars: 60, fontSize: 45, charsPerLine: 32 },
                        { maxChars: 100, fontSize: 35, charsPerLine: 38 },
                        { maxChars: 150, fontSize: 35, charsPerLine: 43 },
                        { maxChars: 200, fontSize: 30, charsPerLine: 46 },
                        { maxChars: 9999, fontSize: 18, charsPerLine: 54 }
                    ],
                    descFont: 40, charLimit: 35
                },
                small: {
                    label: 'Small',
                    barcodeHeight: 50, barcodeModule: 2, asinFont: 28, badgeFont: 18,
                    labelWidth: 406, labelHeight: 203, dynamicDesc: true,
                    descRules: [
                        { maxChars: 30, fontSize: 14, charsPerLine: 28 },
                        { maxChars: 60, fontSize: 12, charsPerLine: 32 },
                        { maxChars: 100, fontSize: 11, charsPerLine: 36 },
                        { maxChars: 150, fontSize: 10, charsPerLine: 40 },
                        { maxChars: 200, fontSize: 9, charsPerLine: 44 },
                        { maxChars: 9999, fontSize: 8, charsPerLine: 48 }
                    ],
                    descFont: 14, charLimit: 28
                }
            }
        }
    };

    var VISIBLE_PRINTERS = ['zd621'];
    var USER_ADJUST_RANGE = 7;
    var ZDEV = { showBadge: true, maxQty: 50, debug: false };
    var ADJUSTABLE_FIELDS = [
        { key: 'descFont', label: 'Desc Font' },
        { key: 'charLimit', label: 'Char/Line' }
    ];

    // --- Styles ---
    GM_addStyle([
        '.zfcr-btn-group { display:inline-flex; margin-left:10px; border-radius:3px; overflow:visible; border:1px solid #999; font-family:Arial,sans-serif; vertical-align:middle; }',
        '.zfcr-print-btn { padding:3px 10px; font-size:11px; font-weight:600; background:#f5f5f5; color:#111; border:none; cursor:pointer; }',
        '.zfcr-print-btn:hover { background:#e0e0e0; }',
        '.zfcr-arrow-btn { padding:3px 6px; font-size:9px; background:#eaeaea; color:#333; border:none; border-left:1px solid #999; cursor:pointer; }',
        '.zfcr-arrow-btn:hover { background:#ddd; }',
        '.zfcr-backdrop { position:fixed; top:0; left:0; width:100%; height:100%; background-color:rgba(0,0,0,0.5); z-index:9999; }',
        '.zfcr-dialog { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background-color:white; padding:24px; border:2px solid #232f3e; border-radius:8px; box-shadow:0 4px 6px rgba(0,0,0,0.3); z-index:10000; font-family:Arial,sans-serif; min-width:360px; max-width:460px; color:#000; }',
        '.zfcr-dialog h3 { margin:0 0 16px 0; color:#000; font-size:16px; font-weight:700; }',
        '.zfcr-dialog-field { margin:8px 0; font-size:13px; color:#000; }',
        '.zfcr-dialog-field strong { color:#000; margin-right:6px; }',
        '.zfcr-dialog-code { font-family:Consolas,monospace; font-size:15px; font-weight:700; color:#111; }',
        '.zfcr-dialog-title { font-size:12px; color:#444; max-height:60px; overflow-y:auto; word-break:break-word; margin-top:2px; }',
        '.zfcr-dialog-condition { font-size:13px; color:#111; font-weight:600; }',
        '.zfcr-dialog-condition.loading { color:#888; font-style:italic; font-weight:400; }',
        '.zfcr-dialog-divider { border:none; border-top:1px solid #eee; margin:14px 0; }',
        '.zfcr-dialog-row { display:flex; align-items:center; gap:10px; margin:12px 0; }',
        '.zfcr-dialog-row label { color:#000; font-size:13px; font-weight:600; }',
        '.zfcr-qty-input { padding:5px; width:60px; font-size:14px; font-weight:700; text-align:center; border:1px solid #ccc; border-radius:3px; font-family:inherit; }',
        '.zfcr-qty-input:focus { outline:none; border-color:#ff9900; }',
        '.zfcr-mode-switch { display:flex; background:#f0f0f0; border-radius:4px; padding:2px; margin:12px 0; }',
        '.zfcr-mode-btn { flex:1; padding:6px 0; text-align:center; font-size:11px; font-weight:600; border:none; background:transparent; color:#666; cursor:pointer; border-radius:3px; transition:all .15s; font-family:inherit; }',
        '.zfcr-mode-btn.active { background:#fff; color:#111; box-shadow:0 1px 3px rgba(0,0,0,0.1); }',
        '.zfcr-printer-row { margin:10px 0; font-size:12px; color:#000; }',
        '.zfcr-printer-row label { font-weight:600; margin-right:6px; }',
        '.zfcr-printer-select { padding:4px 8px; border:1px solid #ccc; border-radius:3px; font-size:11px; font-family:inherit; color:#222; background:#fff; cursor:pointer; }',
        '.zfcr-printer-select:focus { outline:none; border-color:#ff9900; }',
        '.zfcr-printer-ip { font-size:11px; color:#1e7e34; margin-top:4px; }',
        '.zfcr-printer-ip.disconnected { color:#c62828; }',
        '.zfcr-dialog-actions { text-align:right; margin-top:16px; padding-top:12px; border-top:1px solid #eee; }',
        '.zfcr-btn-cancel { margin-right:10px; padding:8px 16px; cursor:pointer; color:#000; background:#f5f5f5; border:1px solid #999; border-radius:3px; font-size:12px; font-family:inherit; }',
        '.zfcr-btn-cancel:hover { background:#e0e0e0; }',
        '.zfcr-btn-print-main { padding:8px 16px; cursor:pointer; background-color:#ff9900; border:none; color:white; font-weight:bold; font-size:12px; border-radius:3px; font-family:inherit; }',
        '.zfcr-btn-print-main:hover { background-color:#e88b00; }',
        '.zfcr-status-msg { margin-top:10px; padding:6px 10px; border-radius:4px; font-size:11px; text-align:center; display:none; }',
        '.zfcr-status-msg.success { display:block; background:#e6f4ea; color:#1e7e34; }',
        '.zfcr-status-msg.info { display:block; background:#e8f0fe; color:#1565c0; }',
        '.zfcr-status-msg.error { display:block; background:#fce8e6; color:#c62828; }',
        '.zfcr-adjust-toggle { font-size:10px; color:#888; cursor:pointer; user-select:none; margin-top:8px; }',
        '.zfcr-adjust-toggle:hover { color:#333; }',
        '.zfcr-adjust-area { display:none; padding-top:8px; }',
        '.zfcr-adjust-area.open { display:block; }',
        '.zfcr-adjust-row { display:flex; align-items:center; gap:8px; margin-bottom:6px; }',
        '.zfcr-adjust-row .adj-label { font-size:10px; color:#666; font-weight:600; width:70px; flex-shrink:0; }',
        '.zfcr-adjust-row input[type="range"] { flex:1; accent-color:#ff9900; cursor:pointer; }',
        '.zfcr-adjust-row .adj-value { font-size:11px; font-weight:700; color:#111; width:30px; text-align:right; font-family:Consolas,monospace; }',
        '.zfcr-adjust-reset { font-size:10px; color:#888; cursor:pointer; border:1px solid #ddd; background:#fafafa; padding:3px 10px; border-radius:3px; margin-top:6px; font-family:inherit; }',
        '.zfcr-adjust-reset:hover { color:#111; border-color:#999; }',
        '.zfcr-adjust-note { font-size:9px; color:#aaa; font-style:italic; margin-top:4px; }'

    ].join('\n'));

    // --- Storage ---
    var STORAGE = { profile: 'zfcr_profile', adjustments: 'zfcr_adjustments', printer: 'zfcr_printer' };

    function getActivePrinter() {
        var saved = localStorage.getItem(STORAGE.printer);
        return (saved && PRINTERS[saved]) ? saved : VISIBLE_PRINTERS[0] || 'zd621';
    }
    function setActivePrinter(name) { localStorage.setItem(STORAGE.printer, name); }
    function getActiveProfile() {
        var saved = localStorage.getItem(STORAGE.profile);
        var printer = PRINTERS[getActivePrinter()];
        return (saved && printer.profiles[saved]) ? saved : 'standard';
    }
    function setActiveProfile(name) { localStorage.setItem(STORAGE.profile, name); }
    function getCurrentProfileObj() { return PRINTERS[getActivePrinter()].profiles[getActiveProfile()]; }

    function getUserAdjustments() {
        try {
            var all = JSON.parse(localStorage.getItem(STORAGE.adjustments)) || {};
            var key = getActivePrinter() + '_' + getActiveProfile();
            return all[key] || {};
        } catch (e) { return {}; }
    }
    function setUserAdjustments(adjustments) {
        try {
            var all = JSON.parse(localStorage.getItem(STORAGE.adjustments)) || {};
            var key = getActivePrinter() + '_' + getActiveProfile();
            all[key] = adjustments;
            localStorage.setItem(STORAGE.adjustments, JSON.stringify(all));
        } catch (e) {}
    }
    function getEffective(key) {
        var profile = getCurrentProfileObj();
        var base = profile[key];
        var offset = (getUserAdjustments()[key] || 0);
        return zClamp(base + offset, base - USER_ADJUST_RANGE, base + USER_ADJUST_RANGE);
    }
    function zClamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

    // --- Utilities ---
    function zLog() {
        if (!ZDEV.debug) return;
        var args = Array.prototype.slice.call(arguments);
        args.unshift('[Zebra]');
        console.log.apply(console, args);
    }
    function getZebraPrinterIP() { return getCookie('fcmenu-remoteAddr') || null; }
    function getZebraBadgeId() { return getCookie('fcmenu-employeeId') || null; }

    function zWordWrap(text, charLimit) {
        text = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        if (!text) return [];
        var words = text.split(' '), lines = [], current = '';
        for (var i = 0; i < words.length; i++) {
            if (current.length === 0) current = words[i];
            else if ((current + ' ' + words[i]).length <= charLimit) current += ' ' + words[i];
            else { lines.push(current); current = words[i]; }
        }
        if (current) lines.push(current);
        return lines;
    }

    function calcBarcodeWidth(dataLength, moduleWidth) {
        return (11 + (dataLength * 11) + 11 + 13) * moduleWidth;
    }

    // --- Condition Lookup ---
    var ConditionCache = {};

    function resolveCondition(code, callback) {
        if (!CONFIG.showCondition) { callback(''); return; }
        if (code.startsWith('B0')) { callback('NewItem'); return; }
        if (!code.startsWith('X0')) { callback(''); return; }
        if (ConditionCache[code]) { callback(ConditionCache[code]); return; }

        GM_xmlhttpRequest({
            method: 'GET',
            url: getURL('commingling') + '/tool/fnsku-mappings-tool',
            headers: { 'Accept': 'text/html' },
            timeout: 8000,
            onload: function (r) {
                var match = r.responseText.match(/anti-csrftoken-a2z[=\s"']+([^&"'<>\s]+)/);
                if (!match) { callback(''); return; }
                var token = decodeURIComponent(match[1]);
                var params = 'getMappingsType=FNSKU_MAPPINGS&FNSku=&FNSkus=' + code
                    + '&merchantId=&MSkus=&ASIN=' + code
                    + '&includeInactive=true&includeInternalMerchants=false'
                    + '&anti-csrftoken-a2z=' + encodeURIComponent(token)
                    + '&submit=get&paginationToken=';

                GM_xmlhttpRequest({
                    method: 'GET',
                    url: getURL('commingling') + '/tool/fnsku-mappings-tool/get?' + params,
                    headers: { 'Accept': 'text/html, */*; q=0.01', 'X-Requested-With': 'XMLHttpRequest' },
                    timeout: 8000,
                    onload: function (r2) {
                        if (r2.status >= 200 && r2.status < 400) {
                            try {
                                var doc = new DOMParser().parseFromString(r2.responseText, 'text/html');
                                var rows = doc.querySelectorAll('#fnsku-table tr');
                                if (rows.length > 1) {
                                    var condition = rows[1].cells[4] ? rows[1].cells[4].textContent.trim() : '';
                                    ConditionCache[code] = condition;
                                    callback(condition);
                                    return;
                                }
                            } catch (e) {}
                        }
                        callback('');
                    },
                    onerror: function () { callback(''); },
                    ontimeout: function () { callback(''); }
                });
            },
            onerror: function () { callback(''); },
            ontimeout: function () { callback(''); }
        });
    }

    // --- ZPL Builder ---
    function buildZPL(barcodeData, title, badgeId, condition) {
        if (!barcodeData) return null;
        var profile = getCurrentProfileObj();
        var bcW = calcBarcodeWidth(barcodeData.length, profile.barcodeModule);
        var bcX = Math.max(10, Math.round((profile.labelWidth - bcW) / 2));
        var y = 40;

        var zpl = '^XA\n^CI28\n^PW' + profile.labelWidth + '\n^LL' + profile.labelHeight + '\n';
        zpl += '^BY' + profile.barcodeModule + ',3\n';
        zpl += '^FO' + bcX + ',' + y + '\n^BCN,' + profile.barcodeHeight + ',N,N,N\n^FD' + barcodeData + '^FS\n';
        y += profile.barcodeHeight + 20;

        zpl += '^FO' + bcX + ',' + y + '\n^A0N,' + profile.asinFont + ',' + profile.asinFont + '\n^FD' + barcodeData + '^FS\n';
        y += profile.asinFont + 8;

        if (ZDEV.showBadge && badgeId) {
            zpl += '^FO' + bcX + ',' + y + '\n^A0N,' + profile.badgeFont + ',' + profile.badgeFont + '\n^FD' + badgeId + '^FS\n';
            y += profile.badgeFont + 10;
        }

        if (title && title !== 'No Title Found') {
            var descFont, charLimit;
            if (profile.dynamicDesc && profile.descRules) {
                var titleLength = title.length;
                var rule = profile.descRules[profile.descRules.length - 1];
                for (var r = 0; r < profile.descRules.length; r++) {
                    if (titleLength <= profile.descRules[r].maxChars) { rule = profile.descRules[r]; break; }
                }
                descFont = rule.fontSize; charLimit = rule.charsPerLine;
            } else {
                descFont = getEffective('descFont'); charLimit = getEffective('charLimit');
            }

            var lines = zWordWrap(title, charLimit);
            var lineSpacing = descFont + 5;
            var maxLines = Math.floor((profile.labelHeight - y - 10) / lineSpacing);
            if (lines.length > maxLines && maxLines > 0) {
                lines = lines.slice(0, maxLines);
                if (lines.length > 0) {
                    var lastLine = lines[lines.length - 1];
                    if (lastLine.length > 3) lines[lines.length - 1] = lastLine.substring(0, lastLine.length - 3) + '...';
                }
            }
            for (var i = 0; i < lines.length; i++) {
                zpl += '^FO' + bcX + ',' + y + '\n^A0N,' + descFont + ',' + descFont + '\n^FD' + lines[i] + '^FS\n';
                y += lineSpacing;
            }
        }

        if (condition) {
            y += 15;
            zpl += '^FO' + bcX + ',' + y + '\n^A0N,30,30\n^FD' + condition + '^FS\n';
        }

        zpl += '^XZ';
        return zpl;
    }
            // --- Printer Communication ---
    function sendToPrinter(zpl, quantity, callback) {
        var ip = getZebraPrinterIP();
        logAction('ZEBRA', 'Print requested | IP: ' + (ip || 'NONE') + ' | qty: ' + quantity + ' | printer: ' + getActivePrinter() + ' | profile: ' + getActiveProfile());
        if (!ip) { logAction('ZEBRA FAIL', 'No printer IP found | cookie fcmenu-remoteAddr is empty | user may not be logged into workstation'); if (callback) callback(false, 'Printer not detected.'); return; }

        var qty = Math.max(1, Math.min(quantity || 1, ZDEV.maxQty));
        var fullZpl = '';
        for (var i = 0; i < qty; i++) fullZpl += zpl + '\n';

        var printer = PRINTERS[getActivePrinter()];
        var endpoints = printer.endpoints.map(function (ep) { return ep.replace('{ip}', ip); });
        var timeout = printer.timeout || 5000;

        var done = false;
        function finish(success, msg) {
            if (done) return;
            done = true;
            if (success) logAction('ZEBRA OK', msg + ' | IP: ' + ip);
            if (callback) callback(success, msg);
        }

        function isRawPort(url) { return /:9100/.test(url); }

        function tryNext(idx) {
            if (idx >= endpoints.length) { logAction('ZEBRA FAIL', 'All endpoints failed | IP: ' + ip + ' | tried: ' + endpoints.join(', ')); finish(false, 'Printer unreachable.'); return; }
            var raw = isRawPort(endpoints[idx]);
            GM_xmlhttpRequest({
                method: 'POST', url: endpoints[idx], data: fullZpl,
                headers: { 'Content-Type': 'text/plain' }, timeout: timeout,
                onload: function (r) {
                    if (r.status >= 200 && r.status < 400) finish(true, 'Printed ' + qty + ' label(s).');
                    else if (raw) finish(true, 'Printed ' + qty + ' label(s).');
                    else tryNext(idx + 1);
                },
                onerror: function () {
                    if (raw) finish(true, 'Printed ' + qty + ' label(s).');
                    else tryNext(idx + 1);
                },
                ontimeout: function () {
                    if (raw) finish(true, 'Printed ' + qty + ' label(s).');
                    else tryNext(idx + 1);
                }
            });
        }
        tryNext(0);
    }

    // --- Dialog Manager (centered modal) ---
    var ZDialog = {
        backdrop: null,
        dialog: null,
        _escHandler: null,

        open: function (html, onReady) {
            this.close();
            var self = this;

            var backdrop = document.createElement('div');
            backdrop.className = 'zfcr-backdrop';

            var dialog = document.createElement('div');
            dialog.className = 'zfcr-dialog';
            dialog.innerHTML = html;
            dialog.addEventListener('click', function (e) { e.stopPropagation(); });

            document.body.appendChild(backdrop);
            document.body.appendChild(dialog);

            this.backdrop = backdrop;
            this.dialog = dialog;

            this._escHandler = function (e) { if (e.key === 'Escape') self.close(); };
            document.addEventListener('keydown', this._escHandler);

            // Delay backdrop click listener so the click that opened the dialog
            // (e.g. from context menu) doesn't immediately bubble and close it
            setTimeout(function () {
                backdrop.addEventListener('click', function () { self.close(); });
            }, 50);

            if (onReady) onReady(dialog);
        },

        close: function () {
            if (this.backdrop && this.backdrop.parentNode) this.backdrop.remove();
            if (this.dialog && this.dialog.parentNode) this.dialog.remove();
            if (this._escHandler) document.removeEventListener('keydown', this._escHandler);
            this.backdrop = null;
            this.dialog = null;
        }
    };

    // --- UI Builders ---
    function buildModeSwitch() {
        var printer = PRINTERS[getActivePrinter()];
        var currentProfile = getActiveProfile();
        var html = '<div class="zfcr-mode-switch">';
        Object.keys(printer.profiles).forEach(function (key) {
            var p = printer.profiles[key];
            var active = (key === currentProfile) ? ' active' : '';
            html += '<button class="zfcr-mode-btn' + active + '" data-profile="' + key + '">' + p.label + '</button>';
        });
        html += '</div>';
        return html;
    }

    function buildPrinterSelect() {
        var current = getActivePrinter();
        if (VISIBLE_PRINTERS.length <= 1) {
            var printer = PRINTERS[current];
            return '<span>' + (printer ? printer.name : 'Unknown') + '</span>';
        }
        var html = '<select class="zfcr-printer-select">';
        VISIBLE_PRINTERS.forEach(function (key) {
            var p = PRINTERS[key];
            if (!p) return;
            html += '<option value="' + key + '"' + (key === current ? ' selected' : '') + '>' + p.name + '</option>';
        });
        html += '</select>';
        return html;
    }

    function buildSliders() {
        var profile = getCurrentProfileObj();
        if (profile.dynamicDesc) {
            return '<div class="zfcr-adjust-note">Description auto scales based on title length.</div>';
        }
        var adj = getUserAdjustments();
        var html = '';
        ADJUSTABLE_FIELDS.forEach(function (field) {
            var base = profile[field.key];
            var min = base - USER_ADJUST_RANGE, max = base + USER_ADJUST_RANGE;
            var current = zClamp(base + (adj[field.key] || 0), min, max);
            html += '<div class="zfcr-adjust-row">'
                + '<span class="adj-label">' + field.label + '</span>'
                + '<input type="range" data-key="' + field.key + '" data-base="' + base + '" min="' + min + '" max="' + max + '" value="' + current + '">'
                + '<span class="adj-value" data-display="' + field.key + '">' + current + '</span>'
                + '</div>';
        });
        return html;
    }

    function buildDialogHTML(item) {
        var ip = getZebraPrinterIP();
        return '<div style="margin-bottom:10px"><span style="display:inline-block;font-size:9px;font-weight:700;background:#4CAF50;color:#fff;padding:2px 8px;border-radius:3px;text-transform:uppercase;letter-spacing:.5px">Print via ZPL</span></div>'
            + '<h3>Print ' + item.type + ': <span class="zfcr-dialog-code">' + item.code + '</span></h3>'
            + '<div class="zfcr-dialog-field"><strong>Title:</strong><div class="zfcr-dialog-title">' + item.title + '</div></div>'
            + '<div class="zfcr-dialog-field"><strong>Condition:</strong><span class="zfcr-dialog-condition loading" id="zfcr-condition">Looking up...</span></div>'
            + '<hr class="zfcr-dialog-divider">'
            + '<div class="zfcr-mode-area">' + buildModeSwitch() + '</div>'
            + '<div class="zfcr-dialog-row"><label for="zfcr-qty">Quantity:</label>'
            + '<input type="number" class="zfcr-qty-input" id="zfcr-qty" min="1" max="' + ZDEV.maxQty + '" value="1"></div>'
            + '<div class="zfcr-printer-row"><label>Printer:</label>' + buildPrinterSelect()
            + '<div class="zfcr-printer-ip' + (ip ? '' : ' disconnected') + '">' + (ip ? 'IP: ' + ip : 'Printer not detected') + '</div></div>'
            + '<div class="zfcr-adjust-toggle">&#9662; Adjust label settings</div>'
            + '<div class="zfcr-adjust-area"><div class="zfcr-sliders">' + buildSliders() + '</div>'
            + '<button class="zfcr-adjust-reset">Reset to default</button></div>'
            + '<div class="zfcr-dialog-actions"><button class="zfcr-btn-cancel">Cancel</button>'
            + '<button class="zfcr-btn-print-main">Print</button></div>'
            + '<div class="zfcr-status-msg"></div>';
    }
             // --- Open Print Dialog ---
    function openPrintDialog(item, badgeId) {
        var html = buildDialogHTML(item);

        ZDialog.open(html, function (dialog) {
            var $ = function (sel) { return dialog.querySelector(sel); };
            var $$ = function (sel) { return dialog.querySelectorAll(sel); };

            var resolvedCondition = '';

            // Condition lookup
            resolveCondition(item.code, function (condition) {
                resolvedCondition = condition;
                var el = $('#zfcr-condition');
                if (el) {
                    el.textContent = condition || 'N/A';
                    el.className = 'zfcr-dialog-condition';
                }
            });

            // Status helper
            function showStatus(msg, type) {
                var el = $('.zfcr-status-msg');
                el.textContent = msg;
                el.className = 'zfcr-status-msg ' + type;
                if (type === 'success') setTimeout(function () { el.className = 'zfcr-status-msg'; }, 3000);
            }

            // Profile switch
            function bindModeButtons() {
                var btns = $$('.zfcr-mode-btn');
                for (var i = 0; i < btns.length; i++) {
                    (function (btn) {
                        btn.addEventListener('click', function () {
                            setActiveProfile(btn.getAttribute('data-profile'));
                            var all = $$('.zfcr-mode-btn');
                            for (var j = 0; j < all.length; j++) all[j].classList.remove('active');
                            btn.classList.add('active');
                            $('.zfcr-sliders').innerHTML = buildSliders();
                            bindSliders();
                        });
                    })(btns[i]);
                }
            }

            // Sliders
            function bindSliders() {
                var sliders = $$('.zfcr-adjust-row input[type="range"]');
                for (var i = 0; i < sliders.length; i++) {
                    (function (slider) {
                        slider.addEventListener('input', function () {
                            var key = slider.getAttribute('data-key');
                            var base = parseInt(slider.getAttribute('data-base'));
                            var val = parseInt(slider.value);
                            $('[data-display="' + key + '"]').textContent = val;
                            var adj = getUserAdjustments();
                            adj[key] = val - base;
                            setUserAdjustments(adj);
                        });
                    })(sliders[i]);
                }
            }

            bindModeButtons();
            bindSliders();

            // Printer dropdown
            var printerSelect = $('.zfcr-printer-select');
            if (printerSelect) {
                printerSelect.addEventListener('change', function (e) {
                    setActivePrinter(e.target.value);
                    $('.zfcr-mode-area').innerHTML = buildModeSwitch();
                    $('.zfcr-sliders').innerHTML = buildSliders();
                    bindModeButtons();
                    bindSliders();
                    showStatus('Switched to ' + PRINTERS[e.target.value].name, 'success');
                });
            }

            // Adjust toggle
            $('.zfcr-adjust-toggle').addEventListener('click', function () {
                $('.zfcr-adjust-area').classList.toggle('open');
            });

            // Reset
            $('.zfcr-adjust-reset').addEventListener('click', function () {
                setUserAdjustments({});
                $('.zfcr-sliders').innerHTML = buildSliders();
                bindSliders();
                showStatus('Reset to defaults.', 'success');
            });

            // Cancel
            $('.zfcr-btn-cancel').addEventListener('click', function () { ZDialog.close(); });

            // Print
            $('.zfcr-btn-print-main').addEventListener('click', function () {
                if (!getZebraPrinterIP()) { showStatus('Printer not detected.', 'error'); return; }
                var qty = parseInt($('#zfcr-qty').value) || 1;
                qty = Math.max(1, Math.min(qty, ZDEV.maxQty));
                $('#zfcr-qty').value = qty;

                var zpl = buildZPL(item.code, item.title, badgeId, resolvedCondition);
                if (zpl) {
                    showStatus('Sending ' + qty + ' label(s)...', 'info');
                    sendToPrinter(zpl, qty, function (success, msg) {
                        showStatus(msg, success ? 'success' : 'error');
                        if (success) setTimeout(function () { ZDialog.close(); }, 1500);
                    });
                }
            });

            // Enter key
            $('#zfcr-qty').addEventListener('keypress', function (e) {
                if (e.key === 'Enter') $('.zfcr-btn-print-main').click();
            });

            // Clamp qty
            $('#zfcr-qty').addEventListener('change', function () {
                this.value = Math.max(1, Math.min(parseInt(this.value) || 1, ZDEV.maxQty));
            });

            // Focus
            $('#zfcr-qty').focus();
            $('#zfcr-qty').select();
        });
    }

    // --- Add button group to a table cell ---
    function addButtonGroup(cell, code, type, title) {
        if (cell.querySelector('.zfcr-btn-group')) return;
        var badgeId = getZebraBadgeId();

        var group = document.createElement('span');
        group.className = 'zfcr-btn-group';

        var printBtn = document.createElement('button');
        printBtn.className = 'zfcr-print-btn';
        printBtn.textContent = 'Print ' + type;
        printBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (!getZebraPrinterIP()) return;
            resolveCondition(code, function (condition) {
                var zpl = buildZPL(code, title, badgeId, condition);
                if (zpl) sendToPrinter(zpl, 1, function () {});
            });
        });

        var arrow = document.createElement('button');
        arrow.className = 'zfcr-arrow-btn';
        arrow.innerHTML = '&#9662;';
        arrow.title = 'Print options';
        arrow.addEventListener('click', function (e) {
            e.stopPropagation();
            openPrintDialog({ code: code, type: type, title: title }, badgeId);
        });

        group.appendChild(printBtn);
        group.appendChild(arrow);
        cell.appendChild(group);
    }

    // --- Quick print (no UI) ---
    function quickPrint(code, quantity, description) {
        var badgeId = getZebraBadgeId();
        resolveCondition(code, function (condition) {
            var zpl = buildZPL(code, description, badgeId, condition);
            if (zpl) sendToPrinter(zpl, quantity || 1, function () {});
        });
    }

    // --- Print with title fetch (context menu) ---
function handlePrintFromMenu(asin) {
    Printing.fetchTitle(asin).then(function (title) {
        var badgeId = getZebraBadgeId();
        openPrintDialog({ code: asin, type: 'ASIN', title: title }, badgeId);
    }).catch(function () {
        var badgeId = getZebraBadgeId();
        openPrintDialog({ code: asin, type: 'ASIN', title: 'No Title Found' }, badgeId);
    });
}

    // --- Show dialog (for routePrintDialog compatibility) ---
    function showDialog(code, type, title) {
        var badgeId = getZebraBadgeId();
        openPrintDialog({ code: code, type: type, title: title }, badgeId);
    }

    return {
        addButtonGroup: addButtonGroup,
        quickPrint: quickPrint,
        handlePrintFromMenu: handlePrintFromMenu,
        showDialog: showDialog,
        buildZPL: buildZPL,
        sendToPrinter: sendToPrinter,
        getActiveProfile: getActiveProfile,
        setActiveProfile: setActiveProfile,
        getActivePrinter: getActivePrinter,
        setActivePrinter: setActivePrinter,
        getPrinterIP: getZebraPrinterIP
    };

})();

    //////// secondary s15 --
    // Printmon3 bridge - allows blob page to send Zebra prints back //s15
window.addEventListener('message', function (e) {
    if (!e.data || e.data.type !== 'pm3-zebra-print') return;
    var d = e.data;

    var isRaw = /:9100/.test(d.endpoint);

    GM_xmlhttpRequest({
        method: 'POST',
        url: d.endpoint,
        data: d.zpl,
        headers: { 'Content-Type': 'text/plain' },
        timeout: 5000,
        onload: function (r) {
            var success = (r.status >= 200 && r.status < 400) || isRaw;
            if (e.source) e.source.postMessage({ type: 'pm3-zebra-result', success: success, id: d.id }, '*');
        },
        onerror: function () {
            var success = isRaw;
            if (e.source) e.source.postMessage({ type: 'pm3-zebra-result', success: success, id: d.id }, '*');
        },
        ontimeout: function () {
            if (e.source) e.source.postMessage({ type: 'pm3-zebra-result', success: false, id: d.id }, '*');
        }
    });
});

  // ====== BADGE FIX[Temporarily] (i hope)
      const OLD_PATTERN = 'internal-cdn.amazon.com/badgephotos.amazon.com/?uid=';
  const NEW_BASE = 'https://badgephotos.corp.amazon.com/?uid=';

  function fixSrc(img) {
    const src = img.getAttribute('src') || '';
    if (src.includes(OLD_PATTERN)) {
      const uid = src.split('?uid=')[1];
      if (uid) img.setAttribute('src', NEW_BASE + uid);
    }
  }

  document.querySelectorAll('img').forEach(fixSrc);

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.tagName === 'IMG') fixSrc(node);
        else node.querySelectorAll && node.querySelectorAll('img').forEach(fixSrc);
      }
      if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
        if (mutation.target.tagName === 'IMG') fixSrc(mutation.target);
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src']
  });




  // ======= [S17] OPEN CONTAINER =======
  //
  // Register / "open" a container without switching to another app. Adds an
  // "Open Container" button to the sidebar that opens a small panel (built from
  // the tw-* utility layer) with a container-ID field.
  //
  // The real sideline/overage request is NOT wired yet. To activate it, fill in
  // CONTAINER_API below with the request the current app makes (URL, method,
  // body) and set `configured: true` — submit() already routes through it.
  var OpenContainer = (function () {

    var CONTAINER_API = {
      configured: false,                 // flip to true once url/buildBody are filled in
      method: 'POST',
      url: '',                           // e.g. getURL('dockExecution') + '/containers/open'
      headers: { 'Content-Type': 'application/json' },
      buildBody: function (id) { return JSON.stringify({ containerId: id }); },
      // Optional: map a raw XHR response to a boolean success (default: 2xx).
      isSuccess: function (r) { return r.status >= 200 && r.status < 300; }
    };

    var panel = null;

    function setStatus(msg, kind) {
      var s = document.getElementById('oc-status');
      if (!s) return;
      s.textContent = msg || '';
      s.className = 'tw-text-xs tw-mt-2 ' +
        (kind === 'err' ? 'tw-text-danger' : kind === 'ok' ? 'tw-text-success' : 'tw-text-dim');
    }

    function submit() {
      var input = document.getElementById('oc-input');
      var id = (input && input.value || '').trim();
      if (!id) { setStatus('Enter a container ID.', 'err'); return; }

      if (!CONTAINER_API.configured || !CONTAINER_API.url) {
        // Scaffold mode — no endpoint captured yet.
        setStatus('Ready to open "' + id + '". API not wired yet — paste the request into CONTAINER_API.', 'err');
        return;
      }

      setStatus('Opening container ' + id + '…', 'info');
      GM_xmlhttpRequest({
        method: CONTAINER_API.method,
        url: CONTAINER_API.url,
        headers: CONTAINER_API.headers,
        data: CONTAINER_API.buildBody(id),
        onload: function (r) {
          if (CONTAINER_API.isSuccess(r)) setStatus('Container ' + id + ' opened ✓', 'ok');
          else setStatus('Open failed (HTTP ' + r.status + ').', 'err');
        },
        onerror: function () { setStatus('Network error opening container.', 'err'); }
      });
    }

    function buildPanel() {
      if (panel) return panel;
      panel = document.createElement('div');
      panel.id = 'oc-panel';
      panel.className = 'tw-card tw-fixed tw-shadow';
      panel.style.cssText = 'display:none;top:64px;left:12px;z-index:99999;width:264px;padding:14px';
      panel.innerHTML =
          '<div class="tw-flex tw-items-center tw-justify-between tw-mb-2">'
        +   '<strong class="tw-text tw-text-sm tw-uppercase tw-tracking-wide">Open Container</strong>'
        +   '<span id="oc-close" class="tw-cursor-pointer tw-text-mute" title="Close" style="font-size:18px;line-height:1">×</span>'
        + '</div>'
        + '<div class="tw-text-xs tw-text-dim tw-mb-2">Register a container via sideline overage — no separate app needed.</div>'
        + '<input id="oc-input" class="tw-input tw-mb-2" type="text" placeholder="Container ID (e.g. tscage…)" autocomplete="off">'
        + '<button id="oc-submit" class="tw-btn tw-btn-accent tw-w-full">Open Container</button>'
        + '<div id="oc-status" class="tw-text-xs tw-mt-2 tw-text-dim"></div>';
      document.body.appendChild(panel);

      panel.querySelector('#oc-close').addEventListener('click', hide);
      panel.querySelector('#oc-submit').addEventListener('click', submit);
      panel.querySelector('#oc-input').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); submit(); }
      });
      return panel;
    }

    function show() {
      buildPanel();
      panel.style.display = 'block';
      var input = document.getElementById('oc-input');
      // Prefill from a container page URL (tscage… / tscart…) when present.
      var v = (window.location.href.split('=')[1] || '');
      if (input && !input.value && (v.indexOf('tscage') === 0 || v.indexOf('tscart') === 0)) input.value = v;
      if (input) input.focus();
      setStatus('', '');
    }
    function hide() { if (panel) panel.style.display = 'none'; }
    function toggle() { if (panel && panel.style.display === 'block') hide(); else show(); }

    function init() {
      waitForKeyElements('.fcr-menu-container', function () {
        var bar = document.querySelector('.fcr-menu-container');
        if (!bar || document.getElementById('open-container-button')) return;
        var btn = document.createElement('button');
        btn.id = 'open-container-button';
        btn.className = 'fcr-sidebar-button';
        btn.setAttribute('role', 'button');
        btn.innerHTML = '<span class="text">Open Container</span>';
        btn.addEventListener('click', toggle);
        bar.appendChild(btn);
      }, true);
    }

    return { init: init, submit: submit, CONTAINER_API: CONTAINER_API };
  })();


  // ======= [SBOOT] INIT =======
  //
  // Single boot sequence. Nothing above runs anything.
  // Everything starts here.

  function boot() {

    // Cookies & styles
    initCookies();
    checkForUpdate();
    Styles.applyBase();
    Styles.applyDark();

    // Static UI
    UI.tabIcon();
    UI.introPage();
    UI.sidebar();
    OpenContainer.init();
   // TabView.init();
    UI.contextMenu();
    UI.headerEnhance();

    // Printing
    Printing.addButtons();
    Printing.initAltClick();
    Printing.initShortcutBar(200);
    document.addEventListener('DOMContentLoaded', Printing.addButtons);
    setTimeout(Printing.addButtons, 2000);


    // Table sort (newest first)
    waitForKeyElements('#purchase-order-placed', function () { $('#purchase-order-placed').click().click(); }, true);
    waitForKeyElements('#shipment-arrival', function () { $('#shipment-arrival').click().click(); }, true);
    waitForKeyElements('#purchase-order-item-order-date', function () { $('#purchase-order-item-order-date').click().click(); }, true);

    // Delayed init (wait for dynamic content)
     setTimeout(function () {
        Prep.autoAdd();
        Profiler.autoRNO();
        UI.ssccGlance();
        UI.attributeHighlight();
        UI.enhanceSearchHistory();
        if (document.querySelector('[data-section-type="inventory"]')) UI.inventoryDropdown();
        if (document.querySelector('[data-section-type="purchase-order-item"]')) UI.poDropdown();
        if (document.querySelector('[data-section-type="inventory-history"]')) UI.inventoryHistoryDropdown();
    }, 2000);


    // Cleanup on unload
    window.addEventListener('unload', Profiler.cleanup);

    // Master observer (replaces 7+ individual observers)
    var lastUrl = location.href;
    var master = new MutationObserver(debounce(function () {
      var url = location.href;
      var changed = url !== lastUrl;

            if (changed) {
                lastUrl = url;
                FC = null;
                Prep.resetAdded();
                Weight.resetFlags();
                setTimeout(function () {
                    Prep.autoAdd();
                    Profiler.autoRNO();
                }, 2000);
            }


      if (!Prep.wasAdded()) Prep.autoAdd();
      if (document.querySelector('[data-section-type="inventory"]')) UI.inventoryDropdown();
      if (document.querySelector('[data-section-type="purchase-order-item"]')) UI.poDropdown();
        if (document.querySelector('[data-section-type="inventory-history"]')) UI.inventoryHistoryDropdown();
    }, 500));


    master.observe(document.body, { childList: true, subtree: true });
  }

  boot();

})();
