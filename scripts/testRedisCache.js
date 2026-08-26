import { isRedisConnected, getCache, setCache, delCache, delPattern } from "../config/redisClient.js";

async function runRedisTest() {
  console.log("================ 🧪 TESTING REDIS CACHE SYSTEM ================");
  const connected = isRedisConnected();
  console.log(`🔌 Redis Connection Status: ${connected ? "CONNECTED (READY)" : "OFFLINE (DB FALLBACK ACTIVE)"}`);

  const testKey = "test:sample_exam_key";
  const sampleData = {
    examId: "EXAM_TEST_101",
    title: "Full-Stack Node.js & Redis Certification",
    questionsCount: 25,
    timestamp: Date.now()
  };

  console.log("\n1️⃣ Testing setCache...");
  const setSuccess = await setCache(testKey, sampleData, 60);
  console.log(`   setCache Status: ${setSuccess ? "SUCCESS ✅" : "FAILED / FALLBACK MODE ⚠️"}`);

  console.log("\n2️⃣ Testing getCache...");
  const retrieved = await getCache(testKey);
  console.log("   getCache Result:", retrieved);

  console.log("\n3️⃣ Testing delPattern...");
  const delSuccess = await delPattern("test:*");
  console.log(`   delPattern Status: ${delSuccess ? "SUCCESS ✅" : "FAILED ⚠️"}`);

  const afterDelete = await getCache(testKey);
  console.log("   getCache After Delete:", afterDelete);

  console.log("\n================ 🏁 REDIS TEST COMPLETED ================");
  process.exit(0);
}

runRedisTest();
