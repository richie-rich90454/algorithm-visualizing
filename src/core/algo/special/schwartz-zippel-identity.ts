/**
 * schwartz-zippel-identity.ts – Schwartz–Zippel Identity Test.
 * Tests P(x)=(x+1)(x+2) against Q(x)=x^2+3x+2 at random points: equal
 * polynomials agree everywhere, distinct ones agree with probability
 * ≤ degree/field-size per trial. Fixed-seed LCG keeps it deterministic.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function lcg(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
    };
}

const P = (x: number): number => (x + 1) * (x + 2);
const Q = (x: number): number => x * x + 3 * x + 2;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { trials?: number; seed?: number } | null) ?? {};
    const trials = Math.max(1, Math.min(8, cfg.trials ?? 5));
    const rnd = lcg(cfg.seed ?? 9);
    const pts: number[] = [];
    let step = 0;
    const frame = (desc: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = pts.map((x, i) => ({
            id: `pt-${i}`,
            type: "cell" as const,
            label: `x=${x} Δ=${P(x) - Q(x)}`,
            value: P(x) - Q(x),
            state: (P(x) === Q(x) ? "sorted" : "error") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i },
        }));
        if (entities.length === 0) {
            entities.push({
                id: "pt-empty",
                type: "cell" as const,
                label: "∅",
                value: "∅",
                state: "idle" as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 0, col: 0 },
            });
        }
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: desc,
            codeLineNumber: Math.min(line, 6),
            layout: "grid",
            meta: { trials: pts.length, allEqual: pts.every((x) => P(x) === Q(x)) },
        };
    };
    yield frame("Claim: (x+1)(x+2) ≡ x²+3x+2; sampling random points in 1..20.", 0);
    step += 1;
    for (let t = 1; t <= trials; t += 1) {
        const x = 1 + Math.floor(rnd() * 20);
        pts.push(x);
        yield frame(`Trial ${t}: x=${x} → P=${P(x)}, Q=${Q(x)} (Δ=${P(x) - Q(x)}).`, t);
        step += 1;
    }
    const ok = pts.every((x) => P(x) === Q(x));
    yield frame(
        ok
            ? `Verdict: identical (agreed on all ${trials} points).`
            : "Verdict: distinct polynomials (mismatch found).",
        trials + 1,
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "The Schwartz-Zippel lemma gives a fast randomized test for whether two polynomials are identical. Rather than expanding them symbolically, evaluate both at a few random points from a finite set. Equal polynomials agree everywhere, while distinct polynomials of degree d agree at only a few points, so a random point usually exposes a difference.",
        "invariants": [
            "If P and Q are identical, they agree at every sampled point.",
            "If they differ, they agree on at most d values in the field, where d is the degree.",
            "Each trial samples an independent random point."
        ],
        "correctness": "A nonzero polynomial of degree d has at most d roots, so for distinct P and Q the difference P-Q vanishes at at most d points of the field. A uniformly random point therefore hits a root with probability at most d/|S|, and k independent trials lower the error probability to (d/|S|)^k. Equal polynomials never fail.",
        "complexityRationale": "Evaluating a degree-d polynomial at a point takes O(d) arithmetic operations, so k trials cost O(k·d). Only the sampled points and their differences are stored, O(k) space.",
        "uses": [
            "Verifying polynomial identities in computer algebra",
            "Checking algebraic circuit and matrix-product identities",
            "Randomized verification of large symbolic computations",
            "Program checking and primality-related tests"
        ],
        "references": [
            "Schwartz, Fast Probabilistic Algorithms for Verification of Polynomial Identities, Journal of the ACM, 1980",
            "Motwani and Raghavan, Randomized Algorithms, Chapter 7"
        ],
        "workedExample": "Test (x+1)(x+2) against x^2+3x+2, which are equal. At x=4 both give 30; at x=7 both give 72. After five agreeing samples the verdict is 'identical'. A genuinely distinct quadratic would agree at no more than two points in the field, so repeated agreement is strong evidence."
    },
    id: "schwartz-zippel-identity",
    name: "Schwartz–Zippel Identity",
    category: "math",
    complexity: { time: "O(k·d)", space: "O(k)" },
    defaultInput: { trials: 5, seed: 9 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize polynomials P and Q for comparison",
        "for trial t <- 1 to trials",
        "sample random x uniformly from 1 to 20",
        "evaluate P(x) and Q(x) with difference delta",
        "record agreement or mismatch for this point",
        "distinct polynomials rarely agree repeatedly",
        "done: verdict identical or distinct reported",
    ],
};

export default module;
