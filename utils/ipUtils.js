/**
 * Extracts all candidate IPv4/IPv6 client IPs from Express request headers, socket, body, and query
 */
export const getCandidateIps = (req) => {
  const ips = new Set();

  if (req.body && req.body.clientIp) ips.add(req.body.clientIp.trim());
  if (req.query && req.query.clientIp) ips.add(req.query.clientIp.trim());
  if (req.headers['x-client-ip']) ips.add(req.headers['x-client-ip'].trim());

  if (req.headers['x-forwarded-for']) {
    req.headers['x-forwarded-for'].split(',').forEach(s => ips.add(s.trim()));
  }
  if (req.headers['x-real-ip']) ips.add(req.headers['x-real-ip'].trim());
  if (req.socket && req.socket.remoteAddress) ips.add(req.socket.remoteAddress.trim());
  if (req.ip) ips.add(req.ip.trim());

  const cleaned = [];
  ips.forEach(raw => {
    let ip = raw;
    if (ip.startsWith('::ffff:')) ip = ip.substring(7);
    if (ip === '::1') ip = '127.0.0.1';
    if (ip) cleaned.push(ip);
  });

  return cleaned.length > 0 ? cleaned : ['127.0.0.1'];
};

export const getClientIp = (req) => {
  const candidates = getCandidateIps(req);
  return candidates[0] || '127.0.0.1';
};

/**
 * Strictly checks if ANY candidate request IP matches an entry in the allowed IP pool.
 * Supports exact IPs (192.168.29.1), wildcards (192.168.29.*), and CIDR/ranges.
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

      // Exact match e.g. 192.168.29.1
      if (rawEntry === cleanClient) return true;

      // Wildcard match e.g. 192.168.29.*
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

export default { getClientIp, getCandidateIps, isIpInPool };

