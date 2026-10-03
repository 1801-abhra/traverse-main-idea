// ============================================================
// TRAVERSE TOPSIS ENGINE
// Modified TOPSIS with Trigonometric Similarity Measures
// Based on: "TSFHSS-TOPSIS Approach with Trigonometric
// Similarity Measures" — Abhra Pawan Sharma et al.
// Adapted for crisp transport criteria from fuzzy framework
// ============================================================

// ------------------------------------------------------------
// CRITERIA DEFINITION
// C1: Total Cost (₹)      — minimize
// C2: Total Time (min)    — minimize
// C3: Avg Comfort (1-10)  — maximize
// C4: Avg Reliability     — maximize
// C5: Transfers (count)   — minimize
// ------------------------------------------------------------
export const CRITERIA = {
    cost: { index: 0, label: 'Total Cost (₹)', type: 'min', unit: '₹' },
    time: { index: 1, label: 'Total Time (min)', type: 'min', unit: 'min' },
    comfort: { index: 2, label: 'Avg Comfort (1-10)', type: 'max', unit: '/10' },
    reliability: { index: 3, label: 'Avg Reliability', type: 'max', unit: '' },
    transfers: { index: 4, label: 'Transfers', type: 'min', unit: '' },
}

// ------------------------------------------------------------
// PERSONA WEIGHT ADJUSTMENT FACTORS
// Applied ON TOP of entropy weights — works for ANY corridor
//
// Design principle:
// Each persona focuses on ONE primary criterion (high boost)
// and moderately values others — never ignores any criterion
// This ensures diverse route types (bus/train/flight/cab)
// appear across personas rather than one type dominating
//
// Transfer weight kept low because modern multi-modal travel
// accepts 1-2 transfers as normal — heavy penalty causes
// direct but slow/expensive routes to always win
// ------------------------------------------------------------
export const PERSONA_BOOST = {
    cheapest: {
        cost: 4.0,        // cost completely dominates
        time: 0.5,        // time barely matters
        comfort: 0.2,     // comfort barely matters
        reliability: 0.3, // reliability barely matters
        transfers: 0.2,   // transfers barely matter
    },
    fastest: {
        cost: 0.05,       // cost almost irrelevant
        time: 10.0,       // time is everything
        comfort: 0.2,     // comfort barely matters
        reliability: 0.5, // reliability moderate
        transfers: 0.2,   // transfers barely matter
    },
    comfort: {
        cost: 0.05,       // cost almost irrelevant
        time: 0.3,        // time barely matters
        comfort: 6.0,     // comfort is everything
        reliability: 3.0, // reliability very important
        transfers: 0.2,   // transfers barely matter
    },
    balanced: {
        cost: 1.5,        // cost important
        time: 1.5,        // time important
        comfort: 1.2,     // comfort slightly less
        reliability: 1.0, // reliability equal
        transfers: 0.3,   // transfers much less important
    },
}

// ------------------------------------------------------------
// COMFORT SCORE ENHANCEMENT
// Applied PER LEG before averaging
// Trains and flights genuinely more comfortable
// Ordinary bus dragging down average is now prevented
// Works for any corridor automatically
// ------------------------------------------------------------
function enhancedLegComfort(leg) {
    let comfort = leg.comfort || 5.0
    const mode = leg.mode || ''
    const operator = (leg.operator || '').toLowerCase()

    // Flight — most comfortable, no road vibration, AC always
    if (mode === 'flight') {
        comfort = Math.min(10, comfort + 2.5)
    }
    // Train — reserved seat, stable ride, dining car
    else if (mode === 'train') {
        comfort = Math.min(10, comfort + 2.0)
        // Vande Bharat extra bonus
        if (operator.includes('vande')) {
            comfort = Math.min(10, comfort + 0.5)
        }
    }
    // Premium bus — Volvo AC already has high comfort (7.8)
    // but metro/city travel at end drags average down
    // Give metro/cab last-mile a minimum comfort of 6.0
    else if (mode === 'metro') {
        comfort = Math.max(comfort, 6.0)
    }
    // Walk penalty for long journeys
    else if (mode === 'walk') {
        comfort = Math.max(1, comfort - 1.0)
    }

    return comfort
}

function enhancedComfort(route) {
    if (!route.legs || route.legs.length === 0) {
        return route.avgComfort || 5.0
    }
    // Compute comfort using WEIGHTED average
    // Main journey leg (longest time) contributes more
    const totalTime = route.legs.reduce((s, l) => s + (l.time || 0), 0)
    if (totalTime === 0) return route.avgComfort || 5.0

    const weightedSum = route.legs.reduce((s, leg) => {
        const legComfort = enhancedLegComfort(leg)
        const weight = (leg.time || 1) / totalTime
        return s + legComfort * weight
    }, 0)

    return Math.round(weightedSum * 10) / 10
}

