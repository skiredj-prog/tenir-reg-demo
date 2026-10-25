# TENIR/REG — publication boundary (private QA vs shareable kit)

## Decision on 2026-10-25

The repository is **private** and the simulator is a **local educational prototype**. This change introduces a *separate, fail-closed* public-distribution preflight. It does **not** publish a website, release an archive, execute TENIR-Gov, or change the signed evidence bytes.

Use `index.html` for local review and `package_demo.py` for the *private*, verified distribution candidates. **Do not send either ZIP or publish the entire `references/` directory until the public gate has passed and manual approval is recorded.**

## Confirmed blocker

The CI inspection of the built consultation ZIP identified **two definite automated privacy blockers**: `references/manifest.json` and `references/architecture-sources.json` contain absolute Windows paths under the original author's local user profile. They are provenance metadata, not prerequisites for rendering the simulation. The consultation packaging currently carries these references verbatim. **Machine publication readiness is therefore FALSE (2 blockers)**; licensing and usability reviews remain independently open.

`tools/publication_audit.py` validates the ZIP inventory/digests, refuses unsafe archive paths, detects local-user-profile strings and embedded private PEM keys, and **never prints the matched content**. The script is deliberately separate from the source inventory covered by the existing signed dossier, so it can be introduced without silently rewriting or re-signing previous EvidenceRecords.

**Do not "fix" the ZIP by deleting or rewriting signed contents or swapping the provided public key.** A safe remediation requires:
1. Decide which third-party reference files may legally be redistributed. Retain original provenance in a private audit record, but remove unnecessary absolute local path strings from intended distributable sources.
2. Update the source templates/manifests in a controlled change; regenerate and independently verify the entire demo dossier, including `test-results.json`, evidence, receipt, generated HTML and source fingerprints.
3. Rebuild the consultation ZIP from the validated source tree and run the **strict** audit:
   ```sh
   python package_demo.py --output dist
   python verify.py output --public-key output/evidence.public.pem
   python tools/publication_audit.py dist/TENIR-REG-consultation.zip
   ```
4. Run a real FR/EN desktop/mobile navigation and accessibility check, and a short observed trial with the three target users described in `USER_WALKTHROUGH.md`.
5. Obtain **explicit owner authorization** for the exact archive digest, content, license/provenance, URL and deploy action.

## Automated checks and claims

GitHub Actions runs tests, signature verification and archive generation **without publishing artifacts**. The local-QA workflow can pass while the publication preflight reports blockers. This is intentional: a green simulation test does not imply public readiness.

Manual **workflow_dispatch** exposes a strict public-release-gate job: it fails if any machine-detectable blocker remains. Passing that job still does not waive legal/UX/owner authorization.

- The prototype's `GO LOCAL` is limited to a single in-memory process with a simulated provider.
- `PASS` is a historical adjudication; `UNKNOWN` is not proof of failure or success.
- Ed25519 proves consistency/attribution relative to a **trusted external public-key channel**. A self-contained public key plus dossier cannot authenticate the original signer by itself.
- Structural validity of REG catalog configurations does **not** establish TENIR-Gov 5.7.0 execution compatibility, production deployment, certification, or an exactly-once provider effect.
- CI scripts using a test DOM **do not** replace live browser, keyboard, assistive technology or customer usability testing.

## Minimal public-facing promise after gates pass

**TENIR/REG — Diagnostic & Evidence Workbench.** Explore a signed *simulated* outcome, distinguish authorization from effect and uncertainty, and examine candidate controls using a bounded structural catalogue. This is not a connected TENIR-Gov execution gateway.
