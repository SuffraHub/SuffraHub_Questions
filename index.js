const express = require('express')
const app = express()
const port = 8003
const mysql = require('mysql');
require('dotenv').config();

app.use(express.json());

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
});

connection.connect(err => {
  if (err) {
    console.error('DB connection error:', err.stack);
    return;
  }
  console.log('Connected to MySQL');
});

app.get('/', (req, res) => {
  res.send('Hello World! from questions API')
})

app.post('/createQuestion', (req, res) => {
    const { question, company_id, description, hidden, user_id } = req.body;

    if (!question || !company_id || !description || hidden === undefined || !user_id) {
        return res.status(400).json({ message: 'Required field not provided' });
    }

    const query = `
        INSERT INTO questions (question, company_id, description, hidden, user_id)
        VALUES (?, ?, ?, ?, ?)
    `;

    connection.query(query, [question, company_id, description, hidden, user_id], (err, result) => {
        if (err) {
            console.error('MySQL error:', err);
            return res.status(500).json({ message: 'Question creation failed' });
        }

        return res.status(201).json({ message: 'Question created' });
    });
});

app.post('/editQuestion', (req, res) => {
  const { id, question, company_id, description, hidden, user_id } = req.body;

  if (!id || !question || !company_id || !description || hidden === undefined || !user_id) {
    return res.status(400).json({ message: 'Required field not provided' });
  }

  const query = `
    UPDATE questions
    SET question = ?, company_id = ?, description = ?, hidden = ?, user_id = ?
    WHERE id = ?
  `;

  const values = [question, company_id, description, hidden, user_id, id];

  connection.query(query, values, (err, result) => {
    if (err) {
      console.error('MySQL error:', err);
      return res.status(500).json({ message: 'Question update failed' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Question not found' });
    }

    return res.status(200).json({ message: 'Question updated successfully' });
  });
});




app.post('/deleteQuestion', (req, res) => {
    const { id } = req.body;

    if (!id) {
        return res.status(400).json({ message: 'Question ID is required' });
    }

    const query = 'DELETE FROM questions WHERE id = ?';

    connection.query(query, [id], (err, result) => {
        if (err) {
            console.error('MySQL error:', err);
            return res.status(500).json({ message: 'Question deletion failed' });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Question not found' });
        }

        return res.status(200).json({ message: 'Question deleted successfully' });
    });
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