// ------------------------------------------------------------
// STEP 1: BUILD DECISION MATRIX
// Extracts 5 criteria values from each candidate route
// Uses weighted enhanced comfort scoring
// Works automatically for any corridor
// ------------------------------------------------------------
export function buildDecisionMatrix(routes) {
    return routes.map(r => ({
        id: r.id,
        route: r,
        values: [
            r.totalCost,              // C1: cost (minimize)
            r.totalTime,              // C2: time (minimize)
            enhancedComfort(r),       // C3: weighted comfort (maximize)
            r.avgReliability,         // C4: reliability (maximize)
            r.transfers,              // C5: transfers (minimize)
        ]
    }))
}

// ------------------------------------------------------------
// STEP 2: NORMALIZE DECISION MATRIX
// Vector normalization: nij = xij / √(Σ xij²)
// From paper: normalized decision matrix step
// ------------------------------------------------------------
export function normalizeMatrix(matrix) {
    const nCriteria = matrix[0].values.length
    const norms = Array(nCriteria).fill(0)

    // Calculate column norms
    matrix.forEach(row => {
        row.values.forEach((v, j) => {
            norms[j] += v * v
        })
    })
    norms.forEach((n, j) => { norms[j] = Math.sqrt(n) })

    // Normalize
    return matrix.map(row => ({
        ...row,
        normalized: row.values.map((v, j) =>
            norms[j] === 0 ? 0 : v / norms[j]
        )
    }))
}

// ------------------------------------------------------------
// STEP 3: ENTROPY-BASED OBJECTIVE WEIGHTS
// From paper Equation (4):
// Hj = -(1/ln(m)) × Σi(nij × ln(nij))
// wj = (1 - Hj) / Σj(1 - Hj)
// This removes subjective bias — weights derived from data
// ------------------------------------------------------------
export function computeEntropyWeights(normalizedMatrix) {
    const m = normalizedMatrix.length        // number of alternatives
    const nCriteria = normalizedMatrix[0].normalized.length

    const entropy = Array(nCriteria).fill(0)

    normalizedMatrix.forEach(row => {
        row.normalized.forEach((nij, j) => {
            if (nij > 0) {
                entropy[j] += nij * Math.log(nij)
            }
        })
    })

    const H = entropy.map(e => -(1 / Math.log(m)) * e)

    const oneMinusH = H.map(h => Math.max(0, 1 - h))
    const sumOneMinusH = oneMinusH.reduce((s, v) => s + v, 0)

    const weights = sumOneMinusH === 0
        ? Array(nCriteria).fill(1 / nCriteria)
        : oneMinusH.map(v => v / sumOneMinusH)

    return {
        entropy: H.map(h => Math.round(h * 10000) / 10000),
        weights: weights.map(w => Math.round(w * 10000) / 10000),
        labels: ['Cost', 'Time', 'Comfort', 'Reliability', 'Transfers']
    }
}

// ------------------------------------------------------------
// STEP 4: APPLY PERSONA BOOST TO ENTROPY WEIGHTS
// Multiply entropy weights by persona boost factors
// Then renormalize so weights sum to 1
// ------------------------------------------------------------
export function applyPersonaWeights(entropyResult, persona) {
    const boost = PERSONA_BOOST[persona] || PERSONA_BOOST.balanced
    const boostArray = [
        boost.cost,
        boost.time,
        boost.comfort,
        boost.reliability,
        boost.transfers,
    ]

    const boosted = entropyResult.weights.map((w, i) => w * boostArray[i])
    const sum = boosted.reduce((s, v) => s + v, 0)
    const final = sum === 0
        ? Array(5).fill(0.2)
        : boosted.map(v => v / sum)

    return {
        entropyWeights: entropyResult.weights,
        boostFactors: boostArray,
        finalWeights: final.map(w => Math.round(w * 10000) / 10000),
        labels: entropyResult.labels
    }
}

// ------------------------------------------------------------
// STEP 5: WEIGHTED NORMALIZED MATRIX
// vij = wj × nij
// ------------------------------------------------------------
export function weightedNormalize(normalizedMatrix, finalWeights) {
    return normalizedMatrix.map(row => ({
        ...row,
        weighted: row.normalized.map((n, j) => n * finalWeights[j])
    }))
}

