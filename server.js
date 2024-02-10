function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Usage
async function example() {
    console.log('Start');
    await sleep(1000); // Sleep for 2 seconds
    console.log('End');
}

example();

const { Console, count } = require("console");
const express = require("express");
const app = express();

app.use(express.json());

const log4js = require('log4js');
log4js.configure('log4js.json');

const reqLogger = log4js.getLogger("request-logger");
const tdLogger = log4js.getLogger("todo-logger");

// const { TodoPost } = require("./models");
const { Sequelize, DataTypes } = require('sequelize');
const db = require("./models");

// Create Sequelize instance
const sequelize = new Sequelize({
    dialect: 'postgres',
    host: 'postgres', 
    port: 5432,
    username: 'postgres',
    password: 'docker',
    database: 'todos',
  });

  // Define the "TodoPostgres" model
  const TodoPost = sequelize.define('ToDoPostgres', {
    rawid: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING,
    },
    content: {
      type: DataTypes.STRING,
    },
    duedate: {
      type: DataTypes.BIGINT,
    },
    state: {
      type: DataTypes.STRING,
    },
  }, {
    tableName: 'todos',
    timestamps: false,
  });

const mongoose = require('mongoose');
const mongoDBURI = 'mongodb://mongo/todos';
mongoose.connect(mongoDBURI, { useNewUrlParser: true, useUnifiedTopology: true });
const mdb = mongoose.connection;

