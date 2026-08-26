import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

let redisClient = null;
let isConnected = false;

try {
  const tlsEnabled = process.env.REDIS_TLS === "true" || (process.env.REDIS_HOST && process.env.REDIS_HOST.includes("upstash.io"));

  const redisOptions = {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    tls: tlsEnabled ? { rejectUnauthorized: false } : undefined,
    connectTimeout: 10000,
    maxRetriesPerRequest: 1, // Fail fast so DB fallback kicks in smoothly
    retryStrategy(times) {
      if (times > 5) {
        console.warn("⚠️ [Redis] Reached maximum reconnect attempts. Continuing with DB fallback mode.");
        return null; // Stop auto-reconnecting after 5 attempts to save resources
      }
      return Math.min(times * 1000, 3000);
    }
  };

  if (process.env.REDIS_URL) {
    // If URL is provided (e.g. rediss://default:pass@endpoint.upstash.io:6379)
    redisClient = new Redis(process.env.REDIS_URL, {
      ...redisOptions,
      tls: process.env.REDIS_URL.startsWith("rediss://") ? { rejectUnauthorized: false } : undefined
    });
  } else {
    redisClient = new Redis(redisOptions);
  }

  redisClient.on("connect", () => {
    console.log("⚡ [Redis] Connecting to Redis Server...");
  });

  redisClient.on("ready", () => {
    isConnected = true;
    console.log("✅ [Redis] Connection Ready. High-Performance Caching Active.");
  });

  redisClient.on("error", (err) => {
    isConnected = false;
    // Silently handle connection errors so MongoDB fallback continues without throwing unhandled errors
    console.warn(`⚠️ [Redis Cache Notice] Redis unreachable (${err.message}). System using MongoDB fallback.`);
  });

  redisClient.on("close", () => {
    isConnected = false;
  });
} catch (error) {
  console.warn("⚠️ [Redis Client Init Failed] Proceeding with MongoDB database direct mode:", error.message);
  redisClient = null;
  isConnected = false;
}

/**
 * Check if Redis connection is active and ready
 */
export const isRedisConnected = () => isConnected && redisClient && redisClient.status === "ready";

/**
 * Get cached item by key
 * @param {string} key 
 * @returns {Promise<any|null>}
 */
export const getCache = async (key) => {
  if (!isRedisConnected()) return null;
  try {
    const data = await redisClient.get(key);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  } catch (error) {
    console.warn(`⚠️ [Redis getCache Error] Key: ${key} - ${error.message}`);
    return null;
  }
};

/**
 * Set cache key with optional TTL (seconds). Default TTL = 600s (10 minutes)
 * @param {string} key 
 * @param {any} value 
 * @param {number} ttlSeconds 
 * @returns {Promise<boolean>}
 */
export const setCache = async (key, value, ttlSeconds = 600) => {
  if (!isRedisConnected()) return false;
  try {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await redisClient.setex(key, ttlSeconds, serialized);
    } else {
      await redisClient.set(key, serialized);
    }
    return true;
  } catch (error) {
    console.warn(`⚠️ [Redis setCache Error] Key: ${key} - ${error.message}`);
    return false;
  }
};

/**
 * Delete one or multiple keys
 * @param {string|string[]} keys 
 * @returns {Promise<boolean>}
 */
export const delCache = async (keys) => {
  if (!isRedisConnected()) return false;
  try {
    const targetKeys = Array.isArray(keys) ? keys : [keys];
    if (targetKeys.length > 0) {
      await redisClient.del(...targetKeys);
    }
    return true;
  } catch (error) {
    console.warn(`⚠️ [Redis delCache Error] Keys: ${keys} - ${error.message}`);
    return false;
  }
};

/**
 * Delete all keys matching a wildcard pattern (e.g., 'org_exams:*')
 * @param {string} pattern 
 * @returns {Promise<boolean>}
 */
export const delPattern = async (pattern) => {
  if (!isRedisConnected()) return false;
  try {
    const stream = redisClient.scanStream({
      match: pattern,
      count: 100
    });

    const keysToDelete = [];
    return new Promise((resolve) => {
      stream.on("data", (resultKeys) => {
        for (let i = 0; i < resultKeys.length; i++) {
          keysToDelete.push(resultKeys[i]);
        }
      });

      stream.on("end", async () => {
        if (keysToDelete.length > 0) {
          await redisClient.del(...keysToDelete);
          console.log(`🧹 [Redis Cache Cleared] ${keysToDelete.length} keys matching pattern '${pattern}'`);
        }
        resolve(true);
      });

      stream.on("error", (err) => {
        console.warn(`⚠️ [Redis delPattern Error] Pattern: ${pattern} - ${err.message}`);
        resolve(false);
      });
    });
  } catch (error) {
    console.warn(`⚠️ [Redis delPattern Exception] Pattern: ${pattern} - ${error.message}`);
    return false;
  }
};

export default {
  redisClient,
  isRedisConnected,
  getCache,
  setCache,
  delCache,
  delPattern
};
