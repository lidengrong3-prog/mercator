# -*- coding: utf-8 -*-
"""把所有政策数据标记为示意性（demonstration），清空不可核实的 source_url。"""
import io, json

paths = ['data/policies.json','web/data/policies.json']
for p in paths:
    d = json.load(io.open(p, encoding='utf-8'))
    items = d.get('items', [])
    for it in items:
        it['data_quality'] = 'demonstration'  # 示意性数据，未独立核实
        it['source_url'] = ''  # 清空不可核实的 URL
        it['source_count'] = 0  # 无独立来源核实
        it['source_verified'] = False
        # 保留 source（机构名）作为参考指引，但不算已核实来源
    d['data_quality_note'] = '当前政策数据为示意性参考，未经过权威源独立核实。展示的来源机构名为参考指引，不构成已验证信息。实际合规请以各国官方公告为准。'
    json.dump(d, io.open(p,'w',encoding='utf-8'), ensure_ascii=False, indent=2)
    print(p,'items=',len(items),'all marked as demonstration')
# 校验
d=json.load(io.open('data/policies.json',encoding='utf-8'))
print('第1条:', d['items'][0]['title'])
print('  source_url=', repr(d['items'][0].get('source_url')))
print('  data_quality=', d['items'][0].get('data_quality'))
print('  source_count=', d['items'][0].get('source_count'))
print('全局 data_quality_note:', d.get('data_quality_note',''))
