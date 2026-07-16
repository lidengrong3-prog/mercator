#!/usr/bin/env python3
"""
Mercator Phase 2: 将JSON数据迁移到Supabase PostgreSQL
使用 service_role key 绕过 RLS 插入公开市场数据
"""
import json
import sys
import httpx

# ============================================================
# 配置 - 会被 main 脚本替换
# ============================================================
SUPABASE_URL = "PLACEHOLDER_URL"
SERVICE_ROLE_KEY = "PLACEHOLDER_KEY"

API_URL = f"{SUPABASE_URL}/rest/v1"
HEADERS = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

DATA_DIR = "data"


def migrate_countries():
    """迁移 countries.json → market_data (key='countries')"""
    with open(f"{DATA_DIR}/countries.json", "r") as f:
        data = json.load(f)
    
    payload = {
        "key": "countries",
        "data": data,
        "meta": {
            "source": "countries.json",
            "country_count": len(data),
            "country_codes": list(data.keys())
        }
    }
    
    # UPSERT: 如果已存在则更新
    resp = httpx.post(
        f"{API_URL}/market_data",
        headers={**HEADERS, "Prefer": "return=minimal,resolution=merge-duplicates"},
        json=payload
    )
    
    if resp.status_code in (200, 201):
        print(f"✅ countries.json → market_data: {len(data)} countries migrated")
    else:
        print(f"❌ countries migration failed: {resp.status_code} {resp.text}")
        return False
    return True


def migrate_platforms():
    """迁移 platforms.json → market_data (key='platforms')"""
    with open(f"{DATA_DIR}/platforms.json", "r") as f:
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
            "regions": sorted(regions)
        }
    }
    
    resp = httpx.post(
        f"{API_URL}/market_data",
        headers={**HEADERS, "Prefer": "return=minimal,resolution=merge-duplicates"},
        json=payload
    )
    
    if resp.status_code in (200, 201):
        print(f"✅ platforms.json → market_data: {len(data)} platforms migrated")
    else:
        print(f"❌ platforms migration failed: {resp.status_code} {resp.text}")
        return False
    return True


def migrate_policies():
    """迁移 policies.json → market_data (key='policies')"""
    with open(f"{DATA_DIR}/policies.json", "r") as f:
        data = json.load(f)
    
    items = data.get("items", [])
    
    payload = {
        "key": "policies",
        "data": data,
        "meta": {
            "source": "policies.json",
            "updated_at": data.get("updated_at"),
            "source_count": data.get("source_count"),
            "item_count": len(items)
        }
    }
    
    resp = httpx.post(
        f"{API_URL}/market_data",
        headers={**HEADERS, "Prefer": "return=minimal,resolution=merge-duplicates"},
        json=payload
    )
    
    if resp.status_code in (200, 201):
        print(f"✅ policies.json → market_data: {len(items)} policies migrated")
    else:
        print(f"❌ policies migration failed: {resp.status_code} {resp.text}")
        return False
    return True


def migrate_rules():
    """迁移 rules.json → market_data (key='rules')"""
    with open(f"{DATA_DIR}/rules.json", "r") as f:
        data = json.load(f)
    
    items = data.get("items", [])
    
    payload = {
        "key": "rules",
        "data": data,
        "meta": {
            "source": "rules.json",
            "updated_at": data.get("updated_at"),
            "source_count": data.get("source_count"),
            "item_count": len(items)
        }
    }
    
    resp = httpx.post(
        f"{API_URL}/market_data",
        headers={**HEADERS, "Prefer": "return=minimal,resolution=merge-duplicates"},
        json=payload
    )
    
    if resp.status_code in (200, 201):
        print(f"✅ rules.json → market_data: {len(items)} rules migrated")
    else:
        print(f"❌ rules migration failed: {resp.status_code} {resp.text}")
        return False
    return True


def verify_migration():
    """验证数据是否成功写入"""
    print("\n🔍 Verifying migration...")
    
    for key in ["countries", "platforms", "policies", "rules"]:
        resp = httpx.get(
            f"{API_URL}/market_data?key=eq.{key}&select=key,meta",
            headers=HEADERS
        )
        if resp.status_code == 200:
            rows = resp.json()
            if rows:
                meta = rows[0].get("meta", {})
                print(f"  ✅ {key}: {meta}")
            else:
                print(f"  ⚠️ {key}: not found")
        else:
            print(f"  ❌ {key}: query failed ({resp.status_code})")


def main():
    if SUPABASE_URL == "PLACEHOLDER_URL" or SERVICE_ROLE_KEY == "PLACEHOLDER_KEY":
        print("❌ Please configure SUPABASE_URL and SERVICE_ROLE_KEY first!")
        sys.exit(1)
    
    print("🚀 Mercator Phase 2: Data Migration")
    print(f"   Target: {SUPABASE_URL}")
    print()
    
    success = True
    success &= migrate_countries()
    success &= migrate_platforms()
    success &= migrate_policies()
    success &= migrate_rules()
    
    if success:
        verify_migration()
        print("\n🎉 Migration complete!")
    else:
        print("\n⚠️ Some migrations failed. Check errors above.")
        sys.exit(1)


if __name__ == "__main__":
    main()
