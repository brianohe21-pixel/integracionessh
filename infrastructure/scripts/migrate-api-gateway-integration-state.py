#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

from api_gateway_integration_slugs import canonical_slug_keys, route_definitions, route_slug_map

ADDRESS_PATTERN = re.compile(r'aws_apigatewayv2_integration\.integrations\["([^"]+)"\]')
INTEGRATION_ADDRESS_PREFIX = "module.api_gateway.aws_apigatewayv2_integration.integrations"
ROUTE_ADDRESS_PREFIX = "module.api_gateway.aws_apigatewayv2_route.routes"


def run(command: list[str]) -> str:
    return subprocess.check_output(command, text=True)


def state_resources() -> dict[str, dict[str, Any]]:
    state = json.loads(run(["terraform", "show", "-json"]))
    resources: dict[str, dict[str, Any]] = {}

    def collect(module: dict[str, Any]) -> None:
        for resource in module.get("resources", []):
            resources[resource["address"]] = resource.get("values", {})
        for child in module.get("child_modules", []):
            collect(child)

    root_module = state.get("values", {}).get("root_module")
    if root_module:
        collect(root_module)
    return resources


def address_key(address: str) -> str:
    match = ADDRESS_PATTERN.search(address)
    return match.group(1) if match else ""


def aws_json(arguments: list[str]) -> dict[str, Any]:
    region = os.environ.get("AWS_REGION", os.environ.get("AWS_DEFAULT_REGION", "us-east-1"))
    return json.loads(run(["aws", *arguments, "--region", region, "--output", "json", "--no-cli-pager"]))


def api_id(resources: dict[str, dict[str, Any]]) -> str:
    values = resources.get("module.api_gateway.aws_apigatewayv2_api.main", {})
    value = str(values.get("id", "")).strip()
    if value:
        return value
    project = os.environ.get("PROJECT", "chatbot-platform")
    environment = os.environ.get("ENVIRONMENT", "dev")
    response = aws_json(["apigatewayv2", "get-apis"])
    for api in response.get("Items", []):
        if api.get("Name") == f"{project}-{environment}":
            return str(api["ApiId"])
    raise RuntimeError(f"API Gateway API not found for {project}-{environment}")


