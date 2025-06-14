#!/usr/bin/env python3
"""
LangGraph Handler for Student Doubts

This module implements a LangGraph workflow for handling student doubts
when they use the push-to-talk button. It analyzes the student's question,
determines if it's a doubt that requires redirection to teaching material,
and provides appropriate responses.
"""

import os
import logging
import uuid
from typing import Dict, List, Any, Literal, TypedDict, Optional

# Import LangGraph components
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import StrOutputParser
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemoryCheckpoint

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('langraph_handler')

# Get OpenAI API key from environment
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    logger.error("OPENAI_API_KEY not found in environment variables")

# Define the state schema
class GraphState(TypedDict):
    """Type for the graph state"""
    messages: List[Dict[str, Any]]
    next: Optional[str]  # Control flow field
    student_id: str
    doubt_topic: Optional[str]
    teaching_page_url: Optional[str]
    doubt_level: Optional[Literal["basic", "intermediate", "advanced"]]
    is_doubt: bool

# Initialize models
model = ChatOpenAI(model="gpt-4-turbo", temperature=0, api_key=api_key)
doubt_classifier_model = ChatOpenAI(model="gpt-3.5-turbo", temperature=0, api_key=api_key)

# Define graph nodes

def analyze_doubt(state: GraphState) -> GraphState:
    """Analyze if the student message is a doubt and classify it"""
    logger.info("Analyzing student input to determine if it's a doubt")
    
    # Extract the latest message from the student
    latest_message = state["messages"][-1]["content"] if state["messages"] else ""
    
    # Doubt classification prompt
    doubt_classification_prompt = ChatPromptTemplate.from_messages([
        SystemMessage(content="""You are an educational assistant that analyzes 
        student questions to determine if they are expressing a doubt or asking for help.
        Classify the input as either a doubt that needs teaching material (TRUE) or 
        a regular comment/question (FALSE). Also determine the topic and level."""),
        HumanMessage(content=f"Student message: {latest_message}")
    ])
    
    # Run the classification chain
    chain = doubt_classification_prompt | doubt_classifier_model | StrOutputParser()
    result = chain.invoke({})
    
    # Parse the result - expected format: "is_doubt: TRUE/FALSE, topic: TOPIC, level: LEVEL"
    is_doubt = "true" in result.lower()
    
    # Extract topic if available
    topic = None
    if "topic:" in result.lower():
        topic_part = result.lower().split("topic:")[1].split(",")[0].strip()
        topic = topic_part if topic_part else None
    
    # Extract level if available
    level = "basic"  # Default
    if "level:" in result.lower():
        level_part = result.lower().split("level:")[1].split(",")[0].strip()
        if level_part in ["basic", "intermediate", "advanced"]:
            level = level_part
    
    # Update state
    state["is_doubt"] = is_doubt
    state["doubt_topic"] = topic
    state["doubt_level"] = level
    
    # Determine next step based on classification
    if is_doubt:
        state["next"] = "find_teaching_material"
        logger.info(f"Classified as doubt. Topic: {topic}, Level: {level}")
    else:
        state["next"] = "general_response"
        logger.info("Not classified as doubt, proceeding to general response")
    
    return state

def find_teaching_material(state: GraphState) -> GraphState:
    """Find relevant teaching material for the doubt"""
    logger.info(f"Finding teaching material for topic: {state['doubt_topic']}")
    
    # Extract relevant info
    topic = state["doubt_topic"]
    level = state["doubt_level"]
    latest_message = state["messages"][-1]["content"] if state["messages"] else ""
    
    # Teaching material search prompt
    teaching_material_prompt = ChatPromptTemplate.from_messages([
        SystemMessage(content="""You are an educational resource finder that helps match
        student doubts to appropriate teaching materials. Based on the doubt topic and level,
        suggest a specific teaching page URL from our platform."""),
        HumanMessage(content=f"""
        Student doubt: {latest_message}
        Topic: {topic}
        Level: {level}
        
        Return the suggested teaching page URL in this format:
        URL: /teaching/[appropriate-page-path]
        """)
    ])
    
    # Run the material search chain
    chain = teaching_material_prompt | model | StrOutputParser()
    result = chain.invoke({})
    
    # Extract URL
    teaching_url = None
    if "url:" in result.lower():
        url_part = result.lower().split("url:")[1].strip()
        teaching_url = url_part if url_part else "/teaching/general"
    else:
        teaching_url = "/teaching/general"  # Default fallback
    
    # Update state
    state["teaching_page_url"] = teaching_url
    logger.info(f"Found teaching material: {teaching_url}")
    
    # Always go to response generation next
    state["next"] = "generate_response"
    
    return state

