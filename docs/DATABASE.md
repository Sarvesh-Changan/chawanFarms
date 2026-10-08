# DATABASE — PostgreSQL (Neon) + Prisma

> Reference design. The coding agent must adapt syntax to the installed Prisma version and the chosen auth library (auth tables `User/Session/Account/Verification` must match what the library generates — keep field names compatible, keep our extra columns). Run `prisma validate` and review generated SQL before applying.

## 1. Conventions
- IDs: `String @id @default(cuid())` (or `uuid` — choose once, ADR).
- Money: **integer paise** (`Int`, or `BigInt` for aggregates). Never floats. Currency fixed `INR` (`Setting`), column kept for future.
- Dates: stay dates `@db.Date`; moments `DateTime` (UTC). Display in Asia/Kolkata.
- Every table: `createdAt`, `updatedAt`; soft-delete (`deletedAt`) for CMS and customer-facing entities; **no soft delete** on ledger/audit (append-only).
- Status fields are Prisma enums. Slugs unique per entity (case-insensitive via lowercased slug).
- All FKs explicit with `onDelete` chosen deliberately: `Restrict` for financial/ledger links, `Cascade` only for pure children (e.g. page sections), `SetNull` for optional links.
- Index every FK used in filters/joins plus common admin filters (status + createdAt).
- Content translatable fields use `Json` locale maps (`{en,mr,hi}`) or a `*Translation` table — decision D-7 (default: `Json` with `en` required).

## 2. Entity overview (by domain)

| Domain | Models |
|---|---|
| Identity | `User`, `Session`, `Account`, `Verification`, `CustomerProfile`, `ConsentRecord` |
| RBAC | `Role`, `Permission`, `RolePermission`, `StaffRole` |
| Catalogue | `Package`, `PackageRate`, `Accommodation`, `Activity`, `Experience`, `MenuCategory`, `MenuItem`, `PackageActivity`, `PackageAccommodation` |
| Availability | `AvailabilityDay`, `BlackoutPeriod` |
| Sales | `Lead`, `LeadEvent`, `LeadNote`, `Enquiry`, `Booking`, `BookingLine`, `Payment`, `PolicyAcceptance`, `PolicyVersion` |
| Media | `Media`, `MediaUsage`, `GalleryItem` |
| Rewards | `VideoSubmission`, `RewardRule`, `RewardTier`, `RewardTierPackage`, `RewardTierAccommodation`, `PointsLedger`, `Coupon`, `CouponRedemption`, `Referral` |
| Social proof | `Review`, `Testimonial`, `Favourite` |
| CMS | `Page`, `PageSection`, `Post`, `PostCategory`, `Faq`, `Offer`, `SeoMetadata`, `Setting` |
| System | `Notification`, `NotificationOutbox`, `AuditLog`, `RateLimitEvent` (optional), `AnalyticsEvent` (optional) |

## 3. Prisma schema (reference)

