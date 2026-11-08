Quick setup for backend (VS Code)

1. Create and activate a virtual environment (Windows PowerShell):

   python -m venv .venv
   .\.venv\Scripts\Activate.ps1

2. Install dependencies:

   pip install -r requirements.txt

3. In VS Code: set the Python interpreter to the environment you just activated.
   - Command Palette -> Python: Select Interpreter -> Choose the `.venv` interpreter

4. Run the app:

   uvicorn main:app --reload

Notes:
- If VS Code still reports "Import could not be resolved", ensure you've selected the right interpreter and that packages are installed in that interpreter's environment.
- If you prefer conda, create a conda env and install the same packages.
