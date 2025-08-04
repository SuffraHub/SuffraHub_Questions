const express = require('express')
const app = express()
const port = 8003
const mysql = require('mysql');
const cors = require('cors');

require('dotenv').config();

app.use(express.json());
app.use(cors());


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

app.get('/getQuestion/:id', (req, res) => {
  const questionId = req.params.id;

  connection.query(
    'SELECT * FROM `questions` WHERE id=?',
    [questionId],
    (err, results) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: 'Question not found' });
      }

      res.json({ questionData: results[0] });
    }
  );
});

app.get('/getOptions/:questionId', (req, res) => {
  const questionId = req.params.questionId;

  connection.query('SELECT * FROM `questions_options` JOIN options ON option_id=options.id WHERE question_id=?',
    [questionId],
    (err, results) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: 'Question not found' });
      }

      res.json({ options: results });
    }
  )
});

app.post('/createQuestion', (req, res) => {
    const { question, description, hidden, user_id } = req.body;

    if (!question || !description || hidden === undefined || !user_id) {
        return res.status(400).json({ message: 'Required field not provided' });
    }

    const query = `
        INSERT INTO questions (question, description, hidden, user_id)
        VALUES (?, ?, ?, ?, ?)
    `;

    connection.query(query, [question, description, hidden, user_id], (err, result) => {
        if (err) {
            console.error('MySQL error:', err);
            return res.status(500).json({ message: 'Question creation failed' });
        }

        return res.status(201).json({ message: 'Question created' });
    });
});

app.put('/editQuestion', (req, res) => {
  const { id, question, company_id, description, hidden } = req.body;

  if (!id || !question || !company_id || !description || hidden === undefined) {
    return res.status(400).json({ message: 'Required field not provided' });
  }

  const query = `
    UPDATE questions
    SET question = ?, company_id = ?, description = ?, hidden = ?
    WHERE id = ?
  `;

  const values = [question, company_id, description, hidden, id];

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




app.delete('/deleteQuestion', (req, res) => {
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

app.get('/getAllQuestions/:pollId', (req, res) => {
  const pollId = req.params.pollId;

  const query = `
    SELECT 
      q.id AS question_id,
      q.question,
      q.description,
      o.id AS option_id,
      o.label,
      pq.sort_order
    FROM poll_questions pq
    JOIN questions q ON pq.question_id = q.id
    LEFT JOIN questions_options qo ON q.id = qo.question_id
    LEFT JOIN options o ON qo.option_id = o.id
    WHERE pq.poll_id = ?
    ORDER BY pq.sort_order ASC, o.id ASC
  `;

  connection.query(query, [pollId], (err, results) => {
    if (err) {
      console.error('MySQL error:', err);
      return res.status(500).json({ message: 'Failed to fetch questions' });
    }

    const questionsMap = {};

    results.forEach(row => {
      if (!questionsMap[row.question_id]) {
        questionsMap[row.question_id] = {
          question_id: row.question_id,
          question: row.question,
          description: row.description,
          sort_order: row.sort_order,
          options: []
        };
      }

      if (row.option_id) {
        questionsMap[row.question_id].options.push({
          option_id: row.option_id,
          label: row.label
        });
      }
    });

    const questions = Object.values(questionsMap);

    return res.status(200).json({ questions });
  });
});

app.post('/assignQuestionsToPoll', (req, res) => {
  const { pollId, questions } = req.body;

  if (!pollId || !Array.isArray(questions)) {
    return res.status(400).json({ message: 'Invalid payload' });
  }

  const values = questions.map((q, idx) => [pollId, q.question_id, 0, idx]);

  const query = `
    INSERT INTO poll_questions (poll_id, question_id, is_draft, sort_order)
    VALUES ?
    ON DUPLICATE KEY UPDATE sort_order=VALUES(sort_order)
  `;

  connection.query(query, [values], (err) => {
    if (err) {
      console.error('MySQL error:', err);
      return res.status(500).json({ message: 'Assignment failed' });
    }

    return res.status(200).json({ message: 'Questions assigned to poll' });
  });
});

app.delete('/unassignQuestionFromPoll', (req, res) => {
  const { pollId, questionId } = req.body;

  if (!pollId || !questionId) {
    return res.status(400).json({ message: 'Missing pollId or questionId' });
  }

  const query = `DELETE FROM poll_questions WHERE poll_id = ? AND question_id = ?`;

  connection.query(query, [pollId, questionId], (err, result) => {
    if (err) {
      console.error('MySQL error:', err);
      return res.status(500).json({ message: 'Unassignment failed' });
    }

    return res.status(200).json({ message: 'Question unassigned from poll' });
  });
});


app.get('/getTenantQuestions/:companyId', (req, res) => {
  const companyId = req.params.companyId;

  if (!companyId) {
    return res.status(400).json({ message: 'Company ID is required' });
  }

  const query = `
    SELECT 
      q.id AS question_id,
      q.question,
      q.description,
      q.hidden,
      q.user_id,
      q.company_id
    FROM questions q
    WHERE q.company_id = ?
  `;

  connection.query(query, [companyId], (err, results) => {
    if (err) {
      console.error('MySQL error:', err);
      return res.status(500).json({ message: 'Failed to fetch tenant questions' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'No questions found for this tenant' });
    }

    return res.status(200).json({ questions: results });
  });
});



app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

