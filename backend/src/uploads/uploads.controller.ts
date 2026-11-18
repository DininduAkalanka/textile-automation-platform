import { closeSync, existsSync, mkdirSync, openSync, readSync, unlinkSync } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';

import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { diskStorage } from 'multer';

import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

/**
 * Image uploads for the admin catalogue and, separately, customer review
 * photos.
 *
 * Deliberately simple and dependency-free: multer (already bundled with
 * @nestjs/platform-express) streams the file to disk, and main.ts serves the
 * folder statically. That gives a real "browse my computer" picker without
 * requiring a Cloudinary account.
 *
 * Production note: the folder is mounted as a Docker volume so restarts don't
 * lose images. For a cloud deploy — and for Instagram, which requires a
 * publicly reachable URL — swapping this for Cloudinary is a drop-in change:
 * only the returned `url` has to come from somewhere else.
 */

const UPLOAD_DIR = join(process.cwd(), 'uploads');
if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Magic-number-free but mimetype + extension checked; doc 09 §10 caps at 2 MB.
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024;

const imageStorageOptions = {
  storage: diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      // Never trust the client's filename — random name, safe extension.
      const ext = extname(file.originalname).toLowerCase();
      const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext)
        ? ext
        : '.jpg';
      cb(null, `${randomUUID()}${safeExt}`);
    },
  }),
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      cb(
        new BadRequestException('Only JPG, PNG or WebP images are allowed.'),
        false,
      );
      return;
    }
    cb(null, true);
  },
};

function validateImageMagicBytes(filePath: string): boolean {
  try {
    const buffer = Buffer.alloc(12);
    const fd = openSync(filePath, 'r');
    readSync(fd, buffer, 0, 12, 0);
    closeSync(fd);

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return true;
    }
    // PNG: 89 50 4E 47
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return true;
    }
    // WebP: RIFF (bytes 0-3) and WEBP (bytes 8-11)
    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function toUploadResponse(file: Express.Multer.File, req: Request) {
  if (!file) {
    throw new BadRequestException('No image was received.');
  }

  // Magic bytes signature validation (QA-010)
  // Rejects spoofed non-image payloads (e.g. bash scripts with image/jpeg header)
  if (!validateImageMagicBytes(file.path)) {
    try {
      unlinkSync(file.path);
    } catch {}
    throw new BadRequestException(
      'Invalid image file signature. Only valid JPG, PNG, or WebP files are allowed.',
    );
  }

  // Absolute URL so it works in <img>, in captions, and (later) for the
  // Instagram Graph API, which will only accept a public URL.
  const base =
    process.env.PUBLIC_API_URL ?? `${req.protocol}://${req.get('host')}`;
  return {
    url: `${base}/uploads/${file.filename}`,
    filename: file.filename,
    size: file.size,
  };
}

@Controller('admin/uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UploadsController {
  @Post('image')
  @UseInterceptors(FileInterceptor('file', imageStorageOptions))
  uploadImage(@UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    return toUploadResponse(file, req);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', imageStorageOptions))
  upload(@UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    return toUploadResponse(file, req);
  }
}

/**
 * Review-photo upload. Separate controller (not a method on
 * UploadsController above) purely so it can sit outside the class-level
 * @Roles(ADMIN) guard: any authenticated customer may attach photos to their
 * own review, not just admins. Same disk/validation pipeline otherwise.
 */
@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class ReviewUploadsController {
  @Post('review-image')
  @UseInterceptors(FileInterceptor('file', imageStorageOptions))
  uploadReviewImage(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    return toUploadResponse(file, req);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', imageStorageOptions))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    return toUploadResponse(file, req);
  }
}
