# Photo Maker

A small client-side tool to generate a 4×6 (1800×1200 @300 DPI) sheet with six square prints (3×2 layout).

**Quick start**

- Open the app: double-click `index.html` or serve the folder and visit `http://localhost:8000`.
  - To serve with Python 3: run

```bash
python -m http.server 8000
```

- Click **Choose Photo**, crop if needed, then use *Download 4×6 JPEG* to save a print-ready file.

**Notes**

- Tailwind is loaded via CDN in `index.html` for simple styling — no build step required.
- The app processes images entirely in the browser; no data is uploaded.
- If you cancel the crop modal, it will close without changing the main 4×6 canvas.

**Files of interest**

- `index.html` — UI and Tailwind CDN
- `styles.css` — minimal overrides and handles styling
- `script.js` — cropping, grid generation, and download logic
