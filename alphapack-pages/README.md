# Alpha Pack ClanData (GitHub Pages)

Static war board for clan members. Reads `data/clandata.json` (exported from the ClanData Sheet).

## Local preview
```bash
cd alphapack-pages && python3 -m http.server 8080
```
Open http://localhost:8080

## Refresh data from Sheet CSV
```bash
python3 scripts/export_json.py /path/to/ClanData.csv
```

## GitHub Pages
Push this folder to a repo, enable Pages from `main` / root (or `/docs`).
Keep the existing GitHub Actions → Google Sheet job unchanged.
