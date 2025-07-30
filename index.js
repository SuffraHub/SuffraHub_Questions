const express = require('express')
const app = express()
const port = 8003

app.get('/', (req, res) => {
  res.send('Hello World! from questions API')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