```prisma
generator client { provider = "prisma-client-js" }   // adjust to installed Prisma version
datasource db { provider = "postgresql" url = env("DATABASE_URL") directUrl = env("DIRECT_URL") }

// ───────── Enums ─────────
enum UserType        { CUSTOMER STAFF }
enum UserStatus      { ACTIVE SUSPENDED PENDING_DELETION }
enum PublishStatus   { DRAFT SCHEDULED PUBLISHED ARCHIVED }
enum AccommodationType { TENT DORMITORY GUEST_HOUSE CAMP_LAWN DAY_VISIT }
enum FoodPreference  { VEG NON_VEG }
enum RateAudience    { ADULT CHILD_4_10 INFANT_UNDER_4 }
enum PricingUnit     { PER_PERSON_PER_NIGHT PER_PERSON_PER_DAY PER_UNIT FLAT }
enum LeadStatus      { NEW CONTACTED QUALIFIED CONVERTED CLOSED }
enum LeadCloseReason { LOST DUPLICATE SPAM NOT_INTERESTED NO_RESPONSE }
enum EnquiryType     { GENERAL PACKAGE ACTIVITY ACCOMMODATION CAMP_ORGANISER SCHOOL_GROUP CONTACT_FORM }
enum BookingStatus   { ENQUIRY PENDING_CONFIRMATION CONFIRMED COMPLETED CANCELLED NO_SHOW REJECTED }
enum PaymentStatus   { UNPAID PARTIALLY_PAID PAID REFUNDED PARTIALLY_REFUNDED }
enum PaymentMethod   { BANK_TRANSFER CHEQUE CASH UPI CARD GATEWAY OTHER }
enum PaymentEntryStatus { PENDING CLEARED BOUNCED REFUNDED }
enum VideoStatus     { UPLOADING PENDING APPROVED REJECTED REMOVED }
enum LedgerType      { EARN REDEEM ADJUST EXPIRE REVERSE }
enum DiscountType    { FIXED PERCENTAGE }
enum CouponStatus    { ACTIVE REDEEMED EXPIRED REVOKED }
enum ReviewStatus    { PENDING APPROVED REJECTED }
enum MediaKind       { IMAGE VIDEO }
enum MediaOrigin     { ADMIN CUSTOMER }
enum NotificationChannel { IN_APP EMAIL }
enum OutboxStatus    { PENDING SENT FAILED }

// ───────── Identity ─────────
model User {
  id            String   @id @default(cuid())
  email         String   @unique              // store lowercased
  emailVerified Boolean  @default(false)
  name          String?
  image         String?
  type          UserType @default(CUSTOMER)
  status        UserStatus @default(ACTIVE)
  twoFactorEnabled Boolean @default(false)
  lastLoginAt   DateTime?
  deletedAt     DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  sessions   Session[]
  accounts   Account[]               // password hash lives here per auth lib
  profile    CustomerProfile?
  staffRoles StaffRole[]
  bookings   Booking[]
  videos     VideoSubmission[]
  ledger     PointsLedger[]
  coupons    Coupon[]
  favourites Favourite[]
  reviews    Review[]
  notifications Notification[]
  consents   ConsentRecord[]
  @@index([type, status])
}
model Session {
  id String @id @default(cuid())
  userId String
  token String @unique
  expiresAt DateTime
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user User @relation(fields:[userId], references:[id], onDelete: Cascade)
  @@index([userId])
}
model Account {                     // credential / OAuth accounts (auth-lib managed)
  id String @id @default(cuid())
  userId String
  providerId String
  accountId String
  password String?                  // hashed by auth lib only
  accessToken String? refreshToken String? idToken String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user User @relation(fields:[userId], references:[id], onDelete: Cascade)
  @@unique([providerId, accountId])
  @@index([userId])
}
model Verification {                // email verify / password reset tokens (hashed)
  id String @id @default(cuid())
  identifier String
  value String
  expiresAt DateTime
  createdAt DateTime @default(now())
  @@index([identifier])
}
model CustomerProfile {
  id String @id @default(cuid())
  userId String @unique
  phone String?                     // E.164
  city String?
  marketingConsent Boolean @default(false)
  referralCode String @unique
  referredById String?
  pointsBalance Int @default(0)     // CACHE of ledger SUM; updated in same tx; reconciled nightly
  lifetimePointsEarned Int @default(0)
  user User @relation(fields:[userId], references:[id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@check_nonneg_note
}
// NOTE: add raw SQL: ALTER TABLE "CustomerProfile" ADD CONSTRAINT balance_nonneg CHECK ("pointsBalance" >= 0);
//       (if negative balances after REVERSE are allowed by policy, relax this constraint — decision D-8)

model ConsentRecord {               // marketing, analytics, video-usage, policy consents
  id String @id @default(cuid())
  userId String?
  anonymousId String?
  purpose String                    // 'marketing' | 'analytics' | 'video_reuse' | 'privacy_policy' ...
  granted Boolean
  policyVersion String?
  ip String? userAgent String?
  createdAt DateTime @default(now())
  user User? @relation(fields:[userId], references:[id], onDelete: SetNull)
  @@index([userId, purpose])
}

// ───────── RBAC ─────────
model Role       { id String @id @default(cuid()) name String @unique description String? isSystem Boolean @default(false)
                   permissions RolePermission[] staff StaffRole[] createdAt DateTime @default(now()) }
model Permission { id String @id @default(cuid()) key String @unique  // e.g. leads.read
                   description String? roles RolePermission[] }
model RolePermission { roleId String permissionId String
                   role Role @relation(fields:[roleId], references:[id], onDelete: Cascade)
                   permission Permission @relation(fields:[permissionId], references:[id], onDelete: Cascade)
                   @@id([roleId, permissionId]) }
model StaffRole  { userId String roleId String assignedById String? createdAt DateTime @default(now())
                   user User @relation(fields:[userId], references:[id], onDelete: Cascade)
                   role Role @relation(fields:[roleId], references:[id], onDelete: Restrict)
                   @@id([userId, roleId]) }

// ───────── Catalogue ─────────
model Accommodation {
  id String @id @default(cuid())
  slug String @unique
  type AccommodationType
  name Json                          // {en: "..."}
  summary Json? description Json?
  unitsTotal Int?                    // tents/rooms (D-5); null = unknown
  maxGuests Int?                     // total capacity (D-5)
  amenities Json?                    // from client only
  heroMediaId String?
  status PublishStatus @default(DRAFT)
  sortOrder Int @default(0)
  deletedAt DateTime?
  createdAt DateTime @default(now()) updatedAt DateTime @updatedAt
  availability AvailabilityDay[]
  packages PackageAccommodation[]
  bookings Booking[]
  @@index([status, sortOrder])
}
model Package {
  id String @id @default(cuid())
  slug String @unique
  code String? @unique               // 'A','B','C','PICNIC' (client naming)
  name Json
  summary Json? description Json?
  inclusions Json?                   // list; client text only
  conditions Json?                   // e.g. min group, timings
  minGuests Int?                     // pricing rule input (D-4)
  maxGuests Int?
  timingNote Json?                   // e.g. "5 pm to 11 am"
  isDayVisit Boolean @default(false)
  isGroupOnly Boolean @default(false)
  heroMediaId String?
  status PublishStatus @default(DRAFT)
  publishAt DateTime?
  sortOrder Int @default(0)
  deletedAt DateTime?
  createdAt DateTime @default(now()) updatedAt DateTime @updatedAt
  rates PackageRate[]
  accommodations PackageAccommodation[]
  activities PackageActivity[]
  bookings Booking[]
  @@index([status, sortOrder])
}
model PackageRate {                  // versioned, admin-managed
  id String @id @default(cuid())
  packageId String
  foodPreference FoodPreference?
  audience RateAudience
  unit PricingUnit @default(PER_PERSON_PER_NIGHT)
  amountPaise Int                    // e.g. 140000 for ₹1400
  percentOfAdult Int?                // 60 for child 4–10 when derived instead of fixed
  validFrom DateTime? validTo DateTime?   // PDF Part C: valid one month (D-16)
  seasonLabel String?
  isActive Boolean @default(true)
  package Package @relation(fields:[packageId], references:[id], onDelete: Restrict)
  createdAt DateTime @default(now()) updatedAt DateTime @updatedAt
  @@index([packageId, isActive])
  @@unique([packageId, foodPreference, audience, validFrom])
}
model PackageAccommodation { packageId String accommodationId String
  package Package @relation(fields:[packageId], references:[id], onDelete: Cascade)
  accommodation Accommodation @relation(fields:[accommodationId], references:[id], onDelete: Cascade)
  @@id([packageId, accommodationId]) }
model Activity {
  id String @id @default(cuid())
  slug String @unique
  name Json summary Json? description Json?
  isExtraCost Boolean @default(false)       // e.g. bullock cart: "extra cost with prior notification"
  priceNote Json?                           // text only; amounts via ExtraCharge if client supplies
  needsPriorNotice Boolean @default(false)
  conditionsNote Json?                      // "subject to prevailing conditions and availability"
  seasonNote Json?
  heroMediaId String?
  status PublishStatus @default(DRAFT)
  sortOrder Int @default(0)
  deletedAt DateTime?
  createdAt DateTime @default(now()) updatedAt DateTime @updatedAt
  packages PackageActivity[]
  @@index([status, sortOrder])
}
model PackageActivity { packageId String activityId String
  package Package @relation(fields:[packageId], references:[id], onDelete: Cascade)
  activity Activity @relation(fields:[activityId], references:[id], onDelete: Cascade)
  @@id([packageId, activityId]) }
model Experience {                    // editorial experiences (farm, organic, dairy, birding…)
  id String @id @default(cuid())
  slug String @unique
  title Json summary Json? body Json?
  heroMediaId String?
  status PublishStatus @default(DRAFT)
  sortOrder Int @default(0)
  deletedAt DateTime?
  createdAt DateTime @default(now()) updatedAt DateTime @updatedAt
  @@index([status, sortOrder])
}
model MenuCategory { id String @id @default(cuid()) slug String @unique name Json sortOrder Int @default(0)
  items MenuItem[] }
model MenuItem {
  id String @id @default(cuid())
  categoryId String
  name Json description Json?
  foodPreference FoodPreference?        // null = both
  isExtraCharge Boolean @default(false)  // fish, BBQ, mutton/chicken per kg
  extraPricePaise Int?                  // null until client gives price (D-18)
  extraUnitLabel String?                // 'per kg'
  isPublished Boolean @default(true)
  sortOrder Int @default(0)
  category MenuCategory @relation(fields:[categoryId], references:[id], onDelete: Restrict)
  @@index([categoryId, sortOrder])
}

// ───────── Availability ─────────
model AvailabilityDay {
  id String @id @default(cuid())
  accommodationId String
  date DateTime @db.Date
  capacity Int                          // units or guests per D-5 decision
  held Int @default(0)
  booked Int @default(0)
  isBlocked Boolean @default(false)
  note String?
  accommodation Accommodation @relation(fields:[accommodationId], references:[id], onDelete: Cascade)
  @@unique([accommodationId, date])
  @@index([date])
}
// RAW SQL: CHECK (held >= 0 AND booked >= 0 AND held + booked <= capacity OR isBlocked)

model BlackoutPeriod { id String @id @default(cuid()) startDate DateTime @db.Date endDate DateTime @db.Date reason String? appliesToAll Boolean @default(true) createdAt DateTime @default(now()) }

// ───────── Leads / Enquiries / Bookings ─────────
model Lead {
  id String @id @default(cuid())
  name String?
  phone String?                         // E.164 normalised
  email String?                         // lowercased
  userId String?                        // linked if registered
  status LeadStatus @default(NEW)
  closeReason LeadCloseReason?
  assignedToId String?
  source String?                        // organic/google/instagram/whatsapp/referral/offline
  utmSource String? utmMedium String? utmCampaign String? utmTerm String? utmContent String?
  firstReferrer String? firstLandingPath String? lastLandingPath String?
  deviceClass String?
  followUpAt DateTime?
  convertedAt DateTime? closedAt DateTime?
  spamScore Int @default(0)
  deletedAt DateTime?
  createdAt DateTime @default(now()) updatedAt DateTime @updatedAt
  events LeadEvent[] notes LeadNote[] enquiries Enquiry[] bookings Booking[]
  @@index([status, createdAt]) @@index([assignedToId, status]) @@index([phone]) @@index([email]) @@index([followUpAt])
}
model LeadEvent { id String @id @default(cuid()) leadId String? anonymousId String?
  type String                           // WHATSAPP_CLICK CALL_CLICK FORM_SUBMIT STATUS_CHANGE …
  path String? meta Json? createdAt DateTime @default(now())
  lead Lead? @relation(fields:[leadId], references:[id], onDelete: SetNull)
  @@index([leadId, createdAt]) @@index([type, createdAt]) }
model LeadNote { id String @id @default(cuid()) leadId String authorId String body String createdAt DateTime @default(now())
  lead Lead @relation(fields:[leadId], references:[id], onDelete: Cascade) @@index([leadId, createdAt]) }
model Enquiry {
  id String @id @default(cuid())
  reference String @unique              // human code e.g. ENQ-2026-000123
  leadId String
  type EnquiryType @default(GENERAL)
  packageId String? activityId String? accommodationId String?
  message String?
  preferredStart DateTime? @db.Date preferredEnd DateTime? @db.Date
  adults Int? children Int? infants Int?
  consentToContact Boolean @default(false)
  pagePath String?
  createdAt DateTime @default(now())
  lead Lead @relation(fields:[leadId], references:[id], onDelete: Restrict)
  @@index([leadId]) @@index([createdAt])
}
model Booking {
  id String @id @default(cuid())
  reference String @unique              // BKG-2026-000045
  leadId String? userId String?
  status BookingStatus @default(PENDING_CONFIRMATION)
  paymentStatus PaymentStatus @default(UNPAID)
  packageId String? accommodationId String?
  checkIn DateTime @db.Date
  checkOut DateTime @db.Date
  nights Int
  adults Int children4to10 Int @default(0) infantsUnder4 Int @default(0)
  foodPreference FoodPreference?
  specialRequests String?
  contactName String contactPhone String contactEmail String?
  // price snapshot (server computed, immutable after confirmation except via admin adjustment record)
  subtotalPaise Int discountPaise Int @default(0) taxPaise Int @default(0) totalPaise Int
  amountPaidPaise Int @default(0)
  pricingSnapshot Json                  // rates, rules, coupon, version used
  couponId String? @unique
  offerId String?
  holdExpiresAt DateTime?
  confirmedAt DateTime? cancelledAt DateTime? cancelReason String?
  internalNotes String?
  createdById String?                   // staff if manual booking
  deletedAt DateTime?
  createdAt DateTime @default(now()) updatedAt DateTime @updatedAt
  lead Lead? @relation(fields:[leadId], references:[id], onDelete: SetNull)
  user User? @relation(fields:[userId], references:[id], onDelete: SetNull)
  package Package? @relation(fields:[packageId], references:[id], onDelete: Restrict)
  accommodation Accommodation? @relation(fields:[accommodationId], references:[id], onDelete: Restrict)
  lines BookingLine[] payments Payment[] policyAcceptances PolicyAcceptance[]
  couponRedemption CouponRedemption?
  @@index([status, checkIn]) @@index([userId, createdAt]) @@index([checkIn, checkOut])
}
// RAW SQL: CHECK ("checkOut" > "checkIn" AND adults >= 1 AND "totalPaise" >= 0 AND "discountPaise" <= "subtotalPaise")

model BookingLine { id String @id @default(cuid()) bookingId String
  kind String                           // STAY | FOOD_EXTRA | ACTIVITY | EXTRA | DISCOUNT | TAX
  label String quantity Int unitPaise Int totalPaise Int refId String? meta Json?
  booking Booking @relation(fields:[bookingId], references:[id], onDelete: Cascade) @@index([bookingId]) }
model Payment {                         // manual in v1; gateway-ready
  id String @id @default(cuid())
  bookingId String
  method PaymentMethod
  status PaymentEntryStatus @default(PENDING)
  amountPaise Int
  reference String?                     // UTR / cheque no (store last digits only if sensitive)
  receivedAt DateTime? clearedAt DateTime?
  provider String? providerPaymentId String? @unique   // future gateway
  recordedById String?
  note String?
  createdAt DateTime @default(now())
  booking Booking @relation(fields:[bookingId], references:[id], onDelete: Restrict)
  @@index([bookingId])
}
model PolicyVersion { id String @id @default(cuid()) key String version Int title String body Json publishedAt DateTime @default(now())
  acceptances PolicyAcceptance[] @@unique([key, version]) }
model PolicyAcceptance { id String @id @default(cuid()) bookingId String policyVersionId String ip String? acceptedAt DateTime @default(now())
  booking Booking @relation(fields:[bookingId], references:[id], onDelete: Cascade)
  policyVersion PolicyVersion @relation(fields:[policyVersionId], references:[id], onDelete: Restrict)
  @@unique([bookingId, policyVersionId]) }

// ───────── Media ─────────
model Media {
  id String @id @default(cuid())
  kind MediaKind
  origin MediaOrigin @default(ADMIN)
  publicId String @unique               // Cloudinary public_id
  resourceType String                   // image|video|raw
  deliveryType String @default("upload") // upload | authenticated | private
  format String? bytes Int? width Int? height Int? durationSec Float?
  contentHash String?                   // sha256 / perceptual hash for dup detection
  altText Json?                         // REQUIRED for published public images (enforced in app)
  caption Json?
  focalX Float? focalY Float?
  tags String[] category String?
  uploadedById String?
  isPublic Boolean @default(false)
  deletedAt DateTime?
  createdAt DateTime @default(now()) updatedAt DateTime @updatedAt
  usages MediaUsage[]
  @@index([kind, category]) @@index([contentHash]) @@index([origin, createdAt])
}
model MediaUsage { id String @id @default(cuid()) mediaId String entityType String entityId String field String?
  media Media @relation(fields:[mediaId], references:[id], onDelete: Restrict)
  @@unique([mediaId, entityType, entityId, field]) @@index([entityType, entityId]) }

// ───────── Rewards ─────────
model VideoSubmission {
  id String @id @default(cuid())
  userId String
  mediaId String @unique                // one submission per uploaded asset
  title String? description String?
  visitDate DateTime? @db.Date          // claimed visit date; admin may verify against booking
  bookingId String?                     // optional verification link
  status VideoStatus @default(UPLOADING)
  contentHash String?
  duplicateOfId String?                 // set by duplicate detection
  consentOwnership Boolean              // user confirms they own/are permitted
  consentPublish Boolean @default(false) // separate permission to publish on website/social
  reviewedById String? reviewedAt DateTime? rejectionReason String?
  rewardRuleId String?                  // rule version applied at approval
  pointsAwarded Int?
  submittedAt DateTime?
  createdAt DateTime @default(now()) updatedAt DateTime @updatedAt
  user User @relation(fields:[userId], references:[id], onDelete: Restrict)
  ledger PointsLedger[]
  @@index([status, submittedAt]) @@index([userId, createdAt]) @@index([contentHash])
}
model RewardRule {                      // versioned; only one ACTIVE at a time
  id String @id @default(cuid())
  version Int @unique
  isActive Boolean @default(false)
  pointsPerApprovedVideo Int
  maxPointsPerCustomer Int?             // lifetime cap
  maxSubmissionsPerPeriod Int?          // count
  periodDays Int?                       // rolling window length
  pointExpiryDays Int?
  minPointsToRedeem Int
  couponValidityDays Int
  allowCombineWithOffers Boolean @default(false)
  allowMultipleCouponsPerBooking Boolean @default(false)
  manualAdjustMaxPoints Int @default(0)          // per-action cap for non-super-admin
  manualAdjustApprovalThreshold Int @default(0)  // above this needs second approver
  createdById String?
  createdAt DateTime @default(now())
  tiers RewardTier[]
  ledger PointsLedger[]
}
// RAW SQL: CREATE UNIQUE INDEX one_active_reward_rule ON "RewardRule" ("isActive") WHERE "isActive";

model RewardTier {
  id String @id @default(cuid())
  ruleId String
  name String
  pointsCost Int
  discountType DiscountType
  discountValue Int                     // paise if FIXED; percent (1–100) if PERCENTAGE
  maxDiscountPaise Int?
  minBookingPaise Int?
  isActive Boolean @default(true)
  rule RewardRule @relation(fields:[ruleId], references:[id], onDelete: Restrict)
  packages RewardTierPackage[] accommodations RewardTierAccommodation[] coupons Coupon[]
  @@index([ruleId])
}
model RewardTierPackage { tierId String packageId String
  tier RewardTier @relation(fields:[tierId], references:[id], onDelete: Cascade) @@id([tierId, packageId]) }
model RewardTierAccommodation { tierId String accommodationId String
  tier RewardTier @relation(fields:[tierId], references:[id], onDelete: Cascade) @@id([tierId, accommodationId]) }
// Empty eligibility lists = "all eligible" (explicit flag preferred: add `allPackages Boolean` if clearer)

model PointsLedger {                    // IMMUTABLE — trigger blocks UPDATE & DELETE
  id String @id @default(cuid())
  userId String
  type LedgerType
  points Int                            // signed: EARN +, REDEEM −, ADJUST ±, EXPIRE −, REVERSE ∓
  balanceAfter Int                      // snapshot for audit/reconciliation
  idempotencyKey String @unique         // 'earn:<submissionId>' | 'redeem:<couponId>' | client-supplied for adjust
  videoSubmissionId String?
  couponId String?
  reversesEntryId String? @unique       // an entry can be reversed at most once
  ruleId String?
  reason String?                        // required for ADJUST / REVERSE
  actorId String?                       // admin who did it (null = system)
  secondApproverId String?
  expiresAt DateTime?                   // for EARN lots
  createdAt DateTime @default(now())
  user User @relation(fields:[userId], references:[id], onDelete: Restrict)
  video VideoSubmission? @relation(fields:[videoSubmissionId], references:[id], onDelete: Restrict)
  rule RewardRule? @relation(fields:[ruleId], references:[id], onDelete: Restrict)
  @@index([userId, createdAt]) @@index([type, createdAt]) @@index([expiresAt])
}
// RAW SQL:
//  CREATE UNIQUE INDEX one_earn_per_video ON "PointsLedger" ("videoSubmissionId") WHERE type='EARN';
//  CHECK ((type='EARN' AND points>0) OR (type IN ('REDEEM','EXPIRE') AND points<0) OR type IN ('ADJUST','REVERSE'));
//  CHECK (type NOT IN ('ADJUST','REVERSE') OR (reason IS NOT NULL AND actorId IS NOT NULL));
//  CREATE FUNCTION forbid_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'append-only table'; END $$ LANGUAGE plpgsql;
//  CREATE TRIGGER ledger_immutable BEFORE UPDATE OR DELETE ON "PointsLedger" FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
//  (same trigger on "AuditLog")

model Coupon {
  id String @id @default(cuid())
  code String @unique                   // random, non-guessable (>= 10 chars, unambiguous alphabet)
  userId String
  tierId String
  status CouponStatus @default(ACTIVE)
  discountType DiscountType discountValue Int maxDiscountPaise Int? minBookingPaise Int?  // snapshot of tier at issue
  pointsSpent Int
  issuedAt DateTime @default(now())
  expiresAt DateTime
  user User @relation(fields:[userId], references:[id], onDelete: Restrict)
  tier RewardTier @relation(fields:[tierId], references:[id], onDelete: Restrict)
  redemption CouponRedemption?
  @@index([userId, status]) @@index([expiresAt])
}
model CouponRedemption { id String @id @default(cuid()) couponId String @unique bookingId String @unique discountPaise Int createdAt DateTime @default(now())
  coupon Coupon @relation(fields:[couponId], references:[id], onDelete: Restrict)
  booking Booking @relation(fields:[bookingId], references:[id], onDelete: Restrict) }
model Referral { id String @id @default(cuid()) referrerId String refereeId String @unique firstBookingId String? status String @default("PENDING") rewardedAt DateTime? createdAt DateTime @default(now()) @@index([referrerId]) }

// ───────── Social proof ─────────
model Review { id String @id @default(cuid()) userId String bookingId String? rating Int title String? body String status ReviewStatus @default(PENDING) moderatedById String? createdAt DateTime @default(now())
  user User @relation(fields:[userId], references:[id], onDelete: Cascade) @@unique([userId, bookingId]) @@index([status, createdAt]) }
// RAW SQL: CHECK (rating BETWEEN 1 AND 5)
model Testimonial { id String @id @default(cuid()) authorName String authorMeta String? quote Json mediaId String? consentConfirmed Boolean @default(false) status PublishStatus @default(DRAFT) sortOrder Int @default(0) deletedAt DateTime? createdAt DateTime @default(now()) }
model Favourite { userId String entityType String entityId String createdAt DateTime @default(now())
  user User @relation(fields:[userId], references:[id], onDelete: Cascade) @@id([userId, entityType, entityId]) }

// ───────── CMS ─────────
model Page { id String @id @default(cuid()) slug String @unique title Json status PublishStatus @default(DRAFT) publishAt DateTime? template String @default("default") deletedAt DateTime? createdAt DateTime @default(now()) updatedAt DateTime @updatedAt
  sections PageSection[] @@index([status]) }
model PageSection { id String @id @default(cuid()) pageId String type String   // hero, why, experiences-grid, rewards-teaser …
  content Json                          // validated by per-type zod schema
  sortOrder Int isVisible Boolean @default(true)
  page Page @relation(fields:[pageId], references:[id], onDelete: Cascade) @@index([pageId, sortOrder]) }
model PostCategory { id String @id @default(cuid()) slug String @unique name Json posts Post[] }
model Post { id String @id @default(cuid()) slug String @unique title Json excerpt Json? body Json categoryId String? authorName String? coverMediaId String? status PublishStatus @default(DRAFT) publishAt DateTime? deletedAt DateTime? createdAt DateTime @default(now()) updatedAt DateTime @updatedAt
  category PostCategory? @relation(fields:[categoryId], references:[id], onDelete: SetNull) @@index([status, publishAt]) }
model Faq { id String @id @default(cuid()) question Json answer Json groupKey String? sortOrder Int @default(0) isPublished Boolean @default(true) deletedAt DateTime? }
model Offer { id String @id @default(cuid()) slug String @unique title Json description Json? discountType DiscountType? discountValue Int? startsAt DateTime endsAt DateTime packageIds String[] status PublishStatus @default(DRAFT) deletedAt DateTime? @@index([status, startsAt, endsAt]) }
model SeoMetadata { id String @id @default(cuid()) entityType String entityId String locale String @default("en") title String? description String? keywords String? canonicalUrl String? ogMediaId String? robots String? jsonLd Json?
  @@unique([entityType, entityId, locale]) }
model Setting { key String @id value Json updatedById String? updatedAt DateTime @updatedAt }  // business.phone[], business.email, whatsapp.number, booking.*, notify.*, feature.*

// ───────── System ─────────
model Notification { id String @id @default(cuid()) userId String type String title String body String? link String? readAt DateTime? createdAt DateTime @default(now())
  user User @relation(fields:[userId], references:[id], onDelete: Cascade) @@index([userId, readAt, createdAt]) }
model NotificationOutbox { id String @id @default(cuid()) channel NotificationChannel to String template String payload Json status OutboxStatus @default(PENDING) attempts Int @default(0) lastError String? sendAfter DateTime @default(now()) sentAt DateTime? createdAt DateTime @default(now()) @@index([status, sendAfter]) }
model AuditLog {                        // IMMUTABLE
  id String @id @default(cuid())
  actorId String? actorType String @default("STAFF")
  action String                         // 'reward.approve', 'role.assign', 'lead.export' …
  entityType String? entityId String?
  before Json? after Json?
  ip String? userAgent String? requestId String?
  createdAt DateTime @default(now())
  @@index([actorId, createdAt]) @@index([entityType, entityId]) @@index([action, createdAt])
}
```

