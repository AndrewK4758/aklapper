# import chromadb

# client = chromadb.PersistentClient("./data_stroe")

# print(client.get_collection("PDFS"))

# collection = client.get_collection(name="chroma.sqlite3")

# results = collection.peek(limit=10)

# ids = results["ids"]
# embeddings = results["embeddings"]  # These will be large vectors
# metadatas = results["metadatas"]
# documents = results["documents"]

# print(f"Number of items: {len(ids)}")
# for i in range(len(ids)):
#     print(f"\n--- Item {i+1} ---")
#     print(f"ID: {ids[i]}")
#     print(f"Metadata: {metadatas[i]}")
#     print(f"Document: {documents[i]}")  # Original text content
#     # Optionally print a few embedding values if you want to see the vectors:
#     # print(f"Embedding (first 5 values): {embeddings[i][:5]}")
