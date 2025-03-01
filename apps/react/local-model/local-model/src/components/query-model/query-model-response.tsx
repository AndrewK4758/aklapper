import Box from '@mui/material/Box';

interface ModelResponseProps {
  promptResponse: string;
}

const codeDelimeter = '```';

const ModelResponse = ({ promptResponse }: ModelResponseProps) => {
  const includesCodeString = promptResponse.includes(codeDelimeter);
  let codeString;
  let startString;
  let endString;
  if (includesCodeString) {
    const startIdx = promptResponse.indexOf(codeDelimeter);
    const lastIdx = promptResponse.lastIndexOf(codeDelimeter);

    startString = promptResponse.slice(0, startIdx);
    codeString = promptResponse.slice(startIdx, lastIdx);
    endString = promptResponse.slice(lastIdx);

    console.log(startIdx, lastIdx);

    console.log(startString, '\n\n');
    console.log(codeString, '\n\n');
    console.log(endString, '\n\n');
  }

  return (
    <Box width={'100vw'} display={'flex'} justifyContent={'center'}>
      {includesCodeString ? (
        <Box width={'90vw'}>
          <pre
            style={{
              height: 'fit-content',
              overflow: 'hidden',
              whiteSpace: 'pre-wrap',
              fontWeight: 'bolder'
            }}
          >
            {startString}
          </pre>
          <Box bgcolor={'#242424'}>
            <code
              style={{
                height: 'fit-content',
                overflow: 'hidden',
                whiteSpace: 'pre-wrap',
                fontWeight: 'bolder'
              }}
            >
              {codeString}
            </code>
          </Box>
          <pre
            style={{
              height: 'fit-content',
              overflow: 'hidden',
              whiteSpace: 'pre-wrap',
              fontWeight: 'bolder'
            }}
          >
            {endString}
          </pre>
        </Box>
      ) : (
        <pre
          style={{
            width: '90%',
            height: 'fit-content',
            minHeight: '30vh',
            overflow: 'hidden',
            whiteSpace: 'pre-wrap',
            fontWeight: 'bolder'
          }}
        >
          {promptResponse}
        </pre>
      )}
    </Box>
  );
};

export default ModelResponse;
/**
 * 

#     template = """You are a helpful AI assistant that can search the internet. Use the available tools to answer questions.

# Available tools: {tools}

# {tool_names}
# To use a tool, you MUST use the following format:
# Question: the input question you must answer
# Thought: your reasoning about what to do
# Action: the action to take, must be one of [{tool_names}]
# Action Input: the specific search query or input for the tool
# Observation: the result of the action
# ... (repeat Thought/Action/Action Input/Observation if needed)
# Thought: I now know the final answer
# Final Answer: the final answer to the original question

# Example format:
# Question: What is the current weather in New York?
# Thought: I need to search for current weather conditions in New York
# Action: web_search
# Action Input: current weather conditions in New York City right now
# Observation: [search results]
# Thought: I now know the final answer
# Final Answer: [provide weather information from search results]

# Begin!

# Previous conversation history:
# {messages}

# {agent_scratchpad}

# Remember: ALWAYS follow the format exactly - Question, Thought, Action, Action Input, Observation, and Final Answer.
# """



    #     template = """You are a helpful AI assistant that can search the internet. Use the available tools to answer questions.

    # Available tools: {tools}

    # {tool_names}
    # To use a tool, you MUST use the following format:
    # Question: the input question you must answer
    # Thought: your reasoning about what to do
    # Action: the action to take, must be one of [{tool_names}]
    # Action Input: the specific search query or input for the tool
    # Observation: the result of the action
    # Thought: I now know the final answer
    # Final Answer: the final answer to the original question

    # Example format:
    # Question: What is the current weather in New York?
    # Thought: I need to search for current weather conditions in New York
    # Action: web_search
    # Action Input: current weather conditions in New York City right now
    # Observation: [search results]
    # Thought: I now know the final answer
    # Final Answer: [provide weather information from search results]

    # Begin!

    # Previous conversation history:
    # {messages}

    # {agent_scratchpad}

    # Remember: ALWAYS follow the format exactly - Question, Thought, Action, Action Input, Observation, and Final Answer.
    # """

        """You are a helpful AI assistant that can search the internet using Google Search.

Available tools: {tools}
Available actions: [{tool_names}]

You MUST ALWAYS follow this EXACT format for EVERY response:

Question: {question}
Thought: [your reasoning about what information you need]
Action: [must be one of these: {tool_names}]
Action Input: [your specific search query]
Observation: [the search results you receive]
... (repeat Thought/Action/Action Input/Observation if needed)
Thought: [your analysis of the search results]
Final Thought: [your final reasoning before returning final answer]
Final Answer: [your complete answer to the user's question]

Important Rules:
1. ALWAYS start with the Question
2. ALWAYS include your Thought process
3. ALWAYS use an Action and Action Input for searching
4. ALWAYS analyze the Observation
5. ALWAYS provide a Final Answer

{agent_scratchpad}"""



---------------------
    Example:
    Question: What is the capital of France?
    Thought: I should look up the capital of France on the web.
    Action: web search
    Action Input: "capital of France"
    Observation: 
    [{{ {{'title'}}: 'Paris - Wikipedia', {{'snippet}}': 'Paris is the capital and most populous city of France',{{'link'}}: 'https://en.wikipedia.org/wiki/Paris'}}]
    Final Answer The capital of France is Paris

    the final answer to the original input question, once you receive a firm answer that meets the requirements, return the answer
*/
