NodeJS ORM
==========

## About

Node-ORM is a NodeJS module for multiple databases using Object-Relational Mapping.

## Connecting to a Database (MySQL in the example)

    var orm = require("orm");
    var db = orm.connect("mysql://username:password@hostname/database", function (success, db) {
        if (!success) {
            console.log("Could not connect to database!");
            return;
        }
        
        // you can now use db variable to define models
    });

## Defining a model

    var Person = db.define("person", {
        "name"   : { "type": "string" },
        "surname": { "type": "string", "default": "" },
        "age"    : { "type": "int" }
	}, {
        "methods" : {
            "fullName" :function () {
                return this.name + " " + this.surname;
            }
        }
    });

## Creating the model on the database

    Person.sync();
