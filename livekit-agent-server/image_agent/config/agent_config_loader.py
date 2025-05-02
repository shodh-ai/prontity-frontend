"""
Agent Configuration Loader Module

This module handles loading, parsing, and validating YAML-based agent persona configurations.
It provides functions to retrieve persona configurations based on various criteria
such as page path, identity, or specific requirements.
"""

import os
import yaml
import logging
from typing import Dict, List, Any, Optional, Set, Union
from pathlib import Path

logger = logging.getLogger(__name__)

# Base directory for all persona configurations
PERSONAS_DIR = Path(__file__).parent / "personas"

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


def load_persona_config(config_id: str) -> Optional[PersonaConfig]:
    """
    Load a specific persona configuration by ID.
    
    Args:
        config_id: The identifier for the persona configuration
        
    Returns:
        PersonaConfig object if found, None otherwise
    """
    # First, try to load by exact filename match
    config_path = PERSONAS_DIR / f"{config_id}.yaml"
    if config_path.exists():
        return _load_config_from_file(config_path)
    
    # If not found, search by identity value in all configs
    for config_file in PERSONAS_DIR.glob("*.yaml"):
        try:
            with open(config_file, 'r') as f:
                config_data = yaml.safe_load(f)
                if config_data.get('identity') == config_id:
                    return PersonaConfig(config_data, file_path=str(config_file))
        except Exception as e:
            logger.error(f"Error loading {config_file}: {str(e)}")
    
    return None


def load_persona_for_page(page_path: str) -> PersonaConfig:
    """
    Load the appropriate persona configuration for a given page path.
    
    Args:
        page_path: The path of the page (e.g., 'speakingpage', 'vocabpage')
        
    Returns:
        PersonaConfig: The most appropriate persona configuration
    """
    # Normalize the page path
    page_path = page_path.lower().strip().replace('/', '')
    
    # Find persona files that might be appropriate
    matching_configs = []
    
    # First, check for exact matches by filename
    exact_path_match = PERSONAS_DIR / f"{page_path}.yaml"
    if exact_path_match.exists():
        config = _load_config_from_file(exact_path_match)
        if config:
            return config
    
    # Next, check page-specific configurations by convention
    # For example: speaking_teacher_default.yaml for "speakingpage"
    prefix = page_path.replace('page', '') # Convert "speakingpage" -> "speaking"
    
    for config_file in PERSONAS_DIR.glob(f"{prefix}_*.yaml"):
        config = _load_config_from_file(config_file)
        if config:
            matching_configs.append(config)
    
    # If no exact matches, look for configs that list this page in supported_pages
    if not matching_configs:
        for config_file in PERSONAS_DIR.glob("*.yaml"):
            config = _load_config_from_file(config_file)
            if config and (page_path in config.supported_pages):
                matching_configs.append(config)
    
    # If still no matches, use default
    if not matching_configs:
        default_config = load_persona_config("default")
        if default_config:
            logger.info(f"No specific persona found for '{page_path}', using default")
            return default_config
        else:
            logger.warning(f"No persona configurations found, including default")
            # Create minimal default config
            return PersonaConfig({
                'identity': 'minimal-default',
                'instructions': 'You are a helpful TOEFL practice assistant.'
            })
    
    # Return the first match (in the future, could implement more selection logic)
    logger.info(f"Found {len(matching_configs)} persona configs for '{page_path}', using {matching_configs[0].identity}")
    return matching_configs[0]


def _load_config_from_file(file_path: Union[str, Path]) -> Optional[PersonaConfig]:
    """
    Load a configuration from a file path.
    
    Args:
        file_path: Path to the YAML configuration file
        
    Returns:
        PersonaConfig if successful, None if error
    """
    try:
        with open(file_path, 'r') as f:
            config_data = yaml.safe_load(f)
            if not config_data:
                logger.error(f"Empty or invalid YAML in {file_path}")
                return None
                
            return PersonaConfig(config_data, file_path=str(file_path))
    except Exception as e:
        logger.error(f"Error loading config from {file_path}: {str(e)}")
        return None


def list_available_personas() -> List[Dict[str, Any]]:
    """
    List all available persona configurations.
    
    Returns:
        List of dictionaries with basic persona information
    """
    personas = []
    for config_file in PERSONAS_DIR.glob("*.yaml"):
        try:
            config = _load_config_from_file(config_file)
            if config:
                personas.append({
                    'identity': config.identity,
                    'description': config.description,
                    'file': config_file.name,
                    'tools_count': len(config.allowed_tools)
                })
        except Exception as e:
            logger.error(f"Error listing {config_file}: {str(e)}")
    
    return personas
