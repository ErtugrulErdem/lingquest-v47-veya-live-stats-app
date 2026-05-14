LingQuest v47 Fresh Clean Live Stats Package

Use this for a completely new GitHub repository and a new Vercel project.

What it does:
- Fresh stats namespace: events-v47/
- Private Vercel Blob store support
- Every user action is saved as an append-only event
- Admin auto-refreshes every 3 seconds
- Save/completed states cannot be overwritten or disappear

Root structure after upload:
index.html
admin.html
package.json
vercel.json
README_DEPLOY.txt
api/
  track.js
  events.js
  clear.js
  health.js

Deploy steps:
1. Upload the CONTENTS of this ZIP to your new GitHub repo root.
2. Create/import a new Vercel project from that repo.
3. Connect a Vercel Blob store to the project.
4. Redeploy after Blob is connected.
5. Open /api/health. It should show ok:true, access:'private', mode:'fresh-v47'.
6. Open the demo and complete one test flow.
7. Open /admin.html. Stats should appear and refresh automatically.
