"""Hello unit test module."""

from rag_example.main import main


def test_main():
    """Test the hello function."""
    assert main() == None
