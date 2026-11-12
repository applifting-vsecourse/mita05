# Architecture decision records

Decisions that are hard to undo or that affect more of the app than the feature that introduced them. Read the relevant ones before changing the data model or the structure of the app. To add one, copy the sections of an existing ADR (Status, Context, Decision, Options considered, Consequences), give it the next number, and add a line here.

| #                                                | Title                                                         | Status                         | Summary                                                                                                                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [0001](0001-deleted-quacks-become-tombstones.md) | A deleted quack with replies becomes a content-free tombstone | Accepted (not implemented yet) | Deleting a quack that has replies erases its text, mood and poll but keeps the row so the replies stay, which means every read of `Quack` must handle `deletedAt`/null text. |
