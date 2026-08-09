#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAIN_TF = ROOT / "modules/api-gateway/main.tf"


def slug_for_function_arn(function_arn: str) -> str:
    return function_arn.removeprefix("var.").removesuffix("_function_arn")


def route_slug_map() -> dict[str, str]:
    text = MAIN_TF.read_text()
    start = text.index("  routes = {")
    end = text.index("  function_integration_keys")
    routes_block = text[start:end]
    pattern = re.compile(r"^\s{4}(\w+)\s*=\s*\{.*?function_arn\s*=\s*(\S+)", re.S | re.M)
    mapping: dict[str, str] = {}
    for match in pattern.finditer(routes_block):
        route_key, function_arn = match.group(1), match.group(2)
        if route_key == "routes":
            continue
        mapping[route_key] = slug_for_function_arn(function_arn)
    return mapping


def canonical_slug_keys() -> dict[str, str]:
    route_map = route_slug_map()
    canonical: dict[str, str] = {}
    for route_key, slug in sorted(route_map.items()):
        if slug not in canonical:
            canonical[slug] = route_key
    return canonical
