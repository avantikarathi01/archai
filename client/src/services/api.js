/**
 * API service for communicating with the ArchAI Express backend
 */

export async function fetchHealthStatus() {
  try {
    const startTime = performance.now();
    const response = await fetch('/api/health', {
      headers: {
        'Accept': 'application/json',
      },
    });

    const elapsedMs = Math.round(performance.now() - startTime);

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: `Backend responded with HTTP ${response.status} ${response.statusText}`,
        latencyMs: elapsedMs,
      };
    }

    const data = await response.json();
    return {
      ok: true,
      status: response.status,
      data,
      latencyMs: elapsedMs,
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message || 'Failed to connect to backend server',
      latencyMs: null,
    };
  }
}

/**
 * Parse architectural requirements from natural language prompt (English or Hinglish)
 */
export async function parseRequirements(prompt) {
  try {
    const response = await fetch('/api/parse-requirements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data.error || `HTTP ${response.status}` };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error.message || 'Failed to connect to parser' };
  }
}

/**
 * Generate procedural 2D floor-plan design from prompt or structured requirements
 */
export async function generateDesign({ prompt, requirements, plotDimensions, options }) {
  try {
    const response = await fetch('/api/generate-design', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, requirements, plotDimensions, options }),
    });

    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data.error || `HTTP ${response.status}`, data };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error.message || 'Failed to generate design' };
  }
}

/**
 * Validate layout geometry, boundary compliance, and room overlaps
 */
export async function validateDesign(layout) {
  try {
    const response = await fetch('/api/validate-design', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layout }),
    });

    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data.error || `HTTP ${response.status}` };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error.message || 'Failed to validate layout' };
  }
}

/**
 * Fetch architectural recommendations for a layout
 */
export async function getRecommendations(layout) {
  try {
    const response = await fetch('/api/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layout }),
    });

    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data.error || `HTTP ${response.status}` };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error.message || 'Failed to fetch recommendations' };
  }
}

/**
 * Modify an existing 2D floor-plan design via conversational prompt
 */
export async function modifyDesign({ layout, prompt }) {
  try {
    const response = await fetch('/api/designs/modify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layout, prompt }),
    });

    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data.error || data.message || `HTTP ${response.status}`, data };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error.message || 'Failed to modify design' };
  }
}

/**
 * Estimate preliminary construction cost for an architectural layout
 */
export async function estimateDesignCost({ layout, options }) {
  try {
    const response = await fetch('/api/designs/cost-estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layout, options }),
    });

    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data.error || `HTTP ${response.status}`, data };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error.message || 'Failed to estimate construction cost' };
  }
}
