/**
 * Created by GROOT on 3/27 0027.
 */
/** @module index */
'use strict';

// Dependencies
const fs = require('fs');
const glob = require('glob');
const path = require('path');
const parser = require('swagger-parser');
const swaggerHelpers = require('./swagger-helpers');
const doctrineFile = require('doctrine-file');
const swaggerUi = require('swagger-ui-express');

const StringFormats = [
    "date",
    "date-time",
    "objectId",
    "ipv4"
]
const BaseFormats = [
    "object",
    "string",
    "number",
    "integer",
    "boolean"
]
/**
 * Parses the provided API file for JSDoc comments.
 * @function
 * @param {string} file - File to be parsed
 * @returns {object} JSDoc comments
 * @requires doctrine
 */
function parseApiFile(file) {
    const content = fs.readFileSync(file, 'utf-8');

    let comments = doctrineFile.parseFileContent(content, {unwrap: true, sloppy: true, tags: null, recoverable: true});
    return comments;
}

function parseRoute(str) {
    let split = str.split(" ")

    return {
        method: split[0].toLowerCase() || 'get',
        uri: split[1] || ''
    }
}

function parseField(str) {
    let split = str.split(".")
    return {
        name: split[0],
        parameter_type: split[1] || 'get',
        required: split[2] && split[2] === 'required' || false
    }
}

function parseType(obj) {
    if (!obj) return undefined;
    // console.log("Parse type!", obj.name);
    if (obj.name) {
        const spl = obj.name.split('.');
        if (spl.length > 1 && spl[1] == 'model') {
            return spl[0];
        }
        else return obj.name;
    } else if (obj.expression && obj.expression.name) {
        return obj.expression.name.toLowerCase();
    } else {
        return 'string';
    }
}

function parseSchema(obj) {
    if (!(obj.name || obj.applications || obj.type == "UnionType")) return undefined;
    // console.log("parse schema", obj);
    if (obj.name) {
        const spl = obj.name.split('.');
        if (spl.length > 1 && spl[1] == 'model') {
            return {"$ref": "#/components/schemas/" + spl[0]};
        }
        else return undefined;
    }
    if (obj.type == "UnionType") {
        obj.applications = obj.elements;
    }
    if (obj.applications) {

        if (obj.applications.length === 1) {
            const type = obj.applications[0].name;
            if (BaseFormats.includes(type) || StringFormats.includes(type)) {
                return {
                    type: obj.expression.name.toLowerCase(),
                    format: StringFormats.includes(type) ? type : null,
                    items: {
                        "type": StringFormats.includes(type) ? "string" : type,
                        "format": StringFormats.includes(type) ? type : null
                    }
                }
            } else {
                return {
                    type: obj.expression.name.toLowerCase(),
                    items: {
                        "$ref": "#/components/schemas/" + obj.applications[0].name
                    }
                }
            }
        }
        let oneOf = []
        for (let i in obj.applications) {
            const type = obj.applications[i].name;
            if (BaseFormats.includes(type) || StringFormats.includes(type)) {
                oneOf.push({
                    "type": StringFormats.includes(type) ? "string" : type,
                    "format": StringFormats.includes(type) ? type : null
                })
            } else {
                oneOf.push({
                    "$ref": "#/components/schemas/" + obj.applications[i].name
                })
            }
        }
        return {
            oneOf: oneOf,
            discriminator: {
                propertyName: "objectType"
            }
        }
    }

    return undefined
}

function parseItems(obj) {
    if (obj.applications && obj.applications.length > 0 && obj.applications[0].name) {
        const type = obj.applications[0].name;
        if (type == 'object' || type == 'string' || type == 'integer' || type == 'boolean' || StringFormats.includes(type)) {
            return {
                "type": StringFormats.includes(type) ? "string" : type,
                "format": StringFormats.includes(type) ? type : null
            }
        }
        else return {"$ref": "#/components/schemas/" + type};
    }
    else return undefined;
}

function parseReturn(tags) {
    let rets = {}
    let headers = parseHeaders(tags)

    for (let i in tags) {
        if (tags[i]['title'] == 'returns' || tags[i]['title'] == 'return') {
            let description = tags[i]['description'].split("-"), key = description[0].trim()

            rets[key] = {
                description: description[1] ? description[1].trim() : '',
                headers: headers[key],
                content: {}
            };
            const type = parseType(tags[i].type);
            if (type) {
                // rets[key].type = type;
                rets[key].content["application/json"] = {
                    schema: parseSchema(tags[i].type),
                    examples: tags[i].examples
                }
            }
        }
    }
    return rets
}

