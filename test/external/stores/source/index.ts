// /source/index.ts
// Run the server

import app from './mongo-store.js'

app.listen(8080, () =>
	console.log('Make a GET request to http://localhost:8080!'),
)
