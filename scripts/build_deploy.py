import os, shutil

SRC = r'D:\AI工具\mercator-main'
WEB = os.path.join(SRC, 'web')
os.makedirs(WEB, exist_ok=True)

# 1) 复制 index.html 为部署副本
src_html = os.path.join(SRC, 'index.html')
dst_html = os.path.join(WEB, 'index.html')
shutil.copyfile(src_html, dst_html)

with open(dst_html, 'r', encoding='utf-8') as f:
    html = f.read()

# 2) 强制 demo 模式：把真实 Supabase URL 改为占位符（跳过 Supabase，走内置+JSON 数据渲染）
old_url = "var JAY_SUPABASE_URL = 'https://ftlzofrnosgvdvwajhuz.supabase.co';"
new_url = "var JAY_SUPABASE_URL = 'YOUR_SUPABASE_URL';"
assert old_url in html, "Supabase URL line not found!"
html = html.replace(old_url, new_url)

# 3) 注入自动 demo 登录脚本（pro 权限），打开链接直达仪表盘，无需登录
seed = ('<body>\n'
        '<script>\n'
        '(function(){try{if(!localStorage.getItem(\'jay_demo\')){'
        'localStorage.setItem(\'jay_demo\', JSON.stringify({email:\'luran@jayguanhai.com\',id:\'demo-user\',name:\'陆安然\',tier:\'pro\'}));'
        '}}catch(e){}})();\n'
        '</script>')
assert '<body>' in html, "body tag not found!"
html = html.replace('<body>', seed, 1)

# 3.5) 构建时中和 console.log/info/debug（保留 warn/error）：0&& 短路，运行期不输出、不报错、不增体积
html = html.replace('console.log(', '0&&console.log(')
html = html.replace('console.info(', '0&&console.info(')
html = html.replace('console.debug(', '0&&console.debug(')

with open(dst_html, 'w', encoding='utf-8') as f:
    f.write(html)

# 4) 复制 data/ 目录（countries/platforms/policies/rules 兜底 JSON）
src_data = os.path.join(SRC, 'data')
dst_data = os.path.join(WEB, 'data')
if os.path.exists(dst_data):
    shutil.rmtree(dst_data)
shutil.copytree(src_data, dst_data)

print('deploy build ready:', WEB)
print('index.html bytes:', os.path.getsize(dst_html))
print('data files:', sorted(os.listdir(dst_data)))
