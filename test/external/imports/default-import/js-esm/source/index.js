// /source/index.js
// Run the server

import app from './app.js'

app.listen(8080, () =>
	console.log('Make a GET request to http://localhost:8080!'),
)
