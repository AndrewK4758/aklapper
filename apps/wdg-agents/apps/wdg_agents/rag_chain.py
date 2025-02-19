from io import BytesIO
import json
import os
from typing import IO, List
import rich
from werkzeug.datastructures import FileStorage

import chromadb
from chromadb import EmbeddingFunction, Documents
from chromadb.api import ClientAPI
from chromadb.api.models import Collection

import chromadb.api
from langchain_chroma import Chroma
# from langchain.chains.combine_documents import create_stuff_documents_chain
# from langchain.chains.retrieval import create_retrieval_chain
from langchain_ollama.llms import OllamaLLM

from langchain_unstructured import UnstructuredLoader

from langchain_text_splitters import RecursiveCharacterTextSplitter

from wdg_agents.utils import print_with_time, SuppressStdout
from langchain_core.prompts import ChatPromptTemplate, PromptTemplate
from langchain_ollama import OllamaEmbeddings


DB_DIRECTORY = "db"
# DOCUMENT_SOURCE_DIRECTORY = "rag-data"

CHUNK_SIZE = 1500
CHUNK_OVERLAP = 400
HIDE_SOURCE_DOCUMENTS = False

embeddingModel = OllamaEmbeddings(model="llama3.2:latest")


class MyEmbeddingFunction(EmbeddingFunction):
    def __call__(self, input: Documents) -> List[List[float]]:
        return embeddingModel.embed_documents(input)


system_prompt = PromptTemplate(
    template="""

    <|begin_of_text|>
    
    <|start_header_id|>system<|end_header_id|>

    You are preparing training material for a multifamly residential management company.
    Use the following pieces of retreived context to assemble the material.
    Use the perspective of a multifamily housing developer planning the ratio of income based units and tax credit units to market rate units.
    Answer any questions as concise as possible.
    
    {context}

    <|eot_id|>
""",
    input_variables=["context"]
)


async def read_files(native_db: ClientAPI, files: List[FileStorage]) -> bool:
    """This method loads the PDF files from the source directory
    and uses the explicit PyPDFLoader to ensure each PDF is broken
    down into individual pages for citation."""

    collection = get_collection(native_db)

    print_with_time("Loading PDF's")

    # files = os.listdir(DOCUMENT_SOURCE_DIRECTORY)

    print(files, "\n")

    try:
        for file in files:
            filename, file_data = file.filename, file.stream

            print(file.filename)
            loader = UnstructuredLoader(file=file_data, mode='element', metadata_filename=filename)
            print('loader: ', loader)
            pages = await loader.aload()

            text_splitter = RecursiveCharacterTextSplitter(chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP)
            chunks = text_splitter.split_documents(pages)

            print(f"{filename} - Pages: {len(pages)}")
            for index, chunk in enumerate(chunks):
                metadata = {key: chunk.metadata.get(key, '')
                            for key in chunk.metadata if type(chunk.metadata[key]) is str or type(chunk.metadata[key]) is int}

                rich.print(metadata)
                print('---------------------------------------------------')
                rich.print(chunk)
                print('---------------------------------------------------')
                chunk_element_id = chunk.metadata.get('element_id')
                if chunk_element_id:
                    collection.upsert(
                        ids=[chunk_element_id + str(index)],
                        metadatas=metadata,
                        documents=chunk.page_content,
                    )
                # chunk_metadata_source = chunk.metadata.get("source")
                # if chunk_metadata_source != None:
                    # print(chunk.page_content)

            file_data.close()
    except Exception as e:
        print(e)
        return False
    return True


def get_collection(native_db: ClientAPI) -> Collection.Collection:
    # with SuppressStdout():
    # try:
    print("DEBUG: call get_collection()")
    # Delete all documents
    # native_db.delete_collection("PDFS")
    # finally:
    collection = native_db.get_or_create_collection(
        name="PDFS", embedding_function=MyEmbeddingFunction()
    )
    print("COLLECTION: ", collection)
    return collection


def format_docs(docs):
    """A simple document formatter if the type of document was not chunked"""
    return "\n".join(doc.page_content for doc in docs)


async def rag_db_with_documents(model: str, files: List[FileStorage]):
    print("rag-chain main")

    # llm = OllamaLLM(model=model)

    native_db = chromadb.PersistentClient(path="./data_store")

    files_read_into_db = await read_files(native_db, files)

    print('read files into db: ', files_read_into_db)

    db = Chroma(client=native_db, collection_name="PDFS",
                embedding_function=embeddingModel, persist_directory='./data_store')

    return db


async def upload_pdfs_to_llm():
    # response = Response()

    # origin = request.origin
    # files = request.files.getlist('files')
    print('---------------\n')
    # print(files)
    print('---------------\n')

    await rag_db_with_documents('llama3.2:latest', files)  # type: ignore

    # response.access_control_allow_origin = origin
    # return response
    # prompt = ChatPromptTemplate.from_messages([
    #     ("system", system_prompt.format_prompt(context="").to_string()),
    #     ("human", "{input}")
    # ])

# BELOW THIS COMMENT IS WHERE I NEED TO IMPLEMENT THE DATABASE INTO THE AGENT_1 WORKFLOW
    # Initialize the primary chain outside the Q&A while loop.
    # question_answer_chain = create_stuff_documents_chain(llm, prompt)
    # retriever = db.as_retriever(
    #     search_type="mmr",
    #     search_kwargs={
    #         "k": 500,
    #         "lambda_mult": 0.25,
    #     },  # Get many documents back, we do 100 because we're dealing with PDFS
    # )

    # Start the REPL
    # while True:
    #     query = input("\nQuery: ")
    #     if query == "exit":
    #         break
    #     if query.strip() == "":
    #         continue

    #     rag_chain = create_retrieval_chain(retriever, question_answer_chain)

    #     # Call the QA chain to print the response
    #     resp = rag_chain.invoke({"input": query})

    #     # Here, we'll print the entire response object, but normally you would only deal with the
    #     # answer: resp["answer"]
    #     # print(resp)
    #     # print()
    #     print(resp["answer"])
