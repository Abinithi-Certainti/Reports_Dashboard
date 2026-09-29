#!/usr/bin/env python3
"""Builds docs/report-guide.html: one page per report (what it is, how it works, tables, fields and formulas).

Reads the field mappings from docs/mapping-dashboard.html (needs node) and the filters / visuals / tables from
reports/*/report.yaml and dataset.sql, so the guide always matches the code. Holds no data rows or figures.
Run from the repo root: python3 tools/make_report_guide.py
"""
import json, os, re, subprocess, tempfile, yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAP = os.path.join(ROOT, 'docs', 'mapping-dashboard.html')

# Where each report's rows come from on the online dashboard today (no figures, only the kind of source).
DATA = {'tender-report': 'export', 'waste-report': 'export', 'market-category': 'sample', 'people-count': 'none',
        'radar-car-count': 'none', 'sales-margin-budget': 'export', 'sales-report-1': 'export',
        'sales-budget-2026': 'export', 'sales-field-team': 'sample', 'financial-reports': 'sample'}


def mapping():
    html = open(MAP, encoding='utf-8').read()
    body = html[html.index('<script>') + len('<script>'):html.index('function tableStatus')]
    with tempfile.NamedTemporaryFile('w', suffix='.cjs', delete=False) as f:
        f.write(body + '\nprocess.stdout.write(JSON.stringify({REPORTS, GLOBAL_Q, TABLES}));')
    try:
        return json.loads(subprocess.check_output(['node', f.name]))
    finally:
        os.unlink(f.name)


def spec(rid):
    p = os.path.join(ROOT, 'reports', rid, 'report.yaml')
    if not os.path.exists(p):
        return None
    y = yaml.safe_load(open(p, encoding='utf-8'))
    sql = open(os.path.join(ROOT, 'reports', rid, 'dataset.sql'), encoding='utf-8').read()
    filters = []
    for f in y.get('filters', []):
        filters.append({'label': y['dimensions'][f['dimension']]['label'], 'type': f['type'],
                        'days': f.get('default_last_days'), 'open_on': f.get('open_on')})
    visuals = []
    for v in y.get('visuals', []):
        title = v.get('title') or ''
        if v['type'] == 'kpi':
            title = ', '.join(i['label'] for i in v.get('items', []))
        visuals.append({'type': v['type'], 'title': title})
    return {'filters': filters, 'visuals': visuals, 'tables': sorted(set(re.findall(r'\bmaster\.([a-z_0-9]+)', sql))),
            'calendar': y.get('calendar')}


def main():
    m = mapping()
    reports = []
    for i, r in enumerate(m['REPORTS'], 1):
        s = spec(r['id'])
        tables = s['tables'] if s else sorted({t for f in r['fields'] for t in f.get('t', [])})
        reports.append({**r, 'no': i, 'data': DATA.get(r['id'], 'none'), 'spec': s, 'tables': tables})
    data = json.dumps({'reports': reports, 'global_q': m['GLOBAL_Q'], 'tables': m['TABLES']}, ensure_ascii=False)
    tpl = open(os.path.join(ROOT, 'tools', 'report_guide_template.html'), encoding='utf-8').read()
    out = tpl.replace('/*DATA*/null', data.replace('</', '<\\/'))
    open(os.path.join(ROOT, 'docs', 'report-guide.html'), 'w', encoding='utf-8').write(out)
    print('wrote docs/report-guide.html,', len(reports), 'reports,', sum(len(r['fields']) for r in reports), 'fields')


if __name__ == '__main__':
    main()
