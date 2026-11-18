/**
 * secretary-problem.ts – Secretary Problem (optimal stopping).
 * Eight candidates arrive in fixed order; observe the first n/e≈2,
 * then hire the first who beats everything seen. Hired 7 vs optimum 8.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { values?: number[] } | null) ?? {};
    const values =
        Array.isArray(cfg.values) && cfg.values.length > 0
            ? (cfg.values as number[]).slice(0, 12)
            : [3, 1, 7, 2, 8, 4, 6, 5];
    const n = values.length;
    const observe = Math.max(1, Math.floor(n / Math.E));
    let step = 0;
    let hired = -1;
    const frame = (seen: number, best: number, desc: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = values.map((v, i) => ({
            id: `c-${i}`,
            type: "cell" as const,
            label: `${v}`,
            value: v,
            state: (i === hired
                ? "sorted"
                : i === seen
                  ? "comparing"
                  : i < seen
                    ? "visited"
                    : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i },
        }));
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: desc,
            codeLineNumber: Math.min(line, 6),
            layout: "grid",
            meta: { seen, bestSeen: best, hired },
        };
    };
    yield frame(
        -1,
        -Infinity,
        `Eight candidates arrive in order [${values.join(",")}]; observe first ${observe}, then commit.`,
        0,
    );
    step += 1;
    let best = -Infinity;
    for (let i = 0; i < observe; i += 1) best = Math.max(best, values[i] ?? -Infinity);
    yield frame(observe - 1, best, `Observed ${observe}: best seen is ${best}; cannot go back.`, 1);
    step += 1;
    for (let i = observe; i < n; i += 1) {
        const v = values[i] ?? 0;
        if (v > best) {
            hired = i;
            best = v;
            yield frame(i, best, `Candidate ${v} beats ${values.slice(0, i).join(",")}: HIRED.`, 2);
            step += 1;
            break;
        }
        yield frame(i, best, `Candidate ${v} ≤ best ${best}: skip (no recall).`, 2);
        step += 1;
    }
    if (hired < 0) {
        hired = n - 1;
        yield frame(hired, best, "Nobody beat the bar: settle for the last candidate.", 3);
        step += 1;
    }
    yield frame(
        hired,
        best,
        `Locked in candidate ${values[hired]} at position ${hired}; later arrivals go unseen.`,
        3,
    );
    step += 1;
    const opt = Math.max(...values);
    yield frame(
        n,
        best,
        `Hired ${values[hired]} (optimum was ${opt}). Optimal stopping wins with probability 1/e.`,
        4,
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "The secretary problem asks you to pick the best candidate from a sequence interviewed in random order with no recall. The optimal strategy is to observe and reject the first n/e candidates to set a benchmark, then hire the first later candidate who beats it. This maximizes the chance of selecting the best, which approaches 1/e, about 37 percent, for large n.",
        "invariants": [
            "No candidate is hired during the observation phase.",
            "The benchmark is the maximum value seen during that phase.",
            "Once hiring starts, the first candidate exceeding the benchmark is accepted and the process stops."
        ],
        "correctness": "If the best candidate is at position j greater than n/e, the strategy succeeds exactly when the best of the first j-1 candidates lies in the observation phase, which has probability (n/e)/(j-1). Averaging over j and taking the limit gives 1/e, which is optimal among all stopping rules; observing too few or too many lowers the chance.",
        "complexityRationale": "The algorithm scans the candidate list once, tracking a running maximum, O(n) time. It stores only the benchmark and the hired index, O(1) space.",
        "uses": [
            "Optimal stopping in hiring and decision problems",
            "Sequential asset-selling and best-price decisions",
            "Threshold policies in online selection",
            "A canonical model in decision theory and auction design"
        ],
        "references": [
            "Gilbert and Mosteller, Recognizing the Maximum of a Sequence, Journal of the American Statistical Association, 1966",
            "Ferguson, Who Solved the Secretary Problem?, Statistical Science, 1989"
        ],
        "workedExample": "Candidates [3,1,7,2,8,4,6,5] give n=8, so observe floor(8/e)=2. The benchmark from the first two is max(3,1)=3. From position 3 onward, hire the first value above 3: candidate 7 at position 3. The optimum was 8 at position 5, so this instance misses it, illustrating that the 1/e rule is optimal only in expectation."
    },
    id: "secretary-problem",
    name: "Secretary Problem",
    category: "math",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { values: [3, 1, 7, 2, 8, 4, 6, 5] },
    visualType: "grid",
    run,
    pseudocode: [
        "list eight candidates arriving in fixed order",
        "observe first n over e candidates without hiring",
        "remember best value seen during observation",
        "hire the first later candidate beating the bar",
        "stop at hire with no recall allowed",
        "settle for last candidate when nobody beats bar",
        "done: hired value compared against optimum",
    ],
};

export default module;
