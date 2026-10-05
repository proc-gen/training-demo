/* Where the FIXTURE athlete's week manifests live, for the few tests that read
 * manifests rather than published records.
 *
 * NOT under `src/test/fixture/`, deliberately. That tree is copied to the
 * public demo with the app, and the manifests are where authored prose lives --
 * the reason the export carries none of them. So these tests read the Python
 * fixture athlete in place, at `tests/fixtures/athletes/fixture/weeks/`, which
 * never leaves this repository; in the demo's checkout the directory is absent
 * and each case guards on that, as they always did for `weeks/`.
 *
 * NEVER `registryDir()`: the suite's registry is the published fixture
 * (`vitest.config.mts`), which holds no manifests, and the real athlete's
 * `weeks/` is the athlete's history -- not test data.
 */

/** The Python fixture athlete's `weeks/` directory. May not exist.
 *
 * A plain string, NO `node:path` import: `tests/test_web_segregation.py` keeps
 * filesystem modules out of every non-test file but the data-access layer, and
 * this is a helper rather than a test. Node's `fs` takes the unnormalised
 * `..` segments as they are, on both separators. */
export const FIXTURE_WEEKS_DIR = `${import.meta.dirname}/../../../tests/fixtures/athletes/fixture/weeks`;
