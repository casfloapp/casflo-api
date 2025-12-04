import { performance } from 'node:perf_hooks';

// Performance monitoring
export class Performance {
  static startTimer(label = 'default') {
    return {
      label,
      startTime: performance.now(),
      end: () => {
        const endTime = performance.now();
        const duration = endTime - this.startTime;
        return {
          label: this.label,
          duration: Math.round(duration * 100) / 100, // Round to 2 decimal places
          startTime: this.startTime,
          endTime
        };
      }
    };
  }

  static formatDuration(ms) {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
  }

  static getMemoryUsage() {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return {
        rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100, // MB
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100, // MB
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100, // MB
        external: Math.round(usage.external / 1024 / 1024 * 100) / 100 // MB
      };
    }
    return null;
  }
}

// ID generation utilities
export class IdGenerator {
  static generateId(prefix = '') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return prefix ? `${prefix}-${timestamp}${random}` : `${timestamp}${random}`;
  }

  static generateUUID() {
    return crypto.randomUUID();
  }

  static generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  static generateSessionId() {
    return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
  }
}

// String utilities
export class StringUtils {
  static sanitize(str, maxLength = 1000) {
    if (!str) return '';
    return str
      .trim()
      .substring(0, maxLength)
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters
  }

  static slugify(str) {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }

  static escapeHtml(str) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return str.replace(/[&<>"']/g, char => map[char]);
  }

  static maskEmail(email) {
    if (!email) return '';
    const [username, domain] = email.split('@');
    if (username.length <= 2) return `${username[0]}*@${domain}`;
    return `${username[0]}${'*'.repeat(username.length - 2)}${username[username.length - 1]}@${domain}`;
  }

  static maskPhone(phone) {
    if (!phone) return '';
    const visible = 4;
    return phone.slice(0, 2) + '*'.repeat(phone.length - visible - 2) + phone.slice(-visible);
  }
}

// Validation utilities
export class ValidationUtils {
  static isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  static isValidPhone(phone) {
    const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
  }

  static isValidPassword(password) {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  }

  static sanitizeFileName(fileName) {
    return fileName
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .toLowerCase();
  }
}

// Date utilities
export class DateUtils {
  static formatDate(date, format = 'ISO') {
    const d = new Date(date);
    if (isNaN(d.getTime())) return null;

    switch (format) {
      case 'ISO':
        return d.toISOString();
      case 'DATE':
        return d.toISOString().split('T')[0];
      case 'DATETIME':
        return d.toISOString().replace('T', ' ').substring(0, 19);
      case 'TIME':
        return d.toTimeString().substring(0, 8);
      case 'READABLE':
        return d.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      default:
        return d.toISOString();
    }
  }

  static addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  static addMonths(date, months) {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  }

  static addYears(date, years) {
    const result = new Date(date);
    result.setFullYear(result.getFullYear() + years);
    return result;
  }

  static getPeriodDates(period, customStartDate = null, customEndDate = null) {
    const now = new Date();
    const start = new Date();
    const end = new Date();

    switch (period) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'week':
        start.setDate(now.getDate() - now.getDay());
        start.setHours(0, 0, 0, 0);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      case 'month':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        start.setMonth(quarter * 3, 1);
        start.setHours(0, 0, 0, 0);
        end.setMonth((quarter + 1) * 3, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'year':
        start.setMonth(0, 1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(11, 31);
        end.setHours(23, 59, 59, 999);
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          return {
            start: new Date(customStartDate),
            end: new Date(customEndDate)
          };
        }
        throw new Error('Custom period requires start and end dates');
      default:
        throw new Error('Invalid period specified');
    }

    return { start, end };
  }
}

// Encryption utilities
export class EncryptionUtils {
  static async hashPassword(password, saltRounds = 12) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    
    const bits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      key,
      256
    );
    
    const hashArray = Array.from(new Uint8Array(bits));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
    
    return `${saltHex}:${hashHex}`;
  }

  static async verifyPassword(password, hash) {
    try {
      const [saltHex, storedHash] = hash.split(':');
      const salt = new Uint8Array(saltHex.match(/.{2}/g).map(byte => parseInt(byte, 16)));
      
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      );
      
      const bits = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        key,
        256
      );
      
      const hashArray = Array.from(new Uint8Array(bits));
      const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      return computedHash === storedHash;
    } catch (error) {
      return false;
    }
  }

  static generateSecureToken(length = 32) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
}

// Async utilities
export class AsyncUtils {
  static async withTimeout(promise, timeoutMs = 30000, timeoutError = 'Operation timeout') {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(timeoutError)), timeoutMs);
    });
    
    return Promise.race([promise, timeoutPromise]);
  }

  static async retry(fn, maxAttempts = 3, delay = 1000, backoff = 2) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxAttempts) {
          throw lastError;
        }
        
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(backoff, attempt - 1)));
      }
    }
    
    throw lastError;
  }

  static async parallel(tasks, concurrency = 5) {
    const results = [];
    const executing = [];
    
    for (const task of tasks) {
      const promise = Promise.resolve(task()).then(result => {
        executing.splice(executing.indexOf(promise), 1);
        return result;
      });
      
      results.push(promise);
      executing.push(promise);
      
      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }
    }
    
    return Promise.all(results);
  }
}

// File utilities
export class FileUtils {
  static getFileExtension(filename) {
    return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
  }

  static getFileMimeType(filename) {
    const ext = this.getFileExtension(filename).toLowerCase();
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'txt': 'text/plain',
      'csv': 'text/csv'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }

  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  static isValidImageType(filename) {
    const validTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    return validTypes.includes(this.getFileExtension(filename).toLowerCase());
  }

  static isValidDocumentType(filename) {
    const validTypes = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv'];
    return validTypes.includes(this.getFileExtension(filename).toLowerCase());
  }
}

export default {
  Performance,
  IdGenerator,
  StringUtils,
  ValidationUtils,
  DateUtils,
  EncryptionUtils,
  AsyncUtils,
  FileUtils
};