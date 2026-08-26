import { getCache, setCache, delCache, delPattern } from "../config/cacheManager.js";

async function runMemoryCacheTest() {
  console.log("================ 🧪 TESTING ZERO-COST IN-MEMORY CACHE ================");

  const testKey = "test:sample_exam_key";
  const sampleData = {
    examId: "EXAM_TEST_202",
    title: "In-Memory Express API Certification",
    questionsCount: 30,
    timestamp: Date.now()
  };

  console.log("\n1️⃣ Testing setCache...");
  const setSuccess = await setCache(testKey, sampleData, 60);
  console.log(`   setCache Status: ${setSuccess ? "SUCCESS ✅" : "FAILED ❌"}`);

  console.log("\n2️⃣ Testing getCache...");
  const retrieved = await getCache(testKey);
  console.log("   getCache Result:", retrieved);

  console.log("\n3️⃣ Testing delPattern ('test:*')...");
  const delSuccess = await delPattern("test:*");
  console.log(`   delPattern Status: ${delSuccess ? "SUCCESS ✅" : "FAILED ❌"}`);

  const afterDelete = await getCache(testKey);
  console.log("   getCache After Delete:", afterDelete);

  console.log("\n================ 🏁 IN-MEMORY CACHE TEST COMPLETED ================");
  process.exit(0);
}

runMemoryCacheTest();
