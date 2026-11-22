import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readSync,
  unlinkSync,
} from 'fs';
import { extname } from 'path';
import { randomUUID } from 'crypto';

import {
  BadRequestException,
  CanActivate,
  Controller,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  Post,
  ServiceUnavailableException,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { UploadPurpose, UserRole } from '@prisma/client';
import type { Request } from 'express';
import { diskStorage } from 'multer';

import { publicUploadUrl } from '../common/config/exposure';
import {
  REVIEW_UPLOAD_THROTTLE_AT_LOAD,
  reviewUploadsPerDay,
} from '../common/config/limits';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  cloudinaryConfig,
  deleteFromCloudinary,
  uploadToCloudinary,
} from './cloudinary';
import { UPLOAD_DIR, UploadsService } from './uploads.service';

const uploadLogger = new Logger('Uploads');

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

if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * QA P2-15: refuses a review-photo upload once the customer has used their
 * daily quota. A guard (not a check in the handler) so it runs before multer
 * has written anything to disk.
 */
@Injectable()
export class ReviewUploadQuotaGuard implements CanActivate {
  constructor(private readonly uploads: UploadsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: { sub?: string } }>();
    const userId = req.user?.sub;
    if (!userId) return true; // the JWT guard has already decided this
    if ((await this.uploads.reviewUploadsRemaining(userId)) > 0) return true;
    throw new HttpException(
      {
        message: `You can upload up to ${reviewUploadsPerDay()} review photos a day. Please try again tomorrow.`,
        code: 'UPLOAD_QUOTA_EXCEEDED',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
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

type AuthedRequest = Request & { user?: { sub?: string } };

/** Deletes a rejected upload; a file that is already gone is not an error. */
function removeQuietly(path: string): void {
  try {
    unlinkSync(path);
  } catch {
    // Nothing to clean up.
  }
}

async function toUploadResponse(
  file: Express.Multer.File,
  req: AuthedRequest,
  uploads: UploadsService,
  purpose: UploadPurpose,
) {
  if (!file) {
    throw new BadRequestException('No image was received.');
  }

  // Magic bytes signature validation (QA-010)
  // Rejects spoofed non-image payloads (e.g. bash scripts with image/jpeg header)
  if (!validateImageMagicBytes(file.path)) {
    removeQuietly(file.path);
    throw new BadRequestException(
      'Invalid image file signature. Only valid JPG, PNG, or WebP files are allowed.',
    );
  }

  // Durable storage: with Cloudinary configured the validated file goes there
  // and the local copy is only a temporary file (the container disk is wiped on
  // every Render deploy and wake-up). Without it, the disk is the storage.
  const cloud = cloudinaryConfig();
  let filename = file.filename;
  // Absolute URL so it works in <img>, in captions, and for the Instagram Graph
  // API, which only accepts a public URL. QA P2-15: the origin comes from
  // configuration, never from the client's Host header.
  let url = publicUploadUrl(file.filename, req);
  if (cloud) {
    try {
      ({ url, filename } = await uploadToCloudinary(
        file.path,
        file.filename,
        cloud,
      ));
    } catch (err) {
      uploadLogger.error(
        `Cloudinary upload failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
      throw new ServiceUnavailableException(
        'Image storage is unavailable right now. Please try again in a minute.',
      );
    } finally {
      removeQuietly(file.path);
    }
  }

  // QA P2-15: every upload is recorded with its uploader — the basis of the
  // quota, of the "your own photos only" check on reviews, and of the cleanup.
  try {
    await uploads.record(
      { filename, size: file.size },
      req.user?.sub ?? null,
      purpose,
    );
  } catch (err) {
    if (cloud) {
      void deleteFromCloudinary(filename, cloud).catch(() => undefined);
    } else {
      removeQuietly(file.path);
    }
    throw err;
  }

  return { url, filename, size: file.size };
}

@Controller('admin/uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('image')
  @UseInterceptors(FileInterceptor('file', imageStorageOptions))
  uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthedRequest,
  ) {
    return toUploadResponse(file, req, this.uploads, UploadPurpose.CATALOGUE);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', imageStorageOptions))
  upload(@UploadedFile() file: Express.Multer.File, @Req() req: AuthedRequest) {
    return toUploadResponse(file, req, this.uploads, UploadPurpose.CATALOGUE);
  }
}

/**
 * Review-photo upload. Separate controller (not a method on
 * UploadsController above) purely so it can sit outside the class-level
 * @Roles(ADMIN) guard: any authenticated customer may attach photos to their
 * own review, not just admins. Same disk/validation pipeline otherwise.
 *
 * QA P2-15: open to every signed-in customer, so it is rate limited per
 * minute and capped per day. The quota guard runs BEFORE multer, so a refused
 * upload never touches the disk.
 */
@Controller('uploads')
@UseGuards(JwtAuthGuard, ReviewUploadQuotaGuard)
@Throttle({
  default: { limit: REVIEW_UPLOAD_THROTTLE_AT_LOAD, ttl: 60_000 },
})
export class ReviewUploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('review-image')
  @UseInterceptors(FileInterceptor('file', imageStorageOptions))
  uploadReviewImage(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthedRequest,
  ) {
    return toUploadResponse(file, req, this.uploads, UploadPurpose.REVIEW);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', imageStorageOptions))
  upload(@UploadedFile() file: Express.Multer.File, @Req() req: AuthedRequest) {
    return toUploadResponse(file, req, this.uploads, UploadPurpose.REVIEW);
  }
}
