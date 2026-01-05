/**
 * Scoring Module
 *
 * Maps tool-specific outputs to normalized severity, confidence, and effort scores.
 *
 * Reference: vibeCop_spec.md section 7
 */

import type {
  AutofixLevel,
  Confidence,
  Effort,
  Layer,
  Severity,
  ToolName,
} from './types.js';

// ============================================================================
// Severity Mapping
// ============================================================================

/**
 * Severity hierarchy (for comparisons).
 * Higher number = more severe.
 */
export const SEVERITY_ORDER: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/**
 * Compare severities. Returns:
 * - negative if a < b
 * - 0 if a === b
 * - positive if a > b
 */
export function compareSeverity(a: Severity, b: Severity): number {
  return SEVERITY_ORDER[a] - SEVERITY_ORDER[b];
}

/**
 * Check if severity meets threshold.
 */
export function meetsSeverityThreshold(severity: Severity, threshold: Severity): boolean {
  return SEVERITY_ORDER[severity] >= SEVERITY_ORDER[threshold];
}

// ============================================================================
// Confidence Mapping
// ============================================================================

/**
 * Confidence hierarchy (for comparisons).
 */
export const CONFIDENCE_ORDER: Record<Confidence, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

/**
 * Compare confidence levels.
 */
export function compareConfidence(a: Confidence, b: Confidence): number {
  return CONFIDENCE_ORDER[a] - CONFIDENCE_ORDER[b];
}

/**
 * Check if confidence meets threshold.
 */
export function meetsConfidenceThreshold(confidence: Confidence, threshold: Confidence): boolean {
  return CONFIDENCE_ORDER[confidence] >= CONFIDENCE_ORDER[threshold];
}

// ============================================================================
// Tool-Specific Severity Mappings
// ============================================================================

/**
 * Map ESLint severity (0=off, 1=warn, 2=error) to our severity scale.
 */
export function mapEslintSeverity(eslintSeverity: 0 | 1 | 2): Severity {
  switch (eslintSeverity) {
    case 2:
      return 'high';
    case 1:
      return 'medium';
    default:
      return 'low';
  }
}

/**
 * Map ESLint rules to confidence level.
 * Some rules are very reliable (high), others are heuristic (medium/low).
 */
export function mapEslintConfidence(ruleId: string): Confidence {
  // High confidence rules (type-related, definite bugs)
  const highConfidenceRules = [
    'no-undef',
    'no-unused-vars',
    '@typescript-eslint/no-unused-vars',
    'no-dupe-keys',
    'no-duplicate-case',
    'no-unreachable',
    'no-func-assign',
    'no-import-assign',
    'no-const-assign',
    'constructor-super',
    'getter-return',
    'no-class-assign',
    'no-compare-neg-zero',
    'no-cond-assign',
    'no-constant-condition',
    'no-debugger',
    'no-dupe-args',
    'no-dupe-class-members',
    'no-empty-pattern',
    'no-ex-assign',
    'no-fallthrough',
    'no-invalid-regexp',
    'no-obj-calls',
    'no-self-assign',
    'no-setter-return',
    'no-sparse-arrays',
    'no-this-before-super',
    'no-unsafe-negation',
    'use-isnan',
    'valid-typeof',
  ];

  if (highConfidenceRules.includes(ruleId)) {
    return 'high';
  }

  // Medium confidence rules (likely issues but context-dependent)
  const mediumConfidenceRules = [
    'eqeqeq',
    'no-eval',
    'no-implied-eval',
    'no-new-func',
    'no-shadow',
    'no-use-before-define',
    'prefer-const',
    'no-var',
    'complexity',
    'max-depth',
    'max-lines-per-function',
  ];

  if (mediumConfidenceRules.includes(ruleId)) {
    return 'medium';
  }

  // Default: stylistic/preference rules
  return 'low';
}

/**
 * Map TypeScript compiler errors to severity.
 * All tsc errors are considered high severity (they prevent compilation).
 */
export function mapTscSeverity(_code: number): Severity {
  // All TypeScript errors are high severity
  return 'high';
}

/**
 * Map TypeScript errors to confidence.
 * TypeScript errors are definitionally high confidence.
 */
export function mapTscConfidence(_code: number): Confidence {
  return 'high';
}