function parseDescription(obj) {
    const description = obj.description || '';
    const sanitizedDescription = description.replace('/**','');
    return sanitizedDescription;
}

function parseSummary(obj) {
    const summaryIndex = obj.tags && obj.tags.findIndex((item) => item.title === 'summary');
    const summary = summaryIndex > -1 ? obj.tags[summaryIndex].description : "";
    const sanitizedSummary = summary.replace('/**','');
    return sanitizedSummary;
}


function parseTag(tags) {
    for (let i in tags) {
        if (tags[i]['title'] == 'group') {
            return tags[i]['description'].split("-")
        }
    }
    return ['default', '']
}

function parseProduces(str) {
    return str.split(/\s+/);
}


function parseConsumes(str) {
    return str.split(/\s+/);
}

function parseTypedef(tags) {
    const typeName = tags[0]['name'];
    // console.log("Parsing typedef", typeName)
    let details = {
        required: [],
        properties: {}
    };
    if (tags[0].type && tags[0].type.name) {
        details.allOf = [{"$ref": '#/components/schemas/' + tags[0].type.name}]
    }
    for (let i = 1; i < tags.length; i++) {
        if (tags[i].title == 'property') {
            let propName = tags[i].name;
            // console.log("Parsing tag", propName, tags[i]);
            let propNameArr = propName.split(".");

            let props = propNameArr.slice(1, propNameArr.length)
            let required = props.indexOf('required') > -1
            let readOnly = props.indexOf('readOnly') > -1

            if (required) {
                if (details.required == null) details.required = [];
                propName = propName.split('.')[0];
                details.required.push(propName);
            }
            var schema = parseSchema(tags[i].type, propName);

            if (schema) {
                // console.log(`${propName} is schema!`);
                const parsedDescription = (tags[i].description || '').split(/-\s*eg:\s*/);
                schema.description = parsedDescription[0];
                if (parsedDescription[1]) {
                    // console.log(`Found example for ${propName}`)
                    schema.example = JSON.parse(parsedDescription[1]);
                }
                details.properties[propName] = schema;
                if (tags[i].type.type == "UnionType") {
                    details.discriminator = {
                        propertyName: "objectType"
                    }
                }
            } else {
                // console.log(`${propName} is property`);
                const type = parseType(tags[i].type);
                const parsedDescription = (tags[i].description || '').split(/-\s*eg:\s*/);
                const description = parsedDescription[0];
                let example = parsedDescription[1];

                let prop = {
                    type: StringFormats.includes(type) ? "string" : type,
                    format: StringFormats.includes(type) ? type : null,
                    description: description,
                    items: parseItems(tags[i].type),
                };
                if(readOnly) {
                    prop.readOnly = true
                }
                details.properties[propName] = prop
                if (prop.type == 'array') {
                    // console.log("Array prop type", prop);
                }
                if (prop.type == 'enum') {
                    let parsedEnum = parseEnums('-eg:' + example)
                    prop.type = parsedEnum.type
                    prop.enum = parsedEnum.enums
                }
                if (prop.format == "objectId") {
                    example = '507f191e810c19729de860ea';
                }
                if (example) {
                    switch (type) {
                        case 'boolean':
                            details.properties[propName].example = example === 'true';
                            break;
                        case 'integer':
                            details.properties[propName].example = +example;
                            break;
                        case 'number':
                            details.properties[propName].example = parseFloat(example);
                            break;
                        case 'enum':
                            break;
                        default:
                            details.properties[propName].example = example;
                            break;
                    }
                }
            }
        }
    }
    return {typeName, details};
}

function parseSecurity(comments) {
    let security;
    try {
        security = JSON.parse(comments)
    } catch (e) {
        let obj = {}
        obj[comments] = []
        security = [
            obj
        ]
    }
    return security
}

