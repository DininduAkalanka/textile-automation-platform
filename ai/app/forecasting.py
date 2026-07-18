"""
Demand forecasting — the one genuinely predictive model in the system.

Classical exponential smoothing (statsmodels), NOT deep learning: with a small
shop's history that is the honest choice — a neural net would overfit noise and
present it as insight. The model ADAPTS to how much history exists and, when
that history is thin, SAYS SO rather than dressing a guess up as a confident
forecast. (Scope doc §4.5 — "basic analytics"; tech-stack §7.2 pre-picked
statsmodels for exactly this.)
"""

from __future__ import annotations

import logging
import warnings
from typing import Literal

import numpy as np

logger = logging.getLogger(__name__)

Confidence = Literal["high", "medium", "low"]

# ~80% one-sided z. A deliberately modest band: a small shop's weekly demand is
# noisy, and an over-tight interval would read as false precision.
_Z = 1.28


def forecast_series(
    history: list[float],
    horizon: int,
    season_length: int = 0,
) -> dict:
    """
    Forecast the next ``horizon`` points from ``history``.

    Returns predicted / lower / upper (all clamped at 0 — demand is never
    negative and is rounded to whole units), the model actually used, a
    confidence level, and a human ``note`` whenever the data is too thin to
    trust. Never raises: a fit failure degrades to a flat average.
    """
    clean = [float(max(0.0, x)) for x in history]
    n = len(clean)

    if n == 0:
        return _flat(
            0.0, horizon, "none", "low",
            "No sales yet, so there's nothing to base an estimate on.",
        )
    if n < 3:
        return _flat(
            float(np.mean(clean)), horizon, "naive", "low",
            "Very little sales history — this is just the average of recent "
            "weeks, not a reliable estimate.",
        )

    try:
        from statsmodels.tsa.holtwinters import ExponentialSmoothing

        use_seasonal = season_length >= 2 and n >= 2 * season_length
        if use_seasonal:
            model, confidence, note = "holt_winters_seasonal", "high", None
            fit = ExponentialSmoothing(
                clean, trend="add", seasonal="add",
                seasonal_periods=season_length,
                initialization_method="estimated",
            ).fit()
        elif n >= 6:
            model, confidence = "holt_linear_trend", "medium"
            note = (
                "Not enough history yet to spot seasonal ups and downs — "
                "this follows the recent sales trend."
            )
            fit = ExponentialSmoothing(
                clean, trend="add", seasonal=None,
                initialization_method="estimated",
            ).fit()
        else:
            model, confidence = "simple_exp_smoothing", "low"
            note = "Limited history — treat this as a rough guide."
            fit = ExponentialSmoothing(
                clean, trend=None, seasonal=None,
                initialization_method="estimated",
            ).fit()

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            raw = np.asarray(fit.forecast(horizon), dtype=float)

        resid = np.asarray(fit.fittedvalues, dtype=float) - np.asarray(clean, dtype=float)
        sigma = float(np.std(resid)) if resid.size else 0.0

        return {
            "predicted": [round(max(0.0, v)) for v in raw],
            "lower": [round(max(0.0, v - _Z * sigma)) for v in raw],
            "upper": [round(max(0.0, v + _Z * sigma)) for v in raw],
            "model": model,
            "confidence": confidence,
            "note": note,
        }
    except Exception as exc:  # noqa: BLE001 — a fit failure must degrade, not crash
        logger.warning("forecast_fit_failed n=%s error=%s", n, exc)
        return _flat(
            float(np.mean(clean)), horizon, "naive", "low",
            "Couldn't calculate a full estimate — showing the average of "
            "recent weeks instead.",
        )


def _flat(
    value: float, horizon: int, model: str, confidence: Confidence, note: str
) -> dict:
    v = round(max(0.0, value))
    return {
        "predicted": [v] * horizon,
        "lower": [v] * horizon,
        "upper": [v] * horizon,
        "model": model,
        "confidence": confidence,
        "note": note,
    }
