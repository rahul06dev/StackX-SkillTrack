import type { Request, Response, NextFunction } from 'express';

/**
 * OWASP Top 10 Security Headers Middleware (OWASP A05: Security Misconfiguration)
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  // Prevent MIME-sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Clickjacking protection: disallow iframe embedding
  res.setHeader('X-Frame-Options', 'DENY');

  // Legacy cross-site scripting filter
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // HTTP Strict Transport Security (HSTS)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // Referrer Policy: Send full URL for same-origin, domain-only for cross-origin, none for downgrade
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; frame-ancestors 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self';"
  );

  // Remove Express identification header
  res.removeHeader('X-Powered-By');

  next();
}

