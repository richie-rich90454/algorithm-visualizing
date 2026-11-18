/**
 * codeExport.test.ts – Checks that every generated sketch is labeled as
 * pseudocode-derived and actually contains the algorithm's pseudocode.
 */

import { describe, expect, it } from "vitest";
import { EXPORT_LANGUAGES, exportCode } from "../codeExport";
import type { AlgorithmModule } from "@/types";

const module = {
    id: "bubble-sort",
    name: "Bubble Sort",
    complexity: { time: "O(n^2)", space: "O(1)" },
    defaultInput: [3, 1, 2],
    pseudocode: ["repeat until no swaps", "compare adjacent items"],
} as Pick<AlgorithmModule, "id" | "name" | "complexity" | "defaultInput" | "pseudocode">;

describe("code export", () => {
    it("labels every language as pseudocode-derived", () => {
        for (const language of EXPORT_LANGUAGES) {
            const source = exportCode(module, language.id);
            expect(source).toContain("Pseudocode-derived");
            expect(source).toContain("NOT the canonical implementation");
            expect(source).toContain("Bubble Sort");
        }
    });

    it("includes the pseudocode lines as comments", () => {
        const source = exportCode(module, "python");
        expect(source).toContain("repeat until no swaps");
        expect(source).toContain("compare adjacent items");
        expect(source).toContain("def bubble_sort(");
    });

    it("emits a runnable Java class shape", () => {
        const source = exportCode(module, "java");
        expect(source).toContain("public class BubbleSort");
        expect(source).toContain("public Object run(Object data)");
    });
});
