"""Export the saved count-scale results without fitting or rounding them."""
import csv
import hashlib
import json
from pathlib import Path

site = Path(__file__).resolve().parents[1]
source = site.parents[1] / 'outputs/ferretti_contact_ratios_2026-09-25/count_scale_results'
daily = list(csv.DictReader((source / 'daily_plot_data.csv').open()))
payload = {'method': 'count-scale fixed-match refit', 'outcomes': {},
           'source_sha256': hashlib.sha256((source / 'daily_plot_data.csv').read_bytes()).hexdigest()}
for outcome in ('contacts', 'transmissions'):
    days = []
    for row in daily:
        if row['outcome'] != outcome:
            continue
        item = {key: float(row[key]) for key in ('observed', 'B', 'D', 'background', 'M', 'fitted_total', 'match_background_ratio')}
        item.update(date=row['date'], is_match_day=row['is_match_day'] == 'TRUE')
        assert abs(item['B'] + item['D'] + item['M'] - item['fitted_total']) < 1e-7
        days.append(item)
    table = list(csv.DictReader((source / (outcome + '_match_table.csv')).open()))
    matches = []
    for row in table:
        from datetime import datetime
        date = datetime.strptime(row['Date'] + ' 2021', '%d %b %Y').strftime('%Y-%m-%d')
        day = next(d for d in days if d['date'] == date)
        assert abs(day['M'] - float(row['Match (M)'])) < 1e-7
        assert abs(day['match_background_ratio'] - float(row['M/(B+D)'])) < 1e-10
        matches.append(dict(day, name=row['Match']))
    assert len(days) == 51 and len(matches) == 8
    payload['outcomes'][outcome] = {'daily': days, 'matches': matches}
(site / 'data.js').write_text('window.EURO_RESULTS = ' + json.dumps(payload, separators=(',', ':')) + ';\n')
print('Exported both outcomes: 51 daily rows and eight match rows each, at full precision.')
