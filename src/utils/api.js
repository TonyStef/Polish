/**
 * Claude API Wrapper
 * Handles communication with Anthropic's Messages API
 *
 * IMPORTANT: Module Loading
 *
 * This file is loaded by service-worker.js using importScripts() (classic script loading).
 * No export/import statements allowed - functions are available in global scope.
 *
 * Used only by: src/background/service-worker.js (line 7: importScripts('../utils/api.js'))
 */

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
const API_VERSION = '2023-06-01';

/**
 * Make a request to Claude API to modify a website element
 * @param {string} apiKey - User's Anthropic API key
 * @param {string} userRequest - What the user wants to change
 * @param {Object} elementContext - DOM element context (HTML, CSS, selector)
 * @returns {Promise<Object>} - Claude's response with modifications
 */
async function requestModification(apiKey, userRequest, elementContext) {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  if (!userRequest || !elementContext) {
    throw new Error('User request and element context are required');
  }

  const prompt = buildPrompt(userRequest, elementContext);

  try {
    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': API_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3 // Lower temperature for more consistent code generation
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Claude API error: ${response.status} - ${errorData.error?.message || response.statusText}`
      );
    }

    const data = await response.json();

    // Extract the text content from Claude's response
    const textContent = data.content?.[0]?.text;

    if (!textContent) {
      throw new Error('No response content from Claude');
    }

    // Parse the JSON response from Claude
    const modifications = parseClaudeResponse(textContent);

    return modifications;

  } catch (error) {
    console.error('Claude API request failed:', error);
    throw error;
  }
}

/**
 * Build the prompt for Claude with element context
 * @param {string} userRequest - User's modification request
 * @param {Object} elementContext - Element data
 * @returns {string} - Formatted prompt
 */
function buildPrompt(userRequest, elementContext) {
  return `You are helping modify a website element. The user wants to: "${userRequest}"

**Current Element Information:**

Tag: ${elementContext.tagName}
Selector: ${elementContext.selector}

HTML:
\`\`\`html
${elementContext.html}
\`\`\`

Current Styles (computed):
\`\`\`css
${formatStyles(elementContext.computedStyles)}
\`\`\`

${elementContext.cssRules ? `Applicable CSS Rules:
\`\`\`css
${elementContext.cssRules}
\`\`\`` : ''}

**Instructions:**
1. Analyze the user's request and the current element structure
2. Generate the necessary CSS and/or HTML modifications
3. Return ONLY a valid JSON object in this exact format (no markdown, no extra text):

{
  "css_changes": "/* CSS rules to apply to this element */",
  "html_changes": "<!-- Modified HTML for the element, or empty string if no HTML changes -->",
  "explanation": "Brief explanation of what was changed"
}

**Important:**
- For CSS changes, provide complete CSS rules that will be applied to the element
- For HTML changes, provide the complete new HTML for the element (not just a snippet)
- If only CSS is needed, leave html_changes as empty string
- Ensure all CSS is valid and won't break the page
- Ensure all HTML is valid and safe (no script tags)
- Return ONLY the JSON object, nothing else`;
}

/**
 * Format computed styles object into readable CSS
 * @param {Object} styles - Computed styles object
 * @returns {string} - Formatted CSS string
 */
function formatStyles(styles) {
  if (!styles || typeof styles !== 'object') {
    return '/* No styles */';
  }

  // Convert styles object to CSS string
  const entries = Object.entries(styles)
    .filter(([key, value]) => value && value !== 'none' && value !== 'normal')
    .slice(0, 20) // Limit to most important styles
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n');

  return entries || '/* No significant styles */';
}

/**
 * Parse Claude's JSON response
 * @param {string} responseText - Raw response from Claude
 * @returns {Object} - Parsed modifications
 */
function parseClaudeResponse(responseText) {
  try {
    // Try to find JSON in the response (Claude might wrap it in markdown)
    let jsonText = responseText.trim();

    // Remove markdown code blocks if present
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```\s*$/g, '');
    }

    const parsed = JSON.parse(jsonText);

    // Validate the response structure
    if (typeof parsed !== 'object') {
      throw new Error('Response is not an object');
    }

    // Ensure required fields exist
    return {
      css_changes: parsed.css_changes || '',
      html_changes: parsed.html_changes || '',
      explanation: parsed.explanation || 'Modifications applied'
    };

  } catch (error) {
    console.error('Failed to parse Claude response:', error);
    console.error('Raw response:', responseText);
    throw new Error(`Failed to parse modifications from Claude: ${error.message}`);
  }
}

/**
 * Validate API key format (basic check)
 * @param {string} apiKey - API key to validate
 * @returns {boolean} - Whether key looks valid
 */
function validateApiKey(apiKey) {
  // Anthropic API keys start with 'sk-ant-'
  return typeof apiKey === 'string' && apiKey.startsWith('sk-ant-') && apiKey.length > 20;
}
