# Google OAuth 2.0 Setup Guide for Chawan Farms

This guide details the step-by-step setup required in Google Cloud Console to enable customer sign-in via Google OAuth.

---

## 1. Prerequisites
- A Google Cloud Platform (GCP) account (preferably the business organization or client account).
- Access to the GCP Console: [https://console.cloud.google.com/](https://console.cloud.google.com/)

---

## 2. Create / Select GCP Project
1. Log in to [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown at the top of the page.
3. Click **New Project**.
4. Set Project name: `Chawan Farms` (or select your existing organizational project).
5. Click **Create** and ensure the project is selected.

---

## 3. Configure OAuth Consent Screen
1. In the left navigation menu, go to **APIs & Services** > **OAuth consent screen** (or search "OAuth consent screen").
2. Select **External** user type (allows any customer with a Google account to sign in).
3. Click **Create**.
4. Fill in App Information:
   - **App name**: `Chawan Farms`
   - **User support email**: select your admin/support email.
   - **App logo**: (optional) Upload Chawan Farms logo.
5. Fill in App Domain:
   - **Application home page**: `https://chawan-farms.vercel.app` (or custom domain).
   - **Application privacy policy link**: `https://chawan-farms.vercel.app/policies/privacy`
   - **Application terms of service link**: `https://chawan-farms.vercel.app/policies/terms`
6. Fill in Developer Contact Information:
   - Enter your technical contact email.
7. Click **Save and Continue**.
8. **Scopes**:
   - Click **Add or Remove Scopes**.
   - Select:
     - `.../auth/userinfo.email` (`email`)
     - `.../auth/userinfo.profile` (`profile`)
     - `openid`
   - Click **Update**, then click **Save and Continue**.
9. **Test Users** (while Publishing status is in "Testing"):
   - Add your test email addresses to test sign-in before verification/publishing.
10. Click **Save and Continue**, then return to Dashboard.

---

## 4. Create OAuth 2.0 Web Client Credentials
1. In the left navigation menu, go to **APIs & Services** > **Credentials**.
2. Click **+ Create Credentials** at the top, and select **OAuth client ID**.
3. In **Application type**, select **Web application**.
4. Set **Name**: `Chawan Farms Web Client`.
5. Under **Authorized JavaScript origins**, click **+ Add URI** and add:
   - `http://localhost:3000`
   - `https://www.chawanfarms.com`
   - `https://chawanfarms.com`
   - `https://chawan-farms.vercel.app` (if using Vercel preview)
6. Under **Authorized redirect URIs**, click **+ Add URI** and add the exact callback URLs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://www.chawanfarms.com/api/auth/callback/google`
   - `https://chawanfarms.com/api/auth/callback/google`
   - `https://chawan-farms.vercel.app/api/auth/callback/google`
7. Click **Create**.
8. A modal will display your:
   - **Client ID** (e.g., `xxxxxxxxxxxx-xxxxxxxxxxxxxxxx.apps.googleusercontent.com`)
   - **Client Secret** (e.g., `GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx`)

---

## 5. Configure Application Environment Variables
1. In your local development environment ([`.env.local`](file:///c:/Vivo%20Y50/ChawanFarms/.env.local)):
   ```env
   GOOGLE_CLIENT_ID=xxxxxxxxxxxx-xxxxxxxxxxxxxxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx
   ```
2. In Vercel / Production deployment settings:
   - Add `GOOGLE_CLIENT_ID` to Production and Preview environments.
   - Add `GOOGLE_CLIENT_SECRET` to Production and Preview environments.
3. Ensure `AUTH_TRUSTED_ORIGINS` includes your deployment domains:
   ```env
   AUTH_TRUSTED_ORIGINS=http://localhost:3000,https://chawan-farms.vercel.app
   ```

---

## 6. Security Architecture & Enforced Rules
- **Customers Only**: Google sign-in is strictly reserved for customer accounts (`type: CUSTOMER`).
- **Staff Access Blocked**: If a Google account's email matches an active or invited `STAFF` account, authentication is rejected with a message directing them to the Admin tab. Zero staff sessions are created through Google OAuth.
- **Verified Email Required**: Only Google accounts with `email_verified: true` are accepted.
- **Account Linking**: If an existing customer account has the matching verified email, the Google credential links to the existing profile without data duplication.
- **Privacy Notice & Consent**: New customers created via Google OAuth receive a provisioned `CustomerProfile` with a unique referral code and an initial `ConsentRecord`.
- **Content Security Policy (CSP)**: Google OAuth uses standard browser redirect flow (`accounts.google.com`), requiring zero third-party script tags or script hosts.

