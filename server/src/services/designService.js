/**
 * ArchAI Central Design & Architectural Intelligence Orchestrator Service
 * 
 * Modular backend service implementing the teammate specification:
 * A. Requirement extraction (English & Hinglish, unit conversions, facts vs assumptions)
 * B. Architectural reasoning (program feasibility, spatial zoning, circulation)
 * C. Design generation orchestration (brief generation, procedural layout, validation)
 * D. Prompt-based modification (living room, open kitchen, balcony, bedroom width, extra floor, compact)
 * E. Validation (boundaries, overlaps, doors, windows, multi-floor references)
 * F. Recommendations & Cost estimation (Vastu, orientation, itemized civil/MEP/finishes breakdown)
 */

import { parsePromptRequirements } from './promptParser.js';
import { generateProceduralLayout } from './layoutGenerator.js';
import { validateLayout, generateRecommendations, COMPLIANCE_DISCLAIMER } from './architecturalRules.js';
import { modifyLayout } from './modificationEngine.js';
import { estimateDesignCost, COST_DISCLAIMER } from './costEstimator.js';
import { aiProvider } from './aiProvider.js';

export class DesignService {
  /**
   * Parse architectural requirements from natural-language text
   * 
   * @param {string} prompt - English or Hinglish prompt string
   * @returns {object} Structured requirement object with facts, assumptions, and clarifications
   */
  async parseRequirements(prompt) {
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      throw new Error('A non-empty prompt string is required to parse requirements.');
    }

    const trimmedPrompt = prompt.trim();

    // Check if AI augmentation is available, otherwise safe deterministic rule parser
    const aiAttempt = await aiProvider.parseWithAI(trimmedPrompt);
    const parsed = parsePromptRequirements(trimmedPrompt);

    // Build architectural brief summarizing the programmatic intent
    const brief = this.buildArchitecturalBrief(parsed.requirements);

