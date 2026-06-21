import { InMemoryDataStore } from "../src/index.js";
import { runDataStoreConformance } from "./conformance.js";

runDataStoreConformance("InMemoryDataStore", () => new InMemoryDataStore());
