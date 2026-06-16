/**
 * Tests for src/utils/filter-validation.ts
 *
 * Covers: validateAndMigrateFilters, getDefaultFilterState, hasActiveFilters,
 *         sanitizeFilterValues, filtersToUrlParams, urlParamsToFilters
 */

import { describe, it, expect } from 'vitest'
import {
  validateAndMigrateFilters,
  getDefaultFilterState,
  hasActiveFilters,
  sanitizeFilterValues,
  filtersToUrlParams,
  urlParamsToFilters,
  FilterState,
} from '../filter-validation'

// ---------------------------------------------------------------------------
// getDefaultFilterState
// ---------------------------------------------------------------------------

describe('getDefaultFilterState', () => {
  it('returns all arrays empty and strings empty', () => {
    const state = getDefaultFilterState()
    expect(state.genres).toEqual([])
    expect(state.formats).toEqual([])
    expect(state.developmentStages).toEqual([])
    expect(state.searchQuery).toBe('')
    expect(state.creatorTypes).toEqual([])
  })

  it('returns optional booleans as undefined', () => {
    const state = getDefaultFilterState()
    expect(state.hasNDA).toBeUndefined()
    expect(state.seekingInvestment).toBeUndefined()
  })

  it('returns budget fields as undefined', () => {
    const state = getDefaultFilterState()
    expect(state.budgetMin).toBeUndefined()
    expect(state.budgetMax).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// validateAndMigrateFilters
// ---------------------------------------------------------------------------

describe('validateAndMigrateFilters', () => {
  it('returns default state for null input', () => {
    expect(validateAndMigrateFilters(null)).toEqual(getDefaultFilterState())
  })

  it('returns default state for undefined input', () => {
    expect(validateAndMigrateFilters(undefined)).toEqual(getDefaultFilterState())
  })

  it('returns default state for primitive string', () => {
    expect(validateAndMigrateFilters('some string')).toEqual(getDefaultFilterState())
  })

  it('returns default state for a number', () => {
    expect(validateAndMigrateFilters(42)).toEqual(getDefaultFilterState())
  })

  it('migrates valid stored filters intact', () => {
    const stored = {
      genres: ['Action', 'Drama'],
      formats: ['Feature'],
      developmentStages: ['Development'],
      searchQuery: 'horror film',
      creatorTypes: ['writer'],
      hasNDA: true,
      seekingInvestment: false,
      budgetMin: 1000,
      budgetMax: 50000,
    }
    const result = validateAndMigrateFilters(stored)
    expect(result.genres).toEqual(['Action', 'Drama'])
    expect(result.formats).toEqual(['Feature'])
    expect(result.searchQuery).toBe('horror film')
    expect(result.hasNDA).toBe(true)
    expect(result.seekingInvestment).toBe(false)
    expect(result.budgetMin).toBe(1000)
    expect(result.budgetMax).toBe(50000)
  })

  it('replaces non-array genres with empty array', () => {
    const result = validateAndMigrateFilters({ genres: 'Action' })
    expect(result.genres).toEqual([])
  })

  it('replaces non-string searchQuery with empty string', () => {
    const result = validateAndMigrateFilters({ searchQuery: 123 })
    expect(result.searchQuery).toBe('')
  })

  it('replaces non-boolean hasNDA with undefined', () => {
    const result = validateAndMigrateFilters({ hasNDA: 'yes' })
    expect(result.hasNDA).toBeUndefined()
  })

  it('replaces non-boolean seekingInvestment with undefined', () => {
    const result = validateAndMigrateFilters({ seekingInvestment: 1 })
    expect(result.seekingInvestment).toBeUndefined()
  })

  it('rejects negative budgetMin (sets to undefined)', () => {
    const result = validateAndMigrateFilters({ budgetMin: -100 })
    expect(result.budgetMin).toBeUndefined()
  })

  it('accepts zero as a valid budgetMin', () => {
    const result = validateAndMigrateFilters({ budgetMin: 0 })
    expect(result.budgetMin).toBe(0)
  })

  it('rejects zero budgetMax (must be > 0)', () => {
    const result = validateAndMigrateFilters({ budgetMax: 0 })
    expect(result.budgetMax).toBeUndefined()
  })

  it('rejects non-number budgetMin', () => {
    const result = validateAndMigrateFilters({ budgetMin: '5000' })
    expect(result.budgetMin).toBeUndefined()
  })

  it('migrates partially valid stored object (fills in missing keys with defaults)', () => {
    const result = validateAndMigrateFilters({ genres: ['Thriller'] })
    expect(result.genres).toEqual(['Thriller'])
    expect(result.formats).toEqual([])
    expect(result.searchQuery).toBe('')
  })
})

// ---------------------------------------------------------------------------
// hasActiveFilters
// ---------------------------------------------------------------------------

describe('hasActiveFilters', () => {
  it('returns false for the default filter state', () => {
    expect(hasActiveFilters(getDefaultFilterState())).toBe(false)
  })

  it('returns true when genres are set', () => {
    const filters = { ...getDefaultFilterState(), genres: ['Action'] }
    expect(hasActiveFilters(filters)).toBe(true)
  })

  it('returns true when searchQuery is non-empty', () => {
    const filters = { ...getDefaultFilterState(), searchQuery: 'space opera' }
    expect(hasActiveFilters(filters)).toBe(true)
  })

  it('returns true when hasNDA is true', () => {
    const filters = { ...getDefaultFilterState(), hasNDA: true }
    expect(hasActiveFilters(filters)).toBe(true)
  })

  it('returns true when hasNDA is false (explicitly set)', () => {
    const filters = { ...getDefaultFilterState(), hasNDA: false }
    expect(hasActiveFilters(filters)).toBe(true)
  })

  it('returns true when seekingInvestment is set', () => {
    const filters = { ...getDefaultFilterState(), seekingInvestment: false }
    expect(hasActiveFilters(filters)).toBe(true)
  })

  it('returns true when budgetMin is > 0', () => {
    const filters = { ...getDefaultFilterState(), budgetMin: 1000 }
    expect(hasActiveFilters(filters)).toBe(true)
  })

  it('returns false when budgetMin is 0 (not > 0)', () => {
    // budgetMin === 0 means "no filter applied" per hasActiveFilters logic
    const filters = { ...getDefaultFilterState(), budgetMin: 0 }
    expect(hasActiveFilters(filters)).toBe(false)
  })

  it('returns true when budgetMax is < 999999999', () => {
    const filters = { ...getDefaultFilterState(), budgetMax: 50000 }
    expect(hasActiveFilters(filters)).toBe(true)
  })

  it('returns false when budgetMax is 999999999 (sentinel value)', () => {
    const filters = { ...getDefaultFilterState(), budgetMax: 999999999 }
    expect(hasActiveFilters(filters)).toBe(false)
  })

  it('returns true when formats are set', () => {
    const filters = { ...getDefaultFilterState(), formats: ['Documentary'] }
    expect(hasActiveFilters(filters)).toBe(true)
  })

  it('returns true when creatorTypes are set', () => {
    const filters = { ...getDefaultFilterState(), creatorTypes: ['writer'] }
    expect(hasActiveFilters(filters)).toBe(true)
  })

  it('returns true when developmentStages are set', () => {
    const filters = { ...getDefaultFilterState(), developmentStages: ['Pre-production'] }
    expect(hasActiveFilters(filters)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// sanitizeFilterValues
// ---------------------------------------------------------------------------

describe('sanitizeFilterValues', () => {
  it('removes < and > from searchQuery', () => {
    const filters = { ...getDefaultFilterState(), searchQuery: '<script>alert(1)</script>' }
    const result = sanitizeFilterValues(filters)
    expect(result.searchQuery).not.toContain('<')
    expect(result.searchQuery).not.toContain('>')
  })

  it('removes single quotes from searchQuery', () => {
    const filters = { ...getDefaultFilterState(), searchQuery: "O'Brien's pitch" }
    const result = sanitizeFilterValues(filters)
    expect(result.searchQuery).not.toContain("'")
  })

  it('removes double quotes from searchQuery', () => {
    const filters = { ...getDefaultFilterState(), searchQuery: '"quoted"' }
    const result = sanitizeFilterValues(filters)
    expect(result.searchQuery).not.toContain('"')
  })

  it('trims whitespace from searchQuery', () => {
    const filters = { ...getDefaultFilterState(), searchQuery: '  thriller  ' }
    const result = sanitizeFilterValues(filters)
    expect(result.searchQuery).toBe('thriller')
  })

  it('sanitizes items in genres array', () => {
    const filters = { ...getDefaultFilterState(), genres: ['<Action>', "Drama'"] }
    const result = sanitizeFilterValues(filters)
    expect(result.genres[0]).toBe('Action')
    expect(result.genres[1]).toBe('Drama')
  })

  it('filters out empty strings from arrays after sanitization', () => {
    // A genre that is only XSS chars will become empty after sanitization
    const filters = { ...getDefaultFilterState(), genres: ['<>'] }
    const result = sanitizeFilterValues(filters)
    expect(result.genres).toEqual([])
  })

  it('preserves budget and boolean fields unchanged', () => {
    const filters: FilterState = {
      ...getDefaultFilterState(),
      budgetMin: 1000,
      budgetMax: 50000,
      hasNDA: true,
      seekingInvestment: false,
    }
    const result = sanitizeFilterValues(filters)
    expect(result.budgetMin).toBe(1000)
    expect(result.budgetMax).toBe(50000)
    expect(result.hasNDA).toBe(true)
    expect(result.seekingInvestment).toBe(false)
  })

  it('sanitizes all array fields (formats, developmentStages, creatorTypes)', () => {
    const filters: FilterState = {
      ...getDefaultFilterState(),
      formats: ['<Feature>'],
      developmentStages: ["'Dev'"],
      creatorTypes: ['"writer"'],
    }
    const result = sanitizeFilterValues(filters)
    expect(result.formats[0]).toBe('Feature')
    expect(result.developmentStages[0]).toBe('Dev')
    expect(result.creatorTypes[0]).toBe('writer')
  })
})

// ---------------------------------------------------------------------------
// filtersToUrlParams / urlParamsToFilters (round-trip)
// ---------------------------------------------------------------------------

describe('filtersToUrlParams', () => {
  it('adds genre params for each genre', () => {
    const filters = { ...getDefaultFilterState(), genres: ['Action', 'Drama'] }
    const params = filtersToUrlParams(filters)
    expect(params.getAll('genre')).toEqual(['Action', 'Drama'])
  })

  it('adds q param for searchQuery', () => {
    const filters = { ...getDefaultFilterState(), searchQuery: 'horror' }
    const params = filtersToUrlParams(filters)
    expect(params.get('q')).toBe('horror')
  })

  it('does not add q param when searchQuery is empty', () => {
    const params = filtersToUrlParams(getDefaultFilterState())
    expect(params.has('q')).toBe(false)
  })

  it('adds hasNDA param when set', () => {
    const filters = { ...getDefaultFilterState(), hasNDA: true }
    const params = filtersToUrlParams(filters)
    expect(params.get('hasNDA')).toBe('true')
  })

  it('does not add hasNDA param when undefined', () => {
    const params = filtersToUrlParams(getDefaultFilterState())
    expect(params.has('hasNDA')).toBe(false)
  })

  it('adds budget params when set', () => {
    const filters = { ...getDefaultFilterState(), budgetMin: 1000, budgetMax: 50000 }
    const params = filtersToUrlParams(filters)
    expect(params.get('budgetMin')).toBe('1000')
    expect(params.get('budgetMax')).toBe('50000')
  })

  it('does not add budget params when undefined', () => {
    const params = filtersToUrlParams(getDefaultFilterState())
    expect(params.has('budgetMin')).toBe(false)
    expect(params.has('budgetMax')).toBe(false)
  })
})

describe('urlParamsToFilters', () => {
  it('reads genre params into genres array', () => {
    const params = new URLSearchParams('genre=Action&genre=Drama')
    const filters = urlParamsToFilters(params)
    expect(filters.genres).toEqual(['Action', 'Drama'])
  })

  it('reads q param into searchQuery', () => {
    const params = new URLSearchParams('q=horror')
    const filters = urlParamsToFilters(params)
    expect(filters.searchQuery).toBe('horror')
  })

  it('sets searchQuery to empty string when q is absent', () => {
    const filters = urlParamsToFilters(new URLSearchParams())
    expect(filters.searchQuery).toBe('')
  })

  it('reads hasNDA=true as boolean true', () => {
    const filters = urlParamsToFilters(new URLSearchParams('hasNDA=true'))
    expect(filters.hasNDA).toBe(true)
  })

  it('reads hasNDA=false as boolean false', () => {
    const filters = urlParamsToFilters(new URLSearchParams('hasNDA=false'))
    expect(filters.hasNDA).toBe(false)
  })

  it('sets hasNDA to undefined when absent', () => {
    const filters = urlParamsToFilters(new URLSearchParams())
    expect(filters.hasNDA).toBeUndefined()
  })

  it('reads budget params as numbers', () => {
    const filters = urlParamsToFilters(new URLSearchParams('budgetMin=1000&budgetMax=50000'))
    expect(filters.budgetMin).toBe(1000)
    expect(filters.budgetMax).toBe(50000)
  })

  it('sets budget to undefined when absent', () => {
    const filters = urlParamsToFilters(new URLSearchParams())
    expect(filters.budgetMin).toBeUndefined()
    expect(filters.budgetMax).toBeUndefined()
  })
})

describe('filtersToUrlParams / urlParamsToFilters round-trip', () => {
  it('round-trips a fully populated filter state', () => {
    const original: FilterState = {
      genres: ['Action', 'Drama'],
      formats: ['Feature'],
      developmentStages: ['Development'],
      searchQuery: 'thriller',
      creatorTypes: ['writer'],
      hasNDA: true,
      seekingInvestment: false,
      budgetMin: 5000,
      budgetMax: 100000,
    }
    const params = filtersToUrlParams(original)
    const restored = urlParamsToFilters(params)
    expect(restored.genres).toEqual(original.genres)
    expect(restored.formats).toEqual(original.formats)
    expect(restored.searchQuery).toBe(original.searchQuery)
    expect(restored.hasNDA).toBe(original.hasNDA)
    expect(restored.seekingInvestment).toBe(original.seekingInvestment)
    expect(restored.budgetMin).toBe(original.budgetMin)
    expect(restored.budgetMax).toBe(original.budgetMax)
  })

  it('round-trips the default filter state', () => {
    const original = getDefaultFilterState()
    const params = filtersToUrlParams(original)
    const restored = urlParamsToFilters(params)
    expect(restored.genres).toEqual([])
    expect(restored.searchQuery).toBe('')
    expect(restored.hasNDA).toBeUndefined()
  })
})
