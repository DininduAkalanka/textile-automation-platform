/**
 * Hand-over tool: move the shop's admin account onto the owner's real email
 * with a new temporary password, and switch off the demo accounts whose
 * passwords are published in the README.
 *
 *   npx ts-node scripts/rotate-admin-account.ts --env-file .env.production.local \
 *     --to owner@example.com [--from admin@textileshop.com] [--deactivate-demo]
 *
 * DRY RUN by default: it only reports what it would change. To write, add
 * --apply AND set CONFIRM_HOST to the database host it printed, e.g.
 *   CONFIRM_HOST=ep-xyz.aws.neon.tech npx ts-node scripts/rotate-admin-account.ts ... --apply
 *
 * What --apply does, in one transaction:
 * - the admin gets the new email and a random temporary password (printed once,
 *   never stored), and every saved session of that account is revoked, so
 *   anyone who signed in with the old public password is out within 15 minutes;
 * - with --deactivate-demo, each demo account is deactivated (it can no longer
 *   sign in; its order history stays) and its sessions are revoked, and demo
 *   workers are taken off the production board's assignment list;
 * - every change is written to the audit log.
 * The owner then changes the temporary password from "Change password" or the
 * "Forgot password?" email link.
 */
import { randomInt } from 'crypto';
import { config as loadEnv } from 'dotenv';
import * as bcrypt from 'bcrypt';
import { PrismaClient, UserRole } from '@prisma/client';

const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const APPLY = args.includes('--apply');
const DEACTIVATE_DEMO = args.includes('--deactivate-demo');
const FROM = (arg('--from') ?? 'admin@textileshop.com').trim().toLowerCase();
const TO = (arg('--to') ?? '').trim().toLowerCase();
const envFile = arg('--env-file');
if (envFile) loadEnv({ path: envFile, override: true });

const DEMO_EMAILS = [
  'customer@example.com',
  'worker1@textileshop.com',
  'worker2@textileshop.com',
  'worker.cutting@textileshop.com',
  'worker.stitching@textileshop.com',
];

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function databaseHost(): string {
  try {
    return new URL(process.env.DATABASE_URL ?? '').hostname;
  } catch {
    return '';
  }
}

