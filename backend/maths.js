



function calculateFinalScore(penalties = {}, customWeights = {}) {
  // 1. Set default weights (These must be documented in your README)
  const defaultWeights = {
    bug: 0.30,  // 30% weight for bugs
    sec: 0.30,  // 30% weight for security flaws
    cplx: 0.20, // 20% weight for high complexity
    red: 0.10,  // 10% weight for redundancy
    lint: 0.10  // 10% weight for linting/formatting
  };

  // 2. Merge user-provided weights with defaults
  const weights = { ...defaultWeights, ...customWeights };

  // 3. Validate that weights sum exactly to 1.0
  const totalWeight = weights.bug + weights.sec + weights.cplx + weights.red + weights.lint;
  
  // (Using 0.001 to account for JavaScript floating point math quirks)
  if (Math.abs(totalWeight - 1.0) > 0.001) {
    throw new Error("CRITICAL: Scoring weights must sum to exactly 1.0. Current sum is " + totalWeight.toFixed(2));
  }

  // 4. Extract penalties (default to 0 if not provided)
  const P_bug = penalties.bug || 0;
  const P_sec = penalties.sec || 0;
  const P_cplx = penalties.cplx || 0;
  const P_red = penalties.red || 0;
  const P_lint = penalties.lint || 0;

  // 5. Calculate the weighted penalty sum
  const weightedPenaltySum = 
    (P_bug * weights.bug) + 
    (P_sec * weights.sec) + 
    (P_cplx * weights.cplx) + 
    (P_red * weights.red) + 
    (P_lint * weights.lint);

  // 6. Calculate final score (cannot drop below 0)
  return Math.max(0, 100 - weightedPenaltySum);
}

module.exports = { calculateFinalScore };