# Community Plugins publishing checklist

Checked against Obsidian's official documentation on 21 November 2026.
Publishing source to GitHub alone does not add a plugin to Community Plugins.

## Prepare the release

1. Test a clean installation in a disposable vault. Check restart, disable and
   unload, dark/light themes, popouts, mobile if claimed, and each supported
   integration. The automated tests and browser previews are not live-vault
   certification.
2. Review README, LICENSE, and manifest.json in the repository root. Keep the
   minimum supported Obsidian version honest. This project is MIT-licensed by
   Ahmed Adel. Third-party plugins retain their own licenses.
3. Disclose network behavior, including optional external background images.
   Use the standard manifest `fundingUrl` for in-app financial-support links.
4. Run `npm ci`, `npm run build`, and `npm test`. Confirm `styles.css` matches
   `styles/core.css`. The standard runtime files are `main.js`, `manifest.json`,
   and `styles.css`; they do not need the source folders or node_modules.
5. Set the intended release version in manifest.json and package.json. Use
   SemVer `x.y.z`. When raising minAppVersion for a future update, maintain the
   compatibility mapping in versions.json.
6. Review and approve the exact changes before pushing. Do not merge or
   publish a release without the owner's specific approval.
7. Update RELEASE_NOTES.md, then push a tag that exactly matches
   manifest.version, without an extra `v` prefix. The tag-triggered workflow
   builds, tests, validates versions.json, and publishes the GitHub release
   with `main.js`, `manifest.json`, and `styles.css` individually. It also
   attaches LICENSE and an optional install ZIP. A ZIP is not a substitute for
   the individual assets. Build provenance attestations are recommended.
8. Download those exact release assets into a clean plugin directory and test
   them, rather than testing from a full development checkout that can hide
   missing files. The release workflow has not been run by these local tests.

## Submit through the current directory

1. Open https://community.obsidian.md and sign in with an Obsidian account.
2. Link the owning GitHub account from the community profile.
3. Select **Plugins**, then **New plugin**. Enter the repository URL and choose
   the owner. This repository's name ends with a period:
   <https://github.com/Ahmedadel200066/Obsidian-Customization-Suite.>
4. Read and accept the developer policies and maintenance commitment, then
   select **Submit**. Acceptance is a decision for the account owner.
5. The directory reads manifest.json at HEAD of the default branch. A branch
   that has not been merged is not the submitted manifest.
6. Check the automated manifest, release-asset, source-code, and build results.
   Errors prevent installation. Warnings do not block submission, but should
   be addressed where possible. Fix the source and publish a new incremented
   release when needed.
7. **Review branch** and **Run preview scan** can inspect a branch, tag, or SHA
   before release. **Request review** and **Check for new releases** can request
   a fresh check after changes.
8. Under **Edit listing**, add the icon, descriptions, categories, payment type,
   and real screenshots. Current limits are up to 5 desktop images at
   1200x800 and up to 5 mobile images at 900x1600, JPEG/PNG/WebP, 5 MB each.
9. Select **Publish** when ready. It does not bypass review errors. No review
   time or acceptance is guaranteed.
10. After the entry is installable, test installation from within Obsidian,
    then announce it if desired. Future versions come from GitHub releases;
    the initial directory submission is not repeated for every update.

The older manual pull-request instructions for the registry are not the
current documented submission route. Local preparation does not create a
GitHub release, submit the entry, accept policies, or publish the listing.

## Official sources

- https://docs.obsidian.md/plugins/releasing/submit-plugin
- https://docs.obsidian.md/community-directory/set-up-and-claim
- https://docs.obsidian.md/community-directory/submission-requirements-for-plugins
- https://docs.obsidian.md/community-directory/developer-policies
- https://docs.obsidian.md/community-directory/manage-entry
- https://docs.obsidian.md/community-directory/faq
- https://docs.obsidian.md/Plugins/Releasing/Release+your+plugin+with+GitHub+Actions
