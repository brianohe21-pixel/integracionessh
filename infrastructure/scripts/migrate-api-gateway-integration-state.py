#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

from api_gateway_integration_slugs import (
    canonical_slug_keys,
    consolidation_summary,
    route_definitions,
    route_slug_map,
    validate_consolidation,
)

ADDRESS_PATTERN = re.compile(r'aws_apigatewayv2_integration\.integrations\["([^"]+)"\]')
INTEGRATION_ADDRESS_PREFIX = "module.api_gateway.aws_apigatewayv2_integration.integrations"
ROUTE_ADDRESS_PREFIX = "module.api_gateway.aws_apigatewayv2_route.routes"


class MigrationError(RuntimeError):
    pass


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Migrate API Gateway integration Terraform state")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report planned state changes without mutating Terraform state",
    )
    parser.add_argument(
        "--no-backup",
        action="store_true",
        help="Skip backing up remote Terraform state before migration",
    )
    parser.add_argument(
        "--backup-dir",
        default=".",
        help="Directory where state backups are written",
    )
    return parser.parse_args()


COMMANDS_WITH_VARS = {"apply", "console", "import", "plan", "refresh"}


def terraform_command(*parts: str) -> list[str]:
    if not parts:
        return ["terraform"]
    subcommand, *rest = parts
    command = ["terraform", subcommand]
    if subcommand in COMMANDS_WITH_VARS:
        command.append("-input=false")
        tfvars = Path("terraform.tfvars")
        if tfvars.is_file():
            command.extend(["-var-file", str(tfvars)])
    command.extend(rest)
    return command


def run(command: list[str], *, dry_run: bool = False, check: bool = True) -> str:
    action = " ".join(command)
    if dry_run:
        print(f"[dry-run] {action}")
        return ""
    result = subprocess.run(command, text=True, capture_output=True)
    if check and result.returncode != 0:
        stderr = result.stderr.strip() or result.stdout.strip()
        raise MigrationError(f"Command failed ({result.returncode}): {action}\n{stderr}")
    return result.stdout


def state_resources() -> dict[str, dict[str, Any]]:
    state = json.loads(run(terraform_command("show", "-json")))
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


def aws_json(arguments: list[str], *, dry_run: bool = False) -> dict[str, Any]:
    region = os.environ.get("AWS_REGION", os.environ.get("AWS_DEFAULT_REGION", "us-east-1"))
    output = run(
        ["aws", *arguments, "--region", region, "--output", "json", "--no-cli-pager"],
        dry_run=dry_run,
        check=not dry_run,
    )
    if dry_run:
        return {}
    return json.loads(output)


def api_id(resources: dict[str, dict[str, Any]], *, dry_run: bool = False) -> str:
    values = resources.get("module.api_gateway.aws_apigatewayv2_api.main", {})
    value = str(values.get("id", "")).strip()
    if value:
        return value
    project = os.environ.get("PROJECT", "chatbot-platform")
    environment = os.environ.get("ENVIRONMENT", "dev")
    if dry_run:
        print(f"[dry-run] Resolve API Gateway id for {project}-{environment}")
        return "dry-run-api-id"
    response = aws_json(["apigatewayv2", "get-apis"])
    for api in response.get("Items", []):
        if api.get("Name") == f"{project}-{environment}":
            return str(api["ApiId"])
    raise MigrationError(f"API Gateway API not found for {project}-{environment}")


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


def backup_state(backup_dir: Path, *, dry_run: bool = False) -> Path | None:
    timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    environment = os.environ.get("ENVIRONMENT", "dev")
    backup_dir.mkdir(parents=True, exist_ok=True)
    backup_path = backup_dir / f"terraform-state-backup-{environment}-{timestamp}.json"
    if dry_run:
        print(f"[dry-run] Would write Terraform state backup to {backup_path}")
        return backup_path
    output = run(terraform_command("state", "pull"))
    backup_path.write_text(output)
    print(f"Terraform state backup written to {backup_path}")
    return backup_path


def preflight(resources: dict[str, dict[str, Any]], *, dry_run: bool) -> None:
    issues = [issue for issue in validate_consolidation() if issue.level == "error"]
    if issues:
        raise MigrationError("Preflight validation failed:\n" + "\n".join(issue.message for issue in issues))

    summary = consolidation_summary()
    print(
        "Preflight summary: "
        f"{summary['route_count']} routes, "
        f"{summary['integration_count']} expected integrations"
    )

    integration_addresses = integration_state(resources)
    print(f"Current Terraform integration addresses: {len(integration_addresses)}")
    if dry_run:
        return

    gateway_id = api_id(resources)
    live_integrations = aws_json(
        ["apigatewayv2", "get-integrations", "--api-id", gateway_id]
    ).get("Items", [])
    live_routes = aws_json(["apigatewayv2", "get-routes", "--api-id", gateway_id]).get("Items", [])
    print(f"Live AWS integrations: {len(live_integrations)}")
    print(f"Live AWS routes: {len(live_routes)}")


