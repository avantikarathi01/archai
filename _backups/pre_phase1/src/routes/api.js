import express from 'express';
import { designService } from '../services/designService.js';
import { COMPLIANCE_DISCLAIMER } from '../services/architecturalRules.js';

const router = express.Router();

/**
 * ---------------------------------------------------------------------------
 * Requirement Parsing Handlers
 * Supported routes:
 *   POST /api/requirements/parse  (Teammate RESTful specification)
 *   POST /api/parse-requirements  (Legacy compatibility alias)
 * ---------------------------------------------------------------------------
 */
async function handleParseRequirements(req, res) {
  const { prompt } = req.body || {};

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({
      status: 'error',
      error: 'A non-empty prompt string is required in the request body (e.g. {"prompt": "3 BHK east facing on 30x40 plot"}).',
      disclaimer: COMPLIANCE_DISCLAIMER,
    });
  }

  try {
    const result = await designService.parseRequirements(prompt);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      error: error.message || 'Failed to parse prompt requirements.',
      disclaimer: COMPLIANCE_DISCLAIMER,
    });
  }
}

router.post('/requirements/parse', handleParseRequirements);
router.post('/parse-requirements', handleParseRequirements);

/**
 * ---------------------------------------------------------------------------
 * Design Generation Handlers
 * Supported routes:
 *   POST /api/designs/generate  (Teammate RESTful specification)
 *   POST /api/generate-design   (Legacy compatibility alias)
 * ---------------------------------------------------------------------------
 */
async function handleGenerateDesign(req, res) {
  const { prompt, requirements, plotDimensions, options } = req.body || {};

  if ((!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) && !requirements) {
    return res.status(400).json({
      status: 'error',
      error: 'Either a "prompt" string or a "requirements" object must be provided.',
      disclaimer: COMPLIANCE_DISCLAIMER,
    });
  }

  try {
    const result = await designService.generateDesign({
      prompt,
      requirements,
      plotDimensions,
      options,
    });
    return res.status(200).json(result);
  } catch (error) {
    // If layout is impossible or inputs are infeasible, return 422 Unprocessable Entity
    return res.status(422).json({
      status: 'error',
      error: error.message,
      disclaimer: COMPLIANCE_DISCLAIMER,
    });
  }
}

router.post('/designs/generate', handleGenerateDesign);
router.post('/generate-design', handleGenerateDesign);

/**
 * ---------------------------------------------------------------------------
 * Design Validation Handlers
 * Supported routes:
 *   POST /api/designs/validate  (Teammate RESTful specification)
 *   POST /api/validate-design   (Legacy compatibility alias)
 * ---------------------------------------------------------------------------
 */
function handleValidateDesign(req, res) {
  const { layout } = req.body || {};

  if (!layout) {
    return res.status(400).json({
      status: 'error',
      error: 'A "layout" object is required in the request body.',
      disclaimer: COMPLIANCE_DISCLAIMER,
    });
  }

  try {
    const result = designService.validateDesign(layout);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(422).json({
      status: 'error',
      error: error.message,
      disclaimer: COMPLIANCE_DISCLAIMER,
    });
  }
}

router.post('/designs/validate', handleValidateDesign);
router.post('/validate-design', handleValidateDesign);

/**
 * ---------------------------------------------------------------------------
 * Design Modification Handler
 * Supported route:
 *   POST /api/designs/modify  (Teammate RESTful specification)
 * ---------------------------------------------------------------------------
 */
async function handleModifyDesign(req, res) {
  const { layout, prompt, instruction } = req.body || {};

  if (!layout) {
    return res.status(400).json({
      status: 'error',
      error: 'A "layout" object is required in the request body for modification.',
      disclaimer: COMPLIANCE_DISCLAIMER,
    });
  }

  const modPrompt = prompt || instruction;
  if (!modPrompt) {
    return res.status(400).json({
      status: 'error',
      error: 'A modification "prompt" or "instruction" string is required (e.g. "Make the living room larger").',
      disclaimer: COMPLIANCE_DISCLAIMER,
    });
  }

  try {
    const result = await designService.modifyDesign(layout, modPrompt);
    if (!result.applied) {
      return res.status(422).json(result);
    }
    return res.status(200).json(result);
  } catch (error) {
    return res.status(422).json({
      status: 'error',
      error: error.message,
      disclaimer: COMPLIANCE_DISCLAIMER,
    });
  }
}

router.post('/designs/modify', handleModifyDesign);

/**
 * ---------------------------------------------------------------------------
 * Design Recommendations Handlers
 * Supported routes:
 *   POST /api/designs/recommendations  (Teammate RESTful specification)
 *   POST /api/recommendations          (Legacy compatibility alias)
 * ---------------------------------------------------------------------------
 */
function handleRecommendations(req, res) {
  const { layout } = req.body || {};

  if (!layout) {
    return res.status(400).json({
      status: 'error',
      error: 'A "layout" object is required in the request body.',
      disclaimer: COMPLIANCE_DISCLAIMER,
    });
  }

  try {
    const result = designService.getRecommendations(layout);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(422).json({
      status: 'error',
      error: error.message,
      disclaimer: COMPLIANCE_DISCLAIMER,
    });
  }
}

router.post('/designs/recommendations', handleRecommendations);
router.post('/recommendations', handleRecommendations);

/**
 * ---------------------------------------------------------------------------
 * Design Cost Estimation Handler
 * Supported route:
 *   POST /api/designs/cost-estimate  (Teammate RESTful specification)
 * ---------------------------------------------------------------------------
 */
function handleCostEstimate(req, res) {
  const { layout, options } = req.body || {};

  if (!layout) {
    return res.status(400).json({
      status: 'error',
      error: 'A "layout" object is required in the request body for cost estimation.',
      disclaimer: COMPLIANCE_DISCLAIMER,
    });
  }

  try {
    const result = designService.estimateCost(layout, options);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(422).json({
      status: 'error',
      error: error.message,
      disclaimer: COMPLIANCE_DISCLAIMER,
    });
  }
}

router.post('/designs/cost-estimate', handleCostEstimate);

export default router;
