# Releasing MouseMore

Releases are built by `.github/workflows/release.yml` on `windows-latest`. Every release is published as a **pre-release** until you promote it by hand.

## Cut a release

1. Bump `version` in `apps/desktop/src-tauri/tauri.conf.json` (and the Cargo/package versions to match).
2. Update `CHANGELOG.md`: use a `## [x.y.z]` heading. The release notes come from the section whose heading contains the version; if none matches, a short default is used.
3. Merge to `main` once CI is green.
4. Tag and push:
   ```powershell
   git tag v0.1.0
   git push origin v0.1.0
   ```
   The tag must equal `v` + the `tauri.conf.json` version, or the workflow fails early.
5. The workflow uploads to the GitHub pre-release: the NSIS `*-setup.exe`, `MouseMore-<ver>-portable-win-x64.zip`, and a `.sha256` for each.
6. Test the assets, then edit the release and untick "pre-release" when satisfied.

To rebuild an existing tag, run the workflow manually (Actions, Release, Run workflow) with that tag. Assets are replaced.

## Code signing (optional)

Without secrets the build is **unsigned** and the release notes say so. With both secrets set, `mousemore.exe` and the installer are signed with `signtool` (SHA-256, RFC 3161 timestamp) before packaging. The portable ZIP contains the signed exe. The signing logic lives in `scripts/sign-file.ps1`.

1. Obtain a code-signing certificate from a CA (OV or EV) and export it as a `.pfx` with a password.
2. Base64-encode it and copy the output:
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("cert.pfx")) | Set-Clipboard
   ```
3. In the repo: Settings, Secrets and variables, Actions, add:
   - `WINDOWS_CERT_PFX_BASE64`: the base64 text
   - `WINDOWS_CERT_PASSWORD`: the pfx password
4. Delete local `.pfx` copies you do not need. The workflow writes the cert to a temp file and deletes it at the end; secrets are never printed.

Some CAs now require hardware-token or cloud-HSM keys that cannot be exported as a `.pfx`. Those need a different signing step (for example Azure Trusted Signing or the CA's cloud signer); this workflow does not cover them. The signing path has not been tested against a real certificate.

## SmartScreen reality

- Unsigned builds trigger "Windows protected your PC" (More info, Run anyway).
- Signed builds from a new OV certificate **still warn** until the file and publisher build reputation. EV certificates no longer reliably skip this.
- Signing proves who published the file and that it was not modified; it does not guarantee a silent install. Ship checksums regardless.

## Verification checklist

- [ ] Release is marked pre-release and the tag matches the version.
- [ ] Hash matches the `.sha256` file:
  ```powershell
  (Get-FileHash .\MouseMore-0.1.0-portable-win-x64.zip -Algorithm SHA256).Hash.ToLower()
  Get-Content .\MouseMore-0.1.0-portable-win-x64.zip.sha256
  ```
- [ ] Signed builds: `Get-AuthenticodeSignature .\MouseMore_0.1.0_x64-setup.exe | Format-List Status, SignerCertificate, TimeStamperCertificate` shows `Status : Valid` and a timestamp. Check the extracted `mousemore.exe` as well.
- [ ] Unsigned builds: `Status` is `NotSigned` and the release notes say "unsigned".
- [ ] The installer installs per-user without elevation; the portable exe starts and keeps data in its `data` folder.
