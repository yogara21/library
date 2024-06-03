const express = require('express')
const app = express()
const port = 3000

const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Library API',
      version: '1.0.0',
      description: 'A simple Express Library API',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
  },
  apis: ['./routes/*.js'], // path to the API docs
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

//import body parser
const bodyParser = require('body-parser')

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

//route loans
const loansRouter = require('./routes/loans');
app.use('/api/loans', loansRouter); // use route loans di Express

//route books
const booksRouter = require('./routes/books');
app.use('/api/books', booksRouter); // use route books di Express

//route members
const membersRouter = require('./routes/members');
app.use('/api/members', membersRouter); // use route members di Express

app.listen(port, () => {
  console.log(`app running at http://localhost:${port}`)
})