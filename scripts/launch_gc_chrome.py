import subprocess
import os
import sys
import signal
import time

# 1) Kill all running Chrome processes
#    WARNING: This closes *all* Chrome windows
os.system('taskkill /F /IM chrome.exe 2>nul')

# 2) Wait a moment to ensure processes are gone
time.sleep(1)

# 3) Path to Chrome
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
if not os.path.isfile(CHROME_PATH):
    print("Chrome not found at:", CHROME_PATH)
    sys.exit(1)

# 4) A new, empty user-data-dir so Chrome won't reuse an existing process
USER_DATA_DIR = r"C:\Temp\ChromeDebugProfile"
os.makedirs(USER_DATA_DIR, exist_ok=True)

# 5) URL to open
TARGET_URL = "http://localhost:3000"  # or your app URL / instagram

# 6) Build the full command string
cmd = (
    f'"{CHROME_PATH}" '
    f'--user-data-dir="{USER_DATA_DIR}" '
    f'--js-flags="--expose-gc" '
    f'--enable-precise-memory-info '
    f'--disable-background-timer-throttling '
    f'--disable-renderer-backgrounding '
    f'--no-sandbox '
    f'--new-window '
    f'"{TARGET_URL}"'
)

# 7) Launch via shell so quoting is respected
subprocess.Popen(cmd, shell=True)
