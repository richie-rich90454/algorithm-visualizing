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
            codeLineNumber: line,
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
    id: "secretary-problem",
    name: "Secretary Problem",
    category: "math",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { values: [3, 1, 7, 2, 8, 4, 6, 5] },
    visualType: "grid",
    run,
};

export default module;
