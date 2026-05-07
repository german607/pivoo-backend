import * as geoip from 'geoip-lite';

export function getClientIp(req: any): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return raw.split(',')[0].trim();
  }
  return req.ip ?? req.connection?.remoteAddress ?? null;
}

export function getCountryFromIp(ip: string | null): string | null {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return null;
  }
  // Strip IPv6-mapped IPv4 prefix (::ffff:1.2.3.4)
  const normalised = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  const geo = geoip.lookup(normalised);
  return geo?.country ?? null;
}