def move_existing_integrations(
    resources: dict[str, dict[str, Any]],
    *,
    dry_run: bool,
) -> tuple[int, int]:
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
            raise MigrationError(
                f"Ambiguous integration state group ({len(candidates)} slugs) for URI {uri}: "
                f"{sorted(candidates)}"
            )

        slug = next(iter(candidates))
        target = canonical_integration_address(slug)
        canonical = target if target in group else sorted(group)[0]

        if canonical != target:
            print(f"Moving {canonical} -> {target}")
            run(terraform_command("state", "mv", canonical, target), dry_run=dry_run)
            moved += 1

        for address in group:
            if address == canonical or address == target:
                continue
            print(f"Removing duplicate integration state: {address}")
            run(terraform_command("state", "rm", address), dry_run=dry_run)
            removed += 1

    return moved, removed


def reconcile_integrations(
    resources: dict[str, dict[str, Any]],
    gateway_id: str,
    live_routes: list[dict[str, Any]],
    live_integrations: list[dict[str, Any]],
    *,
    dry_run: bool,
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
        if not candidates and not dry_run:
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
            if dry_run:
                print(f"[dry-run] Would reconcile missing integration state for {slug}")
                imported += 1
                continue
            raise MigrationError(f"No live integration is available for {slug}")

        integration_id = Counter(candidates).most_common(1)[0][0]
        existing_address = state_address_by_id.get(integration_id)
        if existing_address:
            print(f"Moving {existing_address} -> {target_address}")
            run(terraform_command("state", "mv", existing_address, target_address), dry_run=dry_run)
        else:
            print(f"Importing integration {integration_id} -> {target_address}")
            run(
                terraform_command(
                    "import",
                    target_address,
                    f"{gateway_id}/{integration_id}",
                ),
                dry_run=dry_run,
            )
        imported += 1

    return imported


def remove_noncanonical_integration_state(
    resources: dict[str, dict[str, Any]],
    *,
    dry_run: bool,
) -> int:
    canonical_addresses = {
        canonical_integration_address(slug) for slug in canonical_slug_keys()
    }
    removed = 0
    for address in sorted(integration_state(resources)):
        if address in canonical_addresses:
            continue
        print(f"Removing obsolete integration state: {address}")
        run(terraform_command("state", "rm", address), dry_run=dry_run)
        removed += 1
    return removed


def reconcile_routes(
    resources: dict[str, dict[str, Any]],
    gateway_id: str,
    live_routes: list[dict[str, Any]],
    *,
    dry_run: bool,
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
            run(terraform_command("state", "mv", existing_address, target_address), dry_run=dry_run)
        else:
            print(f"Importing route {route_id} -> {target_address}")
            run(
                terraform_command(
                    "import",
                    target_address,
                    f"{gateway_id}/{route_id}",
                ),
                dry_run=dry_run,
            )
        imported += 1

    return imported


def postflight(resources: dict[str, dict[str, Any]], *, dry_run: bool) -> None:
    expected = len(canonical_slug_keys())
    actual = len(integration_state(resources))
    if dry_run:
        print(f"[dry-run] Expected canonical integration addresses after migration: {expected}")
        return
    if actual != expected:
        raise MigrationError(
            f"Postflight failed: expected {expected} integration addresses, found {actual}"
        )
    print(f"Postflight passed with {actual} canonical integration addresses")


def main() -> None:
    args = parse_args()
    dry_run = args.dry_run or os.environ.get("DRY_RUN", "").lower() in {"1", "true", "yes"}
    skip_backup = args.no_backup or os.environ.get("SKIP_STATE_BACKUP", "").lower() in {
        "1",
        "true",
        "yes",
    }

    resources = state_resources()
    preflight(resources, dry_run=dry_run)

    if not skip_backup and not dry_run:
        backup_state(Path(args.backup_dir))

    gateway_id = api_id(resources, dry_run=dry_run)
    live_routes = (
        aws_json(["apigatewayv2", "get-routes", "--api-id", gateway_id], dry_run=dry_run).get(
            "Items", []
        )
        if not dry_run
        else []
    )
    live_integrations = (
        aws_json(
            ["apigatewayv2", "get-integrations", "--api-id", gateway_id],
            dry_run=dry_run,
        ).get("Items", [])
        if not dry_run
        else []
    )

    moved, removed = move_existing_integrations(resources, dry_run=dry_run)
    if not dry_run:
        resources = state_resources()
    integrations_reconciled = reconcile_integrations(
        resources,
        gateway_id,
        live_routes,
        live_integrations,
        dry_run=dry_run,
    )
    if not dry_run:
        resources = state_resources()
    removed += remove_noncanonical_integration_state(resources, dry_run=dry_run)
    if not dry_run:
        resources = state_resources()
    routes_reconciled = reconcile_routes(resources, gateway_id, live_routes, dry_run=dry_run)
    if not dry_run:
        resources = state_resources()
        postflight(resources, dry_run=False)

    print(
        "API Gateway state migration complete "
        f"({moved} moved, {removed} removed, "
        f"{integrations_reconciled} integrations reconciled, "
        f"{routes_reconciled} routes reconciled)."
    )


if __name__ == "__main__":
    try:
        main()
    except MigrationError as error:
        print(f"Migration failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error
