import { describe, it, expect } from 'vitest';
import {
  StatisticalAnalysis,
  calculateConversionRate,
  calculateLift,
  formatPValue,
  formatConfidenceInterval,
  getSignificanceLevel,
} from '../statistical-analysis';

// ============================================================================
// calculateConversionRate
// ============================================================================
describe('calculateConversionRate', () => {
  it('calculates rate correctly', () => {
    expect(calculateConversionRate(50, 100)).toBe(0.5);
  });

  it('returns 0 for zero sample size', () => {
    expect(calculateConversionRate(10, 0)).toBe(0);
  });

  it('handles zero conversions', () => {
    expect(calculateConversionRate(0, 200)).toBe(0);
  });

  it('returns 1 when all convert', () => {
    expect(calculateConversionRate(100, 100)).toBe(1);
  });
});

// ============================================================================
// calculateLift
// ============================================================================
describe('calculateLift', () => {
  it('calculates positive lift', () => {
    // (0.12 - 0.10) / 0.10 * 100 = 20
    expect(calculateLift(0.10, 0.12)).toBeCloseTo(20, 5);
  });

  it('calculates negative lift', () => {
    // (0.08 - 0.10) / 0.10 * 100 = -20
    expect(calculateLift(0.10, 0.08)).toBeCloseTo(-20, 5);
  });

  it('returns 0 when rates are equal', () => {
    expect(calculateLift(0.5, 0.5)).toBe(0);
  });

  it('returns 0 when control rate is 0', () => {
    expect(calculateLift(0, 0.5)).toBe(0);
  });
});

// ============================================================================
// formatPValue
// ============================================================================
describe('formatPValue', () => {
  it('returns "< 0.001" for very small values', () => {
    expect(formatPValue(0.0001)).toBe('< 0.001');
    expect(formatPValue(0.00099)).toBe('< 0.001');
  });

  it('returns "< 0.01" for values between 0.001 and 0.01', () => {
    expect(formatPValue(0.001)).toBe('< 0.01');
    expect(formatPValue(0.005)).toBe('< 0.01');
  });

  it('returns "< 0.05" for values between 0.01 and 0.05', () => {
    expect(formatPValue(0.01)).toBe('< 0.05');
    expect(formatPValue(0.04)).toBe('< 0.05');
  });

  it('returns 3-decimal string for values >= 0.05', () => {
    expect(formatPValue(0.05)).toBe('0.050');
    expect(formatPValue(0.123)).toBe('0.123');
    expect(formatPValue(0.8)).toBe('0.800');
    expect(formatPValue(1.0)).toBe('1.000');
  });
});

// ============================================================================
// formatConfidenceInterval
// ============================================================================
describe('formatConfidenceInterval', () => {
  it('formats interval with 3 decimal places', () => {
    expect(formatConfidenceInterval({ lower: 0.012, upper: 0.089 })).toBe('[0.012, 0.089]');
  });

  it('formats negative lower bound', () => {
    expect(formatConfidenceInterval({ lower: -0.05, upper: 0.1 })).toBe('[-0.050, 0.100]');
  });

  it('formats zero bounds', () => {
    expect(formatConfidenceInterval({ lower: 0, upper: 0 })).toBe('[0.000, 0.000]');
  });
});

// ============================================================================
// getSignificanceLevel
// ============================================================================
describe('getSignificanceLevel', () => {
  it('returns "high" for p < 0.001', () => {
    expect(getSignificanceLevel(0.0001)).toBe('high');
    expect(getSignificanceLevel(0.00099)).toBe('high');
  });

  it('returns "medium" for 0.001 <= p < 0.01', () => {
    expect(getSignificanceLevel(0.001)).toBe('medium');
    expect(getSignificanceLevel(0.005)).toBe('medium');
  });

  it('returns "low" for 0.01 <= p < 0.05', () => {
    expect(getSignificanceLevel(0.01)).toBe('low');
    expect(getSignificanceLevel(0.04)).toBe('low');
  });

  it('returns "none" for p >= 0.05', () => {
    expect(getSignificanceLevel(0.05)).toBe('none');
    expect(getSignificanceLevel(0.5)).toBe('none');
    expect(getSignificanceLevel(1.0)).toBe('none');
  });
});

