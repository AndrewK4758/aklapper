import asyncio
import os
from typing import Any, TypedDict

import chromadb
import chromadb.api
import chromadb.api.models
import chromadb.api.models.Collection
import pytesseract.pytesseract
from regex import P
import rich
from chromadb import Documents, EmbeddingFunction
from IPython.display import Image, display
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.output_parsers import JsonOutputParser, StrOutputParser
from langchain_ollama import OllamaEmbeddings
from langchain_ollama.chat_models import ChatOllama
from langchain_community.document_loaders import PyMuPDFLoader
from langgraph.graph import END, START, StateGraph
from psutil import cpu_count
from wdg_agents.prompts.agent_2.generate_prompt import generate_prompt
from wdg_agents.utils import print_with_time

from langchain_community.document_loaders.parsers import TesseractBlobParser

from pathlib import Path

MODEL = 'llama3.2:latest'
DB_PATH = './agent_2'
DB_NAME = 'rag_vectors'
GPU_COUNT = 1
CPU_COUNT = cpu_count(logical=False)
MODEL_TEMP: float = 0.65
VECTOR_DB_COLLECTION_NAME = 'RAG_CONTEXT'


llama = ChatOllama(model=MODEL, temperature=MODEL_TEMP)
llama_json = ChatOllama(model=MODEL, format='json', temperature=MODEL_TEMP)
vector_store: chromadb.api.ClientAPI = chromadb.PersistentClient(path=DB_PATH,)
embedding_model = OllamaEmbeddings(model=MODEL, num_gpu=1, num_thread=CPU_COUNT, temperature=MODEL_TEMP)
vector_store_client = Chroma(
    client=vector_store,
    collection_name=VECTOR_DB_COLLECTION_NAME,
    embedding_function=embedding_model,
    persist_directory=DB_PATH
)

# Maybe change to class if functionality is limited


class EmbedData(EmbeddingFunction):
    """
    This class embeds the data into a vector DB.
    The __call__ method asynchronously takes the 
    input documents and creates the necessary 
    embeddings for rag context

    Args:
      input (Documents): The data to be embedded

    Returns:
      Array of embeddings (list[list[float]]) : The embedded vectors for input data.
    """

    async def __call__(self, input: Documents) -> list[list[float]]:
        return await embedding_model.aembed_documents(input)


async def get_vector_db_collection(
        native_db: chromadb.api.ClientAPI, collection_name: str
) -> chromadb.api.models.Collection.Collection:
    """
    This method returns the collection of a given vector store DB and collection name.

    Args:
      native_db (chromadb.api.ClientAPI): The instance of the ChromaDB Client.
      collection_name (str): The name of the collection to create or return

    Returns:
      The ChromaDB collection (chromadb.api.models.Collection.Collection) of vectors for a given LLM query
    """

    try:
        collection = await native_db.get_or_create_collection(name=collection_name, embedding_function=EmbedData())
    except Exception as e:
        print("GET VECTOR DB COLLECTION ERROR:\n\t", e)

    return collection


async def add_files_to_vector_store(files: str) -> bool:
    """
    This method adds the files from a specific path to the vector store 
    to be queried for context of future generation queries

    Args:
      files (list[str]): list of paths for files, can be individual files or entire directories

    Returns
      True or False depending on completion of the process
    """

    try:
        files_path = Path(files)

        resolved_path = files_path.resolve()

        rich.print(f'RESOLVED PATH: {resolved_path}\n')

        for filename in os.listdir(resolved_path):
            full_path = resolved_path.joinpath(filename)

            rich.print(f'FULL PATH: {full_path}\n')

            loader = PyMuPDFLoader(file_path=full_path, extract_tables='csv',
                                   extract_images=False, mode='page')

            pages = await loader.aload()

            for page in pages:

                rich.print(f"PAGES: {page}\n", sep='\n')

        return True
    except Exception as e:
        rich.print("ADD FILES ERROR:\n\t", e)
    return True


asyncio.run(add_files_to_vector_store("../../../../projects/data/rag/"))


class GraphState(TypedDict):
    """
    Represents the state of the workflow graph

    Attributes:
      question: user prompt
      final_response: LLM final response
      rag_context: result of rag retriever db query 
    """

    question: str
    final_response: str
    rag_context: dict[str, Any]


async def generate(state: GraphState):
    """
    Generate Answer

    Args:
      state (dict): The current graph state

    Returns:
      state (dict): Adds value to the state at key (final_response) which contains the result of LLM query
    """
    print_with_time('Step: Generating Final Response')

    question: str = state["question"]
    rag_context: dict[str, Any] = state['rag_context']

    generate_chain = generate_prompt | llama | StrOutputParser()

    output = await generate_chain.ainvoke({"question": question, "rag_context": rag_context})

    return output


async def retrieve_context(state: GraphState):
    """
    Retrieve context specific docuemtns from DB
workflow_graph.add_edge("rag context", "generate")
    Args:
      state (dict): The current graph state

    Returns:
      state (dict): adds value to the state at key (rag_context) which is retrieved from the DB query
    """

    question: str = state["question"]

    await vector_store_client.aadd_documents(
        [Document(page_content="document 1 data"), Document(page_content="Document 2 data")]
    )

    retriever = vector_store_client.as_retriever(
        search_type="mmr",
        search_kwargs={
            "k": 5,
            "fetch_k": 25,
            "lambda_mult": 0.85,
        }
    )

    rag_context = {}

    try:
        rag_context = await retriever.ainvoke(question)

        print("RAG CONTEXT:\n\t", rag_context)

    except Exception as e:
        print("RAG CONTEXT ERROR:\n\t", e)
    return {"rag_context": rag_context}

workflow_graph = StateGraph(GraphState)

workflow_graph.add_node("rag context", retrieve_context)
workflow_graph.add_node("generate", generate)

workflow_graph.add_edge(START, "rag context")
workflow_graph.add_edge("rag context", "generate")
workflow_graph.add_edge("generate", END)

workflow = workflow_graph.compile()

# display(Image(workflow.get_graph().draw_mermaid_png()))

# while True:
#     try:
#         user_input = input("\nQuery: ")

#         if user_input == 'exit':
#             break

#         asyncio.run(workflow.ainvoke({"question": user_input}))

#     except Exception as e:
#         rich.print(e)
