const e = require('express');
var neo4j = require('neo4j-driver');

const URI = process.env.NEO4J_HOST;
const USER = process.env.NEO4J_USER;
const PASSWORD = process.env.NEO4J_PASS;

const driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD));

exports.driver = driver;