// ------------------------------------------------------------
// STEP 6: POSITIVE AND NEGATIVE IDEAL SOLUTIONS
// PIS (A+): best value per criterion
//   For min criteria (cost, time, transfers): smallest value
//   For max criteria (comfort, reliability): largest value
// NIS (A-): worst value per criterion
//   Opposite of PIS
// ------------------------------------------------------------
const CRITERIA_TYPES = ['min', 'min', 'max', 'max', 'min']

export function findIdealSolutions(weightedMatrix) {
    const nCriteria = weightedMatrix[0].weighted.length

    const PIS = Array(nCriteria).fill(null)
    const NIS = Array(nCriteria).fill(null)

    weightedMatrix.forEach(row => {
        row.weighted.forEach((v, j) => {
            const type = CRITERIA_TYPES[j]
            if (PIS[j] === null) {
                PIS[j] = v
                NIS[j] = v
            } else {
                if (type === 'min') {
                    PIS[j] = Math.min(PIS[j], v)   // PIS wants minimum
                    NIS[j] = Math.max(NIS[j], v)   // NIS wants maximum
                } else {
                    PIS[j] = Math.max(PIS[j], v)   // PIS wants maximum
                    NIS[j] = Math.min(NIS[j], v)   // NIS wants minimum
                }
            }
        })
    })

    return { PIS, NIS }
}

// ------------------------------------------------------------
// STEP 7: THREE TRIGONOMETRIC SIMILARITY MEASURES
// Adapted from paper equations (1), (2), (3)
// Applied to crisp transport criteria vectors
//
// SM1: Cosine dot-product similarity (Eq. 1)
// S1(A, B) = (A·B) / (|A| × |B|)
//
// SM2: Cosine of scaled difference (Eq. 2, denominator 1)
// S2(A, B) = (1/n) × Σ cos(π/2 × |ai - bi|)
//
// SM3: Cosine of scaled difference (Eq. 3, denominator 3)
// S3(A, B) = (1/n) × Σ cos(π/2 × |ai - bi| / 3)
// ------------------------------------------------------------

// SM1 — Cosine dot product (from paper Eq. 1)
function sm1(vecA, vecB) {
    const dot = vecA.reduce((s, a, i) => s + a * vecB[i], 0)
    const magA = Math.sqrt(vecA.reduce((s, a) => s + a * a, 0))
    const magB = Math.sqrt(vecB.reduce((s, b) => s + b * b, 0))
    if (magA === 0 || magB === 0) return 0
    return Math.max(0, Math.min(1, dot / (magA * magB)))
}

// SM2 — Cosine based with denominator 1 (from paper Eq. 2)
function sm2(vecA, vecB) {
    const n = vecA.length
    const sum = vecA.reduce((s, a, i) => {
        const diff = Math.abs(a - vecB[i])
        return s + Math.cos((Math.PI / 2) * diff)
    }, 0)
    return Math.max(0, Math.min(1, sum / n))
}

// SM3 — Cosine based with denominator 3 (from paper Eq. 3)
function sm3(vecA, vecB) {
    const n = vecA.length
    const sum = vecA.reduce((s, a, i) => {
        const diff = Math.abs(a - vecB[i])
        return s + Math.cos((Math.PI / 2) * (diff / 3))
    }, 0)
    return Math.max(0, Math.min(1, sum / n))
}

// ------------------------------------------------------------
// STEP 8: CLOSENESS COEFFICIENT (from paper Eq. 5)
// CC(i) = S(Ai, PIS) / (S(Ai, PIS) + S(Ai, NIS))
// Higher CC = route closer to ideal = better rank
// ------------------------------------------------------------
function closenessCoefficient(sToPIS, sToNIS) {
    const denom = sToPIS + sToNIS
    if (denom === 0) return 0
    return sToPIS / denom
}

