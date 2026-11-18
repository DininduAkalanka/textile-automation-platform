"""
Phase 4: Confirmed Findings Verification (Pytest XFAIL Strict)

Automates RED tests for confirmed AI defects:
- QA-006: Insecure AI auth defaults, timing-vulnerable string compare, and missing production boot guards.
"""

import hmac
import pytest
from unittest.mock import patch
from fastapi import HTTPException
from app.config import Settings
from app.main import require_internal_key


@pytest.mark.xfail(
    strict=True,
    reason="QA-006: require_internal_key uses != (not constant-time hmac.compare_digest)",
)
def test_internal_key_comparison_must_use_constant_time():
    """
    Security invariant: Key comparison MUST be timing-safe (secrets.compare_digest or hmac.compare_digest).
    Unpatched code uses Python's standard `!=` operator, which short-circuits on byte mismatches.
    """
    settings = Settings(internal_api_key="very-secret-internal-key")
    
    with patch("hmac.compare_digest", wraps=hmac.compare_digest) as spy_compare:
        require_internal_key(x_internal_key="very-secret-internal-key", settings=settings)
        # Expectation: hmac.compare_digest was called to protect against timing attacks
        assert spy_compare.called, "Key comparison did not invoke hmac.compare_digest"


@pytest.mark.xfail(
    strict=True,
    reason="QA-006: config.py does not enforce production secret guard (boots with dev default)",
)
def test_production_guard_rejects_default_internal_key():
    """
    Security invariant: In production environment, the service must fail fast if default dev key is present.
    Unpatched Settings permits booting with 'local-dev-internal-key' in production.
    """
    with pytest.raises(ValueError, match="Default development internal_api_key is prohibited in production"):
        # When environment is production, Settings should validate and reject the default key.
        # Unpatched code allows this instantiation silently, failing pytest.raises.
        Settings(environment="production", internal_api_key="local-dev-internal-key")