Implementation note for the Prisma v7 schema: PDF-derived catalogue, menu,
policy, reward-rule, and setting rows carry nullable `meta Json?` with
`{ "source": "client-pdf" }`. `PackageRate`, `MenuCategory`, and `MenuItem`
also carry nullable unique `seedKey String?` values for deterministic,
repeatable seed upserts. The Prisma v7 datasource URL is configured in
`prisma7.config.ts`; `DIRECT_URL` is used for migrations and the pooled
`DATABASE_URL` is used at runtime.

Gallery uses first-class ordered entries, per client decision D-38 (2026-10-08):

```prisma
model GalleryItem {
  id         String        @id @default(uuid())
  mediaId    String
  category   String
  caption    Json?
  sortOrder  Int           @default(0)
  isFeatured Boolean       @default(false)
  status     PublishStatus @default(DRAFT)
  publishAt  DateTime?
  deletedAt  DateTime?
  createdAt  DateTime      @default(now())
  updatedAt  DateTime      @updatedAt
  media      Media         @relation(fields: [mediaId], references: [id], onDelete: Restrict)

  @@index([category, status, sortOrder])
  @@index([mediaId])
}
```

Allowed category values are maintained in `src/config/gallery.ts`. Each entry
has a matching `MediaUsage` (`entityType = "GalleryItem"`) created in the same
transaction; customer-origin media is not eligible. Public reads require both a
published, non-deleted GalleryItem and public, non-deleted media.