function parseHeaders(comments) {
    let headers = {}
    for (let i in comments) {
        if (comments[i]['title'] === 'headers' || comments[i]['title'] === 'header') {

            let description = comments[i]['description'].split(/\s+-\s+/)

            if (description.length < 1) {
                break
            }
            let code2name = description[0].split(".")

            if (code2name.length < 2) {
                break
            }

            let type = code2name[0].match(/\w+/)
            let code = code2name[0].match(/\d+/)

            if (!type || !code) {
                break;
            }
            let code0 = code[0].trim();
            if (!headers[code0]) {
                headers[code0] = {}
            }

            headers[code0][code2name[1]] = {
                type: type[0],
                description: description[1]
            }
        }
    }
    return headers
}

function parseEnums(description) {
    let enums = ('' + description).split(/-\s*eg:\s*/)
    if(enums.length < 2) {
        return []
    }
    let parseType = enums[1].split(":")
    if(parseType.length === 1) {
        parseType = ['string', parseType[0]]
    }
    return {
        type: parseType[0],
        enums: parseType[1].split(",")
    }
}

function parseExample(line) {
    const descSplit = (line.description || '').split(/-\s*eg:\s*/);
    const value = descSplit[1] ? JSON.parse(descSplit[1]) : null;
    return {
        key: line.description.substring(9).split(" ")[0],
        displayName: line.description.substring(9).split("- ")[1].trim(),
        value
    }
}

function fileFormat(comments) {

    let route, parameters = {}, params = [], tags = [], definitions = {};

    let examples = {
        input: {},
        output: {}
    };

    // console.log("File formats", comments);
    for (let i in comments) {
        let desc = parseDescription(comments);
        let summ = parseSummary(comments);
        let block = comments[i];
        if (i == 'tags') {
            if (block.length > 0 && block[0]['title'] && block[0]['title'] == 'typedef') {

                const typedefParsed = parseTypedef(block);
                definitions[typedefParsed.typeName] = typedefParsed.details;
                continue;
            }
            for (let j in block) {
                let line = block[j];
                let title = line['title']
                // console.log("parsing line", title);
                if (title == 'route') {
                    route = parseRoute(line['description']);
                    let tag = parseTag(block);
                    parameters[route.uri] = parameters[route.uri] || {}
                    parameters[route.uri][route.method] = parameters[route.uri][route.method] || {}
                    parameters[route.uri][route.method]['parameters'] = []
                    parameters[route.uri][route.method]['description'] = desc
                    parameters[route.uri][route.method]['summary'] = summ
                    parameters[route.uri][route.method]['tags'] = [tag[0].trim()]
                    if (route.method == "post") {
                        parameters[route.uri][route.method]['requestBody'] = {
                            "content": {
                                "application/json": {}
                            }
                        }
                    }
                    tags.push({
                        name: typeof tag[0] === 'string' ? tag[0].trim() : '',
                        description: typeof tag[1] === 'string' ? tag[1].trim() : ''
                    })
                }
                if (title == 'param') {
                    let field = parseField(line['name']),
                        properties = {
                            name: field.name,
                            in: field.parameter_type,
                            description: line['description'],
                            required: field.required
                        },
                        schema = parseSchema(line['type'], field.name)
                    // we only want a type if there is no referenced schema
                    if (!schema) {
                        properties.type = parseType(line['type'])
                        if(properties.type == 'enum') {
                            let parsedEnum = parseEnums(line['description'])
                            properties.type = parsedEnum.type
                            properties.schema = {
                                enum: parsedEnum.enums
                            }
                        }
                    } else {
                        properties.schema = schema
                    }
                    if (line.examples) {
                        properties.examples = line.examples;
                    }
                    if (properties.in == "body") {
                        parameters[route.uri][route.method]['requestBody']["content"]["application/json"] = {
                            ...properties
                        }
                    } else {
                        params.push(properties);
                    }
                }
                
                if (title == 'output' && route) {
                    let example = parseExample(line);
                    // console.log("Found output example ", example);
                    for (let k in block) {
                        const line = block[k];
                        if (line.title == "returns" && line.description.startsWith(example.key + " ")) {
                            // console.log("Found matching output");
                            line.examples = line.examples || {};
                            line.examples[example.displayName] = {
                                value: example.value
                            };
                        }
                    }
                }

                if (title == 'input' && route) { //doctrine parser only parse "input" instead of input_example    
                    let example = parseExample(line);
                    // console.log("Found input example ", example);
                    for (let k in block) {
                        const line = block[k];
                        if (line.title == "param" && line.name && line.name.startsWith(example.key + ".")) {
                            // console.log("Found matching input");
                            line.examples = line.examples || {};
                            line.examples[example.displayName] = {
                                value: example.value
                            };
                        }
                    }
                }

                if (title == 'operationId' && route) {
                    parameters[route.uri][route.method]['operationId'] = line['description'];
                }

                if (title == 'summary' && route) {
                    parameters[route.uri][route.method]['summary'] = line['description'];
                }

                if (title == 'produces' && route) {
                    parameters[route.uri][route.method]['produces'] = parseProduces(line['description']);
                }

                if (title == 'consumes' && route) {
                    parameters[route.uri][route.method]['consumes'] = parseConsumes(line['description']);
                }

                if (title == 'security' && route) {
                    parameters[route.uri][route.method]['security'] = parseSecurity(line['description'])
                }

                if (title == 'deprecated' && route) {
                    parameters[route.uri][route.method]['deprecated'] = true;
                }
            }
            if (route) {
                parameters[route.uri][route.method]['parameters'] = params;
                parameters[route.uri][route.method]['responses'] = parseReturn(block);
            }
        }
    }
    return {
        paths: parameters, 
        tags: tags, 
        definitions: definitions, 
        examples: examples
    }
}

