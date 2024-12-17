"""Hello unit test module."""

from apps.wdg_agents.hello import hello


def test_hello():
    """Test the hello function."""
    assert hello() == "Hello apps/wdg-agents"
