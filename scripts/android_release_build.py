"""Stage web assets, sync Capacitor, and build a signed release AAB for Play Store."""

from __future__ import annotations

import os
import secrets
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ANDROID = ROOT / "android"
KEYSTORE = ANDROID / "countquest-release.keystore"
PROPS = ANDROID / "keystore.properties"
PROPS_EXAMPLE = ANDROID / "keystore.properties.example"
AAB = ANDROID / "app" / "build" / "outputs" / "bundle" / "release" / "app-release.aab"

def gradle_cmd() -> list[str]:
    if sys.platform == "win32":
        return [str(ANDROID / "gradlew.bat"), "bundleRelease"]
    return ["./gradlew", "bundleRelease"]

NODEJS_DIRS = [
    Path(r"C:\Program Files\nodejs"),
    Path(r"C:\Program Files (x86)\nodejs"),
]

KEY_ALIAS = "countquest"
JBR_HOME = Path(r"C:\Program Files\Android\Android Studio\jbr")
KEYTOOL_CANDIDATES = [
    JBR_HOME / "bin" / "keytool.exe",
    JBR_HOME / "bin" / "keytool",
]


def resolve_tool(name: str) -> str:
    found = shutil.which(name)
    if found:
        return found
    if sys.platform == "win32":
        for directory in NODEJS_DIRS:
            candidate = directory / f"{name}.cmd"
            if candidate.is_file():
                return str(candidate)
    raise RuntimeError(f"{name} not found — install Node.js from https://nodejs.org/")


def tool_env() -> dict[str, str]:
    env = os.environ.copy()
    path_parts = [str(directory) for directory in NODEJS_DIRS if directory.is_dir()]
    if JBR_HOME.is_dir():
        if not env.get("JAVA_HOME"):
            env["JAVA_HOME"] = str(JBR_HOME)
        path_parts.insert(0, str(JBR_HOME / "bin"))
    if path_parts:
        env["PATH"] = ";".join(path_parts + [env.get("PATH", "")])
    return env


def run(cmd: list[str], *, cwd: Path | None = None, quiet: bool = False) -> None:
    if quiet:
        print("Running:", cmd[0], "...")
    else:
        print("Running:", " ".join(cmd))
    subprocess.run(cmd, cwd=cwd or ROOT, check=True, env=tool_env())


def find_keytool() -> str:
    java_home = os.environ.get("JAVA_HOME", "")
    if java_home:
        for name in ("keytool.exe", "keytool"):
            candidate = Path(java_home) / "bin" / name
            if candidate.is_file():
                return str(candidate)
    for candidate in KEYTOOL_CANDIDATES:
        if candidate.is_file():
            return str(candidate)
    found = shutil.which("keytool")
    if found:
        return found
    raise RuntimeError("keytool not found — set JAVA_HOME or install Android Studio JBR")


def write_keystore_properties(password: str) -> None:
    PROPS.write_text(
        "\n".join(
            (
                "# Auto-generated for local release builds — do not commit.",
                "storeFile=../countquest-release.keystore",
                f"storePassword={password}",
                f"keyPassword={password}",
                f"keyAlias={KEY_ALIAS}",
                "",
            )
        ),
        encoding="utf-8",
    )


def ensure_release_keystore() -> None:
    if KEYSTORE.is_file() and PROPS.is_file():
        return

    if KEYSTORE.is_file() and not PROPS.is_file():
        raise RuntimeError(
            f"Keystore exists at {KEYSTORE} but {PROPS} is missing. "
            f"Copy {PROPS_EXAMPLE} and fill in your passwords."
        )

    password = secrets.token_urlsafe(24)
    keytool = find_keytool()
    dname = "CN=CountQuest Blackjack, OU=Mobile, O=CountQuest, L=Unknown, ST=Unknown, C=US"
    run(
        [
            keytool,
            "-genkeypair",
            "-v",
            "-keystore",
            str(KEYSTORE),
            "-alias",
            KEY_ALIAS,
            "-keyalg",
            "RSA",
            "-keysize",
            "2048",
            "-validity",
            "10000",
            "-storepass",
            password,
            "-keypass",
            password,
            "-dname",
            dname,
        ],
        quiet=True,
    )
    write_keystore_properties(password)
    print("\nCreated release keystore:", KEYSTORE)
    print("Credentials saved to:", PROPS)
    print("IMPORTANT: Back up the keystore and keystore.properties — Play Store updates need the same key.\n")


def main() -> int:
    if not (ANDROID / "local.properties").is_file():
        print(
            "android/local.properties missing. Create it with sdk.dir= pointing to your Android SDK.",
            file=sys.stderr,
        )
        return 1

    ensure_release_keystore()
    run([sys.executable, "scripts/stage_dist.py"])
    run([resolve_tool("npx"), "cap", "sync"])
    run(gradle_cmd(), cwd=ANDROID)

    if not AAB.is_file():
        print(f"Expected AAB at {AAB} but file was not produced.", file=sys.stderr)
        return 1

    size_kb = AAB.stat().st_size // 1024
    print(f"\nRelease AAB ready ({size_kb} KB):")
    print(f"  {AAB}")
    print("\nUpload app-release.aab to Google Play Console (Release > Production or Testing).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())