import json,pathlib,collections
provinces=json.load(open('work/gitlab-provinces.json')); cities=json.load(open('work/gitlab-cities.json')); barangays=json.load(open('work/gitlab-barangays.json'))
options=[{'code':p['code'],'name':p['name']} for p in provinces]+[{'code':'NCR','name':'Metro Manila (NCR)'}]+[{'code':'IC-'+c['code'],'name':c['name']+' (independent city)'} for c in cities if not c['provinceCode'] and c['regionCode']!='130000000']
cs=[{'code':c['code'],'name':c['name'],'provinceCode':'NCR' if c['regionCode']=='130000000' else c['provinceCode'] or 'IC-'+c['code']} for c in cities]
assert all(c['provinceCode'] in {p['code'] for p in options} for c in cs)
bycode={c['code']:c for c in cs}; groups=collections.defaultdict(lambda:collections.defaultdict(list))
for b in barangays:
 code=b['cityCode'] or b['municipalityCode']; city=bycode[code];groups[city['provinceCode']][code].append({'code':b['code'],'name':b['name']})
for province,group in groups.items():
 for values in group.values(): values.sort(key=lambda x:x['name'].casefold())
 pathlib.Path('public/addresses/'+province+'.json').write_text(json.dumps(group,ensure_ascii=False,separators=(',',':')))
pathlib.Path('lib/ph-addresses.json').write_text(json.dumps({'provinces':sorted(options,key=lambda p:p['name']),'cities':sorted(cs,key=lambda c:c['name']),'source':'https://psgc.gitlab.io/api/','retrieved':'2026-09-15'},ensure_ascii=False,separators=(',',':')))
print(f'{len(options)} province/Metro Manila choices, {len(cs)} cities/municipalities, {len(barangays)} barangays; all parents linked')
assert len([c for c in cs if c['provinceCode']=='NCR'])==17
assert len(groups['NCR']['133900000'])>800
print('Metro Manila and Manila barangay checks passed')
