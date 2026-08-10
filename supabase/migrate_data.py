#!/usr/bin/env python3
"""
Mercator Phase 2: 将JSON数据迁移到Supabase PostgreSQL
使用 service_role key 绕过 RLS 插入公开市场数据

依赖：仅 Python 标准库（urllib），无需 pip install 第三方包。
配置（务必使用环境变量，切勿将 service_role key 提交进代码仓库）：
  export SUPABASE_URL="https://xxxx.supabase.co"
  export SUPABASE_SERVICE_ROLE_KEY="eyJhbGci..."
"""
import json
import os
import sys
import urllib.request
import urllib.error

# ---- 从环境变量读取配置（不再硬编码凭证，修复 P1-4） ----
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "") or os.environ.get("SUPABASE_SERVICE_KEY", "")

API_URL = f"{SUPABASE_URL}/rest/v1" if SUPABASE_URL else ""
HEADERS = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}
DATA_DIR = "data"


def _request(method, path, json_body=None, prefer=None):
    """统一的 Supabase REST 请求（标准库 urllib，无第三方依赖）。"""
    url = f"{API_URL}/{path}"
    data = json.dumps(json_body).encode("utf-8") if json_body is not None else None
    hdrs = dict(HEADERS)
    if prefer:
        hdrs["Prefer"] = prefer
    req = urllib.request.Request(url, data=data, method=method, headers=hdrs)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status, resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")
    except Exception as e:  # noqa: BLE001 - 网络异常统一降级为失败返回
        return None, str(e)


def migrate_countries():
    """迁移 countries.json → market_data (key='countries')"""
    with open(f"{DATA_DIR}/countries.json", "r", encoding="utf-8") as f:
        data = json.load(f)

    payload = {
        "key": "countries",
        "data": data,
        "meta": {
            "source": "countries.json",
            "country_count": len(data),
            "country_codes": list(data.keys()),
        },
    }

    status, body = _request(
        "POST", "market_data", payload,
        prefer="return=minimal,resolution=merge-duplicates",
    )
    if status in (200, 201):
        print(f"✅ countries.json → market_data: {len(data)} countries migrated")
        return True
    print(f"❌ countries migration failed: {status} {body}")
    return False


def migrate_platforms():
    """迁移 platforms.json → market_data (key='platforms')"""
    with open(f"{DATA_DIR}/platforms.json", "r", encoding="utf-8") as f:
        data = json.load(f)

    regions = set()
    for p in data:
        if p.get("region"):
            regions.add(p["region"])

    payload = {
        "key": "platforms",
        "data": data,
        "meta": {
            "source": "platforms.json",
            "platform_count": len(data),
            "regions": sorted(regions),
        },
    }

    status, body = _request(
        "POST", "market_data", payload,
        prefer="return=minimal,resolution=merge-duplicates",
    )
    if status in (200, 201):
        print(f"✅ platforms.json → market_data: {len(data)} platforms migrated")
        return True
    print(f"❌ platforms migration failed: {status} {body}")
    return False


def migrate_policies():
    """迁移 policies.json → market_data (key='policies')"""
    with open(f"{DATA_DIR}/policies.json", "r", encoding="utf-8") as f:
        data = json.load(f)

    items = data.get("items", [])
    payload = {
        "key": "policies",
        "data": data,
        "meta": {
            "source": "policies.json",
            "updated_at": data.get("updated_at"),
            "source_count": data.get("source_count"),
            "item_count": len(items),
        },
    }

    status, body = _request(
        "POST", "market_data", payload,
        prefer="return=minimal,resolution=merge-duplicates",
    )
    if status in (200, 201):
        print(f"✅ policies.json → market_data: {len(items)} policies migrated")
        return True
    print(f"❌ policies migration failed: {status} {body}")
    return False


def migrate_rules():
    """迁移 rules.json → market_data (key='rules')"""
    with open(f"{DATA_DIR}/rules.json", "r", encoding="utf-8") as f:
        data = json.load(f)

    items = data.get("items", [])
    payload = {
        "key": "rules",
        "data": data,
        "meta": {
            "source": "rules.json",
            "updated_at": data.get("updated_at"),
            "source_count": data.get("source_count"),
            "item_count": len(items),
        },
    }

    status, body = _request(
        "POST", "market_data", payload,
        prefer="return=minimal,resolution=merge-duplicates",
    )
    if status in (200, 201):
        print(f"✅ rules.json → market_data: {len(items)} rules migrated")
        return True
    print(f"❌ rules migration failed: {status} {body}")
    return False


def migrate_alerts():
    """迁移 alerts.json → market_data (key='alerts')"""
    with open(f"{DATA_DIR}/alerts.json", "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        print("❌ alerts.json 顶层应为数组，迁移中止")
        return False
    payload = {
        "key": "alerts",
        "data": data,
        "meta": {
            "source": "alerts.json",
            "alert_count": len(data),
        },
    }
    status, body = _request(
        "POST", "market_data", payload,
        prefer="return=minimal,resolution=merge-duplicates",
    )
    if status in (200, 201):
        print(f"✅ alerts.json → market_data: {len(data)} alerts migrated")
        return True
    print(f"❌ alerts migration failed: {status} {body}")
    return False


def verify_migration():
    """验证数据是否成功写入"""
    print("\n🔍 Verifying migration...")
    for key in ["countries", "platforms", "policies", "rules", "alerts"]:
        status, body = _request("GET", f"market_data?key=eq.{key}&select=key,meta")
        if status == 200:
            rows = json.loads(body) if body else []
            if rows:
                meta = rows[0].get("meta", {})
                print(f"  ✅ {key}: {meta}")
            else:
                print(f"  ⚠️ {key}: not found")
        else:
            print(f"  ❌ {key}: query failed ({status})")


def main():
    if not SUPABASE_URL or not SERVICE_ROLE_KEY:
        print("❌ 请先通过环境变量配置凭证后再运行：")
        print("   export SUPABASE_URL='https://你的项目.supabase.co'")
        print("   export SUPABASE_SERVICE_ROLE_KEY='eyJ...'")
        print("   注意：service_role key 拥有完全权限，切勿提交到代码仓库。")
        sys.exit(1)

    print("🚀 Mercator Phase 2: Data Migration")
    print(f"   Target: {SUPABASE_URL}")
    print()

    success = True
    success &= migrate_countries()
    success &= migrate_platforms()
    success &= migrate_policies()
    success &= migrate_rules()
    success &= migrate_alerts()

    if success:
        verify_migration()
        print("\n🎉 Migration complete!")
    else:
        print("\n⚠️ Some migrations failed. Check errors above.")
        sys.exit(1)


if __name__ == "__main__":
    main()