// ============================================================================
// StatisticalAnalysis.calculateSampleSize
// ============================================================================
describe('StatisticalAnalysis.calculateSampleSize', () => {
  it('returns positive integer sample sizes', () => {
    const result = StatisticalAnalysis.calculateSampleSize({
      baselineConversionRate: 0.1,
      minimumDetectableEffect: 0.2, // 20% relative lift → p2 = 0.12
      significanceLevel: 0.05,
      statisticalPower: 0.8,
      twoSided: true,
    });
    expect(result.sampleSizePerVariant).toBeGreaterThan(0);
    expect(result.totalSampleSize).toBe(result.sampleSizePerVariant * 2);
    expect(Number.isInteger(result.sampleSizePerVariant)).toBe(true);
  });

  it('totalSampleSize is twice sampleSizePerVariant', () => {
    const result = StatisticalAnalysis.calculateSampleSize({
      baselineConversionRate: 0.05,
      minimumDetectableEffect: 0.5,
      significanceLevel: 0.05,
      statisticalPower: 0.8,
      twoSided: true,
    });
    expect(result.totalSampleSize).toBe(result.sampleSizePerVariant * 2);
  });

  it('throws when variant conversion rate exceeds 100%', () => {
    expect(() =>
      StatisticalAnalysis.calculateSampleSize({
        baselineConversionRate: 0.9,
        minimumDetectableEffect: 0.5, // 0.9 * 1.5 = 1.35 > 1
        significanceLevel: 0.05,
        statisticalPower: 0.8,
        twoSided: true,
      })
    ).toThrow('Variant conversion rate cannot exceed 100%');
  });

  it('one-sided test returns different result than two-sided', () => {
    const base = {
      baselineConversionRate: 0.1,
      minimumDetectableEffect: 0.3,
      significanceLevel: 0.05,
      statisticalPower: 0.8,
    };
    const twoSided = StatisticalAnalysis.calculateSampleSize({ ...base, twoSided: true });
    const oneSided = StatisticalAnalysis.calculateSampleSize({ ...base, twoSided: false });
    // One-sided needs fewer samples (less conservative)
    expect(oneSided.sampleSizePerVariant).toBeLessThan(twoSided.sampleSizePerVariant);
  });
});

// ============================================================================
// StatisticalAnalysis.calculateSampleSizeWithTraffic
// ============================================================================
describe('StatisticalAnalysis.calculateSampleSizeWithTraffic', () => {
  const base = {
    baselineConversionRate: 0.1,
    minimumDetectableEffect: 0.2,
    significanceLevel: 0.05,
    statisticalPower: 0.8,
    twoSided: true,
  };

  it('sets expectedDuration based on daily traffic', () => {
    const result = StatisticalAnalysis.calculateSampleSizeWithTraffic({
      ...base,
      dailyTrafficPerVariant: 100,
    });
    expect(result.expectedDuration).toBeDefined();
    expect(result.expectedDuration!).toBeGreaterThan(0);
    // expectedDuration = ceil(sampleSizePerVariant / 100)
    expect(result.expectedDuration).toBe(Math.ceil(result.sampleSizePerVariant / 100));
  });

  it('sets expectedDuration based on weekly traffic', () => {
    const result = StatisticalAnalysis.calculateSampleSizeWithTraffic({
      ...base,
      weeklyTrafficPerVariant: 100,
    });
    expect(result.expectedDuration).toBeDefined();
    expect(result.expectedDuration!).toBeGreaterThan(0);
  });

  it('does not set expectedDuration when no traffic provided', () => {
    const result = StatisticalAnalysis.calculateSampleSizeWithTraffic(base);
    expect(result.expectedDuration).toBeUndefined();
  });

  it('prefers dailyTrafficPerVariant over weekly', () => {
    const result = StatisticalAnalysis.calculateSampleSizeWithTraffic({
      ...base,
      dailyTrafficPerVariant: 500,
      weeklyTrafficPerVariant: 100,
    });
    expect(result.expectedDuration).toBe(Math.ceil(result.sampleSizePerVariant / 500));
  });
});

