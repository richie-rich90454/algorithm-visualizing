# Contributing

Thanks for helping improve the Algorithm Visualization Engine. This document covers the local workflow, how to add an algorithm, and the quality bar every change must meet.

## Local workflow

The project uses [Bun](https://bun.sh). Install it first, then:

```sh
bun install                      # install dependencies
bun dev                          # start the dev server
bun test                         # run the unit tests
bun run build                    # type-check and produce a production build
bun scripts/gen-manifest.ts      # regenerate the algorithm manifest
bun scripts/quality-gate.ts      # run the content and consistency checks
```

Run `bun test`, `bun run build`, and `bun scripts/quality-gate.ts` before opening a pull request. If you add, rename, or remove an algorithm module, also run `bun scripts/gen-manifest.ts` and commit the regenerated manifest.

## Adding an algorithm

1. **Create the module.** Add `src/core/algo/<category>/<name>.ts` and export a default `AlgorithmModule`. Use a kebab-case `id` that matches the file name. Provide `name`, one of the 13 supported categories, truthful `complexity` (time and space), a deterministic `defaultInput`, the correct `visualType`, 5 to 12 lines of textbook `pseudocode`, and a `run` generator that yields `VisualFrame` objects.
2. **Map each frame to pseudocode.** Set `codeLineNumber` on every frame so the pseudocode panel highlights the line being executed.
3. **Write a caption per phase.** Each frame's `description` should say what is happening in that step, not repeat the module name.
4. **Add a test.** Create a companion `<name>.test.ts` that checks the frames are well formed, the generator terminates, and the final frame carries the expected result. For algorithms with a checkable answer, prefer a brute-force cross-check against a simple reference implementation over a smoke test.
5. **Regenerate the manifest.** Run `bun scripts/gen-manifest.ts` and commit the updated `src/core/manifest.ts`.
6. **Run the checks.** Run `bun test`, `bun run build`, and `bun scripts/quality-gate.ts`. All must pass.

Do not hand-edit `src/core/manifest.ts`; it is generated.

## Quality bar

- **Correctness:** The visualization must reflect the real algorithm. Verify the final result against a reference or brute-force implementation where feasible.
- **Completeness:** Pseudocode, description, complexity, and a deterministic default input are required for every module. No TODOs, placeholders, or empty frame descriptions.
- **Encoding:** Use plain UTF-8 with correct characters. No mojibake or replacement characters.
- **Language:** American English only. Use "visualization", "organize", "color", and "behavior". Avoid British spellings such as "visualisation", "organise", "colour", and "behaviour".
- **Tone:** Plain, factual language. No hype adjectives that cannot be defended.
- **Rendering:** Frames must use valid coordinates and a layout that matches their entity type. No NaN or Infinity positions.

The `quality-gate.ts` script checks several of these rules automatically; CI runs it on every pull request.

## Pull request checklist

- [ ] `bun install`, `bun test`, `bun run build`, and `bun scripts/quality-gate.ts` all pass locally.
- [ ] A test covers the new behavior or bug fix.
- [ ] The manifest was regenerated and committed if modules changed.
- [ ] New text is American English and free of mojibake and TODOs.
- [ ] Pseudocode and frame captions are present and accurate.
- [ ] The PR description explains what changed and why, and links any related issue.
- [ ] No unrelated files, generated artifacts, or secrets are included.

## Reporting issues and security

Use the issue templates for bugs and feature requests. For security vulnerabilities, do **not** open a public issue; follow the private reporting instructions in [SECURITY.md](SECURITY.md).

By participating, you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).
