from typing import IO

from dotenv import load_dotenv
from flask import Flask, Response, request, send_from_directory
from flask_cors import CORS
from wdg_agents.agent_1 import query_agent
from wdg_agents.get_llm_list import get_llm_list
from wdg_agents.rag_chain import get_db_client
from werkzeug.datastructures import FileStorage

load_dotenv(dotenv_path="apps/wdg_agents/env/.env")

static_path = "../../../../apps/local-model/local-model/dist"

api = Flask(
    __name__,
    static_folder=static_path,
)
CORS(api, origins=["http://127.0.0.1:6900", "http://localhost:6900"])

api.config['JSONIFY_PRETTYPRINT_REGULAR'] = True


@api.route("/", defaults={"path": "/"})
@api.route("/<path:path>")
def index(path):

    if path != "" and path.find(".") == -1:  # Check for explicit files or the root
        return send_from_directory(static_path, "index.html")
    else:
        return send_from_directory(static_path, path)


@api.route("/models")
def get_available_models():
    return get_llm_list()


@api.route("/query-model", methods=["POST"])
async def chat_with_llm():
    response = Response()
    origin = request.origin
    input_data = request.form

    files: list[FileStorage] = request.files.getlist('files')

    model: str = input_data['model']
    query: str = input_data['query']

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
