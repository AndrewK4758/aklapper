# return (local_model, prompt)
# resp = chain.invoke({"query":poetry she "What is the best practice for react contex ?"})
# while True:
#     print("Query:", end=" ")
#     try:
#         inputText = input()
#     except EOFError:
#         break
#     if inputText == "exit" or inputText == "quit":
#         break
#     chain = prompt | model
#     resp = chain.invoke({"prompt": [HumanMessage(content=inputText)]})
#     print(resp)


# if __name__ == "__main__":
#     main()