## 4. Seed data
`prisma/seed.ts` is idempotent (upsert by slug/key) and loads:
1. **Permissions & roles** (below).
2. **PDF-sourced catalogue** (Appendix A of PRD): Packages A/B/C/Picnic, `PackageRate` rows (₹1400/1800, 2300/2800, 1200/1800, 1100 adult / 750 kids; child 4–10 = 60%; under-4 = 0), accommodation (Tent, Dormitory, Guest House [2 AC rooms with terrace], Camp Lawn), menu items, activities list, amenities, policies (stay rules as `PolicyVersion` v1 **DRAFT-flagged pending D-2**), contact numbers and address into `Setting`. Every PDF-derived row carries `meta = { "source": "client-pdf" }`; the policy additionally carries `pendingDecision = "D-2 cancellation conflict"`.
   `PackageRate`, `MenuCategory`, and `MenuItem` use deterministic unique `seedKey` values for rerunnable upserts.
3. Items not in the PDF → **not seeded**.
4. Default inactive `RewardRule` v1 with **placeholder zeros/nulls** — values must be set by the client in admin (D-8). Never ship invented reward numbers.
5. Dev-only fixtures behind `NODE_ENV !== 'production'`.

## 5. Roles & permissions (seed)

Permission keys: `dashboard.read`, `cms.read|write|publish|delete`, `media.read|write|delete`, `bookings.read|write|confirm|cancel`, `payments.record`, `availability.write`, `enquiries.read|write`, `leads.read|write|assign|export`, `customers.read|write|export`, `rewards.videos.read|review`, `rewards.rules.read|write`, `rewards.ledger.read`, `rewards.adjust`, `rewards.adjust.approve`, `rewards.reverse`, `coupons.read|revoke`, `seo.write`, `settings.read|write`, `staff.read|write`, `roles.write`, `audit.read`.

