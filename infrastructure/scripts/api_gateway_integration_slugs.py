#!/usr/bin/env python3
from __future__ import annotations

import re
from collections import Counter
from pathlib import Path
from typing import NamedTuple

ROOT = Path(__file__).resolve().parents[1]
MAIN_TF = ROOT / "modules/api-gateway/main.tf"

AWS_HTTP_API_INTEGRATION_LIMIT = 300
AWS_HTTP_API_ROUTE_LIMIT = 300
ROUTE_WARNING_THRESHOLD = 280
INTEGRATION_WARNING_THRESHOLD = 50
HTTP_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}
NESTED_BLOCK = re.compile(
    r"^\s{4}(\w+)\s*=\s*\{(.*?)(?=^\s{4}\w+\s*=\s*\{|\Z)",
    re.S | re.M,
)


class RouteDefinition(NamedTuple):
    route_key: str
    slug: str
    function_arn: str


class ValidationIssue(NamedTuple):
    level: str
    message: str


def slug_for_function_arn(function_arn: str) -> str:
    return function_arn.removeprefix("var.").removesuffix("_function_arn")


def _hcl_block(start_marker: str, end_marker: str) -> str:
    text = MAIN_TF.read_text()
    start = text.index(start_marker)
    end = text.index(end_marker, start)
    return text[start:end]


def lambda_function_slugs() -> dict[str, str]:
    block = _hcl_block("  lambda_functions = {", "  lambda_invoke_arns = {")
    pattern = re.compile(r"^\s{4}(\w+)\s*=\s*var\.(\w+)", re.M)
    return {
        slug: f"var.{function_arn_var}"
        for slug, function_arn_var in pattern.findall(block)
    }


def _parse_route_map(block: str) -> dict[str, RouteDefinition]:
    definitions: dict[str, RouteDefinition] = {}
    for match in NESTED_BLOCK.finditer(block):
        resource_key, body = match.group(1), match.group(2)
        route_key_match = re.search(r'route_key\s*=\s*"([^"]+)"', body)
        function_arn_match = re.search(r"function_arn\s*=\s*(\S+)", body)
        if not route_key_match or not function_arn_match:
            continue
        function_arn = function_arn_match.group(1)
        definitions[resource_key] = RouteDefinition(
            route_key=route_key_match.group(1),
            slug=slug_for_function_arn(function_arn),
            function_arn=function_arn,
        )
    return definitions


def explicit_route_definitions() -> dict[str, RouteDefinition]:
    return _parse_route_map(_hcl_block("  explicit_routes = {", "  routes = merge("))


def http_proxy_route_definitions() -> dict[str, RouteDefinition]:
    block = _hcl_block("  http_proxy_groups = {", "  http_proxy_routes = {")
    definitions: dict[str, RouteDefinition] = {}
    for match in NESTED_BLOCK.finditer(block):
        group_key, body = match.group(1), match.group(2)
        path_match = re.search(r'path\s*=\s*"([^"]+)"', body)
        methods_match = re.search(r"methods\s*=\s*\[(.*?)\]", body, re.S)
        function_arn_match = re.search(r"function_arn\s*=\s*(\S+)", body)
        if not path_match or not methods_match or not function_arn_match:
            continue
        methods = re.findall(r'"([A-Z]+)"', methods_match.group(1))
        function_arn = function_arn_match.group(1)
        slug = slug_for_function_arn(function_arn)
        for method in methods:
            resource_key = f"{group_key}_proxy_{method.lower()}"
            definitions[resource_key] = RouteDefinition(
                route_key=f"{method} {path_match.group(1)}",
                slug=slug,
                function_arn=function_arn,
            )
    return definitions


def route_definitions() -> dict[str, RouteDefinition]:
    return {**explicit_route_definitions(), **http_proxy_route_definitions()}


def route_slug_map() -> dict[str, str]:
    return {key: definition.slug for key, definition in route_definitions().items()}


