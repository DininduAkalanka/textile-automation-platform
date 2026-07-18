"""
Demand forecasting.

The model's job is to predict; the tests' job is to prove it stays HONEST when
the data is thin and NEVER crashes. The contract tests below hold whether or not
statsmodels is installed (a missing library degrades to a flat average, by
design); one test that needs the real model is skipped when it is absent.
"""

import pytest

from app.analytics import DeadStockArgs, ForecastArgs, TrendingArgs
from app.forecasting import forecast_series

try:
    import statsmodels  # noqa: F401

    HAS_STATSMODELS = True
except ImportError:
    HAS_STATSMODELS = False

_KEYS = {"predicted", "lower", "upper", "model", "confidence", "note"}


class TestForecastContract:
    def test_returns_the_requested_horizon_length(self):
        out = forecast_series([5, 6, 7, 8, 9, 10, 11, 12], horizon=4)
        assert len(out["predicted"]) == 4
        assert len(out["lower"]) == 4
        assert len(out["upper"]) == 4
        assert _KEYS <= set(out)

    def test_predictions_are_never_negative(self):
        # Demand can't be negative; negatives in history are clamped, not trusted.
        out = forecast_series([-3, 0, 0, 5, 2, 1], horizon=3)
        assert all(v >= 0 for v in out["predicted"])
        assert all(v >= 0 for v in out["lower"])

    def test_empty_history_is_low_confidence_and_zero(self):
        out = forecast_series([], horizon=3)
        assert out["predicted"] == [0, 0, 0]
        assert out["confidence"] == "low"
        assert out["note"]  # honestly explains there is nothing to forecast

    def test_thin_history_is_flagged_low_confidence(self):
        # Fewer than 3 points: a flat average with an honest caveat, not a forecast.
        out = forecast_series([4, 8], horizon=2)
        assert out["confidence"] == "low"
        assert out["note"]
        assert len(out["predicted"]) == 2

    def test_never_raises_on_odd_input(self):
        for hist in ([], [0], [0, 0, 0], [1] * 3, [999999, 0, 1]):
            forecast_series(hist, horizon=2)  # must not raise


@pytest.mark.skipif(not HAS_STATSMODELS, reason="statsmodels not installed")
class TestRealModel:
    def test_a_clear_rising_series_forecasts_near_its_recent_level(self):
        history = [float(x) for x in range(1, 16)]  # 1..15, clearly rising
        out = forecast_series(history, horizon=3)
        assert out["model"] in {
            "holt_linear_trend",
            "holt_winters_seasonal",
            "simple_exp_smoothing",
        }
        # A rising series should not predict a collapse to near-zero.
        assert out["predicted"][0] >= 10
        assert out["confidence"] in {"high", "medium"}


class TestAnalyticsArgBounds:
    """The predictive tools' arguments are bounded, like the aggregate tools."""

    def test_forecast_args_are_capped(self):
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            ForecastArgs(weeks=52)  # capped at 12
        with pytest.raises(ValidationError):
            ForecastArgs(products=100)  # capped at 8

    def test_trending_and_deadstock_reject_bad_values(self):
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            TrendingArgs(period="all-time")  # only 7d/30d/90d
        with pytest.raises(ValidationError):
            DeadStockArgs(days=5)  # minimum 14
