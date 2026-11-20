/**
 * aries-recovery.test.ts - Independent recovery reference, ARIES phase checks,
 * frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./aries-recovery";
import type { VisualFrame } from "@/types";

interface LogRecord {
    lsn: number;
    type: "BEGIN" | "UPDATE" | "COMMIT" | "ABORT";
    tx: string;
    page?: string;
    old?: number;
    value?: number;
}

function checkFrames(frames: VisualFrame[], pages: number): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(pages);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Reference: committed updates win; uncommitted updates roll back. */
function reference(pages: Record<string, number>, log: LogRecord[]): Record<string, number> {
    const result = { ...pages };
    const committed = new Set(log.filter((r) => r.type === "COMMIT").map((r) => r.tx));
    for (const r of log) {
        if (r.type === "UPDATE" && committed.has(r.tx) && r.page && r.value !== undefined) {
            result[r.page] = r.value;
        }
    }
    for (let i = log.length - 1; i >= 0; i -= 1) {
        const r = log[i]!;
        if (r.type === "UPDATE" && !committed.has(r.tx) && r.page && r.old !== undefined) {
            result[r.page] = r.old;
        }
    }
    return result;
}

function finalPages(frames: VisualFrame[]): Record<string, number> {
    const last = frames[frames.length - 1]?.meta;
    const names = last?.["pages"] as string[];
    const values = last?.["pageValues"] as number[];
    return Object.fromEntries(names.map((name, i) => [name, values[i]!]));
}

describe("ARIES recovery", () => {
    const cases: Array<{ pages: Record<string, number>; log: LogRecord[] }> = [
        {
            pages: { A: 5, B: 10, C: 0 },
            log: [
                { lsn: 1, type: "BEGIN", tx: "T1" },
                { lsn: 2, type: "UPDATE", tx: "T1", page: "A", old: 5, value: 8 },
                { lsn: 3, type: "BEGIN", tx: "T2" },
                { lsn: 4, type: "UPDATE", tx: "T2", page: "B", old: 10, value: 20 },
                { lsn: 5, type: "COMMIT", tx: "T1" },
                { lsn: 6, type: "UPDATE", tx: "T2", page: "C", old: 0, value: 3 },
            ],
        },
        {
            pages: { X: 1, Y: 2 },
            log: [
                { lsn: 1, type: "BEGIN", tx: "A" },
                { lsn: 2, type: "UPDATE", tx: "A", page: "X", old: 1, value: 9 },
                { lsn: 3, type: "COMMIT", tx: "A" },
                { lsn: 4, type: "BEGIN", tx: "B" },
                { lsn: 5, type: "UPDATE", tx: "B", page: "X", old: 9, value: 7 },
                { lsn: 6, type: "UPDATE", tx: "B", page: "Y", old: 2, value: 6 },
            ],
        },
        {
            pages: { P: 0, Q: 0 },
            log: [
                { lsn: 1, type: "BEGIN", tx: "C" },
                { lsn: 2, type: "UPDATE", tx: "C", page: "P", old: 0, value: 4 },
                { lsn: 3, type: "UPDATE", tx: "C", page: "P", old: 4, value: 5 },
                { lsn: 4, type: "ABORT", tx: "C" },
            ],
        },
    ];

    it("matches an independent committed-wins recovery reference", () => {
        for (const c of cases) {
            const frames = [...mod.run(c)];
            checkFrames(frames, Object.keys(c.pages).length);
            expect(finalPages(frames)).toEqual(reference(c.pages, c.log));
        }
    });

    it("repeats history before undoing and writes one CLR per loser update", () => {
        const frames = [...mod.run(cases[0])];
        const phases = frames.map((f) => f.meta["phase"]);
        expect(phases).toContain("analysis");
        expect(phases).toContain("redo");
        expect(phases).toContain("undo");
        expect(phases.indexOf("redo")).toBeLessThan(phases.indexOf("undo"));
        // Repeat history sets B=20 during redo even though T2 is a loser.
        const redoB = frames.find(
            (f) => f.meta["phase"] === "redo" && (f.meta["pageValues"] as number[])[1] === 20,
        );
        expect(redoB).toBeDefined();
        const last = frames[frames.length - 1]?.meta;
        const loserUpdates = cases[0]!.log.filter(
            (r) => r.type === "UPDATE" && r.tx === "T2",
        ).length;
        expect(last?.["clrs"]).toBe(loserUpdates);
        expect(last?.["losers"]).toEqual(["T2"]);
        expect(last?.["committed"]).toEqual(["T1"]);
    });

    it("handles a repeated page update by undoing in reverse order", () => {
        const frames = [...mod.run(cases[2])];
        expect(finalPages(frames)).toEqual({ P: 0, Q: 0 });
        expect(frames[frames.length - 1]?.meta["clrs"]).toBe(2);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(4);
        expect(generator.next().done).toBe(true);
    });
});
