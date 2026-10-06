# Product proposal decisions

Approved by the project owner: 2026-10-06. Owner: FSD CLI maintainers.

| Proposal | Decision | Current capability | Re-entry condition |
| --- | --- | --- | --- |
| `add` command | Parking Lot | No general add/integration command | Approved user story, compatibility/ownership contract, rollback and scoped release brief |
| Plugin system | Parking Lot | No third-party plugin loader or public plugin API | Approved use case, trust/versioning model, API boundaries and maintenance owner |
| Arbitrary-app `migrate` command | Research under Task 37 | Existing-project audit/guided migration is supported; there is no CLI migrate command | Approve skill-only vs CLI, plan/write scope, framework coverage and legacy/rollback acceptance |

Parking Lot is not a scheduled release commitment. Research is not implemented
functionality. These proposals do not block the current CLI release. Any future
Commit decision requires its own user story, non-goals, acceptance criteria,
owner, security/compatibility assessment and release target.

[Existing-project support](EXISTING-PROJECT-SUPPORT.md) and
[managed upgrade](UPGRADE-ARCHITECTURE.md) remain separate from proposed CLI
migration automation; upgrade does not rewrite unowned business code.
