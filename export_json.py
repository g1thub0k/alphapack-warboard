#!/usr/bin/env python3
import csv, json, sys, pathlib
src = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'ClanData.csv')
out = pathlib.Path(__file__).resolve().parents[1] / 'data' / 'clandata.json'
out.parent.mkdir(parents=True, exist_ok=True)
with src.open(newline='', encoding='utf-8') as f:
    rows = list(csv.DictReader(f))
members = []
for r in rows:
    members.append({
        'tag': r.get('Player Tag', ''),
        'name': r.get('Name', ''),
        'role': r.get('Role', ''),
        'missed': float(r.get('Missed Attacks') or 0),
        'd1': r.get('Day 1 Missed') or '',
        'd2': r.get('Day 2 Missed') or '',
        'd3': r.get('Day 3 Missed') or '',
        'd4': r.get('Day 4 Missed') or '',
        'action': r.get('Suggested Action') or '',
        'reason': r.get('Reason') or '',
        'efficiency': float(r.get('Attack Efficiency') or 0),
        'contribution': float(r.get('Contribution Score') or 0),
        'rank': int(float(r.get('Contribution Rank') or 0) or 0),
        'thisWeek': r.get('This Week Summary') or '',
        'lastWeek': r.get('Last Week Summary') or '',
        'fame': float(r.get('All-Time Fame') or 0),
        'daysInClan': int(float(r.get('Days in Clan') or 0) or 0),
    })
out.write_text(json.dumps({'clan': 'Alpha Pack', 'updated': src.name, 'members': members}, indent=2), encoding='utf-8')
print(f'Wrote {len(members)} members -> {out}')
