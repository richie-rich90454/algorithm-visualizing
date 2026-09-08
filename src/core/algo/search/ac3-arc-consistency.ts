/**
 * ac3-arc-consistency.ts – AC-3 Arc Consistency
 *
 * Enforces arc consistency on X≠Y, Y≠Z with Y pinned to {1}: values
 * without support are revised away until the queue drains. One cell
 * per variable (metadata.variable).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const VARS = ["X", "Y", "Z"];
const ARCS: Array<[string, string]> = [
    ["X", "Y"],
    ["Y", "X"],
    ["Y", "Z"],
    ["Z", "Y"],
];

function makeCells(
    domains: Map<string, number[]>,
    states: Map<string, EntityState> = new Map(),
): VisualEntity[] {
    return VARS.map((v) => ({
        id: `cell-${v}`,
        type: "cell" as const,
        label: `${v}={${(domains.get(v) ?? []).join(",")}}`,
        value: (domains.get(v) ?? []).length,
        state: states.get(v) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { variable: v, domain: (domains.get(v) ?? []).join(",") },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { domains?: Record<string, number[]> } | null) ?? {};
    const domains = new Map<string, number[]>();
    const defaults: Record<string, number[]> = { X: [1, 2], Y: [1], Z: [1, 2] };
    for (const v of VARS) {
        const d = task.domains?.[v];
        domains.set(v, Array.isArray(d) ? [...(d as number[])] : [...(defaults[v] as number[])]);
    }
    let step = 0;
    let revisions = 0;
    const queue: Array<[string, string]> = [...ARCS];

    yield {
        stepNumber: step,
        entities: makeCells(domains),
        edges: [],
        description: `AC-3 over X≠Y, Y≠Z with ${queue.length} arcs queued.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { revisions },
    };
    step += 1;
    if (VARS.some((v) => (domains.get(v) ?? []).length === 0)) {
        yield {
            stepNumber: step,
            entities: makeCells(domains),
            edges: [],
            description: "Empty domain on arrival – unsatisfiable.",
            codeLineNumber: 4,
            layout: "grid",
            meta: { revisions },
        };
        return;
    }
    while (queue.length > 0 && step < 12) {
        const [xi, xj] = queue.shift() as [string, string];
        const di = domains.get(xi) as number[];
        const dj = domains.get(xj) as number[];
        const removed = di.filter((x) => !dj.some((y) => y !== x));
        if (removed.length > 0) {
            domains.set(
                xi,
                di.filter((x) => !removed.includes(x)),
            );
            revisions += 1;
            yield {
                stepNumber: step,
                entities: makeCells(
                    domains,
                    new Map([
                        [xi, "comparing"],
                        [xj, "highlight"],
                    ]),
                ),
                edges: [],
                description: `Revised ${xi}: dropped {${removed.join(",")}} – no support in ${xj}.`,
                codeLineNumber: 1,
                layout: "grid",
                meta: { revisions },
            };
            step += 1;
            if ((domains.get(xi) ?? []).length === 0) {
                yield {
                    stepNumber: step,
                    entities: makeCells(domains, new Map([[xi, "swapped"]])),
                    edges: [],
                    description: `${xi} wiped out – the CSP is unsatisfiable.`,
                    codeLineNumber: 2,
                    layout: "grid",
                    meta: { revisions },
                };
                return;
            }
            for (const [xk, xm] of ARCS) {
                if (xm === xi && xk !== xj) queue.push([xk, xm]);
            }
        } else {
            yield {
                stepNumber: step,
                entities: makeCells(domains, new Map([[xi, "highlight"]])),
                edges: [],
                description: `Arc ${xi}→${xj} already consistent – no change.`,
                codeLineNumber: 3,
                layout: "grid",
                meta: { revisions },
            };
            step += 1;
        }
    }
    const done = new Map<string, EntityState>(
        VARS.map((v) => [v, "sorted"] as [string, EntityState]),
    );
    yield {
        stepNumber: step,
        entities: makeCells(domains, done),
        edges: [],
        description: `Arc consistent after ${revisions} revision(s): ${VARS.map((v) => `${v}={${(domains.get(v) ?? []).join(",")}}`).join(" ")}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { revisions },
    };
}

const module: AlgorithmModule = {
    id: "ac3-arc-consistency",
    name: "AC-3 Arc Consistency",
    category: "searching",
    complexity: { time: "O(e·d³)", space: "O(e)" },
    defaultInput: { domains: { X: [1, 2], Y: [1], Z: [1, 2] } },
    visualType: "grid",
    run,
};

export default module;
