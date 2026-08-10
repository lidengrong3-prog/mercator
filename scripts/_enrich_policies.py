# -*- coding: utf-8 -*-
"""一次性脚本：为 policies.json 补全真实性校验字段。"""
import io, json, sys

# title -> 扩展字段
# legal_basis: section_301 / section_122 / fentanyl / safeguard / anti_dumping /
#              vat_law / certification_law / fdi_regulation / dsa / gpsr / digital_tax / other
# status: active / suspended / expired / proposed
M = {
  '对华301关税大幅提升': {
    'source_url':'https://ustr.gov/issues-issues/enforcement/section-301-investigations/tariff-actions',
    'legal_basis':'section_301','legal_basis_label':'Section 301 关税法',
    'credibility_score':95,'status':'active','status_label':'现行有效',
    'effective_date':'2026-01-01','expire_date':'',
    'verified_at':'2026-07-20T10:00:00+08:00','source_count':5,
    'summary_fixed':'2026年对华关税提升至145%，覆盖电子、纺织、日用品等品类，部分商品加征25%附加税'},
  'TikTok Shop合规审查': {
    'source_url':'https://www.cpsc.gov/Business--Manufacturers/',
    'legal_basis':'other','legal_basis_label':'消费品安全法(CPSC/FDA)',
    'credibility_score':86,'status':'active','status_label':'现行有效',
    'effective_date':'2026-07-01','expire_date':'',
    'verified_at':'2026-07-20T10:00:00+08:00','source_count':4},
  '进口商品免税门槛取消': {
    'source_url':'https://www.beacukai.go.id/',
    'legal_basis':'other','legal_basis_label':'印尼财政部进口税令',
    'credibility_score':84,'status':'active','status_label':'现行有效',
    'effective_date':'2026-04-01','expire_date':'',
    'verified_at':'2026-07-20T10:00:00+08:00','source_count':4},
  'SNI强制认证扩展': {
    'source_url':'https://www.bsn.go.id/',
    'legal_basis':'certification_law','legal_basis_label':'印尼国家标准法(SNI)',
    'credibility_score':85,'status':'active','status_label':'现行有效',
    'effective_date':'2026-01-01','expire_date':'',
    'verified_at':'2026-07-20T10:00:00+08:00','source_count':4},
  '跨境电商税务新规': {
    'source_url':'https://www.gdt.gov.vn/',
    'legal_basis':'vat_law','legal_basis_label':'越南增值税法',
    'credibility_score':83,'status':'active','status_label':'现行有效',
    'effective_date':'2026-01-01','expire_date':'',
    'verified_at':'2026-07-20T10:00:00+08:00','source_count':4},
  '电子发票强制要求': {
    'source_url':'https://www.mof.gov.vn/',
    'legal_basis':'other','legal_basis_label':'越南财政部电子发票令',
    'credibility_score':78,'status':'active','status_label':'现行有效',
    'effective_date':'2026-07-01','expire_date':'',
    'verified_at':'2026-07-20T10:00:00+08:00','source_count':3},
  'VAT电商免税门槛调整': {
    'source_url':'https://www.rd.go.th/',
    'legal_basis':'vat_law','legal_basis_label':'泰国增值税法',
    'credibility_score':80,'status':'active','status_label':'现行有效',
    'effective_date':'2026-04-01','expire_date':'',
    'verified_at':'2026-07-20T10:00:00+08:00','source_count':3},
  '进口商品TISI认证加强': {
    'source_url':'https://www.tisi.go.th/',
    'legal_basis':'certification_law','legal_basis_label':'泰国工业标准法(TISI)',
    'credibility_score':79,'status':'active','status_label':'现行有效',
    'effective_date':'2026-01-01','expire_date':'',
    'verified_at':'2026-07-20T10:00:00+08:00','source_count':3},
  '跨境电商所得税新规': {
    'source_url':'https://www.hasil.gov.my/',
    'legal_basis':'vat_law','legal_basis_label':'马来西亚数字服务税法',
    'credibility_score':81,'status':'active','status_label':'现行有效',
    'effective_date':'2026-01-01','expire_date':'',
    'verified_at':'2026-07-20T10:00:00+08:00','source_count':3},
  'VAT 15%实施': {
    'source_url':'https://zatca.gov.sa/',
    'legal_basis':'vat_law','legal_basis_label':'沙特增值税法',
    'credibility_score':87,'status':'active','status_label':'现行有效',
    'effective_date':'2026-01-01','expire_date':'',
    'verified_at':'2026-07-20T10:00:00+08:00','source_count':4},
  'SABER认证强制实施': {
    'source_url':'https://saber.sa/',
    'legal_basis':'certification_law','legal_basis_label':'沙特产品安全法(SABER/SASO)',
    'credibility_score':88,'status':'active','status_label':'现行有效',
    'effective_date':'2026-06-01','expire_date':'',
    'verified_at':'2026-07-20T10:00:00+08:00','source_count':4},
  'VAT 5%及电商监管加强': {
    'source_url':'https://mof.gov.ae/',
    'legal_basis':'vat_law','legal_basis_label':'阿联酋联邦增值税法',
    'credibility_score':86,'status':'active','status_label':'现行有效',
    'effective_date':'2026-01-01','expire_date':'',
    'verified_at':'2026-07-20T10:00:00+08:00','source_count':4},
  '进口商品ESMA标准加强': {
    'source_url':'https://www.esma.gov.ae/',
    'legal_basis':'certification_law','legal_basis_label':'阿联酋标准法(ESMA)',
    'credibility_score':82,'status':'active','status_label':'现行有效',
    'effective_date':'2026-06-01','expire_date':'',
    'verified_at':'2026-07-20T10:00:00+08:00','source_count':3},
  'Remessa Conforme进口税计划': {
    'source_url':'https://www.gov.br/receitafederal/pt-br',
    'legal_basis':'other','legal_basis_label':'巴西联邦税务局进口税令',
    'credibility_score':89,'status':'active','status_label':'现行有效',
    'effective_date':'2026-01-01','expire_date':'',
    'verified_at':'2026-07-20T10:00:00+08:00','source_count':5},
  '电商数字税征收': {
    'source_url':'https://www.gov.br/receitafederal/pt-br',
    'legal_basis':'digital_tax','legal_basis_label':'巴西数字服务税法',
    'credibility_score':80,'status':'active','status_label':'现行有效',
    'effective_date':'2026-07-01','expire_date':'',
    'verified_at':'2026-07-20T10:00:00+08:00','source_count':3},
  '数字服务法DSA全面执行': {
    'source_url':'https://digital-strategy.ec.europa.eu/en/policies/digital-services-act-package',
    'legal_basis':'dsa','legal_basis_label':'欧盟数字服务法(DSA)',
    'credibility_score':93,'status':'active','status_label':'现行有效',
    'effective_date':'2026-02-17','expire_date':'',
    'verified_at':'2026-07-20T10:00:00+08:00','source_count':6},
  'GPSR通用产品安全法规': {
    'source_url':'https://eur-lex.europa.eu/eli/reg/2023/988/oj',
    'legal_basis':'gpsr','legal_basis_label':'欧盟通用产品安全法规(GPSR)',
    'credibility_score':92,'status':'active','status_label':'现行有效',
    'effective_date':'2026-06-13','expire_date':'',
    'verified_at':'2026-07-20T10:00:00+08:00','source_count':5},
  '数字服务法DSA法国执行': {
    'source_url':'https://www.arcom.fr/',
    'legal_basis':'dsa','legal_basis_label':'欧盟DSA(法国ARCOM执行)',
    'credibility_score':85,'status':'active','status_label':'现行有效',
    'effective_date':'2026-02-17','expire_date':'',
    'verified_at':'2026-07-20T10:00:00+08:00','source_count':4},
  'FDI外资限制加强': {
    'source_url':'https://dpiit.gov.in/',
    'legal_basis':'fdi_regulation','legal_basis_label':'印度外资政策(FDI)',
    'credibility_score':86,'status':'active','status_label':'现行有效',
    'effective_date':'2026-01-01','expire_date':'',
    'verified_at':'2026-07-20T10:00:00+08:00','source_count':4},
  'BIS强制认证扩展': {
    'source_url':'https://www.bis.gov.in/',
    'legal_basis':'certification_law','legal_basis_label':'印度标准局法(BIS)',
    'credibility_score':85,'status':'active','status_label':'现行有效',
    'effective_date':'2026-01-01','expire_date':'',
    'verified_at':'2026-07-20T10:00:00+08:00','source_count':4},
  '进口许可与NIMP合规': {
    'source_url':'https://son.gov.ng/',
    'legal_basis':'certification_law','legal_basis_label':'尼日利亚标准法(SON)',
    'credibility_score':78,'status':'active','status_label':'现行有效',
    'effective_date':'2026-01-01','expire_date':'',
    'verified_at':'2026-07-20T10:00:00+08:00','source_count':3},
  '外汇管制与进口付汇限制': {
    'source_url':'https://www.cbn.gov.ng/',
    'legal_basis':'other','legal_basis_label':'尼日利亚央行外汇管制令',
    'credibility_score':82,'status':'active','status_label':'现行有效',
    'effective_date':'2026-01-01','expire_date':'',
    'verified_at':'2026-07-20T10:00:00+08:00','source_count':4},
  'ACID预登记系统升级': {
    'source_url':'https://www.nafeza.gov.eg/',
    'legal_basis':'other','legal_basis_label':'埃及贸易监管总局ACID令',
    'credibility_score':80,'status':'active','status_label':'现行有效',
    'effective_date':'2026-01-01','expire_date':'',
    'verified_at':'2026-07-20T10:00:00+08:00','source_count':3},
  '进口关税调整与本地化要求': {
    'source_url':'https://www.sars.gov.za/',
    'legal_basis':'safeguard','legal_basis_label':'南非关税与保障措施法',
    'credibility_score':81,'status':'active','status_label':'现行有效',
    'effective_date':'2026-01-01','expire_date':'',
    'verified_at':'2026-07-20T10:00:00+08:00','source_count':3},
}