| Role | Intent |
|---|---|
| Super Admin | all permissions; cannot be edited by others; ≥ 2 holders recommended |
| Owner/Manager | everything except `roles.write`, `staff.write` (configurable) |
| Reservations | bookings, enquiries, leads, availability, payments.record, customers.read |
| Content Editor | cms.*, media.*, seo.write (no publish if configured) |
| Reward Moderator | rewards.videos.*, rewards.ledger.read |
| Read-only | `*.read` |

## 6. Transactions & integrity rules

| Operation | Requirement |
|---|---|
| Approve video | One tx: `SELECT … FOR UPDATE` submission → status must be PENDING → cap checks → ledger EARN (idempotencyKey) → profile balance `increment` → submission APPROVED + `pointsAwarded` + `rewardRuleId` → audit. Serializable retry on conflict |
| Redeem points | One tx: lock `CustomerProfile` row → balance ≥ cost, ≥ min → ledger REDEEM → coupon create (expiry from rule) |
| Confirm booking | One tx: lock `AvailabilityDay` rows for range → capacity check → held→booked → validate coupon (owner, active, unexpired, eligibility, min value) → `CouponRedemption` → status CONFIRMED → audit |
| Cancel booking | Release availability; coupon release policy per D-2; audit |
| Adjust/Reverse | Permission + cap check, reason, second approval over threshold, ledger row, balance update, audit |
| Expire points | FIFO consumption of EARN lots; write EXPIRE per customer; idempotent per (user, run date) key |
| Rate edit | New `PackageRate` row (old deactivated), never edit rate used by confirmed bookings (snapshot protects history anyway) |

