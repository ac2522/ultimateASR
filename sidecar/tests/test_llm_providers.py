import pytest
from unittest.mock import MagicMock, patch
from ultimate_asr.llm.base import LLMConfig
from ultimate_asr.llm.openai_provider import OpenAIProvider
from ultimate_asr.llm.anthropic_provider import AnthropicProvider


@pytest.fixture
def openai_mock():
    with patch("ultimate_asr.llm.openai_provider.OpenAI") as cls:
        client = MagicMock()
        cls.return_value = client
        msg = MagicMock(); msg.content = " hello world  "
        choice = MagicMock(message=msg)
        client.chat.completions.create.return_value = MagicMock(choices=[choice])
        yield client


@pytest.fixture
def anthropic_mock():
    with patch("ultimate_asr.llm.anthropic_provider.Anthropic") as cls:
        client = MagicMock()
        cls.return_value = client
        block = MagicMock(); block.text = " hello world "
        client.messages.create.return_value = MagicMock(content=[block])
        yield client


def test_openai_provider_cleanup(openai_mock):
    cfg = LLMConfig(provider="openai", model="gpt-4o-mini", api_key="sk", system_prompt="SYS")
    out = OpenAIProvider(cfg).cleanup("um, hello world")
    assert out == "hello world"
    kwargs = openai_mock.chat.completions.create.call_args.kwargs
    assert kwargs["model"] == "gpt-4o-mini"
    assert kwargs["messages"][0] == {"role": "system", "content": "SYS"}
    assert kwargs["messages"][1] == {"role": "user", "content": "um, hello world"}


def test_openai_provider_explicit_system_prompt_overrides_config(openai_mock):
    cfg = LLMConfig(provider="openai", model="gpt-4o-mini", api_key="sk", system_prompt="DEFAULT")
    OpenAIProvider(cfg).cleanup("text", system_prompt="OVERRIDE")
    kwargs = openai_mock.chat.completions.create.call_args.kwargs
    assert kwargs["messages"][0]["content"] == "OVERRIDE"


def test_anthropic_provider_cleanup(anthropic_mock):
    cfg = LLMConfig(provider="anthropic", model="claude-3-5-sonnet", api_key="ant", system_prompt="SYS")
    out = AnthropicProvider(cfg).cleanup("um, hello world")
    assert out == "hello world"
    kwargs = anthropic_mock.messages.create.call_args.kwargs
    assert kwargs["model"] == "claude-3-5-sonnet"
    assert kwargs["system"] == "SYS"
    assert kwargs["messages"] == [{"role": "user", "content": "um, hello world"}]


import json
import httpx
from ultimate_asr.llm.ollama_provider import OllamaProvider
from ultimate_asr.llm.llamacpp_provider import LlamaCppProvider


def _ollama_handler(request):
    payload = json.loads(request.content)
    assert payload["model"] == "llama3.1"
    assert payload["stream"] is False
    assert payload["messages"][0] == {"role": "system", "content": "SYS"}
    assert payload["messages"][1]["content"] == "um, hello world"
    return httpx.Response(200, json={"message": {"content": " hello world  "}})


def test_ollama_provider_cleanup():
    cfg = LLMConfig(provider="ollama", model="llama3.1", endpoint="http://example", system_prompt="SYS")
    p = OllamaProvider(cfg)
    p._client = httpx.Client(transport=httpx.MockTransport(_ollama_handler), base_url="http://example")
    assert p.cleanup("um, hello world") == "hello world"


def _llamacpp_handler(request):
    payload = json.loads(request.content)
    assert payload["model"] == "qwen2.5:7b"
    assert payload["max_tokens"] == 512
    assert payload["messages"][0] == {"role": "system", "content": "SYS"}
    return httpx.Response(200, json={"choices": [{"message": {"content": " hello world  "}}]})


def test_llamacpp_provider_cleanup():
    cfg = LLMConfig(provider="llamacpp", model="qwen2.5:7b", endpoint="http://example", system_prompt="SYS")
    p = LlamaCppProvider(cfg)
    p._client = httpx.Client(transport=httpx.MockTransport(_llamacpp_handler), base_url="http://example")
    assert p.cleanup("um, hello world") == "hello world"
