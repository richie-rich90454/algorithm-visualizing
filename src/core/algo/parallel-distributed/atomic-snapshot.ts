/**
 * atomic-snapshot.ts - Atomic Snapshot via Double Collect
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * An atomic snapshot object gives each component a single-writer register and
 * supports update(i, value) and scan(). A scan must return a consistent view of
 * all components even while updates happen concurrently. The double-collect
 * algorithm reads every register twice; if the two collects are identical, no
 * component changed during the scan, so the view is atomic and can be returned.
 * If they differ, the scan simply retries. Each update writes a value together
 * with an increasing sequence number, so a repeated sequence number between
 * the two collects is another signal that nothing changed.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) per collect, so O(n) per successful scan; retries are unbounded
 *   Space: O(n) for the n single-writer registers
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells are components showing value at sequence number.
 *   - GREEN marks a successful scan, amber a collect, red a changed register.
 *   - meta carries the registers, last scan result, and consistency verdict.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Register {
    value: number;
    seq: number;
}

interface Update {
    type: "update";
    comp: number;
    value: number;
}

interface Scan {
    type: "scan";
    label?: string;
    interleave?: Array<{ comp: number; value: number }>;
}

type Event = Update | Scan;

interface Input {
    components?: number;
    events?: Event[];
}

const defaultEvents: Event[] = [
    { type: "update", comp: 0, value: 1 },
    { type: "update", comp: 1, value: 2 },
    { type: "scan", label: "s1" },
    { type: "update", comp: 2, value: 3 },
    { type: "scan", label: "s2", interleave: [{ comp: 0, value: 9 }] },
    { type: "update", comp: 1, value: 5 },
    { type: "scan", label: "s3" },
];

function sameValues(a: number[], b: number[]): boolean {
    return a.length === b.length && a.every((v, i) => v === b[i]);
}

function valueView(regs: Register[]): number[] {
    return regs.map((r) => r.value);
}

function makeCells(regs: Register[], marks: number[], state: EntityState): VisualEntity[] {
    return regs.map((r, i) => {
        const cellState: EntityState = marks.includes(i) ? "comparing" : state;
        return {
            id: `cell-${i}`,
            type: "cell" as const,
            label: `${r.value}@${r.seq}`,
            value: r.value,
            state: cellState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: i, col: 0, value: r.value, seq: r.seq },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const n = Math.max(2, Math.min(6, Math.floor(task.components ?? 3)));
    const events: Event[] = Array.isArray(task.events) && task.events.length > 0 ? task.events : defaultEvents;
    const regs: Register[] = Array.from({ length: n }, () => ({ value: 0, seq: 0 }));
    const history: number[][] = [valueView(regs)];
    const scanResults: Array<{ label: string; values: number[] }> = [];
    let lastScan: number[] = [];
    let step = 0;

    const meta = (last: string, phase: string) => ({
        components: n,
        rows: n,
        cols: 1,
        registers: regs.map((r) => `${r.value}@${r.seq}`),
        values: valueView(regs),
        lastScan,
        scans: scanResults.length,
        phase,
        last,
    });

    yield {
        stepNumber: step++,
        entities: makeCells(regs, [], "idle"),
        edges: [],
        description: `Atomic snapshot with ${n} single-writer registers and ${events.length} event(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: meta("initialized", "start"),
    };

    for (const event of events) {
        if (event.type === "update") {
            const c = Math.max(0, Math.min(n - 1, Math.floor(event.comp)));
            const reg = regs[c]!;
            reg.seq += 1;
            reg.value = event.value;
            history.push(valueView(regs));
            const desc = `Component ${c} updates its register to ${event.value} at sequence ${reg.seq}.`;
            yield {
                stepNumber: step++,
                entities: makeCells(regs, [c], "active"),
                edges: [],
                description: desc,
                codeLineNumber: 1,
                layout: "grid",
                meta: meta(desc, "update"),
            };
            continue;
        }

        const label = event.label ?? `scan-${scanResults.length + 1}`;
        const interleave = event.interleave ?? [];
        let collected = false;
        let attempt = 0;
        while (!collected) {
            attempt += 1;
            const first = valueView(regs);
            const collectDesc = `${label} collect 1 (attempt ${attempt}): [${first.join(", ")}].`;
            yield {
                stepNumber: step++,
                entities: makeCells(regs, [], "comparing"),
                edges: [],
                description: collectDesc,
                codeLineNumber: 2,
                layout: "grid",
                meta: meta(collectDesc, "collect1"),
            };

            for (const u of interleave) {
                const c = Math.max(0, Math.min(n - 1, Math.floor(u.comp)));
                const reg = regs[c]!;
                reg.seq += 1;
                reg.value = u.value;
                history.push(valueView(regs));
                const d = `Concurrent update: component ${c} writes ${u.value} during ${label}.`;
                yield {
                    stepNumber: step++,
                    entities: makeCells(regs, [c], "error"),
                    edges: [],
                    description: d,
                    codeLineNumber: 3,
                    layout: "grid",
                    meta: meta(d, "interleave"),
                };
            }

            const second = valueView(regs);
            const secondDesc = `${label} collect 2 (attempt ${attempt}): [${second.join(", ")}].`;
            yield {
                stepNumber: step++,
                entities: makeCells(regs, [], "comparing"),
                edges: [],
                description: secondDesc,
                codeLineNumber: 4,
                layout: "grid",
                meta: meta(secondDesc, "collect2"),
            };

            if (sameValues(first, second)) {
                lastScan = second;
                scanResults.push({ label, values: second });
                const ok = `Collects match; ${label} returns atomic snapshot [${second.join(", ")}].`;
                yield {
                    stepNumber: step++,
                    entities: makeCells(regs, [], "sorted"),
                    edges: [],
                    description: ok,
                    codeLineNumber: 5,
                    layout: "grid",
                    meta: meta(ok, "result"),
                };
                collected = true;
            } else {
                const retry = `${label} saw a change between collects; retry the double collect.`;
                yield {
                    stepNumber: step++,
                    entities: makeCells(regs, [], "active"),
                    edges: [],
                    description: retry,
                    codeLineNumber: 6,
                    layout: "grid",
                    meta: meta(retry, "retry"),
                };
            }
        }
    }

    const linearizable = scanResults.every((s) => history.some((h) => sameValues(h, s.values)));
    const done = `Completed ${scanResults.length} scan(s); every returned snapshot ${linearizable ? "matches a real instant" : "FAILED linearizability"} in the execution.`;
    yield {
        stepNumber: step,
        entities: makeCells(regs, [], "sorted"),
        edges: [],
        description: done,
        codeLineNumber: 7,
        layout: "grid",
        meta: { ...meta(done, "done"), linearizable, historyLength: history.length },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A scan wants a photograph of several changing counters, but it can only look at them one at a time. Take two photographs in a row. If nothing changed between them, the two are identical and the second one is a genuine instant. If they differ, throw them away and try again. Eventually a scan catches a quiet moment and returns a view that really existed, never a torn mixture of old and new values.",
        invariants: [
            "Sequence numbers at a register never decrease.",
            "A scan returns only when two consecutive collects are identical.",
            "A returned value vector matches the register state at some real instant.",
        ],
        correctness:
            "If the two collects are identical, no update changed any register value between them, so the returned vector equals the state throughout that interval, which is a real instant; the scan is linearizable at that point. If they differ, the scan discards both and retries, applying no computation to the inconsistent pair. Because updates are finite, a retry with no concurrent update succeeds after two equal collects. Validating returned vectors against the recorded execution confirms each snapshot corresponds to an actual state, so no scan can return a value combination that never coexisted.",
        complexityRationale:
            "A collect reads all n registers, O(n), and two collects plus a check are O(n) for a successful scan. Contention may force retries, so worst-case time is unbounded but expected O(n) when updates are sparse. Space is O(n) for the registers; the execution history used for validation is only for the visualization.",
        uses: [
            "Taking consistent snapshots of concurrent counters and gauges",
            "Checkpointing the state of a multithreaded runtime",
            "Implementing readable consistent views in concurrent data structures",
        ],
        references: [
            "Afek, Brown, and Merritt, Atomic Snapshots of Shared Memory, 1993",
            "Herlihy and Shavit, The Art of Multiprocessor Programming, chapter on snapshot objects",
        ],
        workedExample:
            "With registers [0, 0, 0], updates set component 0 to 1 and component 1 to 2. A scan collects [1, 2, 0] twice and returns it. A later scan sees component 0 change from 1 to 9 between its collects, detects the mismatch, retries, and returns [9, 2, 3], a state that actually existed rather than a mix.",
    },
    id: "atomic-snapshot",
    name: "Atomic Snapshot (Double Collect)",
    category: "parallel-distributed",
    complexity: { time: "O(n) per successful scan", space: "O(n)" },
    defaultInput: { components: 3, events: defaultEvents },
    visualType: "grid",
    run,
    pseudocode: [
        "each component owns one single-writer register",
        "on update, write the value with an increasing sequence number",
        "on scan, read every register into collect one",
        "apply any concurrent activity during the scan",
        "read every register again into collect two",
        "if the two collects match, return collect two",
        "otherwise retry the double collect from scratch",
        "done: report scans and linearizability verdict",
    ],
};

export default module;