/**
 * Map jscpd (duplicate code) findings to severity.
 * Based on the size of duplication.
 */
export function mapJscpdSeverity(lines: number, tokens: number): Severity {
  // Large duplications are high severity
  if (lines >= 50 || tokens >= 500) {
    return 'high';
  }
  // Medium-sized duplications
  if (lines >= 20 || tokens >= 200) {
    return 'medium';
  }
  // Small duplications
  return 'low';
}

/**
 * Map jscpd findings to confidence.
 * Exact/near-exact duplicates are high confidence.
 */
export function mapJscpdConfidence(_tokens: number): Confidence {
  // jscpd finds exact duplicates, always high confidence
  return 'high';
}

/**
 * Map dependency-cruiser violations to severity.
 */
export function mapDepcruiseSeverity(violationType: string): Severity {
  // Forbidden dependencies are high
  if (violationType === 'not-allowed' || violationType === 'forbidden') {
    return 'high';
  }
  // Circular dependencies are high
  if (violationType === 'cycle') {
    return 'high';
  }
  // Orphans, unreachable
  if (violationType === 'orphan' || violationType === 'reachable') {
    return 'medium';
  }
  return 'medium';
}

/**
 * Map dependency-cruiser findings to confidence.
 */
export function mapDepcruiseConfidence(violationType: string): Confidence {
  // Cycles and forbidden deps are definitive
  if (violationType === 'cycle' || violationType === 'not-allowed' || violationType === 'forbidden') {
    return 'high';
  }
  return 'medium';
}

/**
 * Map knip (unused code) findings to severity.
 */
export function mapKnipSeverity(issueType: string): Severity {
  // Unused dependencies are high (bloat, security)
  if (issueType === 'dependencies' || issueType === 'devDependencies') {
    return 'high';
  }
  // Unused exports are medium
  if (issueType === 'exports' || issueType === 'types') {
    return 'medium';
  }
  // Unused files are medium-high
  if (issueType === 'files') {
    return 'medium';
  }
  return 'medium';
}

/**
 * Map knip findings to confidence.
 */
export function mapKnipConfidence(issueType: string): Confidence {
  // Dependencies are high confidence
  if (issueType === 'dependencies' || issueType === 'devDependencies') {
    return 'high';
  }
  // Exports can have false positives (dynamic usage)
  if (issueType === 'exports') {
    return 'medium';
  }
  // Unused files are usually accurate
  if (issueType === 'files') {
    return 'high';
  }
  return 'medium';
}

/**
 * Map semgrep findings to severity.
 * Uses semgrep's own severity when available.
 */
export function mapSemgrepSeverity(semgrepSeverity: string): Severity {
  const normalized = semgrepSeverity.toLowerCase();
  if (normalized === 'error' || normalized === 'high') {
    return 'high';
  }
  if (normalized === 'warning' || normalized === 'medium') {
    return 'medium';
  }
  if (normalized === 'info' || normalized === 'low') {
    return 'low';
  }
  return 'medium'; // conservative default
}

/**
 * Map semgrep findings to confidence.
 */
export function mapSemgrepConfidence(semgrepConfidence?: string): Confidence {
  if (!semgrepConfidence) {
    return 'medium';
  }
  const normalized = semgrepConfidence.toLowerCase();
  if (normalized === 'high') {
    return 'high';
  }
  if (normalized === 'medium') {
    return 'medium';
  }
  return 'low';
}

// ============================================================================
// Layer Classification
// ============================================================================

/**
 * Classify a finding into a layer based on tool and rule.
 */
export function classifyLayer(tool: ToolName, ruleId: string): Layer {
  // Security layer
  const securityPatterns = [
    'security',
    'xss',
    'injection',
    'csrf',
    'sql',
    'xxe',
    'ssrf',
    'auth',
    'crypto',
    'secret',
    'password',
    'eval',
    'dangerous',
  ];

  const ruleIdLower = ruleId.toLowerCase();
  if (securityPatterns.some((p) => ruleIdLower.includes(p))) {
    return 'security';
  }

  // Architecture layer
  if (tool === 'dependency-cruiser' || tool === 'knip') {
    return 'architecture';
  }
  if (ruleIdLower.includes('import') || ruleIdLower.includes('dependency') || ruleIdLower.includes('cycle')) {
    return 'architecture';
  }

  // System layer (build, config issues)
  if (tool === 'tsc') {
    // Type errors are code-level
    return 'code';
  }

  // Default: code layer
  return 'code';
}

