from typing import IO, List

from fastapi import FastAPI, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel
from wdg_agents.agent_1 import query_agent
from wdg_agents.get_llm_list import get_llm_list
from wdg_agents.rag_chain import get_db_client

load_dotenv(dotenv_path="apps/wdg_agents/env/.env")

static_path = "../../../../apps/local-model/local-model/dist"

api = FastAPI()

origins=["http://127.0.0.1:6900", "http://localhost:5800"]

api.add_middleware(
    CORSMiddleware, 
    allow_origins=origins,
    allow_credentials=True,  
    allow_methods=["*"],     
    allow_headers=["*"], 
    )


@api.get("/models")
def get_available_models():
    return get_llm_list()

class Query(BaseModel):
    query: str
    model: str
    files: list[UploadFile] | None


@api.post("/query-model")
async def chat_with_llm(user_query:Query):
    

    files: list[UploadFile] = user_query.files or []

    model: str = user_query.model
    query: str = user_query.query

    

    history_collection = await get_db_client(model, "HISTORY")
    if len(files):
        # Adds new files to database before calling retreiver
        rag_collection = await get_db_client(model, "USER_CONTEXT", files)
        llm_response = await query_agent(model, query, rag_collection, history_collection)

    else:
        # Returns instance to RAG DB without adding new files
        rag_collection = await get_db_client(model, "USER_CONTEXT")
        llm_response = await query_agent(model, query, rag_collection, history_collection)

    response.mimetype = "text/plain"
    response.data = llm_response
    response.access_control_allow_origin = origin
    return response


def run_server():
    api.run(debug=True, port=6900)
