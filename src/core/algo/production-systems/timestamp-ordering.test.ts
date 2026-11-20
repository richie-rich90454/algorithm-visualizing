/**
 * timestamp-ordering.test.ts - Independent reference, timestamp-order
 * property, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./timestamp-ordering";
import type { VisualFrame } from "@/types";

type Access = { tx: number; op: "read" | "write"; item: string };

/** Independent reference that decides every operation from scratch. */
function reference(items: string[], operations: Access[]) {
    const read: Record<string, number> = {};
    const write: Record<string, number> = {};
    for (const item of items) {
        read[item] = 0;
        write[item] = 0;
    }
    const verdicts: boolean[] = [];
    for (const access of operations) {
        const r = read[access.item] ?? 0;
        const w = write[access.item] ?? 0;
        const ok = access.op === "read" ? access.tx >= w : access.tx >= r && access.tx >= w;
        verdicts.push(ok);
        if (ok) {
            if (access.op === "read") {
                read[access.item] = Math.max(r, access.tx);
            } else {
                write[access.item] = access.tx;
            }
        }
    }
    return { verdicts, read, write };
}

function checkFrames(frames: VisualFrame[], itemCount: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(itemCount);
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Timestamp Ordering", () => {
    it("matches an independent reference on the default input", () => {
        const input = mod.defaultInput as { items: string[]; operations: Access[] };
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, input.items.length);
        const expected = reference(input.items, input.operations);
        const final = frames[frames.length - 1]?.meta;
        const actual = (final?.["verdicts"] as string[]).map((tag) => tag.endsWith("=ok"));
        expect(actual).toEqual(expected.verdicts);
        expect(final?.["readTS"]).toEqual(input.items.map((item) => expected.read[item]));
        expect(final?.["writeTS"]).toEqual(input.items.map((item) => expected.write[item]));
    });

    it("never accepts a write older than a prior reader or writer", () => {
        const items = ["A"];
        const operations: Access[] = [
            { tx: 25, op: "read", item: "A" },
            { tx: 10, op: "write", item: "A" },
            { tx: 30, op: "write", item: "A" },
            { tx: 20, op: "read", item: "A" },
        ];
        const frames = [...mod.run({ items, operations })];
        const verdicts = frames[frames.length - 1]?.meta["verdicts"] as string[];
        expect(verdicts).toEqual(["T25:read:A=ok", "T10:write:A=reject", "T30:write:A=ok", "T20:read:A=reject"]);
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
