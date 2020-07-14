var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/', function(req, res, next) {
    res.send('respond with a resource');
});


/**
 * JSON parameters require a model. This one just has "name"
 * @typedef ReqNameJSON
 * @property {string} name.required - name of person making request - eg: John Doe
 */
/**
 * This route will respond greetings to name in json request body.
 * @summary greetings to name
 * @route POST /hello/
 * @group hello - Test Demo
 * @param {ReqNameJSON.model} name.body.required - username or email
 * @returns {object} 200 - An object with the key 'msg'
 * @returns {Error}  default - Unexpected error
 * @headers {integer} 200.X-Rate-Limit - calls per hour allowed by the user
 * @headers {string} 200.X-Expires-After - 	date in UTC when token expires
 * @produces application/json
 * @consumes application/json
 */
router.post("/", function() {});



/**
 * @route POST /test/array_input
 * @param {ArrayMan.model} input.body.required
 * @returns {string} 200 - response
 */

/**
 * @route GET /test/array_output
 * @returns {ArrayMan.model} 200 - test
 */

 /**
 * @route POST /test/union_input
 * @input_example input - Dog - eg: {"a":5,"b":6,"woof":"1"}
 * @input_example input - Cat - eg: {"a":5,"b":6,"meow":"2"}
 * @param {Cat|Dog} input.body.required
 */

 /**
 * @route POST /test/union_output
 * @output_example 200 - Cat - eg: {"a":1,"b":2}
 * @output_example 200 - Dog - eg: {"a":3,"b":4}
 * @returns {Cat|Dog} 200 - Cat or dog
 */

 /**
  * @typedef ArrayMan
  * @property {number[]} numbers - A lot of integers - eg:[0,0,0]
  * @property {string[]} strings - A lot of messages - eg:["a","b","c"]
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
 
module.exports = router;