// ============================================================================
// StatisticalAnalysis.performZTest
// ============================================================================
describe('StatisticalAnalysis.performZTest', () => {
  it('detects clear statistical significance', () => {
    // 1000 control, 200 conversions (20%); 1000 variant, 300 conversions (30%)
    const result = StatisticalAnalysis.performZTest({
      controlConversions: 200,
      controlSampleSize: 1000,
      variantConversions: 300,
      variantSampleSize: 1000,
      significanceLevel: 0.05,
    });
    expect(result.isStatisticallySignificant).toBe(true);
    expect(result.pValue).toBeLessThan(0.05);
    expect(result.zScore).toBeGreaterThan(0);
  });

  it('does not detect significance when there is no difference', () => {
    const result = StatisticalAnalysis.performZTest({
      controlConversions: 100,
      controlSampleSize: 1000,
      variantConversions: 100,
      variantSampleSize: 1000,
      significanceLevel: 0.05,
    });
    expect(result.isStatisticallySignificant).toBe(false);
    expect(result.pValue).toBeCloseTo(1.0, 2);
    expect(result.zScore).toBeCloseTo(0, 5);
  });

  it('calculates lift correctly', () => {
    // control = 10%, variant = 20% → lift = 100%
    const result = StatisticalAnalysis.performZTest({
      controlConversions: 100,
      controlSampleSize: 1000,
      variantConversions: 200,
      variantSampleSize: 1000,
    });
    expect(result.lift).toBeCloseTo(100, 0);
  });

  it('calculates lift as 0 when control rate is 0', () => {
    const result = StatisticalAnalysis.performZTest({
      controlConversions: 0,
      controlSampleSize: 1000,
      variantConversions: 10,
      variantSampleSize: 1000,
    });
    expect(result.lift).toBe(0);
  });

  it('confidence interval lower < upper', () => {
    const result = StatisticalAnalysis.performZTest({
      controlConversions: 100,
      controlSampleSize: 1000,
      variantConversions: 120,
      variantSampleSize: 1000,
    });
    expect(result.confidenceInterval.lower).toBeLessThan(result.confidenceInterval.upper);
  });

  it('relative risk is 1 when rates are equal', () => {
    const result = StatisticalAnalysis.performZTest({
      controlConversions: 100,
      controlSampleSize: 1000,
      variantConversions: 100,
      variantSampleSize: 1000,
    });
    expect(result.relativeRisk).toBeCloseTo(1.0, 5);
  });

  it('relative risk is 0 when control rate is 0', () => {
    const result = StatisticalAnalysis.performZTest({
      controlConversions: 0,
      controlSampleSize: 1000,
      variantConversions: 10,
      variantSampleSize: 1000,
    });
    expect(result.relativeRisk).toBe(0);
  });

  it('odds ratio is 0 when variant rate is 0', () => {
    const result = StatisticalAnalysis.performZTest({
      controlConversions: 50,
      controlSampleSize: 1000,
      variantConversions: 0,
      variantSampleSize: 1000,
    });
    expect(result.oddsRatio).toBe(0);
  });

  it('uses default significanceLevel of 0.05', () => {
    const withDefault = StatisticalAnalysis.performZTest({
      controlConversions: 200,
      controlSampleSize: 1000,
      variantConversions: 300,
      variantSampleSize: 1000,
    });
    const withExplicit = StatisticalAnalysis.performZTest({
      controlConversions: 200,
      controlSampleSize: 1000,
      variantConversions: 300,
      variantSampleSize: 1000,
      significanceLevel: 0.05,
    });
    expect(withDefault.isStatisticallySignificant).toBe(withExplicit.isStatisticallySignificant);
    expect(withDefault.pValue).toBeCloseTo(withExplicit.pValue, 10);
  });
});

// ============================================================================
// StatisticalAnalysis.performBayesianTest
// ============================================================================
describe('StatisticalAnalysis.performBayesianTest', () => {
  it('returns probability between 0 and 1', () => {
    const result = StatisticalAnalysis.performBayesianTest({
      controlConversions: 100,
      controlSampleSize: 1000,
      variantConversions: 150,
      variantSampleSize: 1000,
    });
    expect(result.probabilityToBeatControl).toBeGreaterThanOrEqual(0);
    expect(result.probabilityToBeatControl).toBeLessThanOrEqual(1);
  });

  it('clearly better variant has high probability', () => {
    const result = StatisticalAnalysis.performBayesianTest({
      controlConversions: 50,
      controlSampleSize: 1000,
      variantConversions: 200,
      variantSampleSize: 1000,
    });
    // With 5% vs 20% conversion, variant should nearly always win
    expect(result.probabilityToBeatControl).toBeGreaterThan(0.95);
  });

  it('clearly worse variant has low probability', () => {
    const result = StatisticalAnalysis.performBayesianTest({
      controlConversions: 200,
      controlSampleSize: 1000,
      variantConversions: 50,
      variantSampleSize: 1000,
    });
    expect(result.probabilityToBeatControl).toBeLessThan(0.05);
  });

  it('credible interval lower < upper', () => {
    const result = StatisticalAnalysis.performBayesianTest({
      controlConversions: 100,
      controlSampleSize: 1000,
      variantConversions: 120,
      variantSampleSize: 1000,
    });
    expect(result.credibleInterval.lower).toBeLessThan(result.credibleInterval.upper);
  });

  it('posterior parameters reflect data', () => {
    const result = StatisticalAnalysis.performBayesianTest({
      controlConversions: 100,
      controlSampleSize: 1000,
      variantConversions: 200,
      variantSampleSize: 1000,
      priorAlpha: 1,
      priorBeta: 1,
    });
    // posterior alpha = prior_alpha + conversions
    expect(result.posteriorControl.alpha).toBe(101);
    expect(result.posteriorControl.beta).toBe(901);
    expect(result.posteriorVariant.alpha).toBe(201);
    expect(result.posteriorVariant.beta).toBe(801);
  });
});

