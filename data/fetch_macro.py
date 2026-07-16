import json
import subprocess
import os
import time

os.chdir('/app/data/所有对话/主对话/.skills/skill_openecon-data')

countries = [
    ("gb", "UK", "United Kingdom"),
    ("de", "Germany", "Germany"),
    ("fr", "France", "France"),
    ("it", "Italy", "Italy"),
    ("es", "Spain", "Spain"),
    ("nl", "Netherlands", "Netherlands"),
    ("pl", "Poland", "Poland"),
    ("se", "Sweden", "Sweden"),
    ("au", "Australia", "Australia"),
    ("ca", "Canada", "Canada"),
    ("be", "Belgium", "Belgium"),
    ("ae", "UAE", "United Arab Emirates"),
    ("eg", "Egypt", "Egypt"),
    ("tr", "Turkey", "Turkey"),
    ("il", "Israel", "Israel"),
    ("ph", "Philippines", "Philippines"),
    ("sg", "Singapore", "Singapore"),
    ("mx", "Mexico", "Mexico"),
    ("ar", "Argentina", "Argentina"),
    ("co", "Colombia", "Colombia"),
    ("cl", "Chile", "Chile"),
    ("ng", "Nigeria", "Nigeria"),
    ("za", "South Africa", "South Africa"),
    ("ke", "Kenya", "Kenya"),
    ("ma", "Morocco", "Morocco"),
    ("kr", "South Korea", "South Korea"),
    ("ru", "Russia", "Russia"),
    ("ua", "Ukraine", "Ukraine"),
    ("kz", "Kazakhstan", "Kazakhstan"),
    ("in", "India", "India"),
    ("pk", "Pakistan", "Pakistan"),
]

indicators = [
    ("population", "population total 2024"),
    ("gdppc", "GDP per capita USD 2024"),
    ("pop_growth", "population growth rate 2024"),
    ("urbanization", "urban population percentage 2024"),
    ("internet", "internet users percentage of population 2024"),
    ("age_0_14", "population ages 0-14 percentage 2024"),
    ("age_15_64", "population ages 15-64 percentage 2024"),
    ("age_65_plus", "population ages 65+ percentage 2024"),
]

results = {}
for code, name, full_name in countries:
    results[code] = {"name": name, "full_name": full_name}
    for ind_key, ind_query in indicators:
        query = f"{full_name} {ind_query}"
        try:
            p = subprocess.run(
                ["python3", "scripts/_cli_wrapper.py", "call", "query",
                 "--param", f"query={query}"],
                capture_output=True, text=True, timeout=180
            )
            data = json.loads(p.stdout)
            value = None
            source_url = None
            if "data" in data and data["data"] and len(data["data"]) > 0:
                ds = data["data"][0]
                if "data" in ds and ds["data"] and len(ds["data"]) > 0:
                    value = ds["data"][0].get("value")
                if "metadata" in ds:
                    source_url = ds["metadata"].get("sourceUrl")
            results[code][ind_key] = {"value": value, "source_url": source_url}
            print(f"  {code} {ind_key}: {value}")
        except Exception as e:
            results[code][ind_key] = {"value": None, "error": str(e)}
            print(f"  {code} {ind_key}: ERROR {e}")
        time.sleep(1)
    print(f"Done {name}")

with open("/app/data/所有对话/主对话/mercator_rework/data/macro_raw.json", "w") as f:
    json.dump(results, f, indent=2, ensure_ascii=False)
print("Saved macro_raw.json")