Isolation: default Read Committed + explicit row locks; use Serializable only where noted. Keep transactions short; no network calls inside them (send emails after commit via outbox).

## 7. Index & constraint checklist
- Unique: `User.email`, `Lead` dedupe via indexes + app-level upsert, `Booking.reference`, `Enquiry.reference`, `Coupon.code`, `PointsLedger.idempotencyKey`, one EARN per video, one active reward rule, `AvailabilityDay(accommodationId,date)`, `CouponRedemption.couponId/bookingId`.
- Partial/raw SQL constraints and triggers live in a dedicated migration `*_integrity_constraints` and are covered by integration tests (attempt UPDATE/DELETE on ledger must fail).
- Performance indexes listed in schema; add `pg_trgm` GIN indexes for admin search on lead/customer names/phones if needed.

## 8. Data retention (defaults, confirm with client/legal)
| Data | Retention |
|---|---|
| Leads (no conversion) | 24 months then anonymise |
| Bookings/payments | 8 years (accounting/tax; confirm with CA) |
| Customer videos not approved | delete 90 days after rejection |
| Approved videos | until user requests removal or reversal (publish consent separate) |
| Audit logs | ≥ 3 years |
| Sessions/verification tokens | expiry + 30 days |
| Deleted accounts | anonymise PII; keep ledger/booking rows with pseudonymised user |

## 9. Migration workflow
`prisma migrate dev` locally → review SQL → commit → CI `migrate deploy` on release. Hand-written SQL migrations for triggers/constraints via `--create-only`. Never `db push` against production. Backfills as separate scripts with dry-run.
