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

  if (ip === '::1') {
    ip = '127.0.0.1';
  }

  return ip || '127.0.0.1';
};

/**
 * Strictly checks if a target IP matches any entry in the allowed IP pool.
 * NO DEFAULT BYPASSES: Every IP must explicitly match an entry in allowedPool.
 */
export const isIpInPool = (clientIp, allowedPool = []) => {
  // If pool is empty or invalid, NO ONE passes
  if (!allowedPool || allowedPool.length === 0) return false;

  const cleanClient = (clientIp || '').trim();
  if (!cleanClient) return false;

  return allowedPool.some(item => {
    const rawEntry = (typeof item === 'string' ? item : item.ip || '').trim();
    if (!rawEntry) return false;

    // Allow all wildcard entry
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

