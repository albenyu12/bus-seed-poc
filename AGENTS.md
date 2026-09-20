# Project Instructions

## Project

This repository is a technical PoC for testing GPS based
bus stop stay detection and seed propagation.

Read `docs/POC_SPEC.md` before implementing behavior.
Read `docs/TEST_SCENARIOS.md` before modifying domain logic.


## Priority

Correctness and observability are more important than visual polish.

This is a PoC.
Do not introduce production architecture unless required by the specification.


## Architecture

Separate domain logic from browser APIs.

Domain logic must not directly depend on:
- navigator.geolocation
- React
- localStorage

Use adapters for browser specific APIs.

Keep GPS interpretation and state transitions testable with simulated data.


## Dependencies

Do not install a new production dependency unless it is clearly necessary.

Prefer browser APIs and small pure TypeScript functions.


## UI

The UI is a developer debug interface.

Prioritize:
- current coordinates
- GPS accuracy
- distance to stops
- current state
- dwell timers
- seed state
- event log

Do not spend time on visual polish.


## Tests

Domain state transitions must have automated tests.

Before completing a task run:

npm run test
npm run build

Do not report a task as complete when tests or build fail.


## Scope

Do not implement:
- authentication
- backend
- database server
- map SDK
- AI
- weather
- public transport APIs
- multiplayer features

unless the specification explicitly changes.


## Working Style

For non-trivial changes:

1. Inspect relevant files.
2. Explain the implementation plan.
3. Make the smallest change satisfying the requirement.
4. Run tests.
5. Run build.
6. Summarize changed files and remaining risks.

Do not silently change requirements.
If implementation reveals an ambiguity in the specification,
identify it explicitly.