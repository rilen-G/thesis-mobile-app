// Run this entry point explicitly; it starts only a disposable localhost database.
process.env.OPERATIONS_TEST_ENGINE = 'postgres';
await import('./database.test.mjs');
