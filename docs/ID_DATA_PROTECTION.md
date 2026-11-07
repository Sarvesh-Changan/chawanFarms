# Guest Identity Document Data Protection Specification

## 1. Overview and Purpose

Under Indian hospitality regulations (including the Sarai Act, 1867 and Maharashtra State Tourism guidelines), hospitality establishments are legally required to verify the identity of all persons staying on the premises. 

To eliminate physical queuing and insecure physical photocopying at the farm reception, Chawan Farms collects identity verification documents digitally during the online booking process.

## 2. What Is Collected

For **every person** included in a booking (adults, children 4–10, and infants under 4):
- **Full Name** (as printed on the document)
- **Age Group**: `ADULT`, `CHILD_4_10`, or `INFANT_UNDER_4`
- **ID Type**: One of the permitted government or institutional document types:
  - Adults: Aadhaar Card (masked), Passport, Driving Licence, Voter ID, PAN Card
  - Minors (Children / Infants): School / College ID, Birth Certificate, Passport, or Aadhaar Card
- **Document Image / File**: JPG, PNG, WebP, or PDF up to 5 MB per document.

### Strict Non-Collection Safeguards
- **NO identity document numbers** (e.g. 12-digit Aadhaar number, Passport number, PAN) are ever extracted, keyed in, or stored in the database.
- **NO OCR / extracted text** is processed, parsed, or retained.
- **NO facial recognition or biometric scanning** is performed.
- EXIF location and camera metadata are stripped or ignored on ingest.

## 3. Storage and Cryptographic Security

- **Storage Location**: Private authenticated storage container in Cloudinary (`private/booking-ids/{draftKey}/{assetId}`).
- **Access Restrictions**:
  - Assets are stored under Cloudinary `type: "authenticated"`.
  - **No public URLs** exist. Direct URL access without a valid, cryptographic server signature is rejected with HTTP 401/403.
  - No derived public transformations or thumbnails are generated.
- **Upload Binding**:
  - Upload signatures are bound to the booking draft UUID (`draftKey`).
  - The server verifies folder path, format, file size, and draft key ownership before accepting any attachment.
  - Unattached draft uploads are automatically deleted after 24 hours by the orphan media cleanup job.

## 4. Access Control and Audit Logging

- **Role-Based Access Control**:
  - Viewing guest ID documents requires the specific, high-privilege permission: `bookings.ids.read`.
  - Authorized Roles: **Super Admin**, **Owner / Manager**, and **Reservations Staff**.
  - **Read-Only Staff are explicitly excluded** from viewing guest documents.
- **Short-Lived Signed URLs**:
  - Staff never receive persistent document links.
  - Document viewing generates an ephemeral, cryptographically signed URL valid for **60 seconds**.
- **Audit Logging**:
  - Every single view attempt by staff writes an immutable `AuditLog` entry recording:
    - Staff Member ID
    - Action: `booking.guest_id.view`
    - Guest ID and Booking Reference
    - Timestamp, IP address, and User-Agent
- **Visibility Boundaries**:
  - Guest identity documents **never appear** in customer lists, CSV exports, booking emails, WhatsApp alerts, public analytics, or privacy exports.
  - Customer account view and privacy exports display only verification status: `ID provided` or `ID deleted on [date]`, with ID type, never the file.

## 5. Retention and Automated Deletion

- **Provisional Retention Window**:
  - **Completed Stays**: Retained for **30 days** post-checkout (`ID_RETENTION_DAYS_AFTER_CHECKOUT = 30`), then automatically purged.
  - **Cancelled or Rejected Bookings**: Retained for **7 days** (`ID_RETENTION_DAYS_AFTER_CANCEL_OR_REJECT = 7`), then automatically purged.
- **Automated Purge Cron Job (`/api/cron/purge-booking-ids`)**:
  - Deletes the remote Cloudinary asset permanently.
  - Deletes the database `Media` row.
  - Sets `idMediaId = null` and records `idPurgedAt = new Date()` on the `BookingGuest` record.
  - Emits an audited log entry for the purge action.
  - Idempotent: skips already-purged records.

## 6. Aadhaar and DPDP Act 2023 Caveats

### Aadhaar Regulations (UIDAI Advisory)
- Under the Aadhaar (Targeted Delivery of Financial and Other Subsidies, Benefits and Services) Act, 2016 and UIDAI circulars, private entities may not demand unmasked Aadhaar numbers.
- **Masked Aadhaar is explicitly recommended** in the UI hint (first 8 digits hidden, only last 4 visible).
- Alternative identity documents (Passport, Driving Licence, Voter ID, PAN) are provided to ensure guests have non-Aadhaar choices.

### Digital Personal Data Protection Act, 2023 (DPDP)
- **Notice and Consent**: Explicit, mandatory checkbox consent is recorded at booking step 2, detailing purpose (check-in verification), access, and retention period, linked to `/privacy`.
- **Purpose Limitation**: Documents are strictly used for physical verification at farm check-in.
- **Storage Limitation**: Enforced via automated retention purge.

## 7. Breach Response Protocol

If unauthorized access or exposure of document assets is suspected:
1. Immediately rotate Cloudinary API keys and secret via the Cloudinary management console.
2. Review audit logs for `booking.guest_id.view` entries to determine exposed records and actor accounts.
3. Revoke active staff sessions and suspend compromised staff credentials.
4. Notify the Data Protection Officer / Farm Management.
5. In accordance with CERT-In directives and DPDP Act provisions, file incident notification with authorities and affected data principals within statutory timelines.

## 8. Policy Updates Required for Client Approval

The client must review and approve the following policy draft updates under `/admin/settings/policies`:

1. **Privacy Notice (`privacy-policy`)**:
   - Add explicit clause on Digital Identity Document Collection for guests and minors.
   - Specify 30-day post-stay retention window and purpose of check-in verification.
   - Outline right to erasure upon stay completion.
2. **Stay Rules & Cancellation Policy (`stay-rules-and-cancellation`)**:
   - Note that digital ID submission before arrival is mandatory for booking confirmation and expedited check-in.
   - State that failure to provide matching government photo ID at the farm gate may result in refusal of entry without refund.
3. **Child and Minor Policy**:
   - Confirm acceptable ID types for children (school ID vs birth certificate).
   - Confirm parental/guardian consent basis for collecting minor document images.

