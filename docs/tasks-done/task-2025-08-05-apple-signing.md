# Task: Apple Signing

I need to sign the app with an Apple **Developer ID Application** certificate.

See https://tauri.app/distribute/sign/macos/#creating-a-signing-certificate

I should be able to test this locally but I also need it set up with the automated deployment system. So the GitHub Action when it builds a new release does this properly.

---

## Session Summary - January 5, 2025

**ACTUAL PROBLEM DISCOVERED:** The app is being signed with **adhoc signing** instead of the Developer ID certificate. This is why it shows as "damaged" - it's not a notarization issue at all.

### Key Findings:

1. **Certificate Import Working**: The `apple-actions/import-codesign-certs@v3` successfully imports the certificate into the keychain
2. **Environment Variables Set Correctly**: All Apple notarization variables are properly configured
3. **Root Issue**: Code signature analysis shows:
   - `Signature=adhoc` 
   - `TeamIdentifier=not set`
   - `flags=0x20002(adhoc,linker-signed)`

**This means Tauri is NOT using the imported certificate for signing.**

### What We Built (May Need Reverting):

- Complex API key file creation system
- Multiple environment variables for notarization  
- Extensive GitHub Actions workflow changes
- All focused on notarization (which only happens AFTER proper signing)

### The Real Issue:

**Tauri isn't finding or using the imported Developer ID certificate.** The app gets adhoc-signed instead of properly signed, causing the "damaged app" error.

### Next Session Focus:

1. **Debug certificate usage** - Why isn't Tauri using the imported certificate?
2. **Fix basic Developer ID signing** - Get `TeamIdentifier` and proper signature working
3. **THEN** worry about notarization - Only needed after basic signing works
4. **Consider reverting** notarization-focused changes until basic signing is resolved

### Current Status:
- ✅ Certificate import working
- ❌ Certificate not being used for signing (adhoc instead)
- ❌ App shows as "damaged" due to adhoc signature
- 🔄 Notarization irrelevant until basic signing works

**Time spent:** ~4-5 hours mostly chasing the wrong problem (notarization vs. basic certificate usage).

---

## SOLUTION FOUND - August 5, 2025

### The Fix

The issue was that Tauri wasn't being told which certificate to use. The solution was simple:

1. **Add the `APPLE_SIGNING_IDENTITY` environment variable** to the GitHub Actions workflow:
   ```yaml
   APPLE_SIGNING_IDENTITY: "Developer ID Application: Daniel Smith (XT349SJG9U)"
   ```

2. **Certificate Details**:
   - Certificate Name: `Developer ID Application: Daniel Smith (XT349SJG9U)`
   - Team ID: `XT349SJG9U`

### What Was Needed

1. **Local Fix** (for testing):
   - Downloaded Apple Developer ID G2 CA certificate
   - Added to keychain: `curl -O https://www.apple.com/certificateauthority/DeveloperIDG2CA.cer`
   - Build with: `APPLE_SIGNING_IDENTITY="Developer ID Application: Daniel Smith (XT349SJG9U)" npm run tauri build`

2. **GitHub Actions Fix**:
   - Added `APPLE_SIGNING_IDENTITY` environment variable to the build step
   - The certificate import was already working correctly
   - Notarization setup from yesterday is correct and will work after signing

### Verification

Successfully signed app shows:
```
Authority=Developer ID Application: Daniel Smith (XT349SJG9U)
Authority=Developer ID Certification Authority
Authority=Apple Root CA
TeamIdentifier=XT349SJG9U
Runtime Version=15.5.0
flags=0x10000(runtime)
```

No more adhoc signature! The app should no longer show as "damaged" when downloaded.

### Next Steps

1. Push these changes and test the GitHub Actions workflow
2. Verify the built release is properly signed and notarized
3. The Tauri updater signing error can be addressed separately if needed 