def canonical_slug_keys() -> dict[str, str]:
    route_map = route_slug_map()
    canonical: dict[str, str] = {}
    for route_key, slug in sorted(route_map.items()):
        if slug not in canonical:
            canonical[slug] = route_key
    return canonical


def _path_segments(path: str) -> list[str]:
    return [segment for segment in path.strip("/").split("/") if segment]


def proxy_covers(proxy_route_key: str, other_route_key: str) -> bool:
    proxy_method, proxy_path = proxy_route_key.split(" ", 1)
    other_method, other_path = other_route_key.split(" ", 1)
    if proxy_method != other_method or "{proxy+}" not in proxy_path:
        return False
    proxy_segments = _path_segments(proxy_path)
    other_segments = _path_segments(other_path)
    other_index = 0
    for segment in proxy_segments:
        if segment == "{proxy+}":
            return other_index < len(other_segments)
        if other_index >= len(other_segments):
            return False
        if segment.startswith("{") and segment.endswith("}"):
            other_index += 1
            continue
        if segment != other_segments[other_index]:
            return False
        other_index += 1
    return False


def validate_consolidation() -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    routes = route_definitions()
    lambdas = lambda_function_slugs()
    route_keys = set(routes)
    lambda_arns = set(lambdas.values())
    proxy_routes = http_proxy_route_definitions()

    if not routes:
        issues.append(ValidationIssue("error", "No API Gateway routes were parsed from main.tf"))
        return issues

    if not proxy_routes:
        issues.append(ValidationIssue("error", "No http_proxy_groups were parsed from main.tf"))

    for route_key, definition in sorted(routes.items()):
        method = definition.route_key.split(" ", 1)[0]
        if method == "ANY":
            issues.append(
                ValidationIssue(
                    "error",
                    f"Route {route_key} uses ANY, which intercepts OPTIONS and breaks CORS with JWT. "
                    "Add GET/POST/PUT/PATCH/DELETE {proxy+} in http_proxy_groups instead.",
                )
            )
        if definition.function_arn not in lambda_arns:
            issues.append(
                ValidationIssue(
                    "error",
                    f"Route {route_key} references unknown function_arn {definition.function_arn}",
                )
            )
            continue
        expected_slug = next(
            slug for slug, function_arn in lambdas.items() if function_arn == definition.function_arn
        )
        if definition.slug != expected_slug:
            issues.append(
                ValidationIssue(
                    "error",
                    f"Route {route_key} slug mismatch: parsed {definition.slug}, expected {expected_slug}",
                )
            )

    for key, body in (
        (match.group(1), match.group(2))
        for match in NESTED_BLOCK.finditer(_hcl_block("  explicit_routes = {", "  routes = merge("))
    ):
        slug_match = re.search(r'slug\s*=\s*"([^"]+)"', body)
        function_arn_match = re.search(r"function_arn\s*=\s*(\S+)", body)
        if not function_arn_match:
            continue
        expected_slug = slug_for_function_arn(function_arn_match.group(1))
        if not slug_match:
            issues.append(ValidationIssue("error", f"Route {key} is missing a static slug"))
        elif slug_match.group(1) != expected_slug:
            issues.append(
                ValidationIssue(
                    "error",
                    f"Route {key} slug {slug_match.group(1)} does not match {expected_slug}",
                )
            )

    for key, body in (
        (match.group(1), match.group(2))
        for match in NESTED_BLOCK.finditer(_hcl_block("  http_proxy_groups = {", "  http_proxy_routes = {"))
    ):
        slug_match = re.search(r'slug\s*=\s*"([^"]+)"', body)
        function_arn_match = re.search(r"function_arn\s*=\s*(\S+)", body)
        if not function_arn_match:
            continue
        expected_slug = slug_for_function_arn(function_arn_match.group(1))
        if not slug_match:
            issues.append(ValidationIssue("error", f"http_proxy_groups entry {key} is missing a static slug"))
        elif slug_match.group(1) != expected_slug:
            issues.append(
                ValidationIssue(
                    "error",
                    f"http_proxy_groups entry {key} slug {slug_match.group(1)} does not match {expected_slug}",
                )
            )

    for key, definition in sorted(proxy_routes.items()):
        method, path = definition.route_key.split(" ", 1)
        if "{proxy+}" not in path:
            issues.append(
                ValidationIssue(
                    "error",
                    f"http_proxy_groups entry {key} path must include {{proxy+}}: {path}",
                )
            )
        if method not in HTTP_METHODS or method in {"ANY", "OPTIONS"}:
            issues.append(
                ValidationIssue(
                    "error",
                    f"http_proxy_groups entry {key} has invalid method {method}",
                )
            )

    for key, definition in sorted(explicit_route_definitions().items()):
        for proxy_key, proxy in proxy_routes.items():
            if definition.function_arn != proxy.function_arn:
                continue
            if not proxy_covers(proxy.route_key, definition.route_key):
                continue
            issues.append(
                ValidationIssue(
                    "error",
                    f"Route {key} ({definition.route_key}) is already covered by {proxy_key} "
                    f"({proxy.route_key}). Handle it in the Lambda with rawPath; do not add a new API Gateway route.",
                )
            )

    canonical = canonical_slug_keys()
    if len(canonical) != len(lambdas):
        missing = sorted(set(lambdas) - set(canonical))
        unused = sorted(set(canonical) - set(lambdas))
        if missing:
            issues.append(
                ValidationIssue(
                    "error",
                    f"Lambda slugs without routes: {', '.join(missing)}",
                )
            )
        if unused:
            issues.append(
                ValidationIssue(
                    "error",
                    f"Route slugs without lambda_functions entry: {', '.join(unused)}",
                )
            )

    duplicate_route_keys = [
        route_key
        for route_key, count in Counter(definition.route_key for definition in routes.values()).items()
        if count > 1
    ]
    if duplicate_route_keys:
        issues.append(
            ValidationIssue(
                "error",
                f"Duplicate route_key values: {', '.join(sorted(duplicate_route_keys))}",
            )
        )

    if len(route_keys) != len(routes):
        issues.append(ValidationIssue("error", "Duplicate route resource keys detected in main.tf"))

    if len(routes) >= AWS_HTTP_API_ROUTE_LIMIT:
        issues.append(
            ValidationIssue(
                "error",
                f"Route count {len(routes)} reaches AWS HTTP API limit ({AWS_HTTP_API_ROUTE_LIMIT})",
            )
        )
    elif len(routes) >= ROUTE_WARNING_THRESHOLD:
        issues.append(
            ValidationIssue(
                "warning",
                f"Route count {len(routes)} is near AWS HTTP API limit ({AWS_HTTP_API_ROUTE_LIMIT})",
            )
        )

    integration_count = len(canonical)
    if integration_count >= AWS_HTTP_API_INTEGRATION_LIMIT:
        issues.append(
            ValidationIssue(
                "error",
                f"Integration count {integration_count} reaches AWS HTTP API limit ({AWS_HTTP_API_INTEGRATION_LIMIT})",
            )
        )
    elif integration_count >= INTEGRATION_WARNING_THRESHOLD:
        issues.append(
            ValidationIssue(
                "warning",
                f"Integration count {integration_count} is higher than expected for consolidated model",
            )
        )

    return issues


def consolidation_summary() -> dict[str, int | dict[str, int]]:
    routes = route_definitions()
    canonical = canonical_slug_keys()
    routes_per_slug = Counter(route_slug_map().values())
    return {
        "route_count": len(routes),
        "integration_count": len(canonical),
        "lambda_count": len(lambda_function_slugs()),
        "proxy_route_count": len(http_proxy_route_definitions()),
        "routes_per_slug_max": max(routes_per_slug.values()) if routes_per_slug else 0,
        "routes_per_slug": dict(sorted(routes_per_slug.items())),
    }
