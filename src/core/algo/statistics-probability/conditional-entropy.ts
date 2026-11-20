/**
 * conditional-entropy.ts - Conditional Entropy From Joint Counts
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Conditional entropy H(Y|X) measures how much uncertainty remains about Y
 * after X is known. It is computed by grouping the observations by X, finding
 * the entropy of Y inside each group, and averaging those entropies weighted by
 * how often each value of X occurs. Equivalently H(Y|X) = H(X,Y) - H(X), and the
 * gap between H(Y) and H(Y|X) is the mutual information shared by the variables.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n + k) for n pairs and k distinct values of X
 *   Space: O(k + j) for the group and joint count tables
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per distinct value of X shows its weighted entropy contribution.
 *   - The current group is yellow; the final total is green.
 *   - The final frame reports H(X), H(Y), H(X,Y), H(Y|X), and mutual information.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface EntropyInput {
    xs?: Array<number | string>;
    ys?: Array<number | string>;
}

function key(value: number | string): string {
    return String(value);
}

function entropy(counts: number[], total: number): number {
    if (total <= 0) return 0;
    let sum = 0;
    for (const count of counts) {
        if (count <= 0) continue;
        const p = count / total;
        sum -= p * Math.log2(p);
    }
    return sum;
}

function makeBars(labels: string[], contributions: number[], current: number, done: boolean): VisualEntity[] {
    return labels.map((label, index) => {
        let state: EntityState = "idle";
        if (done) {
            state = "sorted";
        } else if (index === current) {
            state = "comparing";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `${label}: ${(contributions[index] ?? 0).toFixed(4)}`,
            value: contributions[index] ?? 0,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, group: label, contribution: contributions[index] ?? 0 },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as EntropyInput | null) ?? {};
    const rawX: Array<number | string> = Array.isArray(task.xs) ? task.xs : ["a", "a", "b", "b", "c", "c"];
    const rawY: Array<number | string> = Array.isArray(task.ys) ? task.ys : [0, 1, 0, 1, 0, 1];
    const n = Math.min(rawX.length, rawY.length);

    const joint = new Map<string, number>();
    const perX = new Map<string, Map<string, number>>();
    const marginalY = new Map<string, number>();
    for (let i = 0; i < n; i += 1) {
        const x = key(rawX[i] ?? "");
        const y = key(rawY[i] ?? "");
        joint.set(`${x}|${y}`, (joint.get(`${x}|${y}`) ?? 0) + 1);
        marginalY.set(y, (marginalY.get(y) ?? 0) + 1);
        if (!perX.has(x)) perX.set(x, new Map());
        const group = perX.get(x);
        if (group) group.set(y, (group.get(y) ?? 0) + 1);
    }

    const labels = [...perX.keys()];
    const hxy = entropy([...joint.values()], n);
    const hx = entropy(labels.map((x) => {
        let total = 0;
        const group = perX.get(x);
        if (group) for (const count of group.values()) total += count;
        return total;
    }), n);
    const hy = entropy([...marginalY.values()], n);
    const conditional = hxy - hx;
    const mutual = hx + hy - hxy;

    const contributions: number[] = [];
    let step = 0;
    const frame = (current: number, done: boolean, description: string, codeLineNumber: number): VisualFrame => ({
        stepNumber: step,
        entities: makeBars(labels, contributions.length === 0 ? labels.map(() => 0) : contributions, current, done),
        edges: [],
        description,
        codeLineNumber,
        layout: "array",
        meta: {
            n,
            groups: labels,
            groupEntropy: [...contributions],
            hx,
            hy,
            hxy,
            conditionalEntropy: conditional,
            mutualInformation: mutual,
        },
    });

    yield frame(-1, false, `Estimating H(Y|X) from ${n} paired observations across ${labels.length} group(s).`, 0);
    step += 1;

    for (let g = 0; g < labels.length; g += 1) {
        const x = labels[g] ?? "";
        const group = perX.get(x);
        const counts = group ? [...group.values()] : [];
        const total = counts.reduce((a, b) => a + b, 0);
        const px = n === 0 ? 0 : total / n;
        const contribution = px * entropy(counts, total);
        contributions.push(contribution);
        yield frame(g, false, `Group X=${x}: p=${px.toFixed(4)}, H(Y|X=${x})=${entropy(counts, total).toFixed(4)}, weighted ${contribution.toFixed(4)}.`, 3);
        step += 1;
    }

    yield frame(-1, true, `H(Y|X) = ${conditional.toFixed(4)}, equal to H(X,Y) minus H(X); mutual information ${mutual.toFixed(4)}.`, 5);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "If you already know X, how much guesswork is left about Y? Conditional entropy answers that by splitting the data into groups with the same X, measuring how mixed Y is inside each group, and averaging the results by group size. A deterministic relationship leaves zero uncertainty; completely unrelated variables leave all of H(Y).",
        invariants: [
            "Each observation belongs to exactly one X group and one joint cell.",
            "Conditional entropy is nonnegative and never exceeds H(Y).",
            "The identity H(Y|X) = H(X,Y) - H(X) holds for the same counts.",
        ],
        correctness:
            "The joint counts estimate p(x,y) and the X marginals estimate p(x). By definition H(Y|X) is the sum over x of p(x) times the entropy of the conditional distribution p(y|x), which the grouped sweep computes because the counts in group x divided by the group total are exactly p(y|x) and the group total divided by n is p(x). The identity H(X,Y) = H(X) + H(Y|X) follows from factoring p(x,y) = p(x)p(y|x) inside the logarithm, so subtracting H(X) gives the same value, and mutual information H(Y) - H(Y|X) is nonnegative by Gibbs' inequality.",
        complexityRationale:
            "Counting pairs touches each of the n observations once, and the grouped sweep visits each of the k groups and j joint cells once, giving O(n + k + j) time and O(k + j) space for the count tables.",
        uses: [
            "Measuring how much a feature reveals about a target label",
            "Building decision trees by choosing high information-gain splits",
            "Analyzing dependence in contingency tables and communication channels",
        ],
        references: [
            "Cover and Thomas, Elements of Information Theory, Chapter 2",
            "MacKay, Information Theory, Inference, and Learning Algorithms, Chapter 8",
        ],
        workedExample:
            "For pairs (a,0), (a,1), (b,0), (b,1), each X group is a fair coin with entropy 1 bit and weight 0.5, so H(Y|X) = 1 bit. The joint distribution is uniform over four cells so H(X,Y) = 2 bits and H(X) = 1 bit, confirming H(X,Y) - H(X) = 1, while H(Y) = 1 gives zero mutual information.",
    },
    id: "conditional-entropy",
    name: "Conditional Entropy",
    category: "statistics-probability",
    complexity: { time: "O(n + k)", space: "O(k + j)" },
    defaultInput: { xs: ["a", "a", "b", "b", "c", "c"], ys: [0, 1, 0, 1, 0, 1] },
    visualType: "array",
    run,
    pseudocode: [
        "read the paired observations of X and Y",
        "build joint counts for each pair and marginal counts for each variable",
        "set the weighted conditional sum to zero",
        "for each distinct value x of X compute the entropy of Y within its group",
        "weight that group entropy by the fraction of observations with that x",
        "add the weighted entropy to the conditional total",
        "verify conditional equals joint entropy minus entropy of X",
        "done: report conditional entropy and mutual information",
    ],
};

export default module;
