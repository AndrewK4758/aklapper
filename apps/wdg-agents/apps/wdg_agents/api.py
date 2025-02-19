from typing import IO,  Sequence
from wdg_agents.agent_1 import query_agent
import os
from io import BytesIO

from dotenv import load_dotenv

from wdg_agents.rag_chain import rag_db_with_documents
from flask import Flask, Response, jsonify, request, send_from_directory
from flask_cors import CORS
from wdg_agents.get_llm_list import get_llm_list

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
    files = request.files.getlist('files')

    model = input_data.get('model')
    query = input_data.get('query')

    if model and query:
        db = await rag_db_with_documents(model, files)

        llm_response = await query_agent(model, query, db)  # type: ignore

        print(f"QUERY RESPONSE: {llm_response}")

        response.mimetype = "text/plain"
        response.data = llm_response
        response.access_control_allow_origin = origin
    return response


def run_server():
    api.run(debug=True, port=6900)
