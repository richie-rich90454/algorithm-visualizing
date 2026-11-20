/**
 * multi-version-concurrency-control.test.ts - Snapshot reads, first-committer-wins, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./multi-version-concurrency-control";
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
        expect(frame.entities.length).toBeGreaterThan(0);
        for (const entity of frame.entities) {
            expect(entity.id).toBeTruthy();
            expect(entity.type).toBe("cell");
            expect(Number.isFinite(entity.x)).toBe(true);
            expect(typeof entity.metadata["row"]).toBe("number");
            expect(typeof entity.metadata["col"]).toBe("number");
        }
    });
}

interface Version { ts: number; value: number }
interface Tx { id: number; readTs: number; reads?: string[]; writes?: Record<string, number> }

/** Independent reference: collect committed versions, then resolve each read by maximum timestamp. */
function reference(transactions: Tx[]): { chains: Map<string, Version[]>; decisions: string[]; reads: Array<{ key: string; tx: number; ts: number; value: number }> } {
    const chains = new Map<string, Version[]>();
    const decisions: string[] = [];
    const reads: Array<{ key: string; tx: number; ts: number; value: number }> = [];
    transactions.forEach((tx, order) => {
        const commitTs = order + 1;
        for (const key of tx.reads ?? []) {
            const versions = chains.get(key) ?? [];
            let visible: Version | null = null;
            for (const version of versions) {
                if (version.ts <= tx.readTs && (!visible || version.ts > visible.ts)) visible = version;
            }
            reads.push({ key, tx: tx.id, ts: tx.readTs, value: visible ? visible.value : 0 });
        }
        const writes = Object.entries(tx.writes ?? {});
        const conflict = writes.some(([key]) => (chains.get(key) ?? []).some((version) => version.ts > tx.readTs));
        if (conflict) {
            decisions.push(`tx${tx.id}:${writes[0]?.[0]}:abort`);
            return;
        }
        for (const [key, value] of writes) {
            const versions = chains.get(key) ?? [];
            versions.push({ ts: commitTs, value });
            chains.set(key, versions);
            decisions.push(`tx${tx.id}:${key}:commit`);
        }
    });
    return { chains, decisions, reads };
}

describe("MultiVersionConcurrencyControl", () => {
    it("resolves snapshot reads and write conflicts like the reference model", () => {
        const transactions: Tx[] = [
            { id: 1, readTs: 1, reads: ["A"], writes: { A: 10 } },
            { id: 2, readTs: 1, reads: ["A"], writes: {} },
            { id: 3, readTs: 2, reads: ["A"], writes: { A: 20 } },
            { id: 4, readTs: 1, reads: [], writes: { A: 30 } },
            { id: 5, readTs: 3, reads: ["A"], writes: {} },
        ];
        const frames = [...mod.run({ transactions })];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["decisions"]).toEqual(reference(transactions).decisions);

        const readKeys = meta?.["readKeys"] as string[];
        const readTx = meta?.["readTx"] as number[];
        const readTs = meta?.["readTs"] as number[];
        const readValues = meta?.["readValues"] as number[];
        const expectedReads = reference(transactions).reads;
        expect(readKeys.length).toBe(expectedReads.length);
        for (let i = 0; i < expectedReads.length; i += 1) {
            expect(readKeys[i]).toBe(expectedReads[i]?.key);
            expect(readTx[i]).toBe(expectedReads[i]?.tx);
            expect(readTs[i]).toBe(expectedReads[i]?.ts);
            expect(readValues[i]).toBe(expectedReads[i]?.value);
        }
        expect(readValues).toEqual([0, 10, 10, 20]);
    });

    it("never stores a version from an aborted writer", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        const chainText = meta?.["chainText"] as string[];
        expect(chainText.join(" ")).not.toContain("=30");
        expect(Number(meta?.["aborted"])).toBe(1);
        expect(Number(meta?.["committed"])).toBe(2);
    });

    it("serializes readers that never block writers", () => {
        const transactions: Tx[] = [
            { id: 1, readTs: 0, writes: { X: 5 } },
            { id: 2, readTs: 0, reads: ["X"] },
            { id: 3, readTs: 1, reads: ["X"] },
        ];
        const frames = [...mod.run({ transactions })];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        expect(Number(meta?.["aborted"])).toBe(0);
        expect(meta?.["readValues"]).toEqual([0, 5]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(3);
        expect(generator.next().done).toBe(true);
    });
});
