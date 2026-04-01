/**
 * Annotation Bridge — injected into HTML page iframes for element-level annotation.
 * Communicates with parent MuleTeam page viewer via postMessage.
 * ~2KB minified.
 */
(function() {
  let annotateMode = false;
  let hoveredEl = null;
  const HIGHLIGHT_CLASS = '__mt_highlight';
  const PIN_CLASS = '__mt_pin';

  // Inject styles
  const style = document.createElement('style');
  style.textContent = `
    .__mt_highlight { outline: 2px solid #3b82f6 !important; outline-offset: 2px; }
    .__mt_hover { outline: 2px dashed #3b82f6 !important; outline-offset: 2px; cursor: crosshair !important; }
    .__mt_pin {
      position: absolute; width: 20px; height: 20px; cursor: pointer; z-index: 99999;
      font-size: 14px; line-height: 20px; text-align: center; user-select: none;
    }
    .__mt_flash { animation: __mt_flash_anim 2s ease-out; }
    @keyframes __mt_flash_anim {
      0% { background-color: rgba(250, 204, 21, 0.4); }
      100% { background-color: transparent; }
    }
  `;
  document.head.appendChild(style);

  /** Generate a unique CSS selector for an element (max 5 levels) */
  function generateSelector(el) {
    if (el.id) return '#' + CSS.escape(el.id);
    const parts = [];
    let current = el;
    for (let depth = 0; depth < 5 && current && current !== document.body && current !== document.documentElement; depth++) {
      let sel = current.tagName.toLowerCase();
      if (current.id) {
        parts.unshift('#' + CSS.escape(current.id));
        break;
      }
      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/)
          .filter(c => !c.startsWith('__mt_'))
          .slice(0, 2);
        if (classes.length) sel += '.' + classes.map(CSS.escape).join('.');
      }
      // Add nth-child if not unique
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(s => s.tagName === current.tagName);
        if (siblings.length > 1) {
          const idx = siblings.indexOf(current) + 1;
          sel += ':nth-child(' + idx + ')';
        }
      }
      parts.unshift(sel);
      current = current.parentElement;
    }
    return parts.join(' > ');
  }

  /** Handle mouse events in annotate mode */
  function onMouseOver(e) {
    if (!annotateMode) return;
    e.stopPropagation();
    if (hoveredEl) hoveredEl.classList.remove('__mt_hover');
    hoveredEl = e.target;
    hoveredEl.classList.add('__mt_hover');
    const rect = hoveredEl.getBoundingClientRect();
    window.parent.postMessage({
      type: 'element-hover',
      selector: generateSelector(hoveredEl),
      text: (hoveredEl.textContent || '').slice(0, 100),
      rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height }
    }, '*');
  }

  function onMouseOut(e) {
    if (!annotateMode || !hoveredEl) return;
    hoveredEl.classList.remove('__mt_hover');
    hoveredEl = null;
    window.parent.postMessage({ type: 'element-hover-end' }, '*');
  }

  function onClick(e) {
    if (!annotateMode) return;
    e.preventDefault();
    e.stopPropagation();
    const target = e.target;
    const rect = target.getBoundingClientRect();
    window.parent.postMessage({
      type: 'element-selected',
      selector: generateSelector(target),
      text: (target.textContent || '').slice(0, 200),
      rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height }
    }, '*');
  }

  /** Handle commands from parent */
  window.addEventListener('message', function(e) {
    const data = e.data;
    if (!data || !data.type) return;

    switch (data.type) {
      case 'set-annotate-mode':
        annotateMode = !!data.enabled;
        document.body.style.cursor = annotateMode ? 'crosshair' : '';
        if (!annotateMode && hoveredEl) {
          hoveredEl.classList.remove('__mt_hover');
          hoveredEl = null;
        }
        break;

      case 'highlight':
        try {
          const el = document.querySelector(data.selector);
          if (el) {
            el.classList.add(HIGHLIGHT_CLASS);
            if (data.annotationId) el.dataset.annotationId = data.annotationId;
          }
        } catch (err) { /* invalid selector */ }
        break;

      case 'scroll-to':
        try {
          const el = document.querySelector(data.selector);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('__mt_flash');
            setTimeout(function() { el.classList.remove('__mt_flash'); }, 2000);
          }
        } catch (err) { /* invalid selector */ }
        break;

      case 'clear-highlights':
        document.querySelectorAll('.' + HIGHLIGHT_CLASS).forEach(function(el) {
          el.classList.remove(HIGHLIGHT_CLASS);
        });
        break;

      case 'show-pins':
        // Remove existing pins
        document.querySelectorAll('.' + PIN_CLASS).forEach(function(el) { el.remove(); });
        // Add pins for each annotation
        if (Array.isArray(data.annotations)) {
          data.annotations.forEach(function(ann) {
            try {
              const el = document.querySelector(ann.selector);
              if (!el) return;
              const rect = el.getBoundingClientRect();
              const pin = document.createElement('div');
              pin.className = PIN_CLASS;
              pin.textContent = '\uD83D\uDCCC'; // 📌
              pin.style.left = (rect.left + window.scrollX - 24) + 'px';
              pin.style.top = (rect.top + window.scrollY) + 'px';
              pin.dataset.annotationId = ann.id;
              pin.addEventListener('click', function() {
                window.parent.postMessage({ type: 'pin-clicked', annotationId: ann.id }, '*');
              });
              document.body.appendChild(pin);
            } catch (err) { /* invalid selector */ }
          });
        }
        break;
    }
  });

  // Add event listeners
  document.addEventListener('mouseover', onMouseOver, true);
  document.addEventListener('mouseout', onMouseOut, true);
  document.addEventListener('click', onClick, true);

  // Notify parent we're ready
  window.parent.postMessage({ type: 'bridge-ready' }, '*');
})();
