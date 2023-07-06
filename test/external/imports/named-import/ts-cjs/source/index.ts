// /source/index.ts
// Run the server

import { app } from './app'

app.listen(8080, () =>
	console.log('Make a GET request to http://localhost:8080!'),
)
