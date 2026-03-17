import { createDatabase, setDb, type AppDatabase } from "../db/client.js";

/**
 * Create a fresh in-memory database for testing.
 * Call this in beforeEach to get isolated test state.
 */
export function createTestDb(): AppDatabase {
  const testDb = createDatabase(":memory:");
  setDb(testDb);
  return testDb;
}
