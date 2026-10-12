import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

ROOT_DIR = Path(__file__).resolve().parent


def load_config():
    notes_dir = Path(os.getenv("NOTES_DIR", str(ROOT_DIR / "input_lecture_notes")))
    upload_dir = Path(os.getenv("UPLOAD_DIR", str(ROOT_DIR / "data" / "uploads")))
    data_dir = Path(os.getenv("DATA_DIR", str(ROOT_DIR / "data")))
    index_path = Path(os.getenv("INDEX_PATH", str(data_dir / "rag_index.pkl")))

    if not notes_dir.is_absolute():
        notes_dir = ROOT_DIR / notes_dir
    if not upload_dir.is_absolute():
        upload_dir = ROOT_DIR / upload_dir
    if not data_dir.is_absolute():
        data_dir = ROOT_DIR / data_dir
    if not index_path.is_absolute():
        index_path = ROOT_DIR / index_path

    upload_dir.mkdir(parents=True, exist_ok=True)
    data_dir.mkdir(parents=True, exist_ok=True)

    return {
        "ROOT_DIR": str(ROOT_DIR),
        "NOTES_DIR": str(notes_dir),
        "UPLOAD_DIR": str(upload_dir),
        "DATA_DIR": str(data_dir),
        "INDEX_PATH": str(index_path),
    }
