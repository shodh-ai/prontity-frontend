"""
Agent Configuration Loader

This module handles loading, parsing, and validating YAML-based agent persona configurations.
It provides functions to retrieve persona configurations and associated tools based on 
page path or persona identity.
"""

import os
import yaml
import logging
from typing import Dict, List, Any, Optional, Set, Union
from pathlib import Path
from functools import lru_cache

# Import this later to avoid circular imports
# from tool_definitions import TOOL_DEFINITIONS

logger = logging.getLogger(__name__)

# Base directory for all persona configurations
PERSONAS_DIR = Path(__file__).parent / "config" / "personas"

# Cache of loaded persona configurations
_PERSONA_CACHE = {}

class PersonaConfig:
    """Represents a parsed and validated persona configuration."""
    
    def __init__(self, 
                config_data: Dict[str, Any], 
                persona_id: Optional[str] = None,
                file_path: Optional[str] = None):
        """
        Initialize a PersonaConfig from parsed YAML data.
        
        Args:
            config_data: Dictionary of configuration values from YAML
            persona_id: Optional identifier for the persona (defaults to value in config)
            file_path: Optional path to the source YAML file
        """
        self.raw_config = config_data
        self.file_path = file_path
        
        # Core properties
        self.identity = persona_id or config_data.get('identity', 'unknown-persona')
        self.description = config_data.get('description', 'No description provided')
        self.instructions = config_data.get('instructions', '')
        
        # Generation parameters
        self.parameters = config_data.get('parameters', {})
        self.temperature = self.parameters.get('temperature', 0.7)
        
        # Voice settings
        self.voice = config_data.get('voice', 'Puck')  # Default to Puck for Gemini
        
        # Tools configuration
        self.allowed_tools = config_data.get('allowed_tools', [])
        
        # Page paths this persona can be used with
        self.supported_pages = config_data.get('supported_pages', [])

    def __repr__(self) -> str:
        """Return string representation of PersonaConfig."""
        return f"PersonaConfig(identity='{self.identity}', tools={len(self.allowed_tools)})"
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert PersonaConfig to a dictionary for serialization."""
        return {
            'identity': self.identity,
            'description': self.description,
            'instructions': self.instructions,
            'parameters': self.parameters,
            'voice': self.voice,
            'allowed_tools': self.allowed_tools,
            'supported_pages': self.supported_pages
        }


@lru_cache(maxsize=32)
def _load_personas() -> Dict[str, PersonaConfig]:
    """
    Load all persona configurations from the personas directory.
    
    Returns:
        Dictionary mapping persona identity to PersonaConfig object
    """
    personas = {}
    
    # Ensure the personas directory exists
    if not PERSONAS_DIR.exists():
        logger.warning(f"Personas directory not found: {PERSONAS_DIR}")
        return personas
    
    # Load all YAML files in the directory
    for config_file in PERSONAS_DIR.glob("*.yaml"):
        try:
            with open(config_file, 'r') as f:
                config_data = yaml.safe_load(f)
                if not config_data:
                    logger.error(f"Empty or invalid YAML in {config_file}")
                    continue
                    
                config = PersonaConfig(config_data, file_path=str(config_file))
                personas[config.identity] = config
                logger.debug(f"Loaded persona config: {config.identity} from {config_file}")
        except Exception as e:
            logger.error(f"Error loading config from {config_file}: {str(e)}")
    
    logger.info(f"Loaded {len(personas)} persona configurations")
    return personas


def get_persona_config_by_identity(identity: str) -> Optional[PersonaConfig]:
    """
    Get a persona configuration by its identity.
    
    Args:
        identity: The identity of the persona to retrieve
        
    Returns:
        PersonaConfig if found, None otherwise
    """
    # Load all personas if not already loaded
    personas = _load_personas()
    
    # Return the requested persona
    if identity in personas:
        return personas[identity]
    
    logger.warning(f"Persona '{identity}' not found")
    return None


def get_persona_config_for_page(page_path: str) -> PersonaConfig:
    """
    Get the appropriate persona configuration for a page path.
    
    Args:
        page_path: The path or type of page (e.g., 'speakingpage', 'vocabpage')
        
    Returns:
        The appropriate PersonaConfig, or a default if none found
    """
    # Handle None values
    if page_path is None:
        logger.warning("No page path provided, using 'vocabpage' as default")
        page_path = 'vocabpage'
        
    # Normalize the page path
    page_path = page_path.lower().strip().replace('/', '')
    
    # Load all personas
    personas = _load_personas()
    
    # First, look for an exact match by removing 'page' suffix
    # Convert: 'speakingpage' -> 'speaking'
    base_name = page_path.replace('page', '')
    
    # Try both hyphenated and underscore patterns for maximum compatibility
    # e.g., "speaking-teacher-default" and "speaking_teacher_default"
    patterns = [
        f"{base_name}-teacher-default",  # hyphenated version
        f"{base_name}_teacher_default",  # underscore version
    ]
    
    # Try all patterns
    for pattern in patterns:
        if pattern in personas:
            logger.info(f"Found {pattern} persona for page {page_path}")
            return personas[pattern]
    
    # Try direct name match (e.g., 'speaking' or 'vocab')
    if base_name in personas:
        logger.info(f"Found direct match persona {base_name} for page {page_path}")
        return personas[base_name]
    
    # Special case for speakingpage and speaking - we specifically want the speaking teacher
    if base_name in ['speaking'] or page_path in ['speakingpage', 'speaking']:
        speaking_teacher = 'speaking-teacher-default'
        if speaking_teacher in personas:
            logger.info(f"Using {speaking_teacher} for {page_path} (special case mapping)")
            return personas[speaking_teacher]
            
    # Special case for vocabpage and vocab - we specifically want the vocab teacher
    if base_name in ['vocab'] or page_path in ['vocabpage', 'vocabulary']:
        vocab_teacher = 'vocab-teacher-default'
        if vocab_teacher in personas:
            logger.info(f"Using {vocab_teacher} for {page_path} (special case mapping)")
            return personas[vocab_teacher]
    
    # Try looking through all personas for supported_pages that include this page
    for identity, persona in personas.items():
        if page_path in persona.supported_pages or base_name in persona.supported_pages:
            logger.info(f"Found persona {identity} supporting page {page_path}")
            return persona
    
    # If nothing found, return default
    if 'default-assistant' in personas:
        logger.info(f"No specific persona for {page_path}, using default-assistant")
        return personas['default-assistant']
    
    # Last resort - create a minimal default
    logger.warning(f"No suitable persona found for {page_path}, creating minimal default")
    return PersonaConfig({
        'identity': 'minimal-default',
        'description': 'Minimal default persona',
        'instructions': 'You are a helpful TOEFL practice assistant.'
    })


def get_tools_for_identity(identity: str) -> List[Any]:
    """
    Get the list of tool function declarations for a persona identity.
    
    Args:
        identity: The identity of the persona
        
    Returns:
        List of FunctionDeclaration objects ready for Gemini
    """
    # Import here to avoid circular import
    from tool_definitions import TOOL_DEFINITIONS
    
    # Get the persona config
    persona = get_persona_config_by_identity(identity)
    if not persona:
        logger.warning(f"No persona found for identity: {identity}, returning empty tools list")
        return []
    
    # Map the allowed tool names to their FunctionDeclaration objects
    tools = []
    for tool_name in persona.allowed_tools:
        if tool_name in TOOL_DEFINITIONS:
            tools.append(TOOL_DEFINITIONS[tool_name])
        else:
            logger.warning(f"Tool '{tool_name}' not found in TOOL_DEFINITIONS")
    
    logger.info(f"Persona {identity} has {len(tools)} tools: {persona.allowed_tools}")
    return tools


def list_available_personas() -> List[Dict[str, Any]]:
    """
    List all available persona configurations.
    
    Returns:
        List of dictionaries with basic persona information
    """
    personas = _load_personas()
    return [
        {
            'identity': persona.identity,
            'description': persona.description,
            'file': persona.file_path,
            'tools_count': len(persona.allowed_tools)
        }
        for persona in personas.values()
    ]
