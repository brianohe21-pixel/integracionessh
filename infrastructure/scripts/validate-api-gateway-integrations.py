#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from api_gateway_integration_slugs import (
    AWS_HTTP_API_INTEGRATION_LIMIT,
    AWS_HTTP_API_ROUTE_LIMIT,
    consolidation_summary,
    validate_consolidation,
)


def main() -> int:
    summary = consolidation_summary()
    print(
        "API Gateway consolidation summary: "
        f"{summary['route_count']} routes, "
        f"{summary['proxy_route_count']} proxy routes, "
        f"{summary['integration_count']} integrations, "
        f"{summary['lambda_count']} lambdas"
    )
    print(
        f"AWS limits: {AWS_HTTP_API_ROUTE_LIMIT} routes, "
        f"{AWS_HTTP_API_INTEGRATION_LIMIT} integrations"
    )

    issues = validate_consolidation()
    errors = [issue for issue in issues if issue.level == "error"]
    warnings = [issue for issue in issues if issue.level == "warning"]

    for issue in warnings:
        print(f"WARNING: {issue.message}", file=sys.stderr)
    for issue in errors:
        print(f"ERROR: {issue.message}", file=sys.stderr)

    if errors:
        print("API Gateway integration validation failed.", file=sys.stderr)
        return 1

    print("API Gateway integration validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
