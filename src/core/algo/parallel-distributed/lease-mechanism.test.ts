/**
 * lease-mechanism.test.ts - Independent lease rule, exclusivity, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./lease-mechanism";
import type { VisualFrame } from "@/types";

interface Attempt {
    owner: string;
    time: number;
    duration: number;
}

/** Independent reference for the lease acquisition rule. */
function reference(attempts: Attempt[]) {
    let holder: string | null = null;
    let expiry = Number.NEGATIVE_INFINITY;
    const acceptedFlags: boolean[] = [];
    for (const attempt of attempts) {
        const accepted = holder === null || attempt.time >= expiry || attempt.owner === holder;
        acceptedFlags.push(accepted);
        if (accepted) {
            holder = attempt.owner;
            expiry = attempt.time + attempt.duration;
        }
    }
    return { holder, expiry, acceptedFlags };
}

function checkFrames(frames: VisualFrame[], contenders: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(contenders);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(1);
        expect(frame.meta["cols"]).toBe(contenders);
    });
}

describe("Lease mechanism (teaching model)", () => {
    it("matches the reference acceptance rule on many attempt sequences", () => {
        const sequences: Attempt[][] = [
            [
                { owner: "A", time: 0, duration: 5 },
                { owner: "B", time: 2, duration: 5 },
                { owner: "A", time: 6, duration: 5 },
            ],
            [
                { owner: "A", time: 0, duration: 3 },
                { owner: "B", time: 3, duration: 3 },
                { owner: "C", time: 4, duration: 3 },
            ],
            [
                { owner: "X", time: 1, duration: 10 },
                { owner: "X", time: 2, duration: 10 },
                { owner: "Y", time: 5, duration: 2 },
                { owner: "Y", time: 12, duration: 2 },
            ],
            [{ owner: "A", time: 0, duration: 0 }],
        ];
        for (const attempts of sequences) {
            const frames = [...mod.run({ attempts })];
            const owners = [...new Set(attempts.map((a) => a.owner))];
            checkFrames(frames, owners.length);
            const want = reference(attempts);
            for (let i = 0; i < attempts.length; i += 1) {
                expect(frames[i + 1]?.meta["accepted"]).toBe(want.acceptedFlags[i]);
            }
            const last = frames[frames.length - 1]?.meta;
            const clock = attempts.length > 0 ? Math.max(...attempts.map((a) => a.time)) : 0;
            const valid = want.holder !== null && clock < want.expiry;
            expect(last?.["holder"]).toBe(valid ? want.holder : "");
            expect(last?.["holderValid"]).toBe(valid);
        }
    });

    it("never shows two holders at once", () => {
        const attempts: Attempt[] = [
            { owner: "A", time: 0, duration: 5 },
            { owner: "B", time: 1, duration: 5 },
            { owner: "B", time: 6, duration: 5 },
        ];
        const frames = [...mod.run({ attempts })];
        checkFrames(frames, 2);
        for (const frame of frames) {
            const holders = frame.entities.filter((e) => e.state === "sorted" || e.state === "active");
            expect(holders.length).toBeLessThanOrEqual(1);
        }
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
