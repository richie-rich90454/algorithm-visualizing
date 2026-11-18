/**
 * write-ahead-log-recovery.test.ts - Independent recovery reference, atomicity
 * properties, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./write-ahead-log-recovery";
import type { VisualFrame } from "@/types";

interface LogRecord {
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
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(frame.entities.every((entity) => entity.metadata["row"] === 0)).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Independent recovery: replay committed, roll back uncommitted. */
function reference(pages: Record<string, number>, log: LogRecord[]): Record<string, number> {
    const result = { ...pages };
    const committed = new Set<string>();
    for (const record of log) {
        if (record.type === "COMMIT") {
            committed.add(record.tx);
        }
    }
    for (const record of log) {
        if (record.type === "UPDATE" && committed.has(record.tx) && record.page) {
            result[record.page] = record.value ?? result[record.page]!;
        }
    }
    for (let i = log.length - 1; i >= 0; i -= 1) {
        const record = log[i]!;
        if (record.type === "UPDATE" && !committed.has(record.tx) && record.page) {
            result[record.page] = record.old ?? result[record.page]!;
        }
    }
    return result;
}

describe("write-ahead log recovery", () => {
    it("matches an independent recovery reference on several logs", () => {
        const cases: Array<{ pages: Record<string, number>; log: LogRecord[] }> = [
            {
                pages: { A: 5, B: 10, C: 0 },
                log: [
                    { type: "BEGIN", tx: "T1" },
                    { type: "UPDATE", tx: "T1", page: "A", old: 5, value: 8 },
                    { type: "BEGIN", tx: "T2" },
                    { type: "UPDATE", tx: "T2", page: "B", old: 10, value: 20 },
                    { type: "COMMIT", tx: "T1" },
                    { type: "UPDATE", tx: "T2", page: "C", old: 0, value: 3 },
                ],
            },
            {
                pages: { X: 1, Y: 2 },
                log: [
                    { type: "BEGIN", tx: "A" },
                    { type: "UPDATE", tx: "A", page: "X", old: 1, value: 9 },
                    { type: "COMMIT", tx: "A" },
                    { type: "BEGIN", tx: "B" },
                    { type: "UPDATE", tx: "B", page: "X", old: 9, value: 7 },
                    { type: "UPDATE", tx: "B", page: "Y", old: 2, value: 6 },
                ],
            },
            {
                pages: { P: 0 },
                log: [
                    { type: "BEGIN", tx: "C" },
                    { type: "UPDATE", tx: "C", page: "P", old: 0, value: 4 },
                    { type: "UPDATE", tx: "C", page: "P", old: 4, value: 5 },
                    { type: "ABORT", tx: "C" },
                ],
            },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames, Object.keys(testCase.pages).length);
            const want = reference(testCase.pages, testCase.log);
            const last = frames[frames.length - 1]?.meta;
            const names = last?.["pages"] as string[];
            const values = last?.["pageValues"] as number[];
            for (let i = 0; i < names.length; i += 1) {
                expect(values[i]).toBe(want[names[i]!]);
            }
        }
    });

    it("keeps committed work and rolls back partial work", () => {
        const input = mod.defaultInput as { pages: Record<string, number>; log: LogRecord[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, 3);
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["committed"]).toEqual(["T1"]);
        expect(last?.["uncommitted"]).toEqual(["T2"]);
        const names = last?.["pages"] as string[];
        const values = last?.["pageValues"] as number[];
        const final = Object.fromEntries(names.map((name, i) => [name, values[i]]));
        expect(final).toEqual({ A: 8, B: 10, C: 0 });
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