def general_response(state: GraphState) -> GraphState:
    """Generate a general response for non-doubt questions"""
    logger.info("Generating general response")
    
    latest_message = state["messages"][-1]["content"] if state["messages"] else ""
    
    # General response prompt
    general_response_prompt = ChatPromptTemplate.from_messages([
        SystemMessage(content="""You are Rox, a helpful educational AI assistant. 
        Provide a friendly, concise response to the student's message that doesn't
        appear to be asking for teaching help."""),
        HumanMessage(content=f"Student message: {latest_message}")
    ])
    
    # Generate response
    chain = general_response_prompt | model | StrOutputParser()
    response = chain.invoke({})
    
    # Add AI message to state
    state["messages"].append({"role": "assistant", "content": response})
    logger.info(f"Generated general response: {response[:50]}...")
    
    # Mark as done
    state["next"] = END
    
    return state

def generate_response(state: GraphState) -> GraphState:
    """Generate a response with teaching material redirect"""
    logger.info("Generating response with teaching material redirect")
    
    latest_message = state["messages"][-1]["content"] if state["messages"] else ""
    topic = state["doubt_topic"]
    teaching_url = state["teaching_page_url"]
    
    # Response prompt
    response_prompt = ChatPromptTemplate.from_messages([
        SystemMessage(content="""You are Rox, a helpful educational AI assistant.
        The student has asked a doubt that requires teaching material. Provide a friendly,
        helpful response that acknowledges their question and directs them to the
        teaching material we've identified."""),
        HumanMessage(content=f"""
        Student doubt: {latest_message}
        Topic: {topic}
        Teaching material URL: {teaching_url}
        
        Craft a response that:
        1. Acknowledges their doubt
        2. Briefly addresses their question in 1-2 sentences
        3. Directs them to the teaching material with a clickable link
        4. Encourages them to ask follow-up questions after reviewing the material
        """)
    ])
    
    # Generate response
    chain = response_prompt | model | StrOutputParser()
    response = chain.invoke({})
    
    # Add AI message to state
    state["messages"].append({"role": "assistant", "content": response})
    logger.info(f"Generated response with redirect: {response[:50]}...")
    
    # Mark as done
    state["next"] = END
    
    return state

# Build the graph
def build_doubt_handling_graph():
    """Build and return the doubt handling workflow graph"""
    # Initialize the graph
    workflow = StateGraph(GraphState)
    
    # Add nodes
    workflow.add_node("analyze_doubt", analyze_doubt)
    workflow.add_node("find_teaching_material", find_teaching_material)
    workflow.add_node("general_response", general_response)
    workflow.add_node("generate_response", generate_response)
    
    # Set entry point
    workflow.set_entry_point("analyze_doubt")
    
    # Add conditional edges based on the "next" field
    workflow.add_conditional_edges(
        "analyze_doubt",
        lambda state: state["next"],
        {
            "find_teaching_material": "find_teaching_material",
            "general_response": "general_response"
        }
    )
    
    # Add simple edge
    workflow.add_edge("find_teaching_material", "generate_response")
    
    # Compile the graph
    return workflow.compile()

# Memory checkpoints for persistent conversation state
def get_memory_checkpoint(student_id: str):
    """Get a memory checkpoint for a specific student"""
    return MemoryCheckpoint(f"student_{student_id}")

# Main entry point function to process student doubts
async def process_student_doubt(student_id: str, message_content: str):
    """
    Process a student doubt coming from push-to-talk
    
    Args:
        student_id: The ID of the student
        message_content: The transcribed content of the student's message
        
    Returns:
        Dict with response and teaching material URL if applicable
    """
    logger.info(f"Processing doubt for student {student_id}: {message_content[:50]}...")
    
    # Create the graph
    graph = build_doubt_handling_graph()
    
    # Get checkpoint for this student
    memory = get_memory_checkpoint(student_id)
    
    # Create initial state
    initial_state = {
        "messages": [{"role": "user", "content": message_content}],
        "next": None,
        "student_id": student_id,
        "doubt_topic": None,
        "teaching_page_url": None,
        "doubt_level": None,
        "is_doubt": False
    }
    
    # Process through the graph
    result = await graph.ainvoke(initial_state, {"checkpoint": memory})
    
    # Format response
    response = {
        "message": result["messages"][-1]["content"] if result["messages"] else "I couldn't process your question. Please try again.",
        "is_doubt": result["is_doubt"],
        "teaching_page_url": result["teaching_page_url"] if result["is_doubt"] else None
    }
    
    logger.info(f"Doubt processing complete. Is doubt: {response['is_doubt']}, Teaching page: {response.get('teaching_page_url', 'None')}")
    return response