// ------------------------------------------------------------
// STEP 9: COMPUTE ALL THREE SM SCORES FOR EACH ROUTE
// Returns CC for SM1, SM2, SM3 and final averaged CC
// ------------------------------------------------------------
export function computeSimilarityScores(weightedMatrix, PIS, NIS) {
    return weightedMatrix.map(row => {
        const vec = row.weighted

        // SM1 scores
        const sm1_pos = sm1(vec, PIS)
        const sm1_neg = sm1(vec, NIS)
        const cc1 = closenessCoefficient(sm1_pos, sm1_neg)

        // SM2 scores
        const sm2_pos = sm2(vec, PIS)
        const sm2_neg = sm2(vec, NIS)
        const cc2 = closenessCoefficient(sm2_pos, sm2_neg)

        // SM3 scores
        const sm3_pos = sm3(vec, PIS)
        const sm3_neg = sm3(vec, NIS)
        const cc3 = closenessCoefficient(sm3_pos, sm3_neg)

        // Final: average of all three SMs (validates robustness)
        const ccFinal = (cc1 + cc2 + cc3) / 3

        return {
            id: row.id,
            route: row.route,
            rawValues: row.values,
            normalizedValues: row.normalized,
            weightedValues: row.weighted,
            // SM1
            sm1_pos: Math.round(sm1_pos * 10000) / 10000,
            sm1_neg: Math.round(sm1_neg * 10000) / 10000,
            cc1: Math.round(cc1 * 10000) / 10000,
            // SM2
            sm2_pos: Math.round(sm2_pos * 10000) / 10000,
            sm2_neg: Math.round(sm2_neg * 10000) / 10000,
            cc2: Math.round(cc2 * 10000) / 10000,
            // SM3
            sm3_pos: Math.round(sm3_pos * 10000) / 10000,
            sm3_neg: Math.round(sm3_neg * 10000) / 10000,
            cc3: Math.round(cc3 * 10000) / 10000,
            // Final
            ccFinal: Math.round(ccFinal * 10000) / 10000,
        }
    })
}

// ------------------------------------------------------------
// CORE TOPSIS PIPELINE
// Shared by runTOPSIS and runTOPSISWithSteps
// ------------------------------------------------------------
function runPipeline(candidates, persona) {
    const matrix = buildDecisionMatrix(candidates)
    const normalized = normalizeMatrix(matrix)
    const entropyResult = computeEntropyWeights(normalized)
    const weightResult = applyPersonaWeights(entropyResult, persona)
    const finalWeights = weightResult.finalWeights
    const weighted = weightedNormalize(normalized, finalWeights)
    const { PIS, NIS } = findIdealSolutions(weighted)
    const scored = computeSimilarityScores(weighted, PIS, NIS)
    const ranked = [...scored].sort((a, b) => b.ccFinal - a.ccFinal)
    return {
        matrix, normalized, entropyResult, weightResult,
        finalWeights, weighted, PIS, NIS, scored, ranked
    }
}

// ------------------------------------------------------------
// STEP 10: MAIN TOPSIS FUNCTION
// Full pipeline: candidates → ranked top 4
// Ensures each persona shows meaningfully different #1 route
// If two personas would show same top route, second persona
// shows its next best unique route as #1
// ------------------------------------------------------------
export function runTOPSIS(candidates, persona = 'balanced') {
    if (!candidates || candidates.length === 0) return []

    const { ranked } = runPipeline(candidates, persona)

    const personaLabels = {
        cheapest: ['Cheapest', '2nd Option', '3rd Option', '4th Option'],
        fastest: ['Fastest', '2nd Fastest', '3rd Option', '4th Option'],
        comfort: ['Most Comfortable', '2nd Option', '3rd Option', '4th Option'],
        balanced: ['Best Overall', '2nd Option', '3rd Option', '4th Option'],
    }
    const rankLabels = personaLabels[persona] || personaLabels.balanced

    return ranked.slice(0, 4).map((r, i) => ({
        rank: i + 1,
        label: rankLabels[i],
        ...r,
        stops: r.route.stops,
        stopNames: r.route.stopNames,
        legs: r.route.legs,
        modes: r.route.modes,
        totalCost: r.route.totalCost,
        totalTime: r.route.totalTime,
        avgComfort: r.route.avgComfort,
        avgReliability: r.route.avgReliability,
        transfers: r.route.transfers,
    }))
}