/** 18 characters from an unambiguous alphabet, with every character class present. */
function temporaryPassword(): string {
  const sets = [
    'ABCDEFGHJKLMNPQRSTUVWXYZ',
    'abcdefghijkmnpqrstuvwxyz',
    '23456789',
    '@#%&*!?',
  ];
  const all = sets.join('');
  const chars = sets.map((s) => s[randomInt(s.length)]);
  while (chars.length < 18) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

async function main() {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(TO))
    fail('Pass the new admin email with --to <email>.');
  const host = databaseHost();
  if (!host)
    fail('DATABASE_URL is missing or unreadable (use --env-file <file>).');

  const prisma = new PrismaClient();
  try {
    console.log(`\nDatabase host: ${host}`);
    console.log(
      `Mode:          ${APPLY ? 'APPLY (writes)' : 'DRY RUN (no changes)'}\n`,
    );

    const staff = await prisma.user.findMany({
      where: {
        role: { in: [UserRole.ADMIN, UserRole.MANAGER, UserRole.WORKER] },
      },
      select: {
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
    const customers = await prisma.user.count({
      where: { role: UserRole.CUSTOMER },
    });
    console.log('Staff accounts now:');
    for (const s of staff) {
      console.log(
        `  ${s.role.padEnd(8)} ${(s.email ?? s.phone ?? '-').padEnd(36)} ${s.isActive ? 'active' : 'INACTIVE'}  since ${s.createdAt.toISOString().slice(0, 10)}`,
      );
    }
    console.log(`Customer accounts: ${customers}\n`);

    const admin = await prisma.user.findUnique({ where: { email: FROM } });
    if (!admin)
      fail(
        `No account with email ${FROM}. Use --from with one of the admin emails above.`,
      );
    if (admin.role !== UserRole.ADMIN)
      fail(`${FROM} is a ${admin.role}, not an ADMIN.`);
    const taken = await prisma.user.findUnique({
      where: { email: TO },
      select: { id: true, role: true },
    });
    if (taken && taken.id !== admin.id) {
      fail(
        `${TO} already belongs to another ${taken.role} account. Decide what to do with it first; nothing was changed.`,
      );
    }
    const adminSessions = await prisma.refreshToken.count({
      where: { userId: admin.id, revokedAt: null },
    });

    console.log('Planned changes:');
    console.log(
      `  ADMIN ${FROM} -> ${TO}; new temporary password; ${adminSessions} saved session(s) revoked`,
    );

    const demo = DEACTIVATE_DEMO
      ? await prisma.user.findMany({
          where: { email: { in: DEMO_EMAILS } },
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            _count: { select: { orders: true } },
            worker: { select: { id: true, isActive: true } },
          },
        })
      : [];
    for (const d of demo) {
      console.log(
        `  deactivate ${d.role.padEnd(8)} ${d.email} (${d.isActive ? 'active' : 'already inactive'}; ${d._count.orders} order(s) kept${d.worker ? '; removed from the worker list' : ''})`,
      );
    }
    if (DEACTIVATE_DEMO) {
      for (const e of DEMO_EMAILS.filter(
        (e) => !demo.some((d) => d.email === e),
      ))
        console.log(`  (not present: ${e})`);
    }

    if (!APPLY) {
      console.log('\nDry run only. Nothing was changed.');
      console.log(`To apply: CONFIRM_HOST=${host} ... --apply\n`);
      return;
    }
    if (process.env.CONFIRM_HOST !== host) {
      fail(
        `Refusing to write: set CONFIRM_HOST=${host} to confirm this is the database you mean.`,
      );
    }

    const password = temporaryPassword();
    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: admin.id },
        data: {
          email: TO,
          passwordHash,
          // Proven when the owner completes a reset from that inbox.
          emailVerified: false,
          resetTokenHash: null,
          resetExpiresAt: null,
          resetChannel: null,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      await tx.refreshToken.updateMany({
        where: { userId: admin.id, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.auditLog.create({
        data: {
          userId: admin.id,
          action: 'admin.credentials.rotated',
          entityType: 'User',
          entityId: admin.id,
          before: { email: FROM },
          after: { email: TO },
        },
      });
      for (const d of demo) {
        await tx.user.update({
          where: { id: d.id },
          data: { isActive: false },
        });
        await tx.refreshToken.updateMany({
          where: { userId: d.id, revokedAt: null },
          data: { revokedAt: now },
        });
        if (d.worker)
          await tx.worker.update({
            where: { id: d.worker.id },
            data: { isActive: false },
          });
        await tx.auditLog.create({
          data: {
            userId: admin.id,
            action: 'user.deactivated',
            entityType: 'User',
            entityId: d.id,
            before: { email: d.email, isActive: d.isActive },
            after: { isActive: false, reason: 'demo account at hand-over' },
          },
        });
      }
    });

    // Read back what is now stored.
    const after = await prisma.user.findUnique({
      where: { id: admin.id },
      select: { email: true, role: true, isActive: true },
    });
    const ok =
      after?.email === TO &&
      after.isActive &&
      (await bcrypt.compare(
        password,
        (await prisma.user.findUnique({
          where: { id: admin.id },
          select: { passwordHash: true },
        }))!.passwordHash,
      ));
    const stillActiveDemo = await prisma.user.count({
      where: { email: { in: DEMO_EMAILS }, isActive: true },
    });
    console.log(
      `\n✔ Applied. Admin is now ${after?.email} (${after?.role}, ${after?.isActive ? 'active' : 'INACTIVE'}); password check: ${ok ? 'OK' : 'FAILED'}.`,
    );
    if (DEACTIVATE_DEMO)
      console.log(`✔ Demo accounts still active: ${stillActiveDemo}`);
    console.log('\nTemporary admin password (shown once, not saved anywhere):');
    console.log(`\n    ${password}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
