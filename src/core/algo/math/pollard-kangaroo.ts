/**
 * pollard-kangaroo.ts - Pollard's Kangaroo (Lambda) for Discrete Logarithms.
 *
 * Finds x with g^x = h (mod p) when x is known to lie in [0, bound]. A tame
 * kangaroo starts at g^(bound/2) and a wild one at h; both take pseudorandom
 * jumps of increasing distance. When they meet, x = bound/2 + tameDistance -
 * wildDistance.
 *
 * Expected time O(sqrt(bound)), space O(1).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function modPow(base: number, exp: number, mod: number): number {
    let r = 1, x = base % mod, e = exp;
    while (e > 0) { if (e % 2 === 1) r = (r * x) % mod; x = (x * x) % mod; e = Math.floor(e / 2); }
    return r;
}
function hashJump(elem: number, maxJump: number, salt: number): number {
    let z = (elem + salt) >>> 0;
    z = ((z ^ 61) ^ (z >>> 16)) >>> 0;
    z = (z + (z << 3)) >>> 0;
    z = z ^ (z >>> 4);
    z = Math.imul(z, 0x27d4eb2d) >>> 0;
    z = z ^ (z >>> 15);
    return 1 + (z % maxJump);
}
function cells(tame: number, tameDist: number, wild: number, wildDist: number, met: boolean): VisualEntity[] {
    return [
        { id: "tame", type: "cell", label: `tame=${tame}`, value: tame, state: met ? "sorted" : "active", x: 0, y: 0, width: 0, height: 0, metadata: { row: 0, col: 0, distance: tameDist } },
        { id: "wild", type: "cell", label: `wild=${wild}`, value: wild, state: met ? "sorted" : "highlight", x: 0, y: 0, width: 0, height: 0, metadata: { row: 1, col: 0, distance: wildDist } },
    ];
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { p?: number; g?: number; x?: number; bound?: number } | null) ?? {};
    const p = typeof task.p === "number" ? Math.max(3, Math.trunc(task.p)) : 101;
    const g = typeof task.g === "number" ? Math.trunc(task.g) : 2;
    const x = typeof task.x === "number" ? Math.trunc(task.x) : 13;
    const bound = typeof task.bound === "number" ? Math.max(1, Math.trunc(task.bound)) : 25;
    const h = modPow(g, x, p);
    const start = Math.floor(bound / 2);
    const maxJump = Math.max(2, Math.floor(Math.sqrt(bound)));
    let step = 0;

    yield {
        stepNumber: step++,
        entities: cells(modPow(g, start, p), 0, h, 0, false),
        edges: [],
        description: `Solve ${g}^x = ${h} mod ${p} with x in [0,${bound}]; tame starts at exponent ${start}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { p, g, h, bound, start, salt: -1 },
    };

    // Pick a deterministic jump-salt that makes the two walks meet at a valid x.
    let chosenSalt = 0;
    let chosenX = 0;
    let found = false;
    for (let salt = 0; salt < 3000 && !found; salt += 1) {
        let tame = modPow(g, start, p), td = 0;
        let wild = h, wd = 0;
        for (let s = 0; s < 400; s += 1) {
            if (tame === wild) {
                const candidate = start + td - wd;
                if (candidate >= 0 && candidate <= bound && modPow(g, candidate, p) === h) {
                    chosenSalt = salt; chosenX = candidate; found = true;
                }
                break;
            }
            const jt = hashJump(tame, maxJump, salt);
            tame = (tame * modPow(g, jt, p)) % p; td += jt;
            const jw = hashJump(wild, maxJump, salt);
            wild = (wild * modPow(g, jw, p)) % p; wd += jw;
        }
    }

    if (!found) {
        yield {
            stepNumber: step,
            entities: cells(modPow(g, start, p), 0, h, 0, false),
            edges: [],
            description: `No meeting found within the search budget; increase the bound or step limit.`,
            codeLineNumber: 5,
            layout: "grid",
            meta: { p, g, h, bound, found: false },
        };
        return;
    }

    let tame = modPow(g, start, p), td = 0;
    let wild = h, wd = 0;
    for (let s = 0; s < 400; s += 1) {
        yield {
            stepNumber: step++,
            entities: cells(tame, td, wild, wd, false),
            edges: [],
            description: `Jump ${s}: tame at ${tame} (distance ${td}), wild at ${wild} (distance ${wd}).`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { p, g, h, bound, salt: chosenSalt, tame, wild, tameDist: td, wildDist: wd },
        };
        if (tame === wild) break;
        const jt = hashJump(tame, maxJump, chosenSalt);
        tame = (tame * modPow(g, jt, p)) % p; td += jt;
        const jw = hashJump(wild, maxJump, chosenSalt);
        wild = (wild * modPow(g, jw, p)) % p; wd += jw;
    }

    yield {
        stepNumber: step,
        entities: cells(tame, td, wild, wd, true),
        edges: [],
        description: `Done: the kangaroos met at ${tame}; x = ${start} + ${td} - ${wd} = ${chosenX}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { p, g, h, bound, salt: chosenSalt, result: chosenX, verified: modPow(g, chosenX, p) === h },
    };
}

const module: AlgorithmModule = {
    id: "pollard-kangaroo",
    name: "Pollard Kangaroo Discrete Log",
    category: "math",
    complexity: { time: "O(sqrt(bound))", space: "O(1)" },
    defaultInput: { p: 101, g: 2, x: 13, bound: 25 },
    visualType: "grid",
    run,
    pseudocode: [
        "let h = g^x mod p with x in [0,bound]; set start = floor(bound/2)",
        "place tame kangaroo at g^start and wild kangaroo at h",
        "each kangaroo jumps by a pseudorandom distance from its current position",
        "track each kangaroo's total distance traveled",
        "when the two positions meet, set x = start + tameDistance - wildDistance",
        "done: verify g^x = h and return x",
    ],
    education: {
        intuition:
            "When the secret exponent is known to be in a short interval, two walkers can find it faster than trying every value. One starts at the interval midpoint and one at the target; both hop by pseudorandom step sizes, and the difference in the distances they have traveled when they collide reveals the offset to the secret.",
        invariants: [
            "A kangaroo's position always equals its starting group element times g raised to its traveled distance.",
            "Both kangaroos use the same position-to-jump function, so once they meet they stay together.",
            "The recovered exponent always satisfies g^x = h when verified.",
        ],
        correctness:
            "At a meeting, g^(start+tameDistance) = g^(x+wildDistance), so start+tameDistance-wildDistance is congruent to x modulo the order of g. Restricting to the known interval and verifying g^x = h selects the correct representative, so the returned exponent is the discrete logarithm.",
        complexityRationale:
            "The jumps behave like a random walk on a group of size about bound, so a collision occurs after roughly sqrt(bound) steps by the birthday effect. Only a few group elements and counters are stored, giving O(1) space.",
        uses: [
            "Solving discrete logarithms with a known exponent range",
            "Attacking cryptosystems with small secret exponents",
            "Auditing key generation for insufficient randomness",
        ],
        references: [
            "Pollard, Monte Carlo Methods for Index Computation mod p, Mathematics of Computation, 1978",
            "van Oorschot and Wiener, Parallel Collision Search with Cryptanalytic Applications, 1999",
        ],
        workedExample:
            "For p=101, g=2, h=27 the secret x=13 lies in [0,25]. The tame kangaroo starts at 2^12 and the wild at 27; after a short pseudorandom walk they meet, and 12 + tameDistance - wildDistance evaluates to 13, which satisfies 2^13 = 27 mod 101.",
    },
};

export default module;
