/**
 * atomic-snapshot.test.ts - Independent double-collect reference, linearizability, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./atomic-snapshot";
import type { VisualFrame } from "@/types";

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

function reference(n: number, events: Event[]): { results: number[][]; history: number[][] } {
    const regs = Array.from({ length: n }, () => 0);
    const history: number[][] = [[...regs]];
    const results: number[][] = [];
    for (const e of events) {
        if (e.type === "update") {
            regs[Math.max(0, Math.min(n - 1, Math.floor(e.comp)))] = e.value;
            history.push([...regs]);
        } else {
            const first = [...regs];
            for (const u of e.interleave ?? []) {
                regs[Math.max(0, Math.min(n - 1, Math.floor(u.comp)))] = u.value;
                history.push([...regs]);
            }
            const second = [...regs];
            const result = first.every((v, i) => v === second[i]) ? second : [...regs];
            results.push(result);
        }
    }
    return { results, history };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.entities.length).toBe(frame.meta["rows"] as number);
        for (const e of frame.entities) expect(Number.isFinite(e.x) && Number.isFinite(e.y)).toBe(true);
        expect(frame.meta["registers"]).toBeDefined();
    });
}

function resultsFromFrames(frames: VisualFrame[]): number[][] {
    return frames.filter((f) => f.meta["phase"] === "result").map((f) => f.meta["lastScan"] as number[]);
}

describe("AtomicSnapshot", () => {
    it("matches an independent double-collect reference", () => {
        const events = (mod.defaultInput as { events: Event[] }).events;
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const ref = reference(3, events);
        expect(resultsFromFrames(frames)).toEqual(ref.results);
    });

    it("every returned snapshot existed at a real instant (linearizability)", () => {
        const extra: Event[] = [
            { type: "update", comp: 0, value: 4 },
            { type: "scan", label: "a" },
            { type: "update", comp: 1, value: 7 },
            { type: "scan", label: "b", interleave: [{ comp: 2, value: 9 }] },
            { type: "scan", label: "c" },
        ];
        const frames = [...mod.run({ components: 3, events: extra })];
        checkFrames(frames);
        const ref = reference(3, extra);
        const results = resultsFromFrames(frames);
        expect(results).toEqual(ref.results);
        for (const r of results) expect(ref.history.some((h) => h.every((v, i) => v === r[i]))).toBe(true);
        expect(frames.at(-1)!.meta["linearizable"]).toBe(true);
    });

    it("detects a change between collects and retries instead of returning a torn view", () => {
        const events: Event[] = [
            { type: "update", comp: 0, value: 1 },
            { type: "scan", label: "changed", interleave: [{ comp: 0, value: 2 }] },
        ];
        const frames = [...mod.run({ components: 2, events })];
        const retries = frames.filter((f) => f.meta["phase"] === "retry").length;
        expect(retries).toBe(1);
        expect(resultsFromFrames(frames)).toEqual([[2, 0]]);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of gen) count += 1;
        expect(count).toBeGreaterThan(3);
        expect(gen.next().done).toBe(true);
    });
});
