/**
 * frobenius-number.ts - Frobenius Number via the Apery Set.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Given a set of positive denominations with greatest common divisor one, the
 * Frobenius number is the largest integer that cannot be formed as a
 * nonnegative combination of them. The algorithm runs Dijkstra on the
 * residues modulo the smallest coin to find, for every residue, the smallest
 * representable number in that residue class. The largest of those minima
 * minus the modulus is the Frobenius number.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m * c log m) for modulus m and c coins
 *   Space: O(m) for the residue distances
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the smallest representable value found for each residue.
 *   - The residue currently being relaxed is highlighted.
 *   - The final frame reports the Frobenius number, or a sentinel when the
 *     denominations share a common factor and no such number exists.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface FrobeniusInput {
    coins?: number[];
}

function bars(distances: number[], current: number, done: boolean): VisualEntity[] {
    return distances.map((value, residue) => ({
        id: `bar-${residue}`,
        type: "bar" as const,
        label: Number.isFinite(value) ? String(value) : "-",
        value: Number.isFinite(value) ? value : 0,
        state: (done ? "sorted" : residue === current ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { residue, index: residue },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as FrobeniusInput | null) ?? {};
    const raw = Array.isArray(task.coins) ? task.coins.filter((c) => Number.isInteger(c) && c > 0) : [];
    const coins = Array.from(new Set(raw.length > 0 ? raw : [6, 9, 20])).sort((x, y) => x - y);
    const modulus = coins[0] ?? 1;
    const distances = new Array<number>(modulus).fill(Infinity);
    distances[0] = 0;
    const visited = new Array<boolean>(modulus).fill(false);
    let step = 0;

    yield {
        stepNumber: step,
        entities: bars(distances, -1, false),
        edges: [],
        description: `Find the Frobenius number of denominations [${coins.join(",")}] using residues modulo ${modulus}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { coins, modulus, count: modulus },
    };
    step += 1;

    for (let iteration = 0; iteration < modulus; iteration += 1) {
        let current = -1;
        for (let residue = 0; residue < modulus; residue += 1) {
            if (!visited[residue] && (current === -1 || (distances[residue] ?? Infinity) < (distances[current] ?? Infinity))) {
                current = residue;
            }
        }
        if (current === -1 || !Number.isFinite(distances[current])) {
            break;
        }
        visited[current] = true;
        for (const coin of coins) {
            const next = (current + coin) % modulus;
            const candidate = (distances[current] ?? Infinity) + coin;
            if (candidate < (distances[next] ?? Infinity)) {
                distances[next] = candidate;
            }
        }
        yield {
            stepNumber: step,
            entities: bars(distances, current, false),
            edges: [],
            description: `Settle residue ${current}: smallest representable value there is ${distances[current]}; relax its coin-neighbors.`,
            codeLineNumber: distances[current] === 0 ? 2 : 3,
            layout: "array",
            meta: { coins, modulus, count: modulus, residue: current, distance: distances[current] },
        };
        step += 1;
    }

    const unreachable = distances.some((value) => !Number.isFinite(value));
    const maximum = unreachable ? 0 : Math.max(...distances);
    const result = unreachable ? -1 : maximum - modulus;
    yield {
        stepNumber: step,
        entities: bars(distances, -1, true),
        edges: [],
        description: unreachable
            ? "No Frobenius number exists because the denominations share a common factor; return the sentinel -1."
            : `Done: the Frobenius number is ${result}, the largest nonrepresentable integer.`,
        codeLineNumber: unreachable ? 5 : 4,
        layout: "array",
        meta: { coins, modulus, count: modulus, result, aperyMax: maximum, exists: !unreachable },
    };
}

const module: AlgorithmModule = {
    id: "frobenius-number",
    name: "Frobenius Number (Apery Set)",
    category: "math",
    complexity: { time: "O(m*c log m)", space: "O(m)" },
    defaultInput: { coins: [6, 9, 20] },
    visualType: "array",
    run,
    pseudocode: [
        "let m be the smallest denomination and set dist[0] = 0, others infinite",
        "repeat until every residue is settled",
        "pick the unsettled residue with the smallest known distance",
        "for each coin relax the residue plus that coin modulo m",
        "the Apery set is the list of settled distances",
        "if some residue stays infinite, no Frobenius number exists",
        "otherwise return max(dist) - m",
    ],
    education: {
        intuition:
            "Instead of testing every integer for representability, look only at residues modulo the smallest coin. Once you know the smallest reachable value in each residue class, every larger value in that class is reachable by adding more of that coin. The last gap before each class becomes fully reachable is captured by the largest of those smallest values.",
        invariants: [
            "dist[r] is always the smallest representable value found so far in residue class r.",
            "Once a residue is settled by Dijkstra, its distance is final and minimal.",
            "The largest distance in the Apery set determines the last possible nonrepresentable value.",
        ],
        correctness:
            "Dijkstra is correct because all edge weights equal coin values and are positive, so the first time a residue is extracted its distance is the true minimum representable value in that class. Adding the smallest coin keeps the residue unchanged and increases the value, so every number at least dist[r] in class r is representable while dist[r] - m is not. The largest such gap across classes is exactly the Frobenius number, and if a residue stays infinite the gcd exceeds one and no finite Frobenius number exists.",
        complexityRationale:
            "There are m residues and each extraction relaxes c coins, giving O(m times c log m) with a binary heap or O(m times c) with a linear scan for small m. Only one distance per residue is stored, so space is O(m).",
        uses: [
            "Solving coin problems and numerical semigroup membership",
            "Analyzing invertible quantities and Frobenius coin problems",
            "Bounding gaps in numerical semigroups in combinatorics",
        ],
        references: [
            "Ramanujan, Question 330 in the Journal of the Indian Mathematical Society",
            "Wikipedia, Coin problem and Numerical semigroup",
        ],
        workedExample:
            "For coins 6, 9, 20 the Apery set modulo 6 has maximum dist 49 in the residue class 1, so the Frobenius number is 49 - 6 = 43. Indeed 43 cannot be formed, but every integer from 44 onward can.",
    },
};

export default module;
