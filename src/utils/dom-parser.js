/**
 * DOM Parser Utilities
 * Extract element context for Claude AI analysis
 */

/**
 * Extract comprehensive context from a DOM element
 * @param {HTMLElement} element - The selected element
 * @returns {Object} - Element context with HTML, CSS, and metadata
 */
export function extractElementContext(element) {
  if (!element || !(element instanceof HTMLElement)) {
    throw new Error('Invalid element');
  }

  return {
    tagName: element.tagName.toLowerCase(),
    selector: generateSelector(element),
    html: getCleanHTML(element),
    computedStyles: getRelevantComputedStyles(element),
    cssRules: getApplicableCSSRules(element),
    classList: Array.from(element.classList),
    id: element.id || null,
    attributes: getElementAttributes(element)
  };
}

/**
 * Generate a unique CSS selector for an element
 * @param {HTMLElement} element - Target element
 * @returns {string} - CSS selector
 */
export function generateSelector(element) {
  // If element has an ID, use that
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  // Build a path from the element to the root
  const path = [];
  let current = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    // Add classes if available
    if (current.classList.length > 0) {
      selector += '.' + Array.from(current.classList).map(c => CSS.escape(c)).join('.');
    }

    // Add nth-child if needed to make it unique
    if (current.parentElement) {
      const siblings = Array.from(current.parentElement.children);
      const index = siblings.indexOf(current);
      if (siblings.length > 1) {
        selector += `:nth-child(${index + 1})`;
      }
    }

    path.unshift(selector);
    current = current.parentElement;
  }

  return path.join(' > ');
}

/**
 * Get clean HTML of the element (limit depth for large trees)
 * @param {HTMLElement} element - Target element
 * @param {number} maxDepth - Maximum depth to include
 * @returns {string} - HTML string
 */
function getCleanHTML(element, maxDepth = 3) {
  const clone = element.cloneNode(true);

  // Remove script tags for security
  clone.querySelectorAll('script').forEach(script => script.remove());

  // If element has many children, simplify
  if (maxDepth > 0) {
    simplifyDeepChildren(clone, maxDepth);
  }

  // Get outer HTML
  let html = clone.outerHTML;

  // Truncate if too long (avoid huge payloads)
  if (html.length > 5000) {
    html = html.substring(0, 5000) + '\n<!-- ... truncated ... -->';
  }

  return html;
}

/**
 * Simplify deeply nested children to avoid huge HTML payloads
 * @param {HTMLElement} element - Element to simplify
 * @param {number} depth - Current depth
 */
function simplifyDeepChildren(element, depth) {
  if (depth <= 0) {
    // Replace deep children with placeholder
    if (element.children.length > 0) {
      element.innerHTML = '<!-- ... nested content ... -->';
    }
    return;
  }

  Array.from(element.children).forEach(child => {
    simplifyDeepChildren(child, depth - 1);
  });
}

/**
 * Get relevant computed styles (filter out defaults and inherited)
 * @param {HTMLElement} element - Target element
 * @returns {Object} - Relevant styles
 */
function getRelevantComputedStyles(element) {
  const computed = window.getComputedStyle(element);

  // List of CSS properties we care about
  const relevantProperties = [
    'display', 'position', 'top', 'right', 'bottom', 'left',
    'width', 'height', 'max-width', 'max-height', 'min-width', 'min-height',
    'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'border', 'border-width', 'border-style', 'border-color', 'border-radius',
    'background', 'background-color', 'background-image', 'background-size',
    'color', 'font-family', 'font-size', 'font-weight', 'line-height',
    'text-align', 'text-decoration', 'text-transform',
    'flex', 'flex-direction', 'justify-content', 'align-items', 'gap',
    'grid', 'grid-template-columns', 'grid-template-rows', 'grid-gap',
    'opacity', 'visibility', 'overflow', 'z-index', 'transform'
  ];

  const styles = {};

  relevantProperties.forEach(prop => {
    const value = computed.getPropertyValue(prop);
    if (value && value !== 'none' && value !== 'normal' && value !== 'auto') {
      styles[prop] = value;
    }
  });

  return styles;
}

/**
 * Get CSS rules that apply to this element
 * @param {HTMLElement} element - Target element
 * @returns {string} - CSS rules as string
 */
function getApplicableCSSRules(element) {
  const rules = [];

  try {
    // Iterate through all stylesheets
    for (const sheet of document.styleSheets) {
      try {
        // Skip external stylesheets we can't access due to CORS
        const cssRules = sheet.cssRules || sheet.rules;

        for (const rule of cssRules) {
          if (rule instanceof CSSStyleRule) {
            // Check if this rule applies to our element
            if (element.matches(rule.selectorText)) {
              rules.push(rule.cssText);
            }
          }
        }
      } catch (e) {
        // CORS error or other issue accessing stylesheet
        continue;
      }
    }
  } catch (error) {
    console.warn('Could not access CSS rules:', error);
  }

  // Limit the number of rules to avoid huge payloads
  const limitedRules = rules.slice(0, 20);

  return limitedRules.join('\n\n');
}

/**
 * Get element attributes as an object
 * @param {HTMLElement} element - Target element
 * @returns {Object} - Attributes object
 */
function getElementAttributes(element) {
  const attrs = {};

  for (const attr of element.attributes) {
    // Skip internal attributes
    if (!attr.name.startsWith('_') && !attr.name.startsWith('data-polish')) {
      attrs[attr.name] = attr.value;
    }
  }

  return attrs;
}

/**
 * Validate if element is safe to modify
 * @param {HTMLElement} element - Target element
 * @returns {boolean} - Whether it's safe to modify
 */
export function isSafeToModify(element) {
  if (!element || !(element instanceof HTMLElement)) {
    return false;
  }

  // Don't allow modifying critical elements
  const tagName = element.tagName.toLowerCase();
  const unsafeTags = ['html', 'head', 'body', 'script', 'style', 'iframe'];

  if (unsafeTags.includes(tagName)) {
    return false;
  }

  // Don't modify our own extension elements
  if (element.hasAttribute('data-polish-extension')) {
    return false;
  }

  return true;
}
