compile:
	bun build ./src/index.ts --compile --outfile ./release/metax

bundle:
	make compile && tar -czf ./release/metax.tar.gz ./release/metax