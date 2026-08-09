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


class RouteDefinition(NamedTuple):
    route_key: str
    slug: str
    function_arn: str


class ValidationIssue(NamedTuple):
    level: str
    message: str


def slug_for_function_arn(function_arn: str) -> str:
    return function_arn.removeprefix("var.").removesuffix("_function_arn")


def lambda_function_slugs() -> dict[str, str]:
    text = MAIN_TF.read_text()
    start = text.index("  lambda_functions = {")
    end = text.index("  routes = {", start)
    block = text[start:end]
    pattern = re.compile(r"^\s{4}(\w+)\s*=\s*var\.(\w+)", re.M)
    return {
        slug: f"var.{function_arn_var}"
        for slug, function_arn_var in pattern.findall(block)
    }


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
        function_arn = function_arn_match.group(1)
        definitions[resource_key] = RouteDefinition(
            route_key=route_key_match.group(1),
            slug=slug_for_function_arn(function_arn),
            function_arn=function_arn,
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


def validate_consolidation() -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    routes = route_definitions()
    lambdas = lambda_function_slugs()
    route_keys = set(routes)
    lambda_arns = set(lambdas.values())
    route_slugs = route_slug_map()

    if not routes:
        issues.append(ValidationIssue("error", "No API Gateway routes were parsed from main.tf"))
        return issues

    for route_key, definition in sorted(routes.items()):
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
        "routes_per_slug_max": max(routes_per_slug.values()) if routes_per_slug else 0,
        "routes_per_slug": dict(sorted(routes_per_slug.items())),
    }
