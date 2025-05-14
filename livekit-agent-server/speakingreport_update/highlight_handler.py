import os
import json
import asyncio
import logging
import requests
from typing import Dict, List, Any, Optional, Set
import time

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class HighlightHandler:
    """
    Handles the navigation between highlights and communication with the frontend.
    Manages highlight state and controls which highlight is active.
    """
    def __init__(self, frontend_url: str = None):
        self.frontend_url = frontend_url or os.environ.get("FRONTEND_URL", "http://localhost:3000")
        self.highlights = []
        self.current_highlight_id = None
        self.explained_highlights: Set[str] = set()
        self.last_highlights_update = 0
        self.is_processing = False
        
    async def update_highlights(self, highlights: List[Dict[str, Any]]) -> bool:
        """
        Update the stored highlights with a new list.
        
        Args:
            highlights: List of highlight objects
            
        Returns:
            True if highlights were updated, False otherwise
        """
        # Check if the highlights actually changed
        if json.dumps(highlights) == json.dumps(self.highlights):
            return False
            
        self.highlights = highlights
        self.last_highlights_update = time.time()
        logger.info(f"Updated highlights: {len(highlights)} items")
        
        # Reset explained state when new highlights come in
        # (only for highlights that aren't in the new list)
        current_ids = {h.get('id') for h in highlights}
        self.explained_highlights = {hid for hid in self.explained_highlights if hid in current_ids}
        
        return True
        
    def select_highlight(self, highlight_id: str) -> Dict[str, Any]:
        """
        Select a specific highlight in the UI.
        
        Args:
            highlight_id: ID of the highlight to select
            
        Returns:
            Response from the API call
        """
        try:
            logger.info(f"Selecting highlight: {highlight_id}")
            self.current_highlight_id = highlight_id
            
            response = requests.post(
                f"{self.frontend_url}/api/highlight-control",
                json={"highlightId": highlight_id, "action": "select"},
                headers={"Content-Type": "application/json"},
                timeout=5
            )
            
            if response.status_code != 200:
                logger.warning(f"Failed to select highlight: HTTP {response.status_code}")
                return {"success": False, "error": f"HTTP {response.status_code}"}
                
            return response.json()
            
        except Exception as e:
            logger.error(f"Error selecting highlight: {str(e)}")
            return {"success": False, "error": str(e)}
            
    def mark_highlight_explained(self, highlight_id: str) -> None:
        """
        Mark a highlight as explained.
        
        Args:
            highlight_id: ID of the highlight that was explained
        """
        self.explained_highlights.add(highlight_id)
        logger.info(f"Marked highlight {highlight_id} as explained. "
                   f"Progress: {len(self.explained_highlights)}/{len(self.highlights)}")
                   
    def get_next_highlight(self) -> Optional[Dict[str, Any]]:
        """
        Get the next unexplained highlight.
        
        Returns:
            The next highlight object, or None if all are explained
        """
        for highlight in self.highlights:
            highlight_id = highlight.get('id')
            if highlight_id and highlight_id not in self.explained_highlights:
                return highlight
                
        return None
        
    def get_highlight_by_id(self, highlight_id: str) -> Optional[Dict[str, Any]]:
        """
        Find a highlight by its ID.
        
        Args:
            highlight_id: ID of the highlight to find
            
        Returns:
            The highlight object, or None if not found
        """
        for highlight in self.highlights:
            if highlight.get('id') == highlight_id:
                return highlight
                
        return None
        
    def all_highlights_explained(self) -> bool:
        """
        Check if all highlights have been explained.
        
        Returns:
            True if all highlights are explained or there are no highlights
        """
        if not self.highlights:
            return True
            
        return len(self.explained_highlights) >= len(self.highlights)
        
    def get_progress(self) -> Dict[str, Any]:
        """
        Get the current progress.
        
        Returns:
            Dictionary with progress information
        """
        total = len(self.highlights)
        explained = len(self.explained_highlights)
        
        return {
            "total": total,
            "explained": explained,
            "remaining": total - explained,
            "percent_complete": 100 if total == 0 else int((explained / total) * 100)
        }
        
    async def get_current_highlights_from_api(self) -> bool:
        """
        Fetch current highlights from the API.
        
        Returns:
            True if successful, False otherwise
        """
        try:
            api_url = f"{self.frontend_url}/api/get-next-highlight"
            logger.info(f"Fetching highlights from API: {api_url}")
            
            response = requests.get(api_url, timeout=5)
            
            if response.status_code != 200:
                logger.warning(f"Failed to get highlights: HTTP {response.status_code}")
                return False
                
            data = response.json()
            logger.debug(f"API response: {data}")
            
            # Check if the response has the expected format
            if not isinstance(data, dict):
                logger.warning(f"Unexpected API response format: {data}")
                return False
                
            # Extract highlights and active ID with detailed logging
            highlights = data.get('highlights', [])
            logger.info(f"API returned {len(highlights)} highlights")
            
            active_id = data.get('activeHighlightId')
            logger.info(f"Active highlight ID from API: {active_id}")
            
            # Show sample highlight for debugging if available
            if highlights and len(highlights) > 0:
                sample = highlights[0]
                logger.info(f"Sample highlight: ID={sample.get('id')}, Type={sample.get('type')}, Message={sample.get('message')}")
            
            # Update internal highlight state
            if self.update_highlights(highlights):
                logger.info(f"Updated internal highlight state with {len(highlights)} highlights")
            else:
                logger.info("No changes to highlight state")
                
            if active_id:
                self.current_highlight_id = active_id
                logger.info(f"Set current highlight ID to: {active_id}")
                
            return True
            
        except requests.RequestException as e:
            logger.error(f"Network error fetching highlights: {str(e)}")
            return False
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON response from API: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error fetching highlights: {str(e)}")
            return False
