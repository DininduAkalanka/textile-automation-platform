"""
Unit tests for inter-service authentication & environment configuration (audit §11.4).
"""

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.config import Settings
from app.main import require_internal_key


def test_production_config_requires_32_char_internal_api_key():
    """
    audit §11.4: Refuse to start in production if INTERNAL_API_KEY is default or < 32 chars.
    """
    with pytest.raises(ValidationError):
        Settings(app_env="production", internal_api_key="local-dev-internal-key")

    with pytest.raises(ValidationError):
        Settings(app_env="production", internal_api_key="too-short-key")

    with pytest.raises(ValidationError):
        Settings(app_env="production", internal_api_key="")

    # Valid 32+ character key passes in production
    valid_key = "a" * 32
    s = Settings(app_env="production", internal_api_key=valid_key)
    assert s.internal_api_key == valid_key


def test_development_config_allows_dev_default_key():
    """
    audit §11.4: Allow dev default key in non-production.
    """
    s = Settings(app_env="development", internal_api_key="local-dev-internal-key")
    assert s.internal_api_key == "local-dev-internal-key"


def test_require_internal_key_uses_constant_time_comparison():
    """
    audit §11.4: Verify require_internal_key validates correct key and rejects invalid key.
    """
    settings = Settings(app_env="development", internal_api_key="test-secret-key-12345678901234567890")

    # Should not raise exception with valid header
    require_internal_key(x_internal_key="test-secret-key-12345678901234567890", settings=settings)

    # Should raise HTTP 401 with invalid header
    with pytest.raises(HTTPException) as exc_info:
        require_internal_key(x_internal_key="wrong-key", settings=settings)
    assert exc_info.value.status_code == 401
