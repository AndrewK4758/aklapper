from wdg_agents.agent_1 import query_agent
import os
from typing import Dict

from dotenv import load_dotenv

from flask import Flask, Response, jsonify, request, send_from_directory
from flask_cors import CORS
from wdg_agents.get_llm_list import get_llm_list

load_dotenv(dotenv_path="apps/wdg_agents/env/.env")

static_path = "../../../../apps/local-model/local-model/dist"

api = Flask(
    __name__,
    static_folder=static_path,
)
CORS(api, origins=["http://127.0.0.1:6900"])

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
def chat_with_llm():
    origin = request.origin
    input_data = request.get_json()

    query = input_data["query"]

    llm_response = query_agent(query)

    print(f"QUERY RESPONSE: {llm_response}")

    response = Response()
    response.mimetype = "text/plain"
    response.data = llm_response
    response.access_control_allow_origin = origin
    return response


def run_server():
    api.run(debug=True, port=6900)
