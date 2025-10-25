from typing import Any

from pathlib import Path
import chromadb
from chromadb.utils import embedding_functions


async def pdf_loader(path: str | list[str], options: dict[Any, int] = {'chunk_size': 1000, 'chunk_overlap': 200}):
    filesPaths: list[str] = []

    if isinstance(path, str):
        filesPaths.append(path)
    else:
        filesPaths = path

    model = 'BAAI/bge-large-en-v1.5'

    store_path = Path.cwd().joinpath('apps/python/rag-example/store').resolve().__str__()

    client = chromadb.PersistentClient(path=store_path)
    embedding_function = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name=model,
        device="cuda"  # This is the key for GPU utilization
    )

    collection = client.get_or_create_collection(
        name="test_collection",
        embedding_function=embedding_function  # type: ignore
    )

    collection.add(
        documents=path,
        ids='doc1'
    )

    return None

# from langchain_community.document_loaders.pdf import PyMuPDFLoader
# from langchain_text_splitters import RecursiveCharacterTextSplitter
# from langchain_chroma import Chroma
# from langchain_ollama import OllamaEmbeddings

# embeddings = OllamaEmbeddings(model=model, num_gpu=1, num_thread=12)

# vectorstore = Chroma()

    # for split in splits:
    #     print(str(split))

    # metadatas=[{"source": "doc1"}, {"source": "doc2"}],
    # vectorstore.from_documents(
    #     embedding=embeddings,
    #     documents=split,
    #     persist_directory=store_path

    # )