/**
 * Filters JSDoc comments
 * @function
 * @param {object} jsDocComments - JSDoc comments
 * @returns {object} JSDoc comments
 * @requires js-yaml
 */
function filterJsDocComments(jsDocComments) {
    return jsDocComments.filter(function (item) {
        return item.tags.length > 0
    })
}

/**
 * Converts an array of globs to full paths
 * @function
 * @param {array} globs - Array of globs and/or normal paths
 * @return {array} Array of fully-qualified paths
 * @requires glob
 */
function convertGlobPaths(base, globs) {
    return globs.reduce(function (acc, globString) {
        let globFiles = glob.sync(path.resolve(base, globString));
        return acc.concat(globFiles);
    }, []);
}

/**
 * Generates the swagger spec
 * @function
 * @param {object} options - Configuration options
 * @returns {array} Swagger spec
 * @requires swagger-parser
 */
function generateSpecAndMount(app) {

    return function (options) {
        /* istanbul ignore if */
        if (!options) {
            throw new Error('\'options\' is required.');
        } else /* istanbul ignore if */ if (!options.swaggerDefinition) {
            throw new Error('\'swaggerDefinition\' is required.');
        } else /* istanbul ignore if */ if (!options.files) {
            throw new Error('\'files\' is required.');
        }

        // Build basic swagger json
        let swaggerObject = swaggerHelpers.swaggerizeObj(options.swaggerDefinition);
        let apiFiles = convertGlobPaths(options.basedir, options.files);

        // Parse the documentation in the APIs array.
        for (let i = 0; i < apiFiles.length; i = i + 1) {
            let parsedFile = parseApiFile(apiFiles[i]);
            // console.log(JSON.stringify(parsedFile))
            let comments = filterJsDocComments(parsedFile);

            for (let j in comments) {
                try {
                    // console.log("parsing block", comments[j]);
                    let parsed = fileFormat(comments[j])
                    
                    // New schema for OpenAPI
                    for (var defName in parsed.definitions) {
                        swaggerObject.components.schemas[defName] = parsed.definitions[defName];
                    }
                    // Legacy
                    swaggerHelpers.addDataToSwaggerObject(swaggerObject, [{
                        paths: parsed.paths,
                        tags: parsed.tags,
                        definitions: parsed.definitions
                    }]);
                } catch (e) {
                    console.log(`Incorrect comment format. Method was not documented.\nFile: ${apiFiles[i]}\nComment:`, comments[j])
                }
            }
        }

        parser.parse(swaggerObject, function (err, api) {
            if (!err) {
                swaggerObject = api;
            }
        });

        let url = options.route ? options.route.url : '/api-docs'
        let docs = options.route ? options.route.docs : '/api-docs.json'

        app.use(docs, function (req, res) {
            res.json(swaggerObject);
        });
        app.use(url, swaggerUi.serve, swaggerUi.setup(swaggerObject));
        return swaggerObject;
    }
};


module.exports = {
    generateSpecAndMount,
    fileFormat,
    parseApiFile
};
