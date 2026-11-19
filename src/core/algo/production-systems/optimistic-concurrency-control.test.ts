/**
 * optimistic-concurrency-control.test.ts - Validation decisions, final database, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./optimistic-concurrency-control";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.edges).toEqual([]);
        for (const entity of frame.entities) {
            expect(entity.id).toBeTruthy();
            expect(entity.type).toBe("cell");
            expect(Number.isFinite(entity.x)).toBe(true);
            expect(entity.metadata).toBeDefined();
        }
    });
}

interface Tx { id: number; startTs: number; reads?: string[]; writes?: Record<string, number> }

/** Independent validation simulation with a flat version list. */
function reference(transactions: Tx[]): { decisions: string[]; db: Map<string, { value: number; ts: number }> } {
    const db = new Map<string, { value: number; ts: number }>();
    const committed: Array<{ id: number; commitTs: number; writeKeys: string[] }> = [];
    const decisions: string[] = [];
    let counter = 0;
    for (const tx of transactions) {
        const reads = tx.reads ?? [];
        const conflict = committed.some((c) => c.commitTs > tx.startTs && c.writeKeys.some((key) => reads.includes(key)));
        if (conflict) {
            decisions.push(`tx${tx.id}:abort`);
            continue;
        }
        counter += 1;
        const writeKeys = Object.keys(tx.writes ?? {});
        for (const key of writeKeys) db.set(key, { value: (tx.writes as Record<string, number>)[key] as number, ts: counter });
        committed.push({ id: tx.id, commitTs: counter, writeKeys });
        decisions.push(`tx${tx.id}:commit`);
    }
    return { decisions, db };
}

describe("OptimisticConcurrencyControl", () => {
    it("validates exactly like the reference model", () => {
        const transactions: Tx[] = [
            { id: 1, startTs: 0, reads: ["A"], writes: { A: 10 } },
            { id: 2, startTs: 0, reads: ["A"], writes: { A: 20 } },
            { id: 3, startTs: 1, reads: ["A"], writes: { B: 30 } },
        ];
        const frames = [...mod.run({ transactions })];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        const expected = reference(transactions);
        expect(meta?.["decisions"]).toEqual(expected.decisions);
        expect(meta?.["decisions"]).toEqual(["tx1:commit", "tx2:abort", "tx3:commit"]);

        const dbText = meta?.["dbText"] as string[];
        expect(dbText).toContain("A:t1=10");
        expect(dbText).toContain("B:t2=30");
        expect(dbText.join(" ")).not.toContain("=20");
    });

    it("never applies a write from an aborted transaction", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        expect(Number(meta?.["aborted"])).toBe(1);
        expect(Number(meta?.["committed"])).toBe(2);
        for (const frame of frames) {
            const text = (frame.meta["dbText"] as string[] | undefined) ?? [];
            expect(text.join(" ")).not.toContain("=20");
        }
    });

    it("commits all transactions when their read sets do not conflict", () => {
        const transactions: Tx[] = [
            { id: 1, startTs: 0, reads: ["A"], writes: { A: 1 } },
            { id: 2, startTs: 0, reads: ["B"], writes: { B: 2 } },
        ];
        const frames = [...mod.run({ transactions })];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["decisions"]).toEqual(["tx1:commit", "tx2:commit"]);
        expect(Number(meta?.["aborted"])).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(3);
        expect(generator.next().done).toBe(true);
    });
});
