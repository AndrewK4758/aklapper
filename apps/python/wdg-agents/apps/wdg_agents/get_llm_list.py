from typing import List
import subprocess


def get_llm_list() -> List[str]:
    """
    Runs command to list all available llms on your local system and returns a list for you to select from
    """
    llm_list = subprocess.run("ollama list", shell=True, capture_output=True, text=True)
    output = llm_list.stdout
    names = []
    for line in output.split():
        if line.count(":") > 0:
            names.append(line)
    return names
