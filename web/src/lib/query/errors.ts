/* The one error the read model raises.
 *
 * IT LIVES HERE RATHER THAN IN `lib/db/records.ts`, WHERE IT WAS BORN, AND THE
 * REASON IS MECHANICAL. `queries.ts` imports it as a VALUE -- it throws one --
 * and `records.ts` imports `node:fs`. A value import drags the whole module in,
 * so leaving the class there would put the filesystem into the browser bundle
 * the moment a client component reached a query. `structure.test.ts`'s "no
 * client component reaches a node builtin" would fire, and it would be right.
 *
 * `records.ts` RE-EXPORTS IT, so every existing call site is unchanged and
 * `repository.ts` still catches the same class it always did. There is one
 * definition; the old name is an alias for it.
 */

/** Raised when a record the catalog promised is not there.
 *
 * "There" is the published tree on the server and the shipped bundle in the
 * browser -- the same broken promise either way, which is why one class covers
 * both. `repository.ts` turns it into "re-run `python scripts/publish.py`".
 */
export class MissingRecord extends Error {}
