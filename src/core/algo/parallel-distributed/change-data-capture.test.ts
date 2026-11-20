/**
 * change-data-capture.test.ts - Independent replay cross-check for the
 * materialized replica, plus frame-shape and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./change-data-capture";
import type { VisualFrame } from "@/types";

interface Change {
    seq: number;
    op: "INSERT" | "UPDATE" | "DELETE";
    key: string;
    value: string;
}

/** Reference CDC replay that produces the expected table and event stream. */
function reference(changes: Change[]) {
    const table = new Map<string, string>();
    const events: string[] = [];
    let lastLsn = 0;
    for (const c of [...changes].sort((a, b) => a.seq - b.seq)) {
        const before = table.get(c.key);
        let after: string | undefined;
        if (c.op === "DELETE") {
            table.delete(c.key);
        } else {
            table.set(c.key, c.value);
            after = c.value;
        }
        lastLsn = Math.max(lastLsn, c.seq);
        events.push(`lsn=${c.seq} ${c.op} ${c.key} ${before ?? "null"}->${after ?? "null"}`);
    }
    return { table: [...table.entries()].map(([k, v]) => `${k}=${v}`), events, lastLsn };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["cols"]).toBe(2);
        const table = frame.meta["table"] as string[];
        expect(frame.entities.length).toBe(table.length * 2);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Change Data Capture", () => {
    it("replays changes into the same table and event stream as the reference", () => {
        const input = mod.defaultInput as { changes: Change[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const finalMeta = frames[frames.length - 1]?.meta;
        const expected = reference(input.changes);
        expect(finalMeta["table"]).toEqual(expected.table);
        expect(finalMeta["events"]).toEqual(expected.events);
        expect(finalMeta["lastLsn"]).toBe(expected.lastLsn);
        expect(finalMeta["applied"]).toBe(input.changes.length);
    });

    it("sorts out-of-order log records before applying them", () => {
        const changes: Change[] = [
            { seq: 5, op: "UPDATE", key: "a", value: "x" },
            { seq: 1, op: "INSERT", key: "a", value: "base" },
            { seq: 9, op: "DELETE", key: "a", value: "" },
            { seq: 3, op: "INSERT", key: "b", value: "bee" },
        ];
        const frames = [...mod.run({ changes })];
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(finalMeta["table"]).toEqual(reference(changes).table);
        expect(finalMeta["lastLsn"]).toBe(9);
        const eventSeqs = (finalMeta["events"] as string[]).map((e) => Number(e.match(/lsn=(\d+)/)?.[1]));
        expect(eventSeqs).toEqual([1, 3, 5, 9]);
    });

    it("handles an empty stream without throwing", () => {
        const frames = [...mod.run({ changes: [] })];
        checkFrames(frames);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(finalMeta["table"]).toEqual([]);
        expect(finalMeta["lastLsn"]).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
