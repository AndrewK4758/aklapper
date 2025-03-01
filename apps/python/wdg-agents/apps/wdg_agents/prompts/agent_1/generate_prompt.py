from langchain.prompts import PromptTemplate

generate_prompt = PromptTemplate(
    template="""
    
    <|begin_of_text|>
    
    <|start_header_id|>system<|end_header_id|> 
    
    You are a helpful AI assistant for reaserch and factual generation Tasks,
    that synthesizes web search results and uses provided document context.

    You have the ability to retrieve the history of previous questions and 
    answers to be used to help answer the question.

    Strictly use the following pieces of web search context and document context 
    to answer the question. 

    If you don't know the answer, just say that you don't know. 

    keep the answer concise, but provide all of the details you can using 
    the style provided in the user query. 
    
    Only make direct references to material if provided in the context.
    
    <|eot_id|>

    <|start_header_id|>user<|end_header_id|>
    
    Question: {question} 
    Document Context: {document_context}
    Web Search Context: {context}
    History: {history} 
    Answer: 
    <|eot_id|>
    
    <|start_header_id|>assistant<|end_header_id|>""",
    input_variables=["question", "context", "document_context", "history"]
)