// ============================================================================
// StatisticalAnalysis.performPowerAnalysis
// ============================================================================
describe('StatisticalAnalysis.performPowerAnalysis', () => {
  it('returns power between 0 and 1', () => {
    const result = StatisticalAnalysis.performPowerAnalysis({
      controlConversionRate: 0.1,
      variantConversionRate: 0.12,
      sampleSizePerVariant: 1000,
      significanceLevel: 0.05,
    });
    expect(result.statisticalPower).toBeGreaterThanOrEqual(0);
    expect(result.statisticalPower).toBeLessThanOrEqual(1);
  });

  it('large sample size gives adequate power', () => {
    const result = StatisticalAnalysis.performPowerAnalysis({
      controlConversionRate: 0.1,
      variantConversionRate: 0.15,
      sampleSizePerVariant: 10000,
      significanceLevel: 0.05,
    });
    expect(result.isAdequatelyPowered).toBe(true);
    expect(result.statisticalPower).toBeGreaterThanOrEqual(0.8);
  });

  it('very small sample size may give inadequate power', () => {
    const result = StatisticalAnalysis.performPowerAnalysis({
      controlConversionRate: 0.1,
      variantConversionRate: 0.11, // tiny effect
      sampleSizePerVariant: 10,
      significanceLevel: 0.05,
    });
    expect(result.isAdequatelyPowered).toBe(false);
  });

  it('isAdequatelyPowered is true when power >= 0.8', () => {
    const result = StatisticalAnalysis.performPowerAnalysis({
      controlConversionRate: 0.1,
      variantConversionRate: 0.2,
      sampleSizePerVariant: 5000,
    });
    expect(result.isAdequatelyPowered).toBe(result.statisticalPower >= 0.8);
  });
});

// ============================================================================
// StatisticalAnalysis.performSequentialTest
// ============================================================================
describe('StatisticalAnalysis.performSequentialTest', () => {
  it('returns standard test fields plus sequential fields', () => {
    const result = StatisticalAnalysis.performSequentialTest({
      controlConversions: 100,
      controlSampleSize: 1000,
      variantConversions: 150,
      variantSampleSize: 1000,
      currentSampleRatio: 0.5,
      totalPlannedSampleSize: 2000,
    });
    expect(result).toHaveProperty('pValue');
    expect(result).toHaveProperty('zScore');
    expect(result).toHaveProperty('adjustedSignificanceLevel');
    expect(result).toHaveProperty('spentAlpha');
    expect(result).toHaveProperty('remainingAlpha');
    expect(result).toHaveProperty('recommendContinue');
  });

  it('spent + remaining alpha approximately equals total alpha', () => {
    const result = StatisticalAnalysis.performSequentialTest({
      controlConversions: 100,
      controlSampleSize: 1000,
      variantConversions: 110,
      variantSampleSize: 1000,
      currentSampleRatio: 0.7,
      totalPlannedSampleSize: 2000,
    });
    expect(result.spentAlpha + result.remainingAlpha).toBeCloseTo(0.05, 5);
  });

  it('recommendContinue is false at full sample ratio', () => {
    const result = StatisticalAnalysis.performSequentialTest({
      controlConversions: 100,
      controlSampleSize: 1000,
      variantConversions: 110,
      variantSampleSize: 1000,
      currentSampleRatio: 1.0,
      totalPlannedSampleSize: 2000,
    });
    expect(result.recommendContinue).toBe(false);
  });

  it('fraction 0 gives 0 spent alpha', () => {
    const result = StatisticalAnalysis.performSequentialTest({
      controlConversions: 50,
      controlSampleSize: 500,
      variantConversions: 50,
      variantSampleSize: 500,
      currentSampleRatio: 0,
      totalPlannedSampleSize: 1000,
    });
    expect(result.spentAlpha).toBe(0);
  });
});

