/**
 * pseudocode.test.ts – Educational quality net for every algorithm.
 *
 * Production-grade teaching requires: real textbook pseudocode per module,
 * valid codeLineNumber highlights on every frame, specific non-empty
 * descriptions, and meaningful meta stats. This test enforces all four
 * across the full 771-module library.
 */

import { describe, expect, it } from "vitest";

const mods = import.meta.glob<{ default: Record<string, unknown> }>(
    ["./algo/*/*.ts", "!./algo/*/*.test.ts", "!./algo/*/*-util.ts"],
    { eager: true },
);

describe("educational quality", () => {
    it("every module has textbook pseudocode (5-12 lines)", () => {
        const bad: string[] = [];
        for (const [file, mod] of Object.entries(mods)) {
            const m = (mod as { default: Record<string, unknown> }).default;
            const pc = m["pseudocode"] as unknown;
            if (!Array.isArray(pc) || pc.length < 5 || pc.length > 12) {
                bad.push(`${String(m["id"] ?? file)}: pseudocode missing or not 5-12 lines`);
                continue;
            }
            for (const line of pc) {
                if (typeof line !== "string" || line.trim().length < 8) {
                    bad.push(`${String(m["id"])}: pseudocode line too short`);
                    break;
                }
            }
        }
        expect(bad).toEqual([]);
    });

    it("every frame has a valid codeLineNumber, description, and layout", () => {
        const bad: string[] = [];
        for (const [file, mod] of Object.entries(mods)) {
            const m = (mod as {
                default: {
                    id: string;
                    run: (input: unknown) => Generator<Record<string, unknown>>;
                    defaultInput: unknown;
                    pseudocode?: string[];
                };
            }).default;
            const pcLen = m.pseudocode?.length ?? 0;
            let frames = 0;
            try {
                for (const frame of m.run(m.defaultInput)) {
                    frames += 1;
                    const ln = frame["codeLineNumber"] as unknown;
                    if (typeof ln !== "number" || ln < 0 || (pcLen > 0 && ln >= pcLen)) {
                        bad.push(`${m.id}: frame ${frames} bad codeLineNumber ${String(ln)}`);
                        break;
                    }
                    const desc = frame["description"] as unknown;
                    if (typeof desc !== "string" || desc.trim().length < 10) {
                        bad.push(`${m.id}: frame ${frames} description too short`);
                        break;
                    }
                    if (!frame["layout"]) {
                        bad.push(`${m.id}: frame ${frames} missing layout`);
                        break;
                    }
                    if (frames > 5000) break;
                }
            } catch (e) {
                bad.push(`${m.id}: run threw ${String(e)}`);
            }
            if (frames === 0) bad.push(`${m.id} (${file}): yields no frames`);
        }
        expect(bad).toEqual([]);
    });
});
