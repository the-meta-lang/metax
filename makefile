compile:
	bun build ./src/index.ts --compile --outfile ./bin/metax-linux-x64/metax

bundle:
	make compile && (cd bin/ && rm ../release/metax-linux-x64.zip && zip -r ../release/metax-linux-x64.zip ./metax-linux-x64/metax)