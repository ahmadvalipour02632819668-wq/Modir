# Resident Manager Android (TWA)

This module wraps the existing production PWA at **https://ahmadvalipour.ir/** as a Trusted Web Activity (TWA). The existing web application, Supabase project, database, and frontend script order are not changed by this module.

## Current state

- Application ID: `ir.ahmadvalipour.modir`
- Display name: `مدیر مجتمع`
- Website: `https://ahmadvalipour.ir/`
- Build workflow: `.github/workflows/android-apk.yml`
- The workflow currently produces a **debug APK for device testing only**.

## Required before a publishable release

A TWA is displayed without browser controls only after the website proves its relationship to this Android application. Publish this file on the website:

`https://ahmadvalipour.ir/.well-known/assetlinks.json`

It must contain the final release signing certificate SHA-256 fingerprint and the application ID above. Do not use the debug certificate fingerprint for the store release.

A release APK must be signed with a dedicated keystore. Keep the keystore and its passwords outside the repository; back up the keystore securely. Configure GitHub Actions secrets only after the keystore has been created and safely backed up. Never commit a keystore or passwords.

## Notifications

The TWA uses the browser's existing PWA runtime and service worker. Actual push-notification behavior still needs verification on Android Chrome with the production domain and the existing push backend. A debug APK build alone does not prove push delivery or digital-store readiness.
