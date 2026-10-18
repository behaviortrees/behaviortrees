"""Checks BT.CPP XML files with the real library (btcpp_check, see check.cpp).

For each file, stand-in nodes come first from the --models files (for Nav2,
Nav2's own nav2_tree_nodes.xml, so port names are checked against Nav2's real
declarations), then from the file's own <TreeNodesModel> for anything left.
Models are read here with the standard library, independently of the
editor's parser.

    check.py --label NAME [--models FILE]... PATH...
"""

import argparse
import os
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET

KINDS = ("Action", "Condition", "Control", "Decorator")
PORTS = {"input_port": "input", "output_port": "output", "inout_port": "inout"}


def model_entries(path):
    """(kind, id, ports) for each node in a file's <TreeNodesModel>."""
    entries = []
    for model in ET.parse(path).getroot().iter("TreeNodesModel"):
        for node in model:
            if node.tag in KINDS and node.get("ID"):
                ports = [f"{PORTS[p.tag]}:{p.get('name')}" for p in node if p.tag in PORTS and p.get("name")]
                entries.append((node.tag, node.get("ID"), ports))
    return entries


def xml_files(paths):
    for path in paths:
        if os.path.isdir(path):
            yield from sorted(os.path.join(path, f) for f in os.listdir(path) if f.endswith(".xml"))
        else:
            yield path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--label", required=True)
    parser.add_argument("--models", action="append", default=[])
    parser.add_argument("paths", nargs="+")
    args = parser.parse_args()

    shared = [entry for path in args.models for entry in model_entries(path)]
    failures = 0
    files = list(xml_files(args.paths))
    print(f"\n== {args.label}: {len(files)} files")

    for path in files:
        seen, lines, own = set(), [], []
        for kind, node_id, ports in shared:
            if node_id not in seen:
                seen.add(node_id)
                lines.append(" ".join([kind, node_id, *ports]))
        for kind, node_id, ports in model_entries(path):
            if node_id not in seen:
                seen.add(node_id)
                own.append(node_id)
                lines.append(" ".join([kind, node_id, *ports]))

        with tempfile.NamedTemporaryFile("w", suffix=".manifest", delete=False) as manifest:
            manifest.write("\n".join(lines) + "\n")
        result = subprocess.run(["/build/btcpp_check", path, manifest.name], capture_output=True, text=True)
        os.unlink(manifest.name)

        name = os.path.basename(path)
        # Nodes only the file itself described: checked against our own model
        note = f"  (own model for: {', '.join(own)})" if own and args.models else ""
        if result.returncode == 0:
            print(f"  ok    {name}{note}")
        else:
            failures += 1
            detail = (result.stdout + result.stderr).strip().replace("\n", " ")
            print(f"  FAIL  {name}{note}\n        {detail}")

    print(f"   {len(files) - failures} passed, {failures} failed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
