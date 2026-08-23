import os from 'os';

/**
 * Returns all local IPv4 network interface addresses on the host system (e.g. 192.168.29.5)
 */
export const getSystemNetworkIps = () => {
  const ips = [];
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const net of interfaces[name] || []) {
        const familyStr = String(net.family);
        if (familyStr === '4' || familyStr === 'IPv4') {
          if (net.address && net.address !== '127.0.0.1' && !net.address.startsWith('169.254.')) {
            ips.push(net.address);
          }
        }
      }
    }
  } catch (e) {
    console.error('Error fetching OS network interfaces:', e.message);
  }
  return ips;
};

/**
 * Extracts all candidate IPv4/IPv6 client IPs from Express request headers, socket, body, query, and network adapters.
 * Prioritizes the true client WAN/LAN IPv4 address from x-forwarded-for when behind reverse proxies (Render, Cloudflare, AWS).
 */
export const getCandidateIps = (req) => {
  const ips = new Set();

  // 1. Check explicit client IP passed in request body, query, or custom header
  if (req && req.body && req.body.clientIp) ips.add(req.body.clientIp.trim());
  if (req && req.query && req.query.clientIp) ips.add(req.query.clientIp.trim());
  if (req && req.headers && req.headers['x-client-ip']) ips.add(req.headers['x-client-ip'].trim());

  // 2. Extract real client IP from reverse proxy headers (Render, Cloudflare, AWS ALB)
  if (req && req.headers && req.headers['x-forwarded-for']) {
    // The FIRST IP in x-forwarded-for is ALWAYS the original client's public IPv4 address
    const forwardedList = req.headers['x-forwarded-for'].split(',').map(s => s.trim());
    if (forwardedList.length > 0 && forwardedList[0]) {
      ips.add(forwardedList[0]);
    }
  }
  if (req && req.headers && req.headers['x-real-ip']) ips.add(req.headers['x-real-ip'].trim());

  // 3. Express req.ip (populated when trust proxy is enabled)
  if (req && req.ip) ips.add(req.ip.trim());

  // 4. Socket remote address
  if (req && req.socket && req.socket.remoteAddress) ips.add(req.socket.remoteAddress.trim());

  // 5. Host system network interface IPv4 addresses (only when running locally, not in cloud containers)
  const isCloudEnv = Boolean(process.env.RENDER || process.env.NODE_ENV === 'production');
  if (!isCloudEnv) {
    getSystemNetworkIps().forEach(ip => ips.add(ip));
  }

  const nonLocal = [];
  const local = [];

  ips.forEach(raw => {
    let ip = raw;
    if (ip.startsWith('::ffff:')) ip = ip.substring(7);
    if (ip === '::1') ip = '127.0.0.1';
    if (ip) {
      if (ip === '127.0.0.1' || ip === 'localhost') {
        local.push(ip);
      } else {
        if (!nonLocal.includes(ip)) nonLocal.push(ip);
      }
    }
  });

  const cleaned = [...nonLocal, ...local];
  return cleaned.length > 0 ? cleaned : ['127.0.0.1'];
};

export const getClientIp = (req) => {
  const candidates = getCandidateIps(req);
  return candidates[0] || '127.0.0.1';
};

/**
 * Strictly checks if ANY candidate request IP matches an entry in the MongoDB allowed IP pool.
 * Supports exact IPs (192.168.29.5 or 157.48.20.10), wildcards (192.168.29.* or 157.48.*), and CIDR/ranges.
 */
export const isIpInPool = (candidateIps, allowedPool = []) => {
  if (!allowedPool || allowedPool.length === 0) return false;

  const targetList = Array.isArray(candidateIps) ? candidateIps : [candidateIps];

  return targetList.some(clientIp => {
    const cleanClient = (clientIp || '').trim();
    if (!cleanClient) return false;

    return allowedPool.some(item => {
      const rawEntry = (typeof item === 'string' ? item : item.ip || '').trim();
      if (!rawEntry) return false;

      // Allow all wildcard entry
      if (rawEntry === '*' || rawEntry === '0.0.0.0/0') return true;

      // Exact match e.g. 192.168.29.5 or 157.48.20.10
      if (rawEntry === cleanClient) return true;

      // Wildcard match e.g. 192.168.29.* or 157.48.*
      if (rawEntry.includes('*')) {
        const regexStr = '^' + rawEntry.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$';
        const regex = new RegExp(regexStr);
        if (regex.test(cleanClient)) return true;
      }

      // Range match e.g. 192.168.29.1-192.168.29.254
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
  });
};

const ipToLong = (ip) => {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  return parts.reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
};

export default { getClientIp, getCandidateIps, getSystemNetworkIps, isIpInPool };
