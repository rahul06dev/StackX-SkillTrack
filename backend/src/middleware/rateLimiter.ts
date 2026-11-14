import type { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

export type RateLimiterMiddleware = ((
  req: Request,
  res: Response,
  next: NextFunction
) => void | Response | Promise<void | Response>) & {
  maxRequests: number;
  windowMs: number;
};

/**
 * In-memory sliding-window rate limiter for brute-force and DoS protection
 * (OWASP A04: Insecure Design & A07: Identification and Authentication Failures).
 */
export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  message: string;
}): RateLimiterMiddleware {
  const store = new Map<string, RateLimitRecord>();

  // Periodically cleanup expired entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (now > record.resetTime) {
        store.delete(key);
      }
    }
  }, 5 * 60 * 1000).unref();

  const middleware: any = (req: Request, res: Response, next: NextFunction) => {
    // Determine client IP safely
    const forwarded = req.headers['x-forwarded-for'];
    const clientIp = typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim()
      : req.socket?.remoteAddress || req.ip || 'unknown-client';

    const now = Date.now();
    let record = store.get(clientIp);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + options.windowMs,
      };
      store.set(clientIp, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, options.maxRequests - record.count);
    const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader('RateLimit-Limit', options.maxRequests);
    res.setHeader('RateLimit-Remaining', remaining);
    res.setHeader('RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > options.maxRequests) {
      res.setHeader('Retry-After', retryAfterSec);
      return res.status(429).json({
        message: options.message,
        retryAfter: `${retryAfterSec} seconds`,
      });
    }

    next();
  };

  middleware.maxRequests = options.maxRequests;
  middleware.windowMs = options.windowMs;

  return middleware as RateLimiterMiddleware;
}

/**
 * Safely evaluates whether the current execution environment is explicitly development.
 * Fails closed (returns false) if NODE_ENV is undefined, empty, 'production', or any unexpected value.
 */
export function isExplicitDevelopmentEnv(env: string | undefined = process.env.NODE_ENV): boolean {
  if (!env || typeof env !== 'string') return false;
  return env.trim().toLowerCase() === 'development';
}

/**
 * Returns the exact rate limit configuration for authentication routes based on environment.
 * Enforces production-safe limits when NODE_ENV is 'production', missing, or unexpected.
 */
export function getRateLimitConfig(env: string | undefined = process.env.NODE_ENV): {
  isDevelopment: boolean;
  loginMaxRequests: number;
  loginWindowMs: number;
  registerMaxRequests: number;
  registerWindowMs: number;
} {
  const isDev = isExplicitDevelopmentEnv(env);
  return {
    isDevelopment: isDev,
    loginMaxRequests: isDev ? 100 : 5,
    loginWindowMs: 15 * 60 * 1000,
    registerMaxRequests: isDev ? 1000 : 10,
    registerWindowMs: 60 * 60 * 1000,
  };
}

/**
 * Helper to instantiate authenticated rate limiters for any specific environment.
 */
export function createAuthRateLimiters(env: string | undefined = process.env.NODE_ENV) {
  const limits = getRateLimitConfig(env);
  return {
    login: createRateLimiter({
      windowMs: limits.loginWindowMs,
      maxRequests: limits.loginMaxRequests,
      message: 'Too many login attempts from this IP address. Please try again in 15 minutes.',
    }),
    register: createRateLimiter({
      windowMs: limits.registerWindowMs,
      maxRequests: limits.registerMaxRequests,
      message: 'Too many accounts registered from this IP address. Please try again later.',
    }),
    limits,
  };
}

const activeLimits = getRateLimitConfig();

// 5 attempts per 15 minutes for login in production-safe environments (100 in explicit development)
export const loginRateLimiter = createRateLimiter({
  windowMs: activeLimits.loginWindowMs,
  maxRequests: activeLimits.loginMaxRequests,
  message: 'Too many login attempts from this IP address. Please try again in 15 minutes.',
});

// 10 account registrations per hour per IP in production-safe environments (1,000 in explicit development)
export const registerRateLimiter = createRateLimiter({
  windowMs: activeLimits.registerWindowMs,
  maxRequests: activeLimits.registerMaxRequests,
  message: 'Too many accounts registered from this IP address. Please try again later.',
});

// 500 requests per 15 minutes for general API endpoints
export const generalApiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 500,
  message: 'Too many requests. Please slow down.',
});

