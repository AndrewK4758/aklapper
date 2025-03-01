import io
import json

import chromadb
import chromadb.api
import rich
from chromadb import Documents, EmbeddingFunction
from chromadb.api import ClientAPI
from chromadb.api.models import Collection
from langchain_chroma import Chroma
from langchain_ollama import OllamaEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_unstructured.document_loaders import UnstructuredLoader
from wdg_agents.utils import print_with_time
from werkzeug.datastructures import FileStorage

CHUNK_SIZE = 1500
CHUNK_OVERLAP = 400
HIDE_SOURCE_DOCUMENTS = False
DB_PATH = './data_store'
native_db = chromadb.PersistentClient(path=DB_PATH)


def make_bytes_io_object(file: FileStorage) -> io.BytesIO:
    return io.BytesIO(file.stream.read())


class MyEmbeddingFunction(EmbeddingFunction):
    def __call__(self, input: Documents) -> list[list[float]]:
        return embeddingModel.embed_documents(input)


async def read_files(native_db: ClientAPI, collection: str, files: list[FileStorage]) -> bool:
    """This method takes the uploaded documents and uses the UnstructuredLoader to ensure each PDF is broken
    down into individual pages for citation."""

    collection = get_collection(native_db, collection)

    try:
        for file in files:
            file.stream.seek(0)
            file_stream_buffer = make_bytes_io_object(file)

            loader = UnstructuredLoader(file=file_stream_buffer, mode='element',
                                        metadata_filename=file.name, metadata_filetype=file.mimetype)

            pages = await loader.aload()

            text_splitter = RecursiveCharacterTextSplitter(chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP)

            chunks = text_splitter.split_documents(pages)
            print_with_time(f"Loading {file.filename} - Pages: {len(pages)}")

            for index, chunk in enumerate(chunks):
                metadata: dict[str, str] = {key: json.dumps(chunk.metadata[key]) for key in chunk.metadata}
                chunk_element_id: str | None = chunk.metadata.get('element_id')
                rich.print(f'{chunk_element_id}: {metadata}')
                if chunk_element_id:
                    collection.upsert(
                        ids=[chunk_element_id + str(index)],
                        metadatas=metadata,
                        documents=chunk.page_content,
                    )

    except Exception as e:
        print(e)
        return False
    return True


# DECIDE WHETHER TO KEEP OR DELETE DOCUMENTS FOR EACH LOAD OR ITERATION
def get_collection(native_db: ClientAPI, collection: str) -> Collection.Collection:
    print("DEBUG: call get_collection()")

    current_collection = native_db.get_or_create_collection(
        name=collection, embedding_function=MyEmbeddingFunction()
    )
    print("COLLECTION: ", collection)

    return current_collection


def format_docs(docs):
    """A simple document formatter if the type of document was not chunked"""
    return "\n".join(doc.page_content for doc in docs)


async def get_db_client(model: str, collection: str, files: list[FileStorage] | None = None) -> Chroma:
    print("rag-chain main")

    global embeddingModel
    embeddingModel = OllamaEmbeddings(model=model)

    if files:
        files_read_into_db = await read_files(native_db, collection, files)

        print('Read files into db: ', files_read_into_db)

    db = Chroma(client=native_db, collection_name=collection,
                embedding_function=embeddingModel, persist_directory=DB_PATH,)

    return db
