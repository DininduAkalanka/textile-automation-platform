import { uploadedImageRef } from '../common/config/exposure';
import { cloudinaryPublicId, cloudinarySignature } from './cloudinary';

const UUID = '0f8fad5b-d9cb-469f-a165-70867728950e';

describe('cloudinarySignature', () => {
  // The two worked examples on cloudinary.com/documentation/authentication_signatures.
  it('matches the documented timestamp-only example', () => {
    expect(cloudinarySignature({ timestamp: 1315060510 }, 'abcd')).toBe(
      'a21ad0f63beb4de2e5575204b79ab90bffb02c10',
    );
  });

  it('matches the documented example with several parameters, sorted by name', () => {
    expect(
      cloudinarySignature(
        {
          timestamp: 1315060510,
          public_id: 'sample_image',
          eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop',
        },
        'abcd',
      ),
    ).toBe('bfd09f95f331f558cbd1320e67aa8d488770583e');
  });
});

describe('cloudinaryPublicId', () => {
  it('drops the extension and adds the shop folder', () => {
    expect(cloudinaryPublicId(`${UUID}.jpg`)).toBe(`nandana-uploads/${UUID}`);
  });
});

describe('uploadedImageRef', () => {
  const original = process.env.CLOUDINARY_CLOUD_NAME;
  beforeEach(() => {
    process.env.CLOUDINARY_CLOUD_NAME = 'nandana-shop';
  });
  afterAll(() => {
    process.env.CLOUDINARY_CLOUD_NAME = original;
  });

  it('accepts disk uploads on any origin', () => {
    expect(
      uploadedImageRef(`https://api.example.com/uploads/${UUID}.png`)?.filename,
    ).toBe(`${UUID}.png`);
    expect(uploadedImageRef(`/uploads/${UUID}.webp`)?.filename).toBe(
      `${UUID}.webp`,
    );
  });

  it('accepts the shop cloud and folder, with or without a version', () => {
    const versioned = `https://res.cloudinary.com/nandana-shop/image/upload/v1719307544/nandana-uploads/${UUID}.jpg`;
    expect(uploadedImageRef(versioned)).toEqual({
      filename: `${UUID}.jpg`,
      url: versioned,
    });
    const plain = `https://res.cloudinary.com/nandana-shop/image/upload/nandana-uploads/${UUID}.jpg`;
    expect(uploadedImageRef(plain)).toEqual({
      filename: `${UUID}.jpg`,
      url: plain,
    });
  });

  it("rejects another account's cloud, another folder, http, and non-upload names", () => {
    expect(
      uploadedImageRef(
        `https://res.cloudinary.com/someone-else/image/upload/nandana-uploads/${UUID}.jpg`,
      ),
    ).toBeNull();
    expect(
      uploadedImageRef(
        `https://res.cloudinary.com/nandana-shop/image/upload/other/${UUID}.jpg`,
      ),
    ).toBeNull();
    expect(
      uploadedImageRef(
        `http://res.cloudinary.com/nandana-shop/image/upload/nandana-uploads/${UUID}.jpg`,
      ),
    ).toBeNull();
    expect(
      uploadedImageRef(
        'https://res.cloudinary.com/nandana-shop/image/upload/nandana-uploads/photo.jpg',
      ),
    ).toBeNull();
  });

  it('ignores Cloudinary URLs when Cloudinary is not configured', () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    expect(
      uploadedImageRef(
        `https://res.cloudinary.com/nandana-shop/image/upload/nandana-uploads/${UUID}.jpg`,
      ),
    ).toBeNull();
  });
});