const TodoMongooseSchema = new mongoose.Schema({
    rawid: {
        type: Number,
        unique: true,
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    content: {
        type: String,
    },
    duedate: {
        type: Number,
        required: true,
    },
    state: {
        type: String,
        uppercase: true,
        required: true,
    },
})
const TodoMongoose = mongoose.model('todos', TodoMongooseSchema);


function TODO(id, title, content, dueDate, status) {
    this.id = id;
    this.title = title;
    this.content = content;
    this.status = status;
    this.dueDate = dueDate;
}

let id;
let toDos = [];
let requestCounter = 1;

reqLogger.addContext('requestCounter', () => requestCounter);
tdLogger.addContext('requestCounter', () => requestCounter);

app.get("/todo/health", (req, res) => {
    const start = new Date();
    
    res.status(200).send("OK");
    
    const end = new Date();
    const durationMs = end - start;
    reqLogger.info("Incoming request | #" + requestCounter + " | resource: /todo/health | HTTP Verb GET");
    reqLogger.debug("request #" + requestCounter + " duration: " + durationMs + "ms");
    requestCounter++;

});

app.post("/todo", (req, res) => {
    const start = new Date();

    const toDo = new TODO(++id, req.body.title, req.body.content, req.body.dueDate, "PENDING");
    const date = new Date(req.body.dueDate);
    const currentDate = new Date();

    if(toDos.find(t => t.title === toDo.title))
    {
        res.status(409).json({ 
			errorMessage: "Error: TODO with the title [" + req.body.title + "] already exists in the system"
         });
         id--;

         tdLogger.error("Error: TODO with the title [" + req.body.title + "] already exists in the system");
    }
    else if (date <= currentDate)
    {
        res.status(409).json(
            { errorMessage: "Error: Can't create new TODO that its due date is in the past"
         });
         id--;

         tdLogger.error("Error: Can't create new TODO that its due date is in the past");
    }
    else{
        tdLogger.info("Creating new TODO with Title [" + toDo.title + "]");
        tdLogger.debug("Currently there are " + toDos.length + 
        " TODOs in the system. New TODO will be assigned with id " + toDo.id);
        TodoPost.create({
            rawid: toDo.id,
            title: toDo.title,
            content: toDo.content,
            duedate: toDo.dueDate,
            state: toDo.status,
        });
        
        const newTD = new TodoMongoose({
            rawid: toDo.id,
            title: toDo.title,
            content: toDo.content,
            duedate: toDo.dueDate,
            state: toDo.status,
        });
        newTD.save();

        res.status(200).json({
            result: (id)
        })
    }

    const end = new Date();
    const durationMs = end - start;
    reqLogger.info("Incoming request | #" + requestCounter + " | resource: /todo | HTTP Verb POST");
    reqLogger.debug("request #" + requestCounter + " duration: " + durationMs + "ms");
    requestCounter++;
});

app.get("/todo/size", async (req, res) => {
    const start = new Date();

    const db = req.query.persistenceMethod;
    let status = req.query.status;
    let num;

    switch (status) {
        case "ALL":
            num = db === 'POSTGRES' ? 
            await TodoPost.count() : 
            await TodoMongoose.countDocuments(); 

            res.status(200).json({
                result: num
            });
            break;
        case "PENDING":
            num = await responseByFilter("PENDING", res, db);
            break;
        case "LATE":
            num = await responseByFilter("LATE", res, db);
            break;
        case "DONE":
            num = await responseByFilter("DONE", res, db);
            break;
        default:
            res.status(400).send("Invalid status: " + status);
            break;
    }

    if(num)
    {
        tdLogger.info("Total TODOs count for state " + status + " is " + num);
        
        const end = new Date();
        const durationMs = end - start;
        reqLogger.info("Incoming request | #" + requestCounter + " | resource: /todo/size | HTTP Verb GET");
        reqLogger.debug("request #" + requestCounter + " duration: " + durationMs + "ms");
        requestCounter++;
}
});

app.get("/todo/content", async (req, res) => {
    const start = new Date();

    const db = req.query.persistenceMethod;
    let status = req.query.status;
    let sort = req.query.sortBy;
    let copyToDo;
    let dbEntry;

    if (status !== "ALL" && status !== "PENDING" && status !== "LATE" && status !== "DONE") {
        res.status(400).send("Invalid status: " + status);
    } else if (sort && (sort !== "ID" && sort !== "DUE_DATE" && sort !== "TITLE")) {
        res.status(400).send("Invalid sort: " + sort);
    } else {
        if (status !== "ALL") {
            copyToDo = db === "POSTGRES" ? 
            await TodoPost
            .findAll({ where: { state: status } })
            .then((results) => {
                return results.map((result) => createTodoObjectFromSequelize(result));
            }) :
            await TodoMongoose
            .find({ state: status })
            .then((results) => {
                return results.map((result) => createTodoObjectFromMongoose(result));
            });

        } else {
            dbEntry = await TodoPost.findAll();
            copyToDo = dbEntry.map((result) => createTodoObjectFromSequelize(result));
        }
        if (sort && sort != "ID")
        {
            switch (sort) {
                case "DUE_DATE":
                    copyToDo.sort(sortByDueDate);
                    break;
                case "TITLE":
                    copyToDo.sort(sortByTitle);
                    break;
            }
        }
        else {
            copyToDo.sort(sortById);
        }

        res.status(200).json({
            result: copyToDo
        });

        tdLogger.info("Extracting todos content. Filter: " + status + " | Sorting by: " + (sort ? sort : "ID"));
        tdLogger.debug("There are a total of " + toDos.length + " todos in the system. The result holds " + copyToDo.length + " todos");

        const end = new Date();
        const durationMs = end - start;
        reqLogger.info("Incoming request | #" + requestCounter + " | resource: /todo/content | HTTP Verb GET");
        reqLogger.debug("request #" + requestCounter + " duration: " + durationMs + "ms");
        requestCounter++;
    } 
});

app.put("/todo", async (req, res) => {
    const start = new Date();

    let id = req.query.id;
    let status = req.query.status;

    if (!id || (!status || (status != "PENDING" && status != "LATE" && status != "DONE"))) {
        res.status(400).send("Error!");
    } else {
        let dbEntry = await TodoPost.findOne({where: {rawid: id}});
        let toDo = createTodoObjectFromSequelize(dbEntry);
        tdLogger.info("Update TODO id [" + id + "] state to " + status);
        console.log("todo obj: " + toDo);
        if (!toDo)
        {
            res.status(404).json({
                errorMessage: "Error: no such TODO with id " + id
            });

            tdLogger.error("Error: no such TODO with id " + id);
        } else {
            let prevStatus = toDo.status;

            TodoPost.update(
                {state: status},
                {where: {rawid: id}}
            );
           
            await TodoMongoose.findOneAndUpdate(
                { rawid: id },
                { $set: { state: status } },
                { new: true }
            );

            res.status(200).json({
                result: prevStatus
            });
            tdLogger.debug("Todo id [" + id + "] state change: " + prevStatus + " --> " + status);
        }

        const end = new Date();
        const durationMs = end - start;
        reqLogger.info("Incoming request | #" + requestCounter + " | resource: /todo | HTTP Verb PUT");
        reqLogger.debug("request #" + requestCounter + " duration: " + durationMs + "ms");
        requestCounter++;
    }    
}) 

app.delete("/todo", async (req, res) => {
    const start = new Date();

    let id = req.query.id
    
    if (!id) {
        res.status(400).send("Error!");
    } else {
        let deletedRaw = await TodoPost.destroy({where: {rawid: id}});
        await TodoMongoose.findOneAndDelete({ rawid: id });

        const leftedTodos = await TodoPost.count();

        if (deletedRaw > 0) {
        res.status(200).json({
            result: leftedTodos
        });

        tdLogger.info("Removing todo id " + id);
        tdLogger.debug("After removing todo id [" + id + "] there are " + toDos.length + " TODOs in the system");
    } else {
        res.status(404).json({
            errorMessage: "Error: no such TODO with id " + id
        });

        tdLogger.error("Error: no such TODO with id " + id);
    }
}

    if(id)
    {
        const end = new Date();
        const durationMs = end - start;
        reqLogger.info("Incoming request | #" + requestCounter + " | resource: /todo | HTTP Verb DELETE");
        reqLogger.debug("request #" + requestCounter + " duration: " + durationMs + "ms");
        requestCounter++;
    }
})

app.get("/logs/level", (req, res) => {
    const start = new Date();
    let loggerName = req.query['logger-name'];

    if (loggerName === "request-logger")
    {
        res.status(200).send(reqLogger.level.levelStr);
    } else if (loggerName === "todo-logger"){
        res.status(200).send(tdLogger.level.levelStr);
    }
    else{
        res.status(404).send("Error! Invalid logger name!");
    }

    const end = new Date();
    const durationMs = end - start;
    reqLogger.info("Incoming request | #" + requestCounter + " | resource: /logs/level | HTTP Verb GET");
    reqLogger.debug("request #" + requestCounter + " duration: " + durationMs + "ms");
    requestCounter++;

})

app.put("/logs/level", (req, res) => {
    const start = new Date();
    let loggerName = req.query['logger-name'];
    let loggerLevel = req.query['logger-level'];

    loggerLevel = loggerLevel.toUpperCase();
    if (loggerLevel != 'DEBUG' && loggerLevel != "ERROR" && loggerLevel != "INFO")
    {
        res.status(404).send("Error!");
    }
    else if (loggerName === "request-logger")
    {
        reqLogger.level = loggerLevel;
        res.status(200).send(loggerLevel);
    }
    else if (loggerName == "todo-logger")
    {
        tdLogger.level = loggerLevel;
        res.status(200).send(loggerLevel);
    }
    else
    {
        res.status(404).send("Error!");
    }

    const end = new Date();
    const durationMs = end - start;
    reqLogger.info("Incoming request | #" + requestCounter + " | resource: /logs/level | HTTP Verb PUT");
    reqLogger.debug("request #" + requestCounter + " duration: " + durationMs + "ms");
    requestCounter++;
})

db.sequelize.sync().then(async () => {
    try {
        id = await TodoPost.max('rawid');
    } catch (error) {
        console.error("Error fetching TodoPost count:", error);
    }

    app.listen(9285, () => {
        console.log("Server listening on port 9285...\n");
        console.log("id: " + id);
    });
});

/********* functions  *********/

function createTodoObjectFromSequelize(seqObj) {
    const rawData = seqObj.dataValues || seqObj; // Access dataValues if available

    return new TODO(
        rawData.rawid,
        rawData.title,
        rawData.content,
        parseInt(rawData.duedate),
        rawData.state
    );
}

function createTodoObjectFromMongoose(mongooseObj) {
    return new TODO(
        mongooseObj.rawid,
        mongooseObj.title,
        mongooseObj.content,
        parseInt(mongooseObj.duedate),
        mongooseObj.state
    );
}

function countToDoByFilter(filter, db) {
    return new Promise((resolve, reject) => {
        if (db === 'POSTGRES') {
            TodoPost.count({
                where: {
                    state: filter
                }
            })
            .then(count => resolve(count))
            .catch(error => reject(error));
        } else {
            TodoMongoose.countDocuments({ state: filter })
                .then(count => resolve(count))
                .catch(error => reject(error));
        }
    });
}


async function responseByFilter(filter, res, db) {
    try {
        const count = await countToDoByFilter(filter, db);
        console.log("in subfunc count = " + count);
        res.status(200).json({
            result: count
        });
        return count; // This return is necessary if you want to propagate the value
    } catch (error) {
        console.error("Error in responseByFilter:", error);
        res.status(500).send("Internal Server Error");
        return null;
    }
}

function sortById(el1, el2)
{
    if (el1.id > el2.id) {
        return 1;
    } else {
        return -1;
    }
}

function sortByDueDate(el1, el2)
{
    if (el1.dueDate > el2.dueDate) {
        return 1;
    } else {
        return -1;
    }
}

function sortByTitle(el1, el2)
{
    if (el1.title > el2.title) {
        return 1;
    } else {
        return -1;
    }
}