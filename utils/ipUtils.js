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
 * STRICTLY PRIORITIZES private LAN system IPv4 addresses (e.g. 192.168.29.5) FIRST.
 */
export const getCandidateIps = (req) => {
  const ips = new Set();

  // 1. Include local host OS network interface IPv4 addresses FIRST
  getSystemNetworkIps().forEach(ip => ips.add(ip));

  // 2. Include client-passed IP in body/query/headers (if provided by client app)
  if (req && req.body && req.body.clientIp) ips.add(req.body.clientIp.trim());
  if (req && req.query && req.query.clientIp) ips.add(req.query.clientIp.trim());
  if (req && req.headers && req.headers['x-client-ip']) ips.add(req.headers['x-client-ip'].trim());

  // 3. Include HTTP request headers & socket remote addresses
  if (req && req.headers && req.headers['x-forwarded-for']) {
    req.headers['x-forwarded-for'].split(',').forEach(s => {
      const trimmed = s.trim();
      if (trimmed) ips.add(trimmed);
    });
  }
  if (req && req.headers && req.headers['x-real-ip']) ips.add(req.headers['x-real-ip'].trim());
  if (req && req.ip) ips.add(req.ip.trim());
  if (req && req.socket && req.socket.remoteAddress) ips.add(req.socket.remoteAddress.trim());

  const privateLan = [];
  const publicWan = [];
  const localLoopback = [];

  ips.forEach(raw => {
    let ip = raw;
    if (ip.startsWith('::ffff:')) ip = ip.substring(7);
    if (ip === '::1') ip = '127.0.0.1';
    if (ip) {
      if (ip === '127.0.0.1' || ip === 'localhost') {
        if (!localLoopback.includes(ip)) localLoopback.push(ip);
      } else if (isPrivateLanIp(ip)) {
        if (!privateLan.includes(ip)) privateLan.push(ip);
      } else {
        if (!publicWan.includes(ip)) publicWan.push(ip);
      }
    }
  });

  // Prioritize private LAN IPv4 (192.168.x.x / 10.x.x.x) FIRST, then Public WAN, then loopback
  const cleaned = [...privateLan, ...publicWan, ...localLoopback];
  return cleaned.length > 0 ? cleaned : ['127.0.0.1'];
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
