/**
 * read-repair.test.ts - Brute-force repair check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./read-repair";
import type { VisualFrame } from "@/types";

interface Replica {
    value: string;
    version: number;
}

function checkFrames(frames: VisualFrame[], replicas: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(replicas);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Read Repair", () => {
    it("repairs exactly the stale replicas with the winning value", () => {
        const replicas: Replica[] = [
            { value: "blue", version: 3 },
            { value: "blue", version: 3 },
            { value: "blue", version: 3 },
            { value: "red", version: 2 },
            { value: "red", version: 1 },
        ];
        const frames = [...mod.run({ replicas })];
        checkFrames(frames, replicas.length);
        const meta = frames[frames.length - 1]!.meta;
        const maxVersion = Math.max(...replicas.map((r) => r.version));
        const expectedStale = replicas
            .map((r, i) => (r.version < maxVersion ? i : -1))
            .filter((i) => i >= 0);
        expect(meta["repairs"]).toBe(expectedStale.length);
        expect(meta["maxVersion"]).toBe(maxVersion);
        expect(meta["winningValue"]).toBe("blue");
        const finals = meta["finalValues"] as string[];
        expect(finals).toEqual(Array.from({ length: replicas.length }, () => `blue@${maxVersion}`));
    });

    it("needs no repairs when replicas already agree", () => {
        const replicas: Replica[] = [
            { value: "x", version: 5 },
            { value: "x", version: 5 },
            { value: "x", version: 5 },
        ];
        const frames = [...mod.run({ replicas })];
        expect(frames[frames.length - 1]!.meta["repairs"]).toBe(0);
        expect(frames[frames.length - 1]!.meta["conflict"]).toBe(false);
    });

    it("flags a split vote among newest replicas as a conflict", () => {
        const replicas: Replica[] = [
            { value: "x", version: 4 },
            { value: "y", version: 4 },
            { value: "x", version: 4 },
            { value: "y", version: 4 },
        ];
        const frames = [...mod.run({ replicas })];
        expect(frames[frames.length - 1]!.meta["conflict"]).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
