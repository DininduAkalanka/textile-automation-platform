"""
Phase 5: Verified Findings & Regression Guard Suite (Pytest GREEN)

Verifies that AI security vulnerabilities (QA-006) are cleanly remediated:
- Timing-safe key comparison using hmac.compare_digest
- Production boot-time guard rejecting weak dev defaults
"""

import hmac
import pytest
from unittest.mock import patch
from fastapi import HTTPException
from app.config import Settings
from app.main import require_internal_key


def test_internal_key_comparison_must_use_constant_time():
    """
    Security invariant: Key comparison MUST be timing-safe (hmac.compare_digest).
    """
    settings = Settings(internal_api_key="very-secret-internal-key")
    
    with patch("hmac.compare_digest", wraps=hmac.compare_digest) as spy_compare:
        require_internal_key(x_internal_key="very-secret-internal-key", settings=settings)
        # Expectation: hmac.compare_digest was called to protect against timing attacks
        assert spy_compare.called, "Key comparison did not invoke hmac.compare_digest"


def test_production_guard_rejects_default_internal_key():
    """
    Security invariant: In production environment, the service must fail fast if default dev key is present.
    """
    with pytest.raises(ValueError, match="Default development internal_api_key is prohibited in production"):
        # When environment is production, Settings must validate and reject the default key.
        Settings(environment="production", internal_api_key="local-dev-internal-key")
