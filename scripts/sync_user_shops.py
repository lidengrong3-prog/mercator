#!/usr/bin/env python3
"""
JAY观海 · 用户监控店铺落库脚本

把 data/user_shops.json（店铺追踪页面的导出/后端产出）upsert 到
Supabase 的 monitored_shops 表，实现「店铺追踪」板块的服务端落库。

与 collect_data.py 一致，仅用标准库 urllib，无需 pip install。

用法：
  # 离线校验导出文件结构（不联网、不写库）
  python scripts/sync_user_shops.py --validate

  # 真正上传（需配置环境变量）
  export SUPABASE_URL="https://xxxx.supabase.co"
  export SUPABASE_SERVICE_KEY="你的service_role_key"
  python scripts/sync_user_shops.py --file data/user_shops.json --device dev_abc123

环境变量：
  SUPABASE_URL           项目地址
  SUPABASE_SERVICE_KEY   service_role key（写库用，绝不进仓库）
  SUPABASE_SERVICE_ROLE_KEY  同上（别名，兼容 migrate_data.py）
"""
import os
import sys
import json
import argparse
import hashlib
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')


def get_supabase():
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        raise SystemExit("缺少 SUPABASE_URL / SUPABASE_SERVICE_KEY 环境变量")
    return url, key


def row_id(device_id, name, platform, market):
    base = "{}|{}|{}".format(name or "", platform or "", market or "")
    h = hashlib.md5(base.encode("utf-8")).hexdigest()[:10]
    return "{}:{}".format(device_id, h)


def upsert(url, key, rows):
    endpoint = "{}/rest/v1/monitored_shops".format(url)
    body = json.dumps(rows).encode("utf-8")
    req = Request(endpoint, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("apikey", key)
    req.add_header("Authorization", "Bearer " + key)
    req.add_header("Prefer", "resolution=merge-duplicates")
    try:
        with urlopen(req, timeout=30) as resp:
            return resp.status, resp.read().decode("utf-8", "ignore")
    except HTTPError as e:
        return e.code, e.read().decode("utf-8", "ignore")
    except URLError as e:
        return 0, str(e)


def load_export(path):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError("导出文件应为 JSON 数组")
    return data


def to_rows(items, device_id):
    out = []
    for it in items:
        name = (it.get("shop_name") or it.get("name") or "").strip()
        if not name:
            continue
        out.append({
            "id": row_id(device_id, name, it.get("platform", ""), it.get("market", "")),
            "device_id": device_id,
            "shop_name": name,
            "platform": it.get("platform", ""),
            "market": it.get("market", ""),
            "category": it.get("category", ""),
            "tags": it.get("tags", ""),
            "status": it.get("status", "正常"),
            "gmv": it.get("gmv", ""),
            "growth": it.get("growth", ""),
            "source": it.get("source", "backend"),
            "updated_at": "now()",
        })
    return out


def validate(path):
    print("=== Validate user_shops export ===")
    if not os.path.exists(path):
        print("  ❌ 文件不存在: {}".format(path))
        return False
    try:
        items = load_export(path)
    except Exception as e:
        print("  ❌ 解析失败: {}".format(e))
        return False
    if not items:
        print("  ⚠️ 空数组（无店铺可同步）")
        return True
    bad = [i for i in items if not (i.get("shop_name") or i.get("name"))]
    print("  ✅ 有效记录: {} 条{}".format(
        len(items) - len(bad),
        "（{} 条缺 shop_name 将被跳过）".format(len(bad)) if bad else ""))
    return True


def main():
    ap = argparse.ArgumentParser(description="Sync user-monitored shops to Supabase")
    ap.add_argument("--file", default=os.path.join(DATA_DIR, "user_shops.json"))
    ap.add_argument("--device", default="backend-default", help="device_id（CLI 批量导入时必填以区分来源）")
    ap.add_argument("--validate", action="store_true", help="仅离线校验导出文件结构")
    args = ap.parse_args()

    if args.validate:
        sys.exit(0 if validate(args.file) else 1)

    items = load_export(args.file)
    rows = to_rows(items, args.device)
    if not rows:
        print("没有可同步的店铺（全部缺少 shop_name）")
        sys.exit(0)

    url, key = get_supabase()
    status, body = upsert(url, key, rows)
    if status in (200, 201, 204):
        print("✅ 已同步 {} 家店铺到 monitored_shops".format(len(rows)))
    else:
        print("❌ 同步失败 HTTP {}: {}".format(status, body[:500]))
        sys.exit(1)


if __name__ == "__main__":
    main()
