# Upstream Codex inspection artifacts

Do not commit extracted upstream Codex application bundles or package contents to this repository. This includes minified or recovered JavaScript, source maps, ASAR archives, and decompiled output.

Keep extracted artifacts outside the repository and use them only for local inspection. Repository documentation may retain compact provenance and findings such as the upstream version, package and archive identifiers, entry names, sizes, hashes, selector ownership, and relevant DOM structure.

The root `.gitignore` blocks the common extracted bundle formats under this directory. Do not force-add them.
