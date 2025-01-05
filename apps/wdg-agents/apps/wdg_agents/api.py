from typing import Dict
from flask import Flask, Response, jsonify, request, send_from_directory
from flask_cors import CORS

api = Flask(__name__, static_folder="../../../../dist/apps/local-model", static_url_path="/")
CORS(api, origins=["http://localhost:5800"])


@api.route("/")
def index():
    return send_from_directory(api.static_folder, "index.html")


@api.route("/query-model", methods=["POST"])
def chat_with_llm():
    origin = request.origin
    input_data: Dict[str:str] = request.get_json()

    response = Response()
    response.mimetype = "application/json"
    response = jsonify(input_data)
    response.access_control_allow_origin = origin
    return response


def run_server():
    api.run(debug=True, port=6900)
