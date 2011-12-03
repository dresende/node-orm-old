NodeJS ORM
==========

## About

Node-ORM is a NodeJS module for multiple databases using Object-Relational Mapping with
some cool features like validators and hooks. New features are added by suggestion issues
or when I remember I need something. I make a strong effort not to change the API, but
sometimes it can happen. If you don't want to get into trouble I suggest you to define
your package.json (in project) to use a specific version of ORM (and not >= x.y.z).

## Installing

Install using NPM:

    npm install orm

## Connecting to a Database (MySQL in the example)

You can check the [API](https://github.com/dresende/node-orm/wiki) for a more detailed overview.

    var orm = require("orm");
    var db = orm.connect("mysql://username:password@hostname/database", function (success, db) {
        if (!success) {
            console.log("Could not connect to database!");
            return;
        }
        
        // you can now use db variable to define models
    });

## Connecting via raw database API

    var orm = require("orm");
    var mysql = require("mysql");
    var client = mysql.createClient({
        user: 'root',
        password: 'root'
    });
    var db = orm.connect("mysql", client, function (success, db) {
        // same as above...
    });

This allows you to generate your own database objects that conform to the following postgres and mysql libraries:

 * Mysql: https://github.com/felixge/node-mysql
 * Postgres: https://github.com/brianc/node-postgres

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

## Adding associations

    Person.hasOne("father", Person);
    // or just
    Person.hasOne("mother"); // defaults to same model
    
    Person.hasMany("friends", Person, "friend"); // will create a table "person_friends" with 2 fields (person_id and friend_id)

## Creating the model on the database

    Person.sync();

## Creating and using a record

    var John = new Person({
    	"name"		: "John",
    	"surname"	: "Doe",
    	"age"		: 20
    });
    console.log("Hello, my name is " + John.fullName() + " and I'm " + John.age + " years old");

## Saving record to database

    John.save(function (err, JohnCopy) {
    	if (!err) {
    		console.log("Saved! ID=" + John.id); // you can use John or JohnCopy
    	} else {
    		console.log("Something went wrong...");
    		console.dir(err);
    	}
    });

## Changing associations

I think an example is better to explain.

    John.setFather(Jeremy, function () {
    	John.setMother(Jane, function () {
    		John.addFriends(Jeremy, Jane, function () {
    			console.log("Jeremy and Jane (John's parents) are now his friends too");
    		});
    	});
    });
    
If you want there's also this methods:

    John.getFather(function (JohnFather) {
    	console.log("John's father is " + JohnFather.name);
    });
    John.unsetMother(function () {
    	console.log("John has no mother now!");
    });
    John.removeFriends(Jeremy, Jane, function () {
    	console.log("John has no friends now!");
    });
    // or just don't send any, all will be removed
    John.removeFriends(function () {
    	console.log("John has no friends now!");
    });

## Database Support

Currently this module supports the following database types:

1. MySQL
2. PostgreSQL
3. MongoDB (alpha)

## Supported Types

This values are still just supported for .sync() (table creations), not for other instance operations like .save() (yet).

<table>
	<tr>
		<th>Name</th>
		<th>Description</th>
		<th>MySQL Type</th>
        <th>PostgreSQL Type</th>
        <th>MongoDB Type</th>
	</tr>
	<tr>
		<td>string</td>
		<td>Small text</td>
		<td>VARCHAR(255)</td>
        <td>VARCHAR(255)</td>
        <td>String</td>
	</tr>
	<tr>
		<td>text</td>
		<td>Big text</td>
		<td>TEXT</td>
        <td>TEXT</td>
        <td>String</td>
	</tr>
	<tr>
		<td>int, integer, num, number</td>
		<td>Signed integer</td>
		<td>INT</td>
        <td>INTEGER</td>
        <td>Int</td>
	</tr>
	<tr>
		<td>float</td>
		<td>Floating point number</td>
		<td>FLOAT</td>
        <td>REAL</td>
        <td>Float</td>
	</tr>
	<tr>
		<td>bool, boolean</td>
		<td>True or false value</td>
		<td>TINYINT(1) (true=1, false=0)</td>
        <td>BOOLEAN</td>
        <td>Boolean</td>
	</tr>
	<tr>
		<td>date</td>
		<td>Date/time value (seconds precision)</td>
		<td>DATETIME</td>
        <td>TIMESTAMP</td>
        <td>?</td>
	</tr>
	<tr>
		<td>data</td>
		<td>Binary data</td>
		<td>BLOB</td>
        <td>BYTEA</td>
        <td>String</td>
	</tr>
	<tr>
		<td>enum</td>
		<td>Enumerated value</td>
		<td>ENUM</td>
        <td>ENUM</td>
        <td>String</td>
	</tr>
	<tr>
		<td>struct, object</td>
		<td>Generic (and simple) object</td>
		<td>TEXT (saved as JSON)</td>
        <td>TEXT (saved as JSON)</td>
        <td>Object</td>
	</tr>
</table>
