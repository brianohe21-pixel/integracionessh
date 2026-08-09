#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path
from typing import NamedTuple

ROOT = Path(__file__).resolve().parents[1]
MAIN_TF = ROOT / "modules/api-gateway/main.tf"


class RouteDefinition(NamedTuple):
    route_key: str
    slug: str


def slug_for_function_arn(function_arn: str) -> str:
    return function_arn.removeprefix("var.").removesuffix("_function_arn")


def route_definitions() -> dict[str, RouteDefinition]:
    text = MAIN_TF.read_text()
    start = text.index("  routes = {")
    end = text.index("  function_integration_keys")
    routes_block = text[start:end]
    pattern = re.compile(
        r"^\s{4}(\w+)\s*=\s*\{(.*?)(?=^\s{4}\w+\s*=\s*\{|\Z)",
        re.S | re.M,
    )
    definitions: dict[str, RouteDefinition] = {}
    for match in pattern.finditer(routes_block):
        resource_key, body = match.group(1), match.group(2)
        route_key_match = re.search(r'route_key\s*=\s*"([^"]+)"', body)
        function_arn_match = re.search(r"function_arn\s*=\s*(\S+)", body)
        if not route_key_match or not function_arn_match:
            continue
        definitions[resource_key] = RouteDefinition(
            route_key=route_key_match.group(1),
            slug=slug_for_function_arn(function_arn_match.group(1)),
        )
    return definitions


def route_slug_map() -> dict[str, str]:
    return {key: definition.slug for key, definition in route_definitions().items()}


def canonical_slug_keys() -> dict[str, str]:
    route_map = route_slug_map()
    canonical: dict[str, str] = {}
    for route_key, slug in sorted(route_map.items()):
        if slug not in canonical:
            canonical[slug] = route_key
    return canonical
