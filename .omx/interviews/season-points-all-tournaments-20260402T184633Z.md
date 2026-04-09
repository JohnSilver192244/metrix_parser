# Deep Interview Transcript Summary

- Profile: standard
- Context type: brownfield
- Final ambiguity: 0.16
- Threshold: 0.20
- Context snapshot: `.omx/context/unspecified-task-20260402T184633Z.md`

## Condensed Transcript

1. **Intent** — Fix season points so points accrue for all tournaments instead of only the best 4; make the system transparent so players see all earned points and which count toward standings.
2. **Desired outcome** —
   - On **Player** page: show all competitions for the selected season; top block contains the best leagues/tournaments, then a separator, then the remaining competitions with points.
   - “Best” means highest points; count of counted entries comes from season settings.
   - On **Players list** page: show two columns: total points (sum of all) and counted points (sum of best N).
   - Season filter is single-select; players do not view mixed-season points together.
3. **Scope boundary** — No automatic backfill/migration. User will manually rerun accrual with overwrite existing data to validate the fix.
4. **Non-goal** — Do not change DB tables.
5. **Decision boundary** — Any code-level decisions may be made autonomously; DB changes are forbidden; backward compatibility matters.
6. **Edge case / acceptance detail** — Count strictly N best entries. If points tie on the cutoff, choose the higher category; if categories tie, choose the competition with more players.

## Pressure-pass finding
The scope was pressure-tested around migration/backfill. Outcome: no automatic migration is needed; manual overwrite rerun is the accepted rollout/verification path.

## Brownfield evidence vs inference
- Evidence: current player and players-list flows already support a single season filter.
- Evidence: backend currently aggregates a single `season_points` total from `season_standings` for players list and one `seasonPoints` value per competition for player results.
- Inference: implementation will likely require additive API/model fields or derived presentation data while preserving backward compatibility.
