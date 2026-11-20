/**
 * law-of-total-probability.ts - Law of Total Probability
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Given a finite sample space partitioned into disjoint groups B1..Bk and an
 * event A, the law states P(A) = sum over i of P(A | Bi) * P(Bi). This module
 * works directly from weighted outcomes: it sums the mass of each group, the
 * mass of A inside each group, and accumulates the per-group contributions
 * P(A and Bi). The final total equals the mass of A computed directly.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n weighted outcomes
 *   Space: O(k) for k partition groups
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per partition group, showing its probability mass.
 *   - The bar being accumulated is BLUE (active); finished groups are GREEN.
 *   - The final frame reports P(A) in the metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Outcome {
    group: string;
    inA: boolean;
    mass: number;
}

const DEFAULT_OUTCOMES: Outcome[] = [
    { group: "B1", inA: true, mass: 0.15 },
    { group: "B1", inA: false, mass: 0.10 },
    { group: "B2", inA: true, mass: 0.20 },
    { group: "B2", inA: false, mass: 0.05 },
    { group: "B3", inA: true, mass: 0.25 },
    { group: "B3", inA: false, mass: 0.25 },
];

function makeBars(
    groups: string[],
    pB: Map<string, number>,
    pAB: Map<string, number>,
    states: Map<string, EntityState>,
): VisualEntity[] {
    return groups.map((group) => {
        const mass = pB.get(group) ?? 0;
        return {
            id: `bar-${group}`,
            type: "bar" as const,
            label: group,
            value: mass,
            state: states.get(group) ?? "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { group, pB: mass, pAB: pAB.get(group) ?? 0 },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { outcomes?: Outcome[] } | null) ?? {};
    const outcomes: Outcome[] = task.outcomes ?? DEFAULT_OUTCOMES;

    const groups: string[] = [];
    for (const outcome of outcomes) {
        if (!groups.includes(outcome.group)) {
            groups.push(outcome.group);
        }
    }

    const pB = new Map<string, number>();
    const pAB = new Map<string, number>();
    for (const group of groups) {
        pB.set(group, 0);
        pAB.set(group, 0);
    }
    let totalMass = 0;
    for (const outcome of outcomes) {
        totalMass += outcome.mass;
        pB.set(outcome.group, (pB.get(outcome.group) ?? 0) + outcome.mass);
        if (outcome.inA) {
            pAB.set(outcome.group, (pAB.get(outcome.group) ?? 0) + outcome.mass);
        }
    }
    if (totalMass <= 0) {
        totalMass = 1;
    }
    for (const group of groups) {
        pB.set(group, (pB.get(group) ?? 0) / totalMass);
        pAB.set(group, (pAB.get(group) ?? 0) / totalMass);
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(groups, pB, pAB, new Map()),
        edges: [],
        description: `Partitioned ${outcomes.length} outcomes into ${groups.length} group(s); summing P(A | Bi) times P(Bi).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { groups: groups.length, accumulated: 0, pA: 0 },
    };
    step += 1;

    let accumulated = 0;
    const states = new Map<string, EntityState>();
    for (const group of groups) {
        states.set(group, "active");
        const mass = pB.get(group) ?? 0;
        const joint = pAB.get(group) ?? 0;
        const conditional = mass > 0 ? joint / mass : 0;
        const contribution = conditional * mass;
        accumulated += joint;
        yield {
            stepNumber: step,
            entities: makeBars(groups, pB, pAB, states),
            edges: [],
            description: `Group ${group}: P(B)=${mass.toFixed(3)}, P(A|B)=${conditional.toFixed(3)}, contribution=${contribution.toFixed(3)}; running total ${accumulated.toFixed(3)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: {
                group,
                pB: mass,
                pAB: joint,
                pAGivenB: conditional,
                contribution,
                accumulated,
                pA: accumulated,
            },
        };
        step += 1;
        states.set(group, "sorted");
    }

    yield {
        stepNumber: step,
        entities: makeBars(groups, pB, pAB, states),
        edges: [],
        description: `Law of total probability gives P(A) = ${accumulated.toFixed(6)} from ${groups.length} group(s).`,
        codeLineNumber: 4,
        layout: "array",
        meta: { groups: groups.length, accumulated, pA: accumulated },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "When a sample space splits into disjoint cases, you can compute the probability of an event by asking how likely each case is and how likely the event is inside that case, then adding the products. It is the same as slicing the event into pieces and summing their masses, but it is useful when the conditional probabilities are easier to know than the pieces themselves.",
        invariants: [
            "The partition groups are disjoint and their masses sum to one after normalization.",
            "The joint mass P(A and Bi) never exceeds the group mass P(Bi).",
            "The running total after each group equals the mass of A found so far.",
        ],
        correctness:
            "The groups partition the sample space, so A is the disjoint union of the intersections A and Bi. Probability is additive over disjoint unions, giving P(A) equal to the sum of P(A and Bi). Because P(A and Bi) equals P(A | Bi) times P(Bi), the accumulated product sum is exactly P(A), which matches a direct sum over outcomes in A.",
        complexityRationale:
            "Each outcome is visited once to build group and joint totals, so time is linear in the number of outcomes. Only one entry per group is stored, giving linear space in the number of groups.",
        uses: [
            "Computing overall failure rates from per-condition failure rates",
            "Marginalizing latent variables in probabilistic models",
            "Deriving Bayes' theorem denominators in diagnostic testing",
        ],
        references: [
            "Grinstead and Snell, Introduction to Probability, Chapter 4",
            "Ross, A First Course in Probability, Chapter 3",
        ],
        workedExample:
            "With groups B1, B2, B3 of mass 0.25, 0.25, 0.50 and conditional probabilities P(A|B1)=0.6, P(A|B2)=0.8, P(A|B3)=0.5, the products are 0.15, 0.20, 0.25 and sum to 0.60, which equals the direct mass of the outcomes marked in A.",
    },
    id: "law-of-total-probability",
    name: "Law of Total Probability",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(k)" },
    defaultInput: { outcomes: DEFAULT_OUTCOMES },
    visualType: "array",
    run,
    pseudocode: [
        "group the outcomes into disjoint partition cells Bi",
        "compute P(Bi) and P(A and Bi) for every cell",
        "for each cell compute P(A | Bi) = P(A and Bi) / P(Bi)",
        "add the product P(A | Bi) times P(Bi) to the total",
        "the total after the last cell is P(A)",
    ],
};

export default module;
