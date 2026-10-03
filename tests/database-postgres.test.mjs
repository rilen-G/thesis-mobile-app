// Run this entry point explicitly; it starts only a disposable localhost database.
// The suite awaits database teardown; --test-force-exit releases lingering Windows runner handles afterward.
process.env.OPERATIONS_TEST_ENGINE = 'postgres';
await import('./database.test.mjs');
