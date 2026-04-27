import pytest
from ultimate_asr.llm.base import LLMProvider, get_provider, LLMConfig


def test_get_provider_unknown_raises():
    with pytest.raises(ValueError):
        get_provider(LLMConfig(provider="bogus", model="x", api_key="y"))


def test_each_provider_resolvable():
    for p in ("openai", "anthropic", "ollama", "llamacpp"):
        cfg = LLMConfig(provider=p, model="m", api_key="k", endpoint="http://x")
        provider = get_provider(cfg)
        assert hasattr(provider, "cleanup")
