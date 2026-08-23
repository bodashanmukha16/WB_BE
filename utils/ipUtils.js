import os from 'os';

/**
 * Helper to check if an IPv4 address belongs to a private LAN subnet (RFC 1918)
 * e.g. 192.168.x.x, 10.x.x.x, 172.16.x.x - 172.31.x.x
 */
export const isPrivateLanIp = (ip) => {
  if (!ip) return false;
  const clean = ip.trim();
  if (clean.startsWith('192.168.')) return true;
  if (clean.startsWith('10.')) return true;
  if (clean.startsWith('172.')) {
    const parts = clean.split('.');
    if (parts.length >= 2) {
      const second = parseInt(parts[1], 10);
      if (second >= 16 && second <= 31) return true;
    }
  }
  return false;
};

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
 * Differentiates between Localhost (prioritizes local LAN 192.168.x.x) and Cloud Proxies like Render (prioritizes x-forwarded-for client IP).
 */
export const getCandidateIps = (req) => {
  const clientIps = new Set();
  const serverIps = new Set();

  // 1. Explicit client-supplied IP (from frontend request body / query / header)
  if (req && req.body && req.body.clientIp) clientIps.add(req.body.clientIp.trim());
  if (req && req.query && req.query.clientIp) clientIps.add(req.query.clientIp.trim());
  if (req && req.headers && req.headers['x-client-ip']) clientIps.add(req.headers['x-client-ip'].trim());

  // 2. Client HTTP Request headers (from reverse proxies like Render / Cloudflare)
  let isBehindProxy = false;
  if (req && req.headers && req.headers['x-forwarded-for']) {
    isBehindProxy = true;
    req.headers['x-forwarded-for'].split(',').forEach(s => {
      const trimmed = s.trim();
      if (trimmed) clientIps.add(trimmed);
    });
  }
  if (req && req.headers && req.headers['x-real-ip']) {
    isBehindProxy = true;
    clientIps.add(req.headers['x-real-ip'].trim());
  }

  if (req && req.ip) clientIps.add(req.ip.trim());
  if (req && req.socket && req.socket.remoteAddress) clientIps.add(req.socket.remoteAddress.trim());

  // 3. Server host system network interface IPv4s
  getSystemNetworkIps().forEach(ip => serverIps.add(ip));

  const cleanList = (set) => {
    const list = [];
    set.forEach(raw => {
      let ip = raw;
      if (ip.startsWith('::ffff:')) ip = ip.substring(7);
      if (ip === '::1') ip = '127.0.0.1';
      if (ip && ip !== '127.0.0.1' && ip !== 'localhost') {
        if (!list.includes(ip)) list.push(ip);
      }
    });
    return list;
  };

  const cleanClient = cleanList(clientIps);
  const cleanServer = cleanList(serverIps);

  let candidates = [];
  if (isBehindProxy) {
    // On Render: client IP from x-forwarded-for is the real client IP (e.g. 49.37.129.163). Ignore Render container internal 10.x IP as primary.
    candidates = [...cleanClient, ...cleanServer, '127.0.0.1'];
  } else {
    // On Localhost: local system network interface (e.g. 192.168.29.5) is the primary LAN IP.
    const lanServerIps = cleanServer.filter(ip => isPrivateLanIp(ip));
    const otherServerIps = cleanServer.filter(ip => !isPrivateLanIp(ip));
    candidates = [...lanServerIps, ...cleanClient, ...otherServerIps, '127.0.0.1'];
  }

  // Deduplicate
  const result = [];
  candidates.forEach(ip => {
    if (ip && !result.includes(ip)) result.push(ip);
  });

  return result.length > 0 ? result : ['127.0.0.1'];
};

export const getClientIp = (req) => {
  const candidates = getCandidateIps(req);
  return candidates[0] || '127.0.0.1';
};

/**
 * Strictly checks if ANY candidate request IP matches an entry in the MongoDB allowed IP pool.
 * Supports exact IPs (192.168.29.5 or 49.37.129.163), wildcards (192.168.29.* or 49.37.*), and CIDR/ranges.
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

      // Exact match e.g. 192.168.29.5 or 49.37.129.163
      if (rawEntry === cleanClient) return true;

      // Wildcard match e.g. 192.168.29.* or 49.37.*
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

export default { getClientIp, getCandidateIps, getSystemNetworkIps, isIpInPool, isPrivateLanIp };
