from __future__ import annotations

import importlib
import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "formula_data"
OUTPUT_DIR = ROOT / "formula-data"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

MODULES = [
    ("pre_algebra", "pre-algebra"),
    ("algebra_i", "algebra-i"),
    ("algebra_ii", "algebra-ii"),
    ("geometry", "geometry"),
]


def slugify(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def migrate_module(module_name: str, class_id: str) -> dict[str, object]:
    module = importlib.import_module(f"formula_data.{module_name}")
    class_name = module.CLASS_NAME
    categories = []
    formula_count = 0

    for category_name, formulas in module.FORMULAS.items():
        category_id = slugify(category_name)
        normalized_formulas = []

        for formula in formulas:
            formula_id = slugify(f"{class_id}-{category_id}-{formula['name']}")
            normalized_formulas.append(
                {
                    "id": formula_id,
                    "name": formula["name"],
                    "latex": formula["latex"],
                }
            )

        formula_count += len(normalized_formulas)
        categories.append(
            {
                "id": category_id,
                "name": category_name,
                "formulas": normalized_formulas,
            }
        )

    class_payload = {
        "id": class_id,
        "name": class_name,
        "categories": categories,
    }

    manifest_entry = {
        "id": class_id,
        "name": class_name,
        "file": f"{class_id}.json",
        "categoryCount": len(categories),
        "formulaCount": formula_count,
    }

    return {"class_payload": class_payload, "manifest_entry": manifest_entry}


def main() -> None:
    if not SOURCE_DIR.exists():
        raise SystemExit(f"Missing source directory: {SOURCE_DIR}")

    OUTPUT_DIR.mkdir(exist_ok=True)
    manifest = {"classes": []}

    for module_name, class_id in MODULES:
        migrated = migrate_module(module_name, class_id)
        output_file = OUTPUT_DIR / f"{class_id}.json"
        output_file.write_text(
            json.dumps(migrated["class_payload"], indent=2) + "\n",
            encoding="utf-8",
        )
        manifest["classes"].append(migrated["manifest_entry"])

    (OUTPUT_DIR / "index.json").write_text(
        json.dumps(manifest, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