def integration_state(
    resources: dict[str, dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    return {
        address: values
        for address, values in resources.items()
        if address.startswith(f"{INTEGRATION_ADDRESS_PREFIX}[")
    }


def canonical_integration_address(slug: str) -> str:
    return f'{INTEGRATION_ADDRESS_PREFIX}["{slug}"]'


def canonical_route_address(key: str) -> str:
    return f'{ROUTE_ADDRESS_PREFIX}["{key}"]'


def move_existing_integrations(resources: dict[str, dict[str, Any]]) -> tuple[int, int]:
    slug_for_route = route_slug_map()
    slugs = set(canonical_slug_keys())
    grouped: dict[str, list[str]] = defaultdict(list)
    integrations = integration_state(resources)

    for address, values in integrations.items():
        uri = str(values.get("integration_uri", "")).strip()
        if uri:
            grouped[uri].append(address)

    moved = 0
    removed = 0
    for uri, group in grouped.items():
        candidates = {
            key if key in slugs else slug_for_route.get(key, "")
            for key in (address_key(address) for address in group)
        }
        candidates.discard("")
        if len(candidates) != 1:
            print(f"Skipping ambiguous integration state group ({len(candidates)} slugs): {uri}")
            continue

        slug = next(iter(candidates))
        target = canonical_integration_address(slug)
        canonical = target if target in group else sorted(group)[0]

        if canonical != target:
            print(f"Moving {canonical} -> {target}")
            subprocess.run(["terraform", "state", "mv", canonical, target], check=True)
            moved += 1

        for address in group:
            if address == canonical or address == target:
                continue
            print(f"Removing duplicate integration state: {address}")
            subprocess.run(["terraform", "state", "rm", address], check=True)
            removed += 1

    return moved, removed


def reconcile_integrations(
    resources: dict[str, dict[str, Any]],
    gateway_id: str,
    live_routes: list[dict[str, Any]],
    live_integrations: list[dict[str, Any]],
) -> int:
    definitions = route_definitions()
    desired_slug_by_route = {
        definition.route_key: definition.slug for definition in definitions.values()
    }
    integrations = integration_state(resources)
    state_address_by_id = {
        str(values.get("id")): address
        for address, values in integrations.items()
        if values.get("id")
    }
    route_targets: dict[str, list[str]] = defaultdict(list)
    for route in live_routes:
        route_key = str(route.get("RouteKey", ""))
        target = str(route.get("Target", ""))
        slug = desired_slug_by_route.get(route_key)
        if slug and target.startswith("integrations/"):
            route_targets[slug].append(target.removeprefix("integrations/"))

    imported = 0
    for slug in sorted(canonical_slug_keys()):
        target_address = canonical_integration_address(slug)
        if target_address in integrations:
            continue
        candidates = route_targets.get(slug, [])
        if not candidates:
            function_suffix = (
                f":function:{os.environ.get('PROJECT', 'chatbot-platform')}-"
                f"{os.environ.get('ENVIRONMENT', 'dev')}-{slug.replace('_', '-')}/invocations"
            )
            candidates = [
                str(integration["IntegrationId"])
                for integration in live_integrations
                if function_suffix in str(integration.get("IntegrationUri", ""))
            ]
        if not candidates:
            raise RuntimeError(f"No live integration is available for {slug}")
        integration_id = Counter(candidates).most_common(1)[0][0]
        existing_address = state_address_by_id.get(integration_id)
        if existing_address:
            print(f"Moving {existing_address} -> {target_address}")
            subprocess.run(
                ["terraform", "state", "mv", existing_address, target_address],
                check=True,
            )
        else:
            print(f"Importing integration {integration_id} -> {target_address}")
            subprocess.run(
                [
                    "terraform",
                    "import",
                    "-input=false",
                    target_address,
                    f"{gateway_id}/{integration_id}",
                ],
                check=True,
            )
        imported += 1

    return imported


def remove_noncanonical_integration_state(
    resources: dict[str, dict[str, Any]],
) -> int:
    canonical_addresses = {
        canonical_integration_address(slug) for slug in canonical_slug_keys()
    }
    removed = 0
    for address in sorted(integration_state(resources)):
        if address in canonical_addresses:
            continue
        print(f"Removing obsolete integration state: {address}")
        subprocess.run(["terraform", "state", "rm", address], check=True)
        removed += 1
    return removed


def reconcile_routes(
    resources: dict[str, dict[str, Any]],
    gateway_id: str,
    live_routes: list[dict[str, Any]],
) -> int:
    definitions = route_definitions()
    live_by_key = {str(route.get("RouteKey")): route for route in live_routes}
    state_routes = {
        address: values
        for address, values in resources.items()
        if address.startswith(f"{ROUTE_ADDRESS_PREFIX}[")
    }
    state_address_by_id = {
        str(values.get("id")): address
        for address, values in state_routes.items()
        if values.get("id")
    }
    imported = 0

    for key, definition in definitions.items():
        target_address = canonical_route_address(key)
        if target_address in state_routes:
            continue
        live_route = live_by_key.get(definition.route_key)
        if not live_route:
            continue
        route_id = str(live_route["RouteId"])
        existing_address = state_address_by_id.get(route_id)
        if existing_address:
            print(f"Moving {existing_address} -> {target_address}")
            subprocess.run(
                ["terraform", "state", "mv", existing_address, target_address],
                check=True,
            )
        else:
            print(f"Importing route {route_id} -> {target_address}")
            subprocess.run(
                [
                    "terraform",
                    "import",
                    "-input=false",
                    target_address,
                    f"{gateway_id}/{route_id}",
                ],
                check=True,
            )
        imported += 1

    return imported


def main() -> None:
    resources = state_resources()
    gateway_id = api_id(resources)
    live_routes = aws_json(
        ["apigatewayv2", "get-routes", "--api-id", gateway_id]
    ).get("Items", [])
    live_integrations = aws_json(
        ["apigatewayv2", "get-integrations", "--api-id", gateway_id]
    ).get("Items", [])

    moved, removed = move_existing_integrations(resources)
    resources = state_resources()
    integrations_reconciled = reconcile_integrations(
        resources, gateway_id, live_routes, live_integrations
    )
    resources = state_resources()
    removed += remove_noncanonical_integration_state(resources)
    resources = state_resources()
    routes_reconciled = reconcile_routes(resources, gateway_id, live_routes)

    print(
        "API Gateway state migration complete "
        f"({moved} moved, {removed} removed, "
        f"{integrations_reconciled} integrations reconciled, "
        f"{routes_reconciled} routes reconciled)."
    )

if __name__ == "__main__":
    main()