// ============================================================================
// StatisticalAnalysis.performMultiVariantTest
// ============================================================================
describe('StatisticalAnalysis.performMultiVariantTest', () => {
  const variants = [
    { name: 'Control', conversions: 100, sampleSize: 1000 },
    { name: 'Variant A', conversions: 120, sampleSize: 1000 },
    { name: 'Variant B', conversions: 80, sampleSize: 1000 },
  ];

  it('throws with fewer than 2 variants', () => {
    expect(() =>
      StatisticalAnalysis.performMultiVariantTest([
        { name: 'Control', conversions: 100, sampleSize: 1000 },
      ])
    ).toThrow('At least 2 variants required');
  });

  it('returns overall test with chiSquare and degreesOfFreedom', () => {
    const result = StatisticalAnalysis.performMultiVariantTest(variants);
    expect(result.overallTest.chiSquare).toBeGreaterThanOrEqual(0);
    expect(result.overallTest.degreesOfFreedom).toBe(variants.length - 1);
  });

  it('pairwise comparisons count is n*(n-1)/2', () => {
    const result = StatisticalAnalysis.performMultiVariantTest(variants);
    const n = variants.length;
    expect(result.pairwiseComparisons).toHaveLength((n * (n - 1)) / 2);
  });

  it('variantData includes conversionRate', () => {
    const result = StatisticalAnalysis.performMultiVariantTest(variants);
    expect(result.variantData[0].conversionRate).toBeCloseTo(0.1, 5);
    expect(result.variantData[1].conversionRate).toBeCloseTo(0.12, 5);
  });

  it('bonferroniAlpha is correctly calculated', () => {
    const result = StatisticalAnalysis.performMultiVariantTest(variants);
    const n = variants.length;
    const pairs = (n * (n - 1)) / 2;
    expect(result.bonferroniAlpha).toBeCloseTo(0.05 / pairs, 10);
  });

  it('detects significance when variants differ a lot', () => {
    const bigDiff = [
      { name: 'Low', conversions: 10, sampleSize: 1000 },
      { name: 'High', conversions: 500, sampleSize: 1000 },
    ];
    const result = StatisticalAnalysis.performMultiVariantTest(bigDiff);
    expect(result.overallTest.isStatisticallySignificant).toBe(true);
  });

  it('overall p-value is between 0 and 1', () => {
    const result = StatisticalAnalysis.performMultiVariantTest(variants);
    expect(result.overallTest.pValue).toBeGreaterThanOrEqual(0);
    expect(result.overallTest.pValue).toBeLessThanOrEqual(1);
  });
});

// ============================================================================
// StatisticalAnalysis.calculateEffectSizes
// ============================================================================
describe('StatisticalAnalysis.calculateEffectSizes', () => {
  it('riskDifference is variantRate - controlRate', () => {
    const result = StatisticalAnalysis.calculateEffectSizes(0.1, 0.15);
    expect(result.riskDifference).toBeCloseTo(0.05, 10);
  });

  it('relativeRisk is variant / control', () => {
    const result = StatisticalAnalysis.calculateEffectSizes(0.1, 0.2);
    expect(result.relativeRisk).toBeCloseTo(2.0, 5);
  });

  it('relativeRisk is 0 when control is 0', () => {
    const result = StatisticalAnalysis.calculateEffectSizes(0, 0.2);
    expect(result.relativeRisk).toBe(0);
  });

  it('oddsRatio is 0 when control is 0', () => {
    const result = StatisticalAnalysis.calculateEffectSizes(0, 0.2);
    expect(result.oddsRatio).toBe(0);
  });

  it('oddsRatio is 0 when variant is 0', () => {
    const result = StatisticalAnalysis.calculateEffectSizes(0.1, 0);
    expect(result.oddsRatio).toBe(0);
  });

  it('oddsRatio is 1 when rates are equal', () => {
    const result = StatisticalAnalysis.calculateEffectSizes(0.2, 0.2);
    expect(result.oddsRatio).toBeCloseTo(1.0, 5);
  });

  it('cohensH is 0 when rates are equal', () => {
    const result = StatisticalAnalysis.calculateEffectSizes(0.3, 0.3);
    expect(result.cohensH).toBeCloseTo(0, 10);
  });

  it('nnt is null when riskDifference <= 0', () => {
    const result = StatisticalAnalysis.calculateEffectSizes(0.2, 0.1); // negative diff
    expect(result.numberNeededToTreat).toBeNull();
  });

  it('nnt is computed correctly for positive difference', () => {
    // riskDifference = 0.1 → NNT = round(1/0.1) = 10
    const result = StatisticalAnalysis.calculateEffectSizes(0.1, 0.2);
    expect(result.numberNeededToTreat).toBe(10);
  });
});
