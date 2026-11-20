/** percolator.test.ts - Version visibility, atomic commit, abort checks, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./percolator";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], codeLines: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(codeLines);
        expect(frame.meta).toBeDefined();
        expect(frame.entities.length).toBe(Number(frame.meta["rows"]) * Number(frame.meta["cols"]));
        frame.entities.forEach((entity) => {
            expect(Number.isFinite(entity.x)).toBe(true);
            expect(Number.isFinite(entity.y)).toBe(true);
        });
    });
}

describe("Percolator distributed transaction", () => {
    it("commits all written rows atomically at one stamp with correct snapshot reads", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, mod.pseudocode?.length ?? 0);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["committed"]).toEqual(["B", "C"]);
        expect(final?.["locks"]).toEqual([]);
        expect(final?.["aborted"]).toBe(false);
        const versions = final?.["versions"] as string[];
        expect(versions[1]).toBe("20@11c");
        expect(versions[2]).toBe("30@11c");
        const reads = final?.["snapshotReads"] as string[];
        expect(reads).toContain("B@10 = 7");
        expect(reads).toContain("B@10 = 7");
        expect(reads).toContain("B@11 = 20");
        for (const frame of frames) {
            const committedCount = (frame.meta["committed"] as string[]).length;
            expect(committedCount).toBeGreaterThanOrEqual(0);
            expect(committedCount).toBeLessThanOrEqual(2);
        }
    });

    it("aborts a conflicting prewrite without leaving any committed version", () => {
        const frames = [...mod.run({ conflictRow: 2 })];
        checkFrames(frames, mod.pseudocode?.length ?? 0);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["aborted"]).toBe(true);
        expect(final?.["conflict"]).toBe("C");
        expect(final?.["committed"]).toEqual([]);
        expect(final?.["locks"]).toEqual([]);
        const versions = final?.["versions"] as string[];
        expect(versions[1]).toBe("");
        expect(versions[2]).toBe("");
        const cells = final ? frames[frames.length - 1]?.entities : undefined;
        expect(cells?.find((entity) => entity.metadata["name"] === "B")?.value).toBe(7);
        expect(cells?.find((entity) => entity.metadata["name"] === "C")?.value).toBe(9);
    });

    it("honors a custom commit stamp for snapshot visibility", () => {
        const frames = [...mod.run({ startTs: 20, commitTs: 25 })];
        const final = frames[frames.length - 1]?.meta;
        const versions = final?.["versions"] as string[];
        expect(versions[1]).toBe("20@25c");
        const reads = final?.["snapshotReads"] as string[];
        expect(reads).toContain("B@24 = 7");
        expect(reads).toContain("B@25 = 20");
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
