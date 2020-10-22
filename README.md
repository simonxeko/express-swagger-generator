### Express OpenAPI Generator 

This is a forked version supporting OpenAPI 3.0

#### Installation

```
npm i express-swagger-generator --save-dev
```

#### Usage

```
const express = require('express');
const app = express();
const expressSwagger = require('express-swagger-generator')(app);

let options = {
    swaggerDefinition: {
        info: {
            description: 'This is a sample server',
            title: 'Swagger',
            version: '1.0.0',
        },
        host: 'localhost:3000',
        basePath: '/v1',
        produces: [
            "application/json",
            "application/xml"
        ],
        schemes: ['http', 'https'],
		securityDefinitions: {
            JWT: {
                type: 'apiKey',
                in: 'header',
                name: 'Authorization',
                description: "",
            }
        }
    },
    basedir: __dirname, //app absolute path
    files: ['./routes/**/*.js'] //Path to the API handle folder
};
expressSwagger(options)
app.listen(3000);
```

Open http://<app_host>:<app_port>/api-docs in your browser to view the documentation.

#### How to document the API

```
/**
 * This function comment is parsed by doctrine
 * @route GET /api
 * @group foo - Operations about user
 * @param {string} email.query.required - username or email - eg: user@domain
 * @param {string} password.query.required - user's password.
 * @returns {object} 200 - An array of user info
 * @returns {Error}  default - Unexpected error
 */
exports.foo = function() {}
```

For model definitions:

```
/**
 * @typedef Product
 * @property {integer} id
 * @property {string} name.required - Some description for product
 * @property {Array.<Point>} Point
 */

/**
 * @typedef Point
 * @property {integer} x.required
 * @property {integer} y.required - Some description for point - eg: 1234
 * @property {string} color
 * @property {enum} status - Status values that need to be considered for filter - eg: available,pending
 */

/**
 * @typedef Error
 * @property {string} code.required
 */

/**
 * @typedef Response
 * @property {[integer]} code
 */


/**
 * This function comment is parsed by doctrine
 * sdfkjsldfkj
 * @route POST /users
 * @param {Point.model} point.body.required - the new point
 * @group foo - Operations about user
 * @param {string} email.query.required - username or email
 * @param {string} password.query.required - user's password.
 * @param {enum} status.query.required - Status values that need to be considered for filter - eg: available,pending
 * @operationId retrieveFooInfo
 * @produces application/json application/xml
 * @consumes application/json application/xml
 * @returns {Response.model} 200 - An array of user info
 * @returns {Product.model}  default - Unexpected error
 * @returns {Array.<Point>} Point - Some description for point
 * @headers {integer} 200.X-Rate-Limit - calls per hour allowed by the user
 * @headers {string} 200.X-Expires-After - 	date in UTC when token expires
 * @security JWT
 */
```

Supporting input/output examples

Supporting union types
```
 /**
 * @route POST /test/union_input
 * @input_example input - Dog - eg: {"a":5,"b":6,"woof":"1"}
 * @input_example input - Cat - eg: {"a":5,"b":6,"meow":"2"}
 * @param {Cat|Dog} input.body.required
 */

 /**
 * @route POST /test/union_output
 * @output_example 200 - Cat - eg: {"a":1,"b":2,"woof":"1"}
 * @output_example 200 - Dog - eg: {"a":3,"b":4,"meow":"2"}
 * @returns {Cat|Dog} 200 - Cat or dog
 */

 /**
  * @typedef Pet
  * @property {string} name - Name - eg: Sys
  * @property {string} objectType - Object type to differ class types
  */

 /**
  * @typedef {Pet} Dog
  * @property {string} woof - M - eg: woof
  */

 /**
  * @typedef {Pet} Cat
  * @property {string} meow - M - eg: meow
  */
```

Supporting intersection types
```
 /**
 * @typedef {Pet&Dog} DogWithName
 */
```

#### More

This module is based on [express-swaggerize-ui](https://github.com/pgroot/express-swaggerize-ui) and [Doctrine-File](https://github.com/researchgate/doctrine-file)