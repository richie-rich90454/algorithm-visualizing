/**
 * serializable-snapshot-isolation.test.ts - Independent cycle-abort reference,
 * serializability check, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./serializable-snapshot-isolation";
import type { VisualFrame } from "@/types";

interface Transaction {
    id: string;
    start: number;
    commit: number;
    reads: string[];
    writes: string[];
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
            expect(edge.directed).toBe(true);
        }
        expect(frame.meta).toBeDefined();
    });
}

/** Independent SSI reference using a transitive-closure cycle test. */
function reference(txns: Transaction[]): { aborted: string[]; remaining: string[] } {
    let active = [...txns];
    const aborted: string[] = [];
    const concurrent = (a: Transaction, b: Transaction): boolean =>
        a.start < b.commit && b.start < a.commit;
    const edgesBetween = (list: Transaction[]): Array<[string, string]> => {
        const out: Array<[string, string]> = [];
        for (const r of list) {
            for (const w of list) {
                if (r.id !== w.id && concurrent(r, w) && r.reads.some((k) => w.writes.includes(k))) {
                    out.push([r.id, w.id]);
                }
            }
        }
        return out;
    };
    const cycleNodes = (list: Transaction[]): string[] => {
        const ids = list.map((t) => t.id);
        const edges = edgesBetween(list);
        const reach = new Map<string, Set<string>>();
        for (const id of ids) {
            reach.set(id, new Set());
        }
        for (const [a, b] of edges) {
            reach.get(a)?.add(b);
        }
        for (const k of ids) {
            for (const i of ids) {
                if (reach.get(i)?.has(k)) {
                    for (const j of ids) {
                        if (reach.get(k)?.has(j)) {
                            reach.get(i)?.add(j);
                        }
                    }
                }
            }
        }
        for (const id of ids) {
            if (reach.get(id)?.has(id)) {
                return [...reach.get(id)!].filter((x) => reach.get(x)?.has(id));
            }
        }
        return [];
    };
    for (let guard = 0; guard <= txns.length; guard += 1) {
        const cycle = cycleNodes(active);
        if (cycle.length === 0) {
            break;
        }
        const candidates = active.filter((t) => cycle.includes(t.id));
        const victim = candidates.reduce((a, b) => (a.commit > b.commit ? a : b));
        aborted.push(victim.id);
        active = active.filter((t) => t.id !== victim.id);
    }
    return { aborted, remaining: active.map((t) => t.id) };
}

describe("serializable snapshot isolation", () => {
    const cases: Transaction[][] = [
        [
            { id: "T1", start: 1, commit: 4, reads: ["X"], writes: ["Y"] },
            { id: "T2", start: 2, commit: 5, reads: ["Y"], writes: ["X"] },
            { id: "T3", start: 6, commit: 7, reads: ["X"], writes: ["Z"] },
        ],
        [
            { id: "A", start: 1, commit: 2, reads: ["K"], writes: ["M"] },
            { id: "B", start: 1, commit: 3, reads: ["M"], writes: ["K"] },
            { id: "C", start: 4, commit: 5, reads: ["K"], writes: ["N"] },
        ],
        [
            { id: "P", start: 1, commit: 2, reads: ["X"], writes: ["Y"] },
            { id: "Q", start: 3, commit: 4, reads: ["Y"], writes: ["Z"] },
        ],
    ];

    it("matches an independent cycle-abort reference", () => {
        for (const txns of cases) {
            const frames = [...mod.run({ transactions: txns })];
            checkFrames(frames);
            const last = frames[frames.length - 1]?.meta;
            const want = reference(txns);
            expect(last?.["aborted"]).toEqual(want.aborted);
            expect(last?.["nodes"]).toEqual(want.remaining);
            expect(last?.["serializable"]).toBe(true);
        }
    });

    it("detects and breaks a write-skew cycle", () => {
        const frames = [...mod.run({ transactions: cases[1] })];
        const last = frames[frames.length - 1]?.meta;
        expect((last?.["aborted"] as string[]).length).toBeGreaterThan(0);
        expect(last?.["aborted"]).toContain("B");
        expect(last?.["serializable"]).toBe(true);
    });

    it("leaves an already acyclic graph untouched", () => {
        const frames = [...mod.run({ transactions: cases[2] })];
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["aborted"]).toEqual([]);
        expect(last?.["serializable"]).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
