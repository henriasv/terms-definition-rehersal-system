# Review log

`reviews.jsonl`: one JSON object per line, append-only. The current scheduling state of every card is *derived* from it by replaying (`reduceLog()` in `src/lib/reviews.ts`); nothing else stores state.

## Card keys

`<slug>#fwd` (term → definition) and `<slug>#rev` (definition → term).

## Line types

Review:

```json
{"t":"2026-09-04T07:13:33.438Z","card":"salicylic-acid#fwd","rating":3,"ms":4200,
 "state":{"due":"2026-09-04T07:23:33.438Z","stability":2.3,"difficulty":2.1,"elapsed_days":0,
          "scheduled_days":0,"learning_steps":1,"reps":1,"lapses":0,"state":1,"last_review":"2026-09-04T07:13:33.438Z"}}
```

`rating` 1–4 = Again, Hard, Good, Easy. `ms` is time-to-answer, optional. `state` is the FSRS card after the rating (ts-fsrs `Card`, dates as ISO strings; `state` 0 New, 1 Learning, 2 Review, 3 Relearning).

Rename (written by `terms rename` and the Rename button; moves both cards' history):

```json
{"t":"…","event":"rename","from":"old-slug","to":"new-slug"}
```

Reset (forget a card; write it by hand):

```json
{"t":"…","event":"reset","card":"old-slug#rev"}
```

Malformed lines are skipped, and `parseLog()` reports their line numbers.

## Why the state is stored on each line

Replaying only ratings would also work, but storing the resulting state makes the log self-describing, robust to parameter changes, and lets other tools read the current schedule with `tail`. Both are kept.
