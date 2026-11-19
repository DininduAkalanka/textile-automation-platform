import {
  publicUploadUrl,
  swaggerEnabled,
  uploadedFilenameFrom,
} from './exposure';

const PHOTO = '0f8fad5b-d9cb-469f-a165-70867728950e.jpg';
const req = (host: string) => ({
  protocol: 'https',
  get: (name: string) => (name.toLowerCase() === 'host' ? host : undefined),
});

describe('exposure (QA P2-11, P2-15)', () => {
  const keys = [
    'NODE_ENV',
    'SWAGGER_ENABLED',
    'PUBLIC_API_URL',
    'RENDER_EXTERNAL_URL',
  ] as const;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of keys) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  describe('swaggerEnabled', () => {
    it('is OFF in production unless explicitly enabled', () => {
      process.env.NODE_ENV = 'production';
      expect(swaggerEnabled()).toBe(false);
      process.env.SWAGGER_ENABLED = 'true';
      expect(swaggerEnabled()).toBe(true);
    });

    it('is ON in development unless explicitly disabled', () => {
      process.env.NODE_ENV = 'development';
      expect(swaggerEnabled()).toBe(true);
      process.env.SWAGGER_ENABLED = 'false';
      expect(swaggerEnabled()).toBe(false);
    });
  });

  describe('publicUploadUrl', () => {
    it('never uses the Host header in production', () => {
      process.env.NODE_ENV = 'production';
      expect(publicUploadUrl(PHOTO, req('attacker.example'))).toBe(
        `/uploads/${PHOTO}`,
      );
    });

    it('prefers PUBLIC_API_URL, then RENDER_EXTERNAL_URL', () => {
      process.env.NODE_ENV = 'production';
      process.env.RENDER_EXTERNAL_URL = 'https://shop-api.onrender.com';
      expect(publicUploadUrl(PHOTO, req('attacker.example'))).toBe(
        `https://shop-api.onrender.com/uploads/${PHOTO}`,
      );
      process.env.PUBLIC_API_URL = 'https://api.shop.lk/';
      expect(publicUploadUrl(PHOTO)).toBe(
        `https://api.shop.lk/uploads/${PHOTO}`,
      );
    });

    it('adds https:// to a bare configured host', () => {
      process.env.PUBLIC_API_URL = 'api.shop.lk';
      expect(publicUploadUrl(PHOTO)).toBe(
        `https://api.shop.lk/uploads/${PHOTO}`,
      );
    });

    it('uses the request host only in local development', () => {
      process.env.NODE_ENV = 'development';
      expect(publicUploadUrl(PHOTO, req('localhost:3001'))).toBe(
        `https://localhost:3001/uploads/${PHOTO}`,
      );
    });
  });

  describe('uploadedFilenameFrom', () => {
    it.each([
      [`https://any.example/uploads/${PHOTO}`, PHOTO],
      [`/uploads/${PHOTO}`, PHOTO],
      [`https://any.example/uploads/${PHOTO}?v=1`, PHOTO],
      ['https://cdn.example/photo.jpg', null],
      ['/uploads/../../etc/passwd', null],
      ['/uploads/not-a-uuid.jpg', null],
      [`/uploads/${PHOTO.replace('.jpg', '.svg')}`, null],
      [`/other/uploads/${PHOTO}`, null],
    ])('%s -> %s', (url, expected) => {
      expect(uploadedFilenameFrom(url)).toBe(expected);
    });
  });
});