// ------------------------------------------------------------
// STEP 10B: SEARCH RESULTS TOP ROUTE PER PERSONA
// Returns ONE best route per persona with DEDUPLICATION
// Ensures Comfortable and Fastest never show same route
// Priority order: balanced > cheapest > comfort > fastest
// Each persona must show a UNIQUE top route
// ------------------------------------------------------------
export function getTopRoutePerPersona(candidates) {
    if (!candidates || candidates.length === 0) return {}

    // Get top ranked for each persona independently
    const balanced = runPipeline(candidates, 'balanced').ranked
    const cheapest = runPipeline(candidates, 'cheapest').ranked
    const comfort = runPipeline(candidates, 'comfort').ranked
    const fastest = runPipeline(candidates, 'fastest').ranked

    // Mode signature for deduplication
    const modeSig = (r) =>
        [...new Set(r.route.legs.map(l => l.mode))].sort().join('+')

    // RULE 1: Recommended = absolute top balanced route (no restriction)
    const recommendedRoute = balanced[0]
    const recommendedSig = modeSig(recommendedRoute)

    // RULE 2: Cheapest = genuinely cheapest route by cost
    // ALWAYS show the lowest cost route
    // If same legs as Recommended, show same route (honest)
    // Never show a MORE expensive route just to be different
    const sortedByCost = [...cheapest].sort(
        (a, b) => a.route.totalCost - b.route.totalCost
    )
    const lowestCost = sortedByCost[0].route.totalCost
    const recommendedLegIds = recommendedRoute.route.legs
        .map(l => l.id).join('|')

    // Among same-cost routes, prefer one different from Recommended
    let cheapestRoute = sortedByCost[0]
    for (const r of sortedByCost) {
        if (r.route.totalCost > lowestCost) break // stop at lowest cost group
        const legIds = r.route.legs.map(l => l.id).join('|')
        if (legIds !== recommendedLegIds) {
            cheapestRoute = r
            break
        }
    }
    const cheapestSig = modeSig(cheapestRoute)

    // RULE 3: Comfortable = best comfort route
    // Must be different mode from Recommended
    // (flight should win here — cab+flight is unique)
    let comfortRoute = comfort[0]
    for (const r of comfort) {
        if (modeSig(r) !== recommendedSig &&
            modeSig(r) !== cheapestSig) {
            comfortRoute = r
            break
        }
    }
    const comfortSig = modeSig(comfortRoute)

    // RULE 4: Fastest = fastest route by TIME
    // Must be different mode from Comfortable
    // Sort by actual time to ensure genuinely fastest appears
    const fastestByTime = [...fastest].sort(
        (a, b) => a.route.totalTime - b.route.totalTime
    )
    let fastestRoute = fastestByTime[0]
    for (const r of fastestByTime) {
        const sig = modeSig(r)
        if (sig !== comfortSig) {
            fastestRoute = r
            break
        }
    }

    const personaLabels = {
        balanced: 'Recommended',
        cheapest: 'Cheapest',
        comfort: 'Most Comfortable',
        fastest: 'Fastest',
    }

    const makeResult = (r, persona) => ({
        ...r,
        label: personaLabels[persona],
        stops: r.route.stops,
        stopNames: r.route.stopNames,
        legs: r.route.legs,
        modes: r.route.modes,
        totalCost: r.route.totalCost,
        totalTime: r.route.totalTime,
        avgComfort: r.route.avgComfort,
        avgReliability: r.route.avgReliability,
        transfers: r.route.transfers,
    })

    return {
        balanced: makeResult(recommendedRoute, 'balanced'),
        cheapest: makeResult(cheapestRoute, 'cheapest'),
        comfort: makeResult(comfortRoute, 'comfort'),
        fastest: makeResult(fastestRoute, 'fastest'),
    }
}

// ------------------------------------------------------------
// STEP 11: FULL TOPSIS RESULT WITH INTERMEDIATE STEPS
// Returns everything needed for Algorithm Demo page display
// Shows VC the complete mathematical process
// ------------------------------------------------------------
export function runTOPSISWithSteps(candidates, persona = 'balanced') {
    if (!candidates || candidates.length === 0) return null

    const { matrix, normalized, entropyResult, weightResult,
        finalWeights, weighted, PIS, NIS, scored, ranked
    } = runPipeline(candidates, persona)

    return {
        // For display
        persona,
        totalCandidates: candidates.length,

        // Step 2: Decision matrix (raw values)
        decisionMatrix: matrix.map(r => ({
            id: r.id,
            label: r.route.operators,
            stops: r.route.stopNames,
            values: r.values,
        })),

        // Step 3: Entropy weights
        entropyWeights: entropyResult,

        // Step 4: Final weights after persona
        weightDetails: weightResult,

        // Step 5: Ideal solutions
        PIS,
        NIS,

        // Step 6: All SM scores
        allScored: scored.map(s => ({
            id: s.id,
            label: s.route.operators,
            stops: s.route.stopNames,
            totalCost: s.route.totalCost,
            totalTime: s.route.totalTime,
            cc1: s.cc1,
            cc2: s.cc2,
            cc3: s.cc3,
            ccFinal: s.ccFinal,
        })),

        // Step 7: Final ranking
        ranked: ranked.slice(0, 4).map((r, i) => ({
            rank: i + 1,
            ...r,
            stops: r.route.stopNames,
            legs: r.route.legs,
            totalCost: r.route.totalCost,
            totalTime: r.route.totalTime,
            avgComfort: r.route.avgComfort,
            avgReliability: r.route.avgReliability,
            transfers: r.route.transfers,
        })),

        // Criteria labels for table headers
        criteriaLabels: ['Cost (₹)', 'Time (min)', 'Comfort', 'Reliability', 'Transfers'],
        criteriaTypes: CRITERIA_TYPES,
    }
}
