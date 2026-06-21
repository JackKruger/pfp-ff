import "fake-indexeddb/auto";
import { IndexedDbDataStore } from "../src/index.js";
import { runDataStoreConformance } from "./conformance.js";

let counter = 0;
// Fresh database name per store so tests are isolated from one another.
runDataStoreConformance(
  "IndexedDbDataStore",
  () => new IndexedDbDataStore({ dbName: `pfp-test-${counter++}` }),
);