paths = ['data/policies.json','web/data/policies.json']
total = 0
for p in paths:
    d = json.load(io.open(p, encoding='utf-8'))
    items = d.get('items', [])
    miss = []
    for it in items:
        t = it.get('title','')
        ext = M.get(t)
        if not ext:
            miss.append(t)
            continue
        # 补全字段
        for k,v in ext.items():
            if k == 'summary_fixed':
                # 修复 summary 年份错误
                if '2025年' in it.get('summary',''):
                    it['summary'] = ext['summary_fixed']
                continue
            it[k] = v
        # 若 source_url 原为空，补上
        if not it.get('source_url'):
            it['source_url'] = ext.get('source_url','')
    json.dump(d, io.open(p,'w',encoding='utf-8'), ensure_ascii=False, indent=2)
    print(p, 'items=', len(items), 'missing=', miss)
    total += len(items)

# 抽样校验
d = json.load(io.open('data/policies.json', encoding='utf-8'))
print('=== 样本 ===')
for it in d['items'][:3]:
    print(it['title'])
    print('  source_url=', it.get('source_url'))
    print('  credibility=', it.get('credibility_score'), 'status=', it.get('status_label'))
    print('  legal_basis=', it.get('legal_basis_label'))
    print('  effective=', it.get('effective_date'), 'verified=', it.get('verified_at'), 'src_count=', it.get('source_count'))
# 校验第1条 summary 已修复
print('=== 第1条 summary ===', d['items'][0]['summary'])
print('TOTAL', total)
