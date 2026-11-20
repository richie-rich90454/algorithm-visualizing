/**
 * quorum-read-write.test.ts - Independent replication reference, exhaustive intersection check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./quorum-read-write";
import type { VisualFrame } from "@/types";

function subset(n: number, size: number, rotation: number): number[] {
    const result: number[] = [];
    for (let j = 0; j < Math.min(n, size); j += 1) result.push((rotation + j) % n);
    return result;
}

function reference(n: number, w: number, r: number, writes: number[]) {
    const versions = new Array<number>(n).fill(0);
    const values = new Array<number | null>(n).fill(null);
    let version = 0;
    for (let i = 0; i < writes.length; i += 1) {
        version += 1;
        for (const index of subset(n, w, i)) {
            versions[index] = version;
            values[index] = writes[i] ?? 0;
        }
    }
    const queried = subset(n, r, writes.length);
    let bestVersion = -1;
    let bestValue: number | null = null;
    for (const index of queried) {
        if ((versions[index] ?? 0) > bestVersion) {
            bestVersion = versions[index] ?? 0;
            bestValue = values[index] ?? 0;
        }
    }
    return { versions, readVersion: bestVersion, readValue: bestValue };
}

function* combinations(n: number, k: number, start = 0, chosen: number[] = []): Generator<number[]> {
    if (chosen.length === k) {
        yield [...chosen];
        return;
    }
    for (let i = start; i <= n - (k - chosen.length); i += 1) {
        chosen.push(i);
        yield* combinations(n, k, i + 1, chosen);
        chosen.pop();
    }
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.meta["rows"]).toBe(1);
        expect(frame.meta["cols"]).toBe(n);
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect((frame.meta["versions"] as number[]).length).toBe(n);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("QuorumReadWrite", () => {
    it("matches an independent replication simulation", () => {
        const cases: Array<{ n: number; w: number; r: number; writes: number[] }> = [
            { n: 5, w: 3, r: 3, writes: [10, 20, 30] },
            { n: 3, w: 2, r: 2, writes: [1, 2, 3, 4] },
            { n: 4, w: 2, r: 3, writes: [7] },
            { n: 4, w: 2, r: 2, writes: [5, 6] },
            { n: 1, w: 1, r: 1, writes: [9] },
        ];
        for (const { n, w, r, writes } of cases) {
            const frames = [...mod.run({ replicas: n, writeQuorum: w, readQuorum: r, writes })];
            checkFrames(frames, n);
            const expected = reference(n, w, r, writes);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["readVersion"]).toBe(expected.readVersion);
            expect(final?.["readValue"]).toBe(expected.readValue);
            expect(final?.["versions"]).toEqual(expected.versions);
            frames.slice(1, -1).forEach((frame, i) => {
                const afterWrite = reference(n, w, r, writes.slice(0, i + 1));
                expect(frame.meta["versions"]).toEqual(afterWrite.versions);
            });
        }
    });

    it("returns the latest write whenever R plus W exceeds N", () => {
        for (const { n, w, r } of [
            { n: 5, w: 3, r: 3 },
            { n: 3, w: 2, r: 2 },
            { n: 7, w: 4, r: 4 },
        ]) {
            const writes = [1, 2, 3, 4, 5];
            const frames = [...mod.run({ replicas: n, writeQuorum: w, readQuorum: r, writes })];
            expect(frames[frames.length - 1]?.meta["guaranteed"]).toBe(true);
            expect(frames[frames.length - 1]?.meta["correct"]).toBe(true);
            expect(frames[frames.length - 1]?.meta["readValue"]).toBe(5);
        }
    });

    it("exhaustively confirms subset intersection when R plus W exceeds N", () => {
        const n = 5;
        const wSets = [...combinations(n, 3)];
        const rSets = [...combinations(n, 3)];
        for (const writeSet of wSets) {
            for (const readSet of rSets) {
                const overlap = writeSet.some((index) => readSet.includes(index));
                expect(overlap).toBe(true);
            }
        }
        const smallWrite = [...combinations(n, 2)];
        const smallRead = [...combinations(n, 2)];
        const disjointExists = smallWrite.some((a) =>
            smallRead.some((b) => !a.some((index) => b.includes(index))),
        );
        expect(disjointExists).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
