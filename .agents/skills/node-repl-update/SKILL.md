# Node REPL Update

Use this workflow when refreshing the vendored `desktop/resources/node_repl.exe` fallback.

## Rules

- Use only the official Microsoft Store Codex package with product ID `9PLM9XGG6VKS`.
- Run the update from `desktop/` with `npm run update:node-repl`.
- Do not use arbitrary local paths, copied WindowsApps folders, appcast artifacts, GitHub release assets, npm packages, or non-Store sources for `node_repl.exe`.
- If the updater installs the Store package because it was missing, it must uninstall that package after copying the fallback.
- Keep changes focused to the vendored fallback, metadata, inventory documentation, and the updater workflow.

## Validation

After the update, validate:

```powershell
node -e "JSON.parse(require('fs').readFileSync('desktop/resources/node_repl.json','utf8')); console.log('node_repl.json ok')"
node -e "const fs=require('fs'); const b=fs.readFileSync('desktop/resources/node_repl.exe'); const o=b.readUInt32LE(0x3c); if(b.toString('ascii',0,2)!=='MZ'||b.toString('ascii',o,o+4)!=='PE\\0\\0'||b.readUInt16LE(o+4)!==0x8664) process.exit(1); console.log('node_repl.exe PE x64 ok')"
git diff --check
```

If the binary or metadata changed, update `docs/executable-inventory.md` with the current package identity and SHA-256, then commit, push, and open or update the PR.
