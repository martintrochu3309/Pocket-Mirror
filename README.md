# Pocket Mirror

Open index.html to preview the app, or deploy the complete folder.

## Replace hero images
All six heroes are linked files in images/, not embedded in the HTML:
- awareness-day.png
- awareness-night.png
- acceptance-day.png
- acceptance-night.png
- action-day.png
- action-night.png

Day images have black backgrounds; night images have white backgrounds. The switch in More selects the matching version. Replace any image with the same filename and reload the page. No HTML edit is needed. For a hosted app, redeploy the changed files first. A fresh image URL is generated on each page load and the service worker bypasses image caching. Keep the same aspect ratio for a consistent layout; images display fully without cropping.

## Preview interactions
Reflection questions use selectable circles, without plus signs or expanding notes. LOOK MORE opens a demo gate. Any nonempty text unlocks the 12 mirrors and two episode pages for the current session. This is not email collection: no text is sent or saved. Reloading restores the gate.

## Episode media
The two supplied poster images are in media/. Actual video/audio files were not supplied; episode pages remain clearly marked coming soon.

## Fonts
Embedded Nimbus Sans Narrow approximates the reference headlines. See FONT-LICENSE.txt.
