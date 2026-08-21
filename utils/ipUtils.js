/**
 * Utility to extract clean IPv4/IPv6 client IP from Express request
 */
export const getClientIp = (req) => {
  let ip = '';
  if (req.headers['x-forwarded-for']) {
    ip = req.headers['x-forwarded-for'].split(',')[0].trim();
  } else if (req.headers['x-real-ip']) {
    ip = req.headers['x-real-ip'].trim();
  } else if (req.socket && req.socket.remoteAddress) {
    ip = req.socket.remoteAddress;
  } else if (req.ip) {
    ip = req.ip;
  }

  // Strip IPv6 prefix if mapped IPv4 (e.g. ::ffff:192.168.1.100 -> 192.168.1.100)
  if (ip && ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  // Handle localhost IPv6 loopback
  if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') {
    return '127.0.0.1';
  }

  return ip || '127.0.0.1';
};

/**
 * Checks if a target IP matches any entry in the allowed IP pool.
 * Allowed entries can be:
 * 1) Exact IP: "192.168.1.50"
 * 2) Wildcard IP: "192.168.1.*"
 * 3) Localhost: "127.0.0.1" / "localhost"
 * 4) Range: "192.168.1.10-192.168.1.100"
 */
export const isIpInPool = (clientIp, allowedPool = []) => {
  if (!allowedPool || allowedPool.length === 0) return true; // If pool is empty, default open

  const cleanClient = (clientIp || '').trim();

  // Allow localhost / dev loopback IPs automatically
  if (cleanClient === '127.0.0.1' || cleanClient === 'localhost' || cleanClient === '::1') {
    return true;
  }

  return allowedPool.some(item => {
    const rawEntry = (typeof item === 'string' ? item : item.ip || '').trim();
    if (!rawEntry) return false;

    // Allow all entry
    if (rawEntry === '*' || rawEntry === '0.0.0.0/0') return true;

    // Exact match
    if (rawEntry === cleanClient) return true;

    // Wildcard match e.g. 192.168.1.*
    if (rawEntry.includes('*')) {
      const regexStr = '^' + rawEntry.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$';
      const regex = new RegExp(regexStr);
      if (regex.test(cleanClient)) return true;
    }

    // Range match e.g. 192.168.1.10-192.168.1.100
    if (rawEntry.includes('-')) {
      const [startStr, endStr] = rawEntry.split('-').map(s => s.trim());
      const clientNum = ipToLong(cleanClient);
      const startNum = ipToLong(startStr);
      const endNum = ipToLong(endStr);

      if (clientNum !== null && startNum !== null && endNum !== null) {
        if (clientNum >= startNum && clientNum <= endNum) return true;
      }
    }

    return false;
  });
};

const ipToLong = (ip) => {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  return parts.reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
};

export default { getClientIp, isIpInPool };
