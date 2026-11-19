import { describe, expect, it } from "vitest";
import mod from "./hospital-residents-algorithm";
import type { VisualFrame } from "@/types";

type Input = {
    residents: string[];
    hospitals: string[];
    preferences: Record<string, string[]>;
    hospitalPreferences: Record<string, string[]>;
    capacities: Record<string, number>;
};

function isStable(input: Input, match: Record<string, string | null>): boolean {
    const held = new Map<string, string[]>();
    for (const h of input.hospitals) {
        held.set(h, []);
    }
    for (const r of input.residents) {
        const h = match[r] ?? null;
        if (h) {
            held.get(h)?.push(r);
        }
    }
    for (const h of input.hospitals) {
        if ((held.get(h) ?? []).length > (input.capacities[h] ?? 0)) {
            return false;
        }
    }
    for (const r of input.residents) {
        const current = match[r] ?? null;
        const currentRank = current ? (input.preferences[r] ?? []).indexOf(current) : Infinity;
        for (const h of input.preferences[r] ?? []) {
            if (h === current) {
                continue;
            }
            if ((input.preferences[r] ?? []).indexOf(h) >= currentRank) {
                continue;
            }
            const seats = held.get(h) ?? [];
            if (seats.length < (input.capacities[h] ?? 0)) {
                return false;
            }
            const hRank = input.hospitalPreferences[h] ?? [];
            const worse = seats.find((s) => hRank.indexOf(s) > hRank.indexOf(r));
            if (!hRank.includes(r) || worse !== undefined) {
                return false;
            }
        }
    }
    return true;
}

/** Enumerate all stable matchings and take each resident's best hospital. */
function residentOptimal(input: Input): Record<string, string | null> {
    const best: Record<string, string | null> = {};
    for (const r of input.residents) {
        best[r] = null;
    }
    const recurse = (i: number, match: Record<string, string | null>): void => {
        if (i === input.residents.length) {
            if (!isStable(input, match)) {
                return;
            }
            for (const r of input.residents) {
                const h = match[r] ?? null;
                if (!h) {
                    continue;
                }
                const current = best[r] ?? null;
                const curIndex = current ? (input.preferences[r] ?? []).indexOf(current) : Infinity;
                if ((input.preferences[r] ?? []).indexOf(h) < curIndex) {
                    best[r] = h;
                }
            }
            return;
        }
        const r = input.residents[i] as string;
        for (const h of [...(input.preferences[r] ?? []), null]) {
            match[r] = h;
            recurse(i + 1, match);
        }
        delete match[r];
    };
    recurse(0, {});
    return best;
}

function finalMatching(frames: VisualFrame[]): Record<string, string | null> {
    const nodes = frames[frames.length - 1]?.entities ?? [];
    const result: Record<string, string | null> = {};
    for (const node of nodes) {
        if (node.metadata["kind"] === "resident") {
            result[node.id.replace("resident-", "")] = (node.metadata["partner"] as string) || null;
        }
    }
    return result;
}

function checkFrames(frames: VisualFrame[], nodes: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(nodes);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Hospital/Residents Algorithm", () => {
    it("produces the resident-optimal stable matching", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames, input.residents.length + input.hospitals.length);
        const result = finalMatching(frames);
        expect(isStable(input, result)).toBe(true);
        expect(result).toEqual(residentOptimal(input));
    });

    it("matches brute force on small random instances", () => {
        const residents = ["r1", "r2", "r3"];
        const hospitals = ["A", "B"];
        for (let trial = 0; trial < 12; trial += 1) {
            const shuffled = <T>(list: T[]): T[] => [...list].sort(() => Math.random() - 0.5);
            const input: Input = {
                residents,
                hospitals,
                preferences: {
                    r1: shuffled(hospitals),
                    r2: shuffled(hospitals),
                    r3: shuffled(hospitals),
                },
                hospitalPreferences: {
                    A: shuffled(residents),
                    B: shuffled(residents),
                },
                capacities: { A: 2, B: 1 },
            };
            const frames = [...mod.run(input)];
            const result = finalMatching(frames);
            expect(isStable(input, result)).toBe(true);
            expect(result).toEqual(residentOptimal(input));
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
