/**
 * Security Utilities for Input Sanitization, Password Complexity,
 * and OWASP Top 10 Protection.
 */

export interface PasswordValidationResult {
  isValid: boolean;
  message?: string;
  errors: string[];
}

/**
 * Validates password strength according to OWASP Authentication Guidelines:
 * - Minimum 8 characters, maximum 128 characters (prevents DoS on bcrypt)
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one number (0-9)
 * - At least one special character (!@#$%^&*()_+-=[]{};':"|,.<>/?)
 * - Rejects trivial/common dictionary passwords
 */
export function validatePasswordStrength(password: unknown): PasswordValidationResult {
  const errors: string[] = [];

  if (typeof password !== 'string') {
    return {
      isValid: false,
      message: 'Password must be a string.',
      errors: ['Password must be a string.'],
    };
  }

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long.');
  }

  if (password.length > 128) {
    errors.push('Password must not exceed 128 characters.');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter (A-Z).');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter (a-z).');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number (0-9).');
  }

  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&* etc.).');
  }

  // Reject common dictionary passwords
  const commonWeakPasswords = [
    'password',
    'password123',
    '12345678',
    'admin123',
    'welcome123',
    'qwerty123',
    'letmein123',
  ];

  if (commonWeakPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common and easily guessable.');
  }

  return {
    isValid: errors.length === 0,
    message: errors.length > 0 ? errors[0] : undefined,
    errors,
  };
}

/**
 * Validates email address format strictly using standard RFC 5322 regex.
 */
export function validateEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return false;
  
  // RFC 5322 compliant regex pattern
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(trimmed);
}

/**
 * Sanitizes user input string against XSS, null bytes, and script injection (OWASP A03: Injection).
 */
export function sanitizeString(input: unknown): string {
  if (typeof input !== 'string') return '';

  return input
    // Remove null bytes
    .replace(/\0/g, '')
    // Strip HTML/script tags
    .replace(/<[^>]*>?/gm, '')
    // Replace dangerous javascript: pseudo-protocols
    .replace(/javascript\s*:/gi, '')
    .trim();
}

