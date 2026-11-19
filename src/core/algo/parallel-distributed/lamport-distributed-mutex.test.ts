/**
 * lamport-distributed-mutex.test.ts - Grant-order property, mutual exclusion, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./lamport-distributed-mutex";
import type { VisualFrame } from "@/types";

interface ReqSpec {
    proc?: number;
    time?: number;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const e of frame.entities) {
            expect(Number.isFinite(e.x) && Number.isFinite(e.y)).toBe(true);
            expect(e.type).toBe("node");
        }
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

function expectedOrder(specs: ReqSpec[], n: number): number[] {
    return specs
        .map((s) => {
            const p = Math.max(0, Math.min(n - 1, Math.floor(s.proc ?? 0)));
            const t = Math.max(0, Math.floor(s.time ?? 0)) + 1;
            return { p, t };
        })
        .sort((a, b) => (a.t !== b.t ? a.t - b.t : a.p - b.p))
        .map((x) => x.p);
}

describe("LamportDistributedMutex", () => {
    it("grants requests in (timestamp, process id) order", () => {
        const inputs: Array<{ processes: number; requests: ReqSpec[] }> = [
            { processes: 4, requests: (mod.defaultInput as { requests: ReqSpec[] }).requests },
            { processes: 5, requests: [{ proc: 3, time: 5 }, { proc: 1, time: 1 }, { proc: 3, time: 1 }, { proc: 0, time: 9 }] },
            { processes: 3, requests: [{ proc: 2, time: 0 }, { proc: 0, time: 0 }, { proc: 1, time: 4 }] },
        ];
        for (const input of inputs) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const grantOrder = frames.at(-1)!.meta["grantOrder"] as number[];
            expect(grantOrder).toEqual(expectedOrder(input.requests, input.processes));
        }
    });

    it("never shows two processes in the critical section at once", () => {
        const frames = [...mod.run(mod.defaultInput)];
        for (const frame of frames) {
            const inCS = frame.entities.filter((e) => e.metadata["inCS"] === true);
            expect(inCS.length).toBeLessThanOrEqual(1);
        }
    });

    it("each grant is followed by a release and all requests complete", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const grants = frames.filter((f) => f.meta["inCS"] !== -1).length;
        const releases = frames.filter((f) => (f.meta["last"] as string).includes("releases")).length;
        expect(grants).toBe(4);
        expect(releases).toBe(4);
        expect(frames.at(-1)!.meta["inCS"]).toBe(-1);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of gen) count += 1;
        expect(count).toBe(1 + 4 + 2 * 4 + 1);
        expect(gen.next().done).toBe(true);
    });
});
