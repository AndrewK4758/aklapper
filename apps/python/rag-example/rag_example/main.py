#!/usr/bin/python3

import asyncio
from pathlib import Path
import sys

from rag_example.loaders.base import LoaderType
from rag_example.loaders.loaders import loaders
import os
import json  # Optional, for pretty printing

# os.environ is a dictionary-like object of all env variables
all_env_vars = dict(os.environ)

# Print all variables in a readable JSON format
print(json.dumps(all_env_vars, indent=2))


def main():

    if len(sys.argv) < 2:
        print('Need to pass in the loader type then the path(s)\nExample pdf ./my_doc.pdf ./my_other_doc.pdf')
        sys.exit(1)
    else:

        loader_type: str = sys.argv[1]
        paths: list[str] = sys.argv[2:]

        loader = loaders.get(LoaderType(loader_type))
        if loader is None:
            print('Loader type not found. please use pdf file for example')
            sys.exit(2)

        asyncio.run(loader(paths, {'chunk_size': 1000, 'chunk_overlap': 200}))

    return 0


if __name__ == '__main__':
    main()