    return {
      status: 'success',
      rawPrompt: trimmedPrompt,
      generationMethod: aiAttempt?.method || 'deterministic_engine',
      requirements: parsed.requirements,
      extractedFacts: parsed.extractedFacts,
      assumptions: parsed.assumptions,
      clarifications: parsed.clarifications,
      warnings: parsed.warnings,
      brief,
      disclaimer: COMPLIANCE_DISCLAIMER,
    };
  }

  /**
   * Generate canonical 2D floor plan design from prompt or structured requirements
   * 
   * @param {object} params - { prompt, requirements, plotDimensions, options }
   * @returns {object} Canonical design structure
   */
  async generateDesign({ prompt, requirements, plotDimensions, options = {} }) {
    let reqs = null;
    let rawPrompt = null;

    if (prompt && typeof prompt === 'string' && prompt.trim().length > 0) {
      rawPrompt = prompt.trim();
      const parsed = parsePromptRequirements(rawPrompt);
      reqs = parsed.requirements;

      // Override with explicit plot dimensions if supplied
      const explicitPlot = plotDimensions || requirements?.plot;
      if (explicitPlot && explicitPlot.width && explicitPlot.length) {
        const w = Number(explicitPlot.width);
        const l = Number(explicitPlot.length);
        reqs.plot = {
          width: w,
          length: l,
          totalAreaSqFt: Math.round(w * l),
          unit: 'ft',
          isDimensionsExplicit: true,
        };
      }
    } else if (requirements) {
      reqs = requirements;
      rawPrompt = requirements.rawPrompt || null;
    } else {
      throw new Error('Either a "prompt" string or a "requirements" object must be provided.');
    }

    // Build architectural brief
    const brief = this.buildArchitecturalBrief(reqs);

    // Invoke procedural layout generator
    const layout = generateProceduralLayout(reqs);

    // Run geometric validation
    const validation = validateLayout(layout);
    layout.validation = validation;

    // Run architectural recommendations
    const recommendations = generateRecommendations(layout);

    // Compute preliminary cost estimate
    const costEstimate = estimateDesignCost(layout, {
      tier: reqs.budget?.tier || options.tier,
      designStyle: reqs.designStyle || options.designStyle,
    });

    return {
      status: 'success',
      generationMethod: 'deterministic_engine',
      requirements: reqs,
      layout,
      brief,
      validation,
      recommendations: recommendations.recommendations,
      costEstimate,
      clarifications: layout.clarifications || reqs.clarifications || [],
      warnings: layout.warnings || reqs.warnings || [],
      disclaimer: COMPLIANCE_DISCLAIMER,
    };
  }

  /**
   * Modify an existing floor plan design using natural language or structured changes
   * 
   * @param {object} layout - Existing valid layout object
   * @param {string|object} instruction - Modification prompt text or structured command
   * @returns {object} Modification result with updated layout, validation, and cost
   */
  async modifyDesign(layout, instruction) {
    if (!layout || !Array.isArray(layout.rooms)) {
      throw new Error('A valid "layout" object containing rooms is required for modification.');
    }
    if (!instruction) {
      throw new Error('A modification prompt or instruction is required.');
    }

    // Apply geometric modification
    const modResult = modifyLayout(layout, instruction);

    if (!modResult.applied) {
      return modResult;
    }

    // Recalculate cost estimate for modified layout
    const updatedCost = estimateDesignCost(modResult.layout);

    return {
      ...modResult,
      costEstimate: updatedCost,
      disclaimer: COMPLIANCE_DISCLAIMER,
    };
  }

  /**
   * Validate layout geometry, boundaries, overlaps, doors, windows, and practical standards
   * 
   * @param {object} layout - Layout object to validate
   * @returns {object} Validation result
   */
  validateDesign(layout) {
    if (!layout) {
      throw new Error('A "layout" object is required for validation.');
    }
    const validation = validateLayout(layout);
    return {
      status: 'success',
      validation,
      disclaimer: COMPLIANCE_DISCLAIMER,
    };
  }

  /**
   * Generate architectural recommendations (Vastu, orientation, acoustics, zoning)
   * 
   * @param {object} layout - Layout object
   * @returns {object} Recommendations list
   */
  getRecommendations(layout) {
    if (!layout) {
      throw new Error('A "layout" object is required for recommendations.');
    }
    const result = generateRecommendations(layout);
    return {
      status: 'success',
      recommendations: result.recommendations,
      disclaimer: COMPLIANCE_DISCLAIMER,
    };
  }

  /**
   * Calculate preliminary itemized construction cost estimate
   * 
   * @param {object} layout - Layout object
   * @param {object} options - { tier, designStyle }
   * @returns {object} Cost estimate
   */
  estimateCost(layout, options = {}) {
    if (!layout) {
      throw new Error('A "layout" object is required for cost estimation.');
    }
    return estimateDesignCost(layout, options);
  }

  /**
   * Builds an architectural brief detailing space program, zoning, and orientation
   */
  buildArchitecturalBrief(requirements) {
    const floorsCount = Math.max(1, requirements?.floors || 1);
    const facing = requirements?.facing || 'unspecified';
    const totalBeds = requirements?.bedrooms || 0;
    const totalBaths = requirements?.bathrooms || 0;

    const floorPrograms = [];
    if (requirements?.floorRequirements) {
      for (let i = 0; i < floorsCount; i++) {
        const f = requirements.floorRequirements[i];
        if (f) {
          const spaces = [];
          if (f.parking) spaces.push('Covered Parking');
          if (f.livingRoom) spaces.push('Living / Drawing Lounge');
          if (f.kitchen) spaces.push('Kitchen');
          if (f.bedrooms > 0) spaces.push(`${f.bedrooms} Bedroom(s)`);
          if (f.bathrooms > 0) spaces.push(`${f.bathrooms} Bathroom(s)`);
          if (f.poojaRoom) spaces.push('Pooja Mandir');
          if (f.balcony) spaces.push('Balcony / Terrace');
          if (f.staircase) spaces.push('Staircase Flight');
          floorPrograms.push({
            level: i,
            name: f.name || `Floor ${i}`,
            spaces,
          });
        }
      }
    }

    return {
      projectType: 'Residential Independent House',
      floorsCount,
      totalBedrooms: totalBeds,
      totalBathrooms: totalBaths,
      facingOrientation: facing,
      designStyle: requirements?.designStyle || 'unspecified',
      floorPrograms,
      zoningPrinciples: [
        'Public & Social Zone: Front facing, direct entrance access',
        'Private Rest Zone: Rear buffer for acoustic tranquility',
        'Wet & Service Zone: Grouped plumbing stacks for cost-effective drainage',
        'Sacred / Pooja Zone: East / North-East quadrant isolation',
      ],
    };
  }
}

export const designService = new DesignService();
