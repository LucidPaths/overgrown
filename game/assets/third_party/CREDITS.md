# Third-party asset credits

Rule (OQ-038): every third-party file under `game/assets/third_party/` needs one row in the table below, with a licence from the allow-list in `tools/check-credits.sh` (CC0-1.0, Public-Domain, MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, CC-BY-3.0, CC-BY-4.0, OFL-1.1).
Share-alike licences (CC-BY-SA-3.0, CC-BY-SA-4.0) are allowed only if the file keeps its licence and the Changes column says "share-alike kept".
Never add files with no or an unknown licence, personal-use-only, NonCommercial, NoDerivatives, or ripped or traced work. `Path` is relative to `third_party/`. CI runs `bash tools/check-credits.sh`.

| Path | Source URL | Licence | Author | Changes |
|------|------------|---------|--------|---------|
