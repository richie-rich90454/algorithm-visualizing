import { describe, expect, it } from "vitest";
import mod from "./irving-stable-roommates";
import type { VisualFrame } from "@/types";

type Input = { people: string[]; preferences: Record<string, string[]> };

function rank(input: Input): Map<string, Map<string, number>> {
    const result = new Map<string, Map<string, number>>();
    for (const p of input.people) {
        result.set(p, new Map((input.preferences[p] ?? []).map((q, i) => [q, i])));
    }
    return result;
}

/** Check whether a perfect matching is blocked by any acceptable pair. */
function stableMatchings(input: Input, match: Map<string, string>): boolean {
    const r = rank(input);
    for (const a of input.people) {
        for (const b of input.people) {
            if (a >= b || match.get(a) === b) {
                continue;
            }
            const partnerA = match.get(a);
            const partnerB = match.get(b);
            const aPrefers = partnerA === undefined ||
                (r.get(a)?.get(b) ?? Infinity) < (r.get(a)?.get(partnerA ?? "") ?? Infinity);
            const bPrefers = partnerB === undefined ||
                (r.get(b)?.get(a) ?? Infinity) < (r.get(b)?.get(partnerB ?? "") ?? Infinity);
            if (aPrefers && bPrefers) {
                return false;
            }
        }
    }
    return true;
}

/** Enumerate every perfect matching; report whether any stable one exists. */
function bruteForceStableExists(input: Input): boolean {
    let found = false;
    const recurse = (remaining: string[], match: Map<string, string>): void => {
        if (found || remaining.length === 0) {
            if (remaining.length === 0 && stableMatchings(input, match)) {
                found = true;
            }
            return;
        }
        const first = remaining[0] as string;
        for (let i = 1; i < remaining.length; i += 1) {
            const other = remaining[i] as string;
            match.set(first, other);
            match.set(other, first);
            recurse(remaining.filter((p) => p !== first && p !== other), match);
            match.delete(first);
            match.delete(other);
        }
    };
    recurse([...input.people], new Map());
    return found;
}

function checkFrames(frames: VisualFrame[], people: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(people);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Irving's Stable Roommates Algorithm", () => {
    it("agrees with brute force on the default solvable instance", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames, input.people.length);
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["stable"]).toBe(bruteForceStableExists(input));
        const pairs = (last?.["matching"] as string[]) ?? [];
        const match = new Map<string, string>();
        for (const pair of pairs) {
            const [a, b] = pair.split("-");
            if (a && b) {
                match.set(a, b);
                match.set(b, a);
            }
        }
        expect(stableMatchings(input, match)).toBe(true);
        expect(match.size).toBe(input.people.length);
    });

    it("agrees with brute force on random instances", () => {
        const people = ["A", "B", "C", "D", "E", "F"];
        for (let trial = 0; trial < 20; trial += 1) {
            const preferences: Record<string, string[]> = {};
            for (const p of people) {
                preferences[p] = [...people.filter((q) => q !== p)].sort(() => Math.random() - 0.5);
            }
            const input: Input = { people, preferences };
            const frames = [...mod.run(input)];
            const stable = frames[frames.length - 1]?.meta["stable"];
            expect(stable).toBe(bruteForceStableExists(input));
            if (stable) {
                const pairs = (frames[frames.length - 1]?.meta["matching"] as string[]) ?? [];
                const match = new Map<string, string>();
                for (const pair of pairs) {
                    const [a, b] = pair.split("-");
                    if (a && b) {
                        match.set(a, b);
                        match.set(b, a);
                    }
                }
                expect(stableMatchings(input, match)).toBe(true);
            }
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
