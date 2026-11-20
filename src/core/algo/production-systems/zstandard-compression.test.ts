import { describe, expect, it } from "vitest";
import mod from "./zstandard-compression";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("text");
        expect(frame.entities.every((entity) => entity.type === "character")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independently expand the emitted token stream back to the plaintext. */
function expand(tokens: string[]): string {
    const out: string[] = [];
    for (const token of tokens) {
        const parts = token.split("|");
        if (parts[0] === "L") {
            out.push(parts[1] ?? "");
        } else if (parts[0] === "M") {
            const offset = Number(parts[1]);
            const length = Number(parts[2]);
            for (let k = 0; k < length; k += 1) {
                const source = out.length - offset;
                out.push(source >= 0 ? out[source] : "");
            }
        }
    }
    return out.join("");
}

describe("Zstandard-Style Compression", () => {
    it("round-trips the token stream and produces a prefix-free Huffman code", () => {
        const input = mod.defaultInput as { text: string };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        const tokens = meta?.["tokens"] as string[];
        const codes = (meta?.["codes"] as string[]).map((entry) => {
            const parts = entry.split("|");
            return { char: parts[0] ?? "", bits: parts.slice(1).join("|") };
        });

        expect(meta?.["decoded"]).toBe(input.text);
        expect(expand(tokens)).toBe(input.text);
        expect(meta?.["encodedSize"] as number).toBeLessThan(meta?.["originalSize"] as number);

        const bits = codes.map((code) => code.bits);
        for (let i = 0; i < bits.length; i += 1) {
            for (let j = 0; j < bits.length; j += 1) {
                if (i !== j) {
                    expect(bits[i]?.startsWith(bits[j] ?? "!")).toBe(false);
                }
            }
        }
        const literals = new Set(tokens.filter((token) => token.startsWith("L|")).map((token) => token.slice(2)));
        for (const char of literals) {
            expect(bits).toContain(codes.find((code) => code.char === char)?.bits);
        }
    });

    it("handles text with no repeated matches and single-symbol alphabets", () => {
        const unique = [...mod.run({ text: "abcdef", minMatch: 4 })];
        const uniqueMeta = unique[unique.length - 1]?.meta;
        expect(uniqueMeta?.["decoded"]).toBe("abcdef");
        expect(uniqueMeta?.["matchCount"]).toBe(0);
        expect(expand(uniqueMeta?.["tokens"] as string[])).toBe("abcdef");

        const single = [...mod.run({ text: "aaaaaaaa", minMatch: 4 })];
        const singleMeta = single[single.length - 1]?.meta;
        expect(singleMeta?.["decoded"]).toBe("aaaaaaaa");
        expect(expand(singleMeta?.["tokens"] as string[])).toBe("aaaaaaaa");
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
