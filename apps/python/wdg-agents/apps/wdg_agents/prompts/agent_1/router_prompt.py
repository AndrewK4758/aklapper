from langchain.prompts import PromptTemplate

router_prompt = PromptTemplate(
    template="""
    
    <|begin_of_text|>
    
    <|start_header_id|>system<|end_header_id|>
    
    You are an expert at routing a user question to either the final_response stage or web search. 
    Use the web search for questions that require more context for a better answer, or recent events.
    Otherwise, you can skip and go straight to the final_response phase to respond.
    You do not need to be stringent with the keywords in the question related to these topics.
    Give a binary choice 'web_search' or 'generate' based on the question. 
    Return the JSON with a single key 'choice' with no premable or explanation. 
    
    Question to route: {question} 
    
    <|eot_id|>
    
    <|start_header_id|>assistant<|end_header_id|>
    
    """,
    input_variables=["question"],
)
