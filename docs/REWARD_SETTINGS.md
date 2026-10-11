# REWARD SETTINGS & LIFECYCLE SPECIFICATION

Status: Provisional defaults loaded in code and database (RewardRule v1, inactive). Client approval pending (Decision D-8 in `docs/OPEN_QUESTIONS.md`).

## 1. Provisional Defaults (`src/config/reward-defaults.ts`)

These values serve as initial operational placeholders pending client approval:

| Setting | Provisional Value | Description |
|---|---|---|
| `pointsPerApprovedVideo` | 100 | Points credited upon admin approval of guest video |
| `maxPointsPerCustomer` | 500 | Lifetime earning cap per customer |
| `maxSubmissionsPerPeriod` | 2 | Max video submissions within rolling window |
| `periodDays` | 30 | Rolling window length for submissions cap |
| `pointExpiryDays` | 365 | Validity period before points expire |
| `minPointsToRedeem` | 100 | Minimum balance required to generate a coupon |
| `couponValidityDays` | 90 | Expiry of generated discount coupon code |
| `allowCombineWithOffers` | false | Whether coupons can be combined with promotions |
| `allowMultipleCouponsPerBooking` | false | Single coupon restriction per reservation |
| `manualAdjustMaxPoints` | 50 | Single staff point adjustment ceiling |
| `manualAdjustApprovalThreshold` | 200 | Above this requires manager/second approval |

### Provisional Tiers

- **Tier 1**: 100 points cost, 5% discount, max discount ₹500 (`50,000 paise`), min booking value ₹5,000 (`500,000 paise`). All packages & accommodations eligible.
- **Tier 2**: 250 points cost, 10% discount, max discount ₹1,000 (`100,000 paise`), min booking value ₹10,000 (`1,000,000 paise`). All packages & accommodations eligible.

All internal monetary amounts are stored as **integer paise**.

---

## 2. Architecture & Boundary Rules

1. **Strict Database Isolation**:
   - The rewards engine, coupon generation, pricing calculations, and customer public views read rules **exclusively** from the database (active `RewardRule` and `RewardTier` rows).
   - `src/config/reward-defaults.ts` is imported **only** by:
     - `prisma/seed.ts` (for initial create-only seeding)
     - `src/server/actions/admin-rewards.ts` (for the audited "Load provisional defaults" admin action)
   - An automated import-guard test enforces that no other server services, policies, or application routes import `reward-defaults.ts`.

2. **Rewards OFF by Default**:
   - The rewards program is OFF until an authorized staff member explicitly activates a rule version.
   - When no rule is active, public `/rewards` and customer account dashboards show **no numeric reward amounts** and display neutral informational messages.

---

## 3. Immutability & Versioning Lifecycle

1. **Immutable Rules & Tiers**:
   - Once a `RewardRule` has ever been activated (`meta.activatedAt` exists) or is referenced by any `PointsLedger` or `Coupon` row, it is **permanently immutable**.
   - Saving changes in the Admin UI always allocates and creates a **brand new version** (`max(version) + 1`), clearing the provisional flag on that new version.
   - Active rules are **never** mutated in place.

2. **Editable Draft Definition**:
   - An editable draft is defined as the latest rule version that:
     - Has `isActive = false`
     - Has never been activated (`meta.activatedAt` is null/undefined)
     - Has 0 `PointsLedger` references
     - Has 0 `Coupon` references
   - "Load provisional defaults" is permitted only when **no editable draft exists**.

3. **Activation Invariants**:
   - A PostgreSQL partial unique index (`one_active_reward_rule` on `RewardRule.isActive` WHERE `isActive`) guarantees that at most one rule is active at any time.
   - Activation executes in an atomic transaction:
     - Deactivates the existing active rule (sets `isActive = false` and `meta.deactivatedAt`)
     - Re-validates the target rule with Zod (refuses invalid rules)
     - Activates the target rule (sets `isActive = true` and `meta.activatedAt`)
     - Audits the activation with before/after state
     - Revalidates Next.js cache tags (`rewards:rule`, `cms:reward-rule`) and route paths (`/rewards`, `/admin/rewards/rules`, `/account`).

---

## 4. Admin Management UI (`/admin/rewards/rules`)

- **Provisional Banner**: Displayed whenever the active rule or latest rule has `meta.provisional = true`.
- **Impact Summary**: Compares field-by-field differences between draft and active versions before activation. No speculative revenue/cost projections.
- **Confirmation Dialog**: Activation requires explicit confirmation detailing points per video, redemption minimums, and tier structures.