// ============================================================================
// Effort Estimation
// ============================================================================

/**
 * Estimate effort to fix a finding.
 *
 * S (Small): Quick fix, often autofix available, single location
 * M (Medium): Requires some thought, multiple changes, or investigation
 * L (Large): Significant refactoring, architectural changes
 */
export function estimateEffort(
  tool: ToolName,
  ruleId: string,
  locationCount: number,
  hasAutofix: boolean
): Effort {
  // Autofix available = Small effort
  if (hasAutofix) {
    return 'S';
  }

  // Multiple locations = at least Medium
  if (locationCount > 3) {
    return 'L';
  }
  if (locationCount > 1) {
    return 'M';
  }

  // Tool-specific heuristics
  if (tool === 'jscpd') {
    // Duplicate code refactoring is typically Medium to Large
    return 'M';
  }

  if (tool === 'dependency-cruiser') {
    // Fixing dependency cycles is typically Large
    if (ruleId.toLowerCase().includes('cycle')) {
      return 'L';
    }
    return 'M';
  }

  if (tool === 'knip') {
    // Removing unused code is typically Small
    return 'S';
  }

  if (tool === 'tsc') {
    // Type errors can vary; assume Medium without more info
    return 'M';
  }

  // ESLint/Prettier - typically Small if single location
  if (tool === 'eslint' || tool === 'prettier') {
    return 'S';
  }

  // Default: Medium
  return 'M';
}

// ============================================================================
// Autofix Detection
// ============================================================================

/**
 * Determine autofix level based on tool and rule.
 */
export function determineAutofixLevel(
  tool: ToolName,
  ruleId: string,
  hasFixInfo: boolean
): AutofixLevel {
  // Prettier always has safe autofix
  if (tool === 'prettier') {
    return 'safe';
  }

  // ESLint with fix info
  if (tool === 'eslint' && hasFixInfo) {
    // Some ESLint fixes are safe, others need review
    const safeRules = [
      'semi',
      'quotes',
      'indent',
      'comma-dangle',
      'no-extra-semi',
      'no-trailing-spaces',
      'eol-last',
      'space-before-function-paren',
      'object-curly-spacing',
      'array-bracket-spacing',
      'prefer-const',
      'no-var',
    ];

    if (safeRules.some((r) => ruleId.includes(r))) {
      return 'safe';
    }
    return 'requires_review';
  }

  // Trunk may provide autofix
  if (tool === 'trunk' && hasFixInfo) {
    return 'requires_review';
  }

  return 'none';
}

// ============================================================================
// Threshold Checking
// ============================================================================

/**
 * Check if a finding meets severity and confidence thresholds.
 */
export function meetsThresholds(
  severity: Severity,
  confidence: Confidence,
  severityThreshold: Severity,
  confidenceThreshold: Confidence
): boolean {
  return (
    meetsSeverityThreshold(severity, severityThreshold) &&
    meetsConfidenceThreshold(confidence, confidenceThreshold)
  );
}

// ============================================================================
// Sorting
// ============================================================================

/**
 * Compare two findings for deterministic sorting.
 * Order: severity desc, confidence desc, path asc, line asc
 */
export function compareFindingsForSort(
  a: { severity: Severity; confidence: Confidence; locations: { path: string; startLine: number }[] },
  b: { severity: Severity; confidence: Confidence; locations: { path: string; startLine: number }[] }
): number {
  // Severity descending
  const severityDiff = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
  if (severityDiff !== 0) return severityDiff;

  // Confidence descending
  const confidenceDiff = CONFIDENCE_ORDER[b.confidence] - CONFIDENCE_ORDER[a.confidence];
  if (confidenceDiff !== 0) return confidenceDiff;

  // Path ascending
  const pathA = a.locations[0]?.path ?? '';
  const pathB = b.locations[0]?.path ?? '';
  const pathDiff = pathA.localeCompare(pathB);
  if (pathDiff !== 0) return pathDiff;

  // Line ascending
  const lineA = a.locations[0]?.startLine ?? 0;
  const lineB = b.locations[0]?.startLine ?? 0;
  return lineA - lineB;
}
