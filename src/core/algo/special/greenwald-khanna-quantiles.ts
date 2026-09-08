/**
 * greenwald-khanna-quantiles.ts – Greenwald–Khanna quantiles.
 * Ten values stream through an ε=0.2 tuple summary (value, gap, slack):
 * inserts keep order, periodic compress merges cheap tuples, and the
 * median query returns rank 5 ± εn. True median shown alongside.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Tuple {
    v: number;
    g: number;
    d: number;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { stream?: number[]; eps?: number } | null) ?? {};
    const stream =
        Array.isArray(cfg.stream) && cfg.stream.length > 0
            ? (cfg.stream as number[]).slice(0, 12)
            : [7, 2, 9, 4, 1, 8, 3, 6, 5, 10];
    const eps = 0.2;
    void cfg.eps;
    const summary: Tuple[] = [];
    let step = 0;
    let n = 0;
    const frame = (desc: string, line: number, hot: number): VisualFrame => {
        const entities: VisualEntity[] = summary.map((t, i) => ({
            id: `gk-${i}`,
            type: "cell" as const,
            label: `${t.v}`,
            value: t.v,
            state: (i === hot ? "comparing" : "sorted") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i },
        }));
        if (entities.length === 0) {
            entities.push({
                id: "gk-empty",
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
            codeLineNumber: line,
            layout: "grid",
            meta: { n, size: summary.length },
        };
    };
    yield frame(
        `Quantile summary (ε=${eps}) over [${stream.join(",")}]; querying the median.`,
        0,
        -1,
    );
    step += 1;
    for (const v of stream) {
        n += 1;
        const delta = n <= 2 ? 0 : Math.floor(2 * eps * n);
        let at = summary.findIndex((t) => t.v > v);
        if (at < 0) at = summary.length;
        summary.splice(at, 0, { v, g: 1, d: delta });
        if (n % 4 === 0) {
            for (let i = summary.length - 2; i >= 1; i -= 1) {
                const a = summary[i];
                const b = summary[i + 1];
                if (a && b && a.g + b.g + b.d <= Math.floor(2 * eps * n)) {
                    b.g += a.g;
                    summary.splice(i, 1);
                }
            }
        }
        yield frame(`Inserted ${v} (n=${n}, summary holds ${summary.length} tuples).`, n, at);
        step += 1;
        if (step > 11) break;
    }
    const sorted = [...stream].sort((a, b) => a - b);
    const target = Math.ceil(n / 2);
    let rank = 0;
    let est = sorted[sorted.length - 1] ?? 0;
    for (const t of summary) {
        rank += t.g;
        if (rank + t.d >= target) {
            est = t.v;
            break;
        }
    }
    const truth = sorted[Math.ceil(sorted.length / 2) - 1] ?? 0;
    yield frame(
        `Median estimate ${est} vs true median ${truth} (rank ${target} ± ${Math.floor(eps * n)}).`,
        n + 1,
        summary.findIndex((t) => t.v === est),
    );
}

const module: AlgorithmModule = {
    id: "greenwald-khanna-quantiles",
    name: "Greenwald–Khanna Quantiles",
    category: "data-structures",
    complexity: { time: "O(n log 1/ε)", space: "O(1/ε log n)" },
    defaultInput: { stream: [7, 2, 9, 4, 1, 8, 3, 6, 5, 10], eps: 0.2 },
    visualType: "grid",
    run,
};

export default module;
