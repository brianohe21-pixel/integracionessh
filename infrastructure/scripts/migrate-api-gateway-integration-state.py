#!/usr/bin/env python3
from __future__ import annotations

import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from api_gateway_integration_slugs import route_slug_map

ADDRESS_PATTERN = re.compile(r'aws_apigatewayv2_integration\.integrations\["([^"]+)"\]')


def run(command: list[str]) -> str:
    return subprocess.check_output(command, text=True)


def state_addresses() -> list[str]:
    output = run(["terraform", "state", "list"])
    return [
        line.strip()
        for line in output.splitlines()
        if line.startswith("module.api_gateway.aws_apigatewayv2_integration.integrations[")
    ]


def integration_uri(address: str) -> str:
    output = run(["terraform", "state", "show", "-no-color", address])
    for line in output.splitlines():
        if "integration_uri" in line:
            return line.split("=", 1)[1].strip()
    return ""


def address_key(address: str) -> str:
    match = ADDRESS_PATTERN.search(address)
    return match.group(1) if match else ""


def main() -> None:
    slug_for_route = route_slug_map()
    addresses = state_addresses()
    if not addresses:
        print("No API Gateway integrations in state; migration skipped.")
        return

    grouped: dict[str, list[str]] = defaultdict(list)
    uri_for_address: dict[str, str] = {}
    key_for_address: dict[str, str] = {}

    for address in addresses:
        key = address_key(address)
        uri = integration_uri(address)
        if not key or not uri:
            print(f"Skipping unreadable state address: {address}")
            continue
        grouped[uri].append(address)
        uri_for_address[address] = uri
        key_for_address[address] = key

    moved = 0
    removed = 0

    for uri, group in grouped.items():
        slugs = {slug_for_route.get(key_for_address[address], "") for address in group}
        slugs.discard("")
        if len(slugs) != 1:
            print(f"Skipping ambiguous URI group ({len(slugs)} slugs): {uri}")
            continue
        slug = next(iter(slugs))

        canonical_address = None
        for address in sorted(group, key=lambda item: key_for_address[item]):
            if key_for_address[address] == slug:
                canonical_address = address
                break
        if canonical_address is None:
            canonical_address = sorted(group, key=lambda item: key_for_address[item])[0]

        canonical_key = key_for_address[canonical_address]
        target_address = f'module.api_gateway.aws_apigatewayv2_integration.integrations["{slug}"]'

        if canonical_key != slug:
            print(f"Moving integrations[\"{canonical_key}\"] -> integrations[\"{slug}\"]")
            subprocess.run(
                ["terraform", "state", "mv", canonical_address, target_address],
                check=True,
            )
            moved += 1

        for address in group:
            key = key_for_address[address]
            if key == slug:
                continue
            if canonical_key != slug and address == canonical_address:
                continue
            print(f"Removing duplicate integration from state: integrations[\"{key}\"]")
            subprocess.run(["terraform", "state", "rm", address], check=True)
            removed += 1

    print(f"API Gateway integration state migration complete ({moved} moved, {removed} removed).")


if __name__ == "__main__":
    main()
