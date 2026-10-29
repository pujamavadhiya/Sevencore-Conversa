"""
Sarvam Call History & Transcript Pipeline.
Keeps single calls and batch campaigns strictly separated.
"""
from backend.sarvam_history import *

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("sarvam_history:app", host="0.0.0.0", port=8003, reload=True)

