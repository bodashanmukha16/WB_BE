import NodeCache from "node-cache";

// Standard TTL of 600 seconds (10 minutes), checkperiod for expired keys every 120 seconds
const memoryCache = new NodeCache({ stdTTL: 600, checkperiod: 120, useClones: false });

console.log("⚡ [In-Memory Cache] Zero-Cost High-Performance Node.js Cache Active.");

/**
 * Get cached item by key
 * @param {string} key 
 * @returns {Promise<any|null>}
 */
export const getCache = async (key) => {
  try {
    const value = memoryCache.get(key);
    if (value !== undefined) {
      console.log(`⚡ [Cache HIT] '${key}'`);
      return value;
    }
    console.log(`🗄️ [Cache MISS] '${key}' (Fetching from Database)`);
    return null;
  } catch (error) {
    console.warn(`⚠️ [Cache getCache Error] Key: ${key} - ${error.message}`);
    return null;
  }
};

/**
 * Set cache key with optional TTL (seconds)
 * @param {string} key 
 * @param {any} value 
 * @param {number} ttlSeconds 
 * @returns {Promise<boolean>}
 */
export const setCache = async (key, value, ttlSeconds = 600) => {
  try {
    if (ttlSeconds && ttlSeconds > 0) {
      memoryCache.set(key, value, ttlSeconds);
    } else {
      memoryCache.set(key, value);
    }
    return true;
  } catch (error) {
    console.warn(`⚠️ [Cache setCache Error] Key: ${key} - ${error.message}`);
    return false;
  }
};

/**
 * Delete one or multiple keys
 * @param {string|string[]} keys 
 * @returns {Promise<boolean>}
 */
export const delCache = async (keys) => {
  try {
    if (Array.isArray(keys)) {
      memoryCache.del(keys);
    } else if (keys) {
      memoryCache.del(keys);
    }
    return true;
  } catch (error) {
    console.warn(`⚠️ [Cache delCache Error] Keys: ${keys} - ${error.message}`);
    return false;
  }
};

/**
 * Delete all keys matching a wildcard pattern (e.g., 'org_exams:*')
 * @param {string} pattern 
 * @returns {Promise<boolean>}
 */
export const delPattern = async (pattern) => {
  try {
    const allKeys = memoryCache.keys();
    const regexPattern = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
    const matchingKeys = allKeys.filter((key) => regexPattern.test(key));

    if (matchingKeys.length > 0) {
      memoryCache.del(matchingKeys);
      console.log(`🧹 [In-Memory Cache Cleared] ${matchingKeys.length} keys matching pattern '${pattern}'`);
    }
    return true;
  } catch (error) {
    console.warn(`⚠️ [Cache delPattern Error] Pattern: ${pattern} - ${error.message}`);
    return false;
  }
};

/**
 * Flush all cached entries
 */
export const flushAllCache = async () => {
  try {
    memoryCache.flushAll();
    console.log("🧹 [In-Memory Cache Flushed All]");
    return true;
  } catch (error) {
    return false;
  }
};

export default {
  getCache,
  setCache,
  delCache,
  delPattern,
  flushAllCache
};
