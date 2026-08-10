# -*- coding: utf-8 -*-
"""评测修复补丁二：修正第一波未命中的小替换（不重复注入 CSS/footer/INIT）。"""
import re

PATH = 'index.html'
src = open(PATH, encoding='utf-8').read()
orig = src

def rep(old, new, label, n=1):
    global src
    c = src.count(old)
    if c != n:
        print('[WARN] %s : 期望 %d 实际 %d' % (label, n, c))
        if c == 0:
            print('   skip'); return
    src = src.replace(old, new, n if n != 1 else 1)
    print('[OK] %s (x%d)' % (label, src.count(new) if c>0 else 0))

# 分组标签（HTML 转义 &amp;）
rep('Product &amp; Operations', '商品与运营', 'N-15 分组4')
rep('Risk &amp; Compliance', '风险与合规', 'N-15 分组5')

# Global Overview 第二处（JS source 元数据）
rep("source = 'Global Overview';", "source = '全局概览';", 'N-15 分组1(JS源)')

# Hero 文案中的平台数（动态化）
rep('结合 26 国 41 平台数据', "结合 26 国 '+JAY_PLATFORM_COUNT+' 平台数据", 'S-01 Hero1')
rep('基于 26 国 41 平台数据', "基于 26 国 '+JAY_PLATFORM_COUNT+' 平台数据", 'S-01 Hero2')

# S-02 Dazzle Me 重复行（Shopee 东南亚 US$ 85万 版本）
daz_re = re.compile(r"\['Dazzle Me Official','Shopee','东南亚','US\$ 85万'[^\]]*\]")
src2, dazcnt = daz_re.subn('', src)
print('[INFO] Dazzle Me 重复行移除:', dazcnt)
src = src2

open(PATH, 'w', encoding='utf-8').write(src)
print('DONE bytes:', len(src), '(was', len(orig), ')')
