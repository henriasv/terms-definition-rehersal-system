# Scheduling

The scheduler is FSRS (Free Spaced Repetition Scheduler) via the `ts-fsrs` package, the algorithm Anki adopted as its default. Each card carries stability, difficulty and a due date; a rating updates them and yields the next due date. Defaults target 90 % recall.

## Derived, not stored

Card state lives nowhere except as the last matching line in `reviews.jsonl`. On every request the log is replayed into a map of card → state. At personal scale (thousands of lines) this takes a millisecond and removes an entire class of consistency problems: there is no cache to invalidate and no second copy to drift.

## Two cards per term

Forward and reverse cards are independent. Learning to recognise a term and learning to produce it are different skills with different forgetting curves, so sharing a schedule would over- or under-review one of them.

## Sessions

A session is the set of cards due at start time plus a bounded batch of new cards. Learning-step cards (rated Again or Hard moments ago) reappear inside the session when their due time falls within the lookahead window, so a session ends with everything seen at least once at Good or better, or the user leaving.

## Undo

An undo appends an event rather than deleting a line. Replay pops the card's most recent state, so the log stays append-only and a later reader can still see that the rating happened and was withdrawn.

## Renames

A rename appends an event that redirects the old slug's history to the new one at replay time. Old lines are never rewritten, so the log stays append-only and diffs stay honest.

## Parameter fitting

`pnpm terms optimize` fits FSRS weights to the log with the Rust optimiser behind Anki's, and writes them to `config.json`. It needs a few hundred reviews to beat the defaults, so it refuses below that unless overridden.
