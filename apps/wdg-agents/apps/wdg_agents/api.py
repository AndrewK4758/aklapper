import os
from typing import Dict

from dotenv import load_dotenv
from flask import Flask, Response, jsonify, request, send_from_directory
from flask_cors import CORS
from wdg_agents.get_llm_list import get_llm_list

load_dotenv(dotenv_path="apps/wdg_agents/env/.env")

from wdg_agents.agent_1 import use_model_with_agent

api = Flask(
    __name__,
    static_folder="../../../../dist/apps/local-model",
)
CORS(api, origins=["http://localhost:5800"])

api.config['JSONIFY_PRETTYPRINT_REGULAR'] = True

@api.route("/", defaults={"path": "/"})
@api.route("/<path:path>")
def index(path):

    if path != "" and path.find(".") == -1:  # Check for explicit files or the root
        return send_from_directory(api.static_folder, "index.html")
    else:
        return send_from_directory(api.static_folder, path)


@api.route("/models")
def get_available_models():
    return get_llm_list()


@api.route("/query-model", methods=["POST"])
def chat_with_llm():
    origin = request.origin
    input_data: Dict[str:str] = request.get_json()

    model = input_data["model"]
    query = input_data["query"]

    query_response = use_model_with_agent(model, query)

    content = query_response["output"]
    response = Response()
    response.mimetype = "application/json"
    response = jsonify({"query_response": content})
    response.access_control_allow_origin = origin
    return response


def run_server():
    api.run(debug=True, port=6900)
