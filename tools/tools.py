from langchain_tavily import TavilySearch
import os


def tavily_search(query: str):
    # Keep result count and per-result length modest: Groq's free tier allows
    # only 6000 tokens per minute, and these results feed straight into the LLM.
    tool = TavilySearch(max_results=3, api_key=os.getenv("TAVILY_API_KEY"))
    response = tool.invoke(query)
    return [r["content"][:1500] for r in response.get("results", [])]
