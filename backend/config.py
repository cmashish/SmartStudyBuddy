import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()


def load_config():
    """Load backend configuration using the backend project directory as root."""
    root = Path(__file__).resolve().parent
    configured_notes = os.getenv("NOTES_DIR")

    if configured_notes:
        notes = Path(configured_notes).expanduser()
        if not notes.is_absolute():
            notes = root / notes
    else:
        notes = root / "input_lecture_notes"

    return {
        "ROOT_DIR": str(root),
        "NOTES_DIR": str(notes.resolve()),
    }
