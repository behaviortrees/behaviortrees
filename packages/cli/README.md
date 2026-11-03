# behaviortrees

Validate, convert and share behavior trees from the command line or any MCP client. It uses the same code as the free visual editor at [behaviortrees.com](https://www.behaviortrees.com), so what it accepts, the editor opens.

- **Validate** behavior3 JSON and BehaviorTree.CPP XML: dangling children, nodes with two parents, cycles, decorators with more than one child, leaves with children, unknown node names.
- **Convert** between behavior3 JSON and BehaviorTree.CPP XML (v4 for ROS 2 Jazzy and Groot2, v3 for ROS 2 Humble).
- **Link**: turn a tree into a URL that opens it in the editor, laid out and editable. The tree travels inside the link, so nothing is uploaded.

## CLI

```sh
npx behaviortrees validate tree.json
npx behaviortrees convert tree.json --to btcpp-v4 -o tree.xml
npx behaviortrees convert nav2_tree.xml --to behavior3
npx behaviortrees link tree.json --open
npx behaviortrees nodes            # built-in node types
npx behaviortrees examples         # example trees; add an id to print one
npx behaviortrees guides           # behaviortrees.com guides; add a slug to read one
```

Leave out the file, or pass `-`, to read from stdin. `--json` gives machine-readable output, and `validate` exits with status 1 when a tree has errors, so it works in CI.

## MCP server

Lets an AI assistant write a behavior tree, check it, and hand you a link that opens it in the editor. Tools: `validate_tree`, `create_editor_link`, `convert_tree`, `list_node_types`, `get_example`, `read_guide`.

Remote, nothing to install (Streamable HTTP):

```
https://www.behaviortrees.com/mcp
```

Or run it locally over stdio:

```json
{
  "mcpServers": {
    "behaviortrees": { "command": "npx", "args": ["-y", "behaviortrees", "mcp"] }
  }
}
```

For Claude Code: `claude mcp add --transport http behaviortrees https://www.behaviortrees.com/mcp`

## Tree format

A minimal behavior3 tree. Positions are optional; the editor lays the tree out.

```json
{
  "title": "Guard",
  "root": "a",
  "nodes": {
    "a": { "name": "Priority", "children": ["b", "c"] },
    "b": { "name": "Sequence", "children": ["d", "e"] },
    "c": { "name": "Patrol" },
    "d": { "name": "IsEnemyVisible" },
    "e": { "name": "Attack" }
  },
  "custom_nodes": [
    { "name": "IsEnemyVisible", "category": "condition" },
    { "name": "Attack", "category": "action" },
    { "name": "Patrol", "category": "action" }
  ]
}
```

Composites list `children` in run order, decorators have one `child`, and anything else is a leaf. `Priority` is behavior3's selector (fallback). Declare any node that isn't built in under `custom_nodes`.

## Library

```js
import { validateTree, convertTree, createEditorLink } from 'behaviortrees';

const { valid, findings } = await validateTree(json);
const { output } = await convertTree(json, 'btcpp-v4');
const { url } = await createEditorLink(json);
```

## License

AGPL-3.0-only (see LICENSE). Portions are derived from the MIT-licensed [behavior3editor](https://github.com/behavior3/behavior3editor) by Renato de Pontes Pereira (see LICENSE-MIT). Source: [github.com/behaviortrees/behaviortrees](https://github.com/behaviortrees/behaviortrees/tree/main/packages/cli).
