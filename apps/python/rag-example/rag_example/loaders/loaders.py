from collections.abc import Callable
from types import CoroutineType
from typing import Any
from rag_example.loaders.base import LoaderType
from rag_example.loaders.pdf import pdf_loader


loaders: dict[LoaderType, Callable[[str | list[str], dict[Any, Any]], CoroutineType[Any, Any, None]]] = {
    LoaderType.PDF: pdf_loader
}
