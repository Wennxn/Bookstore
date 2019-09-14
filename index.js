// Require dependencies
var path = require('path');
var express = require('express');
var StoreDB = require('./StoreDB.js');
var db = new StoreDB("mongodb://localhost:27017", "cpen400a-bookstore");

// Declare application parameters
var PORT = process.env.PORT || 3000;
var STATIC_ROOT = path.resolve(__dirname, './public');

// Defining CORS middleware to enable CORS.
// (should really be using "express-cors",
// but this function is provided to show what is really going on when we say "we enable CORS")
function cors(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS,PUT");
    next();
}

// Instantiate an express.js application
var app = express();

// Configure the app to use a bunch of middlewares
app.use(express.json());							// handles JSON payload
app.use(express.urlencoded({extended: true}));	// handles URL encoded payload
app.use(cors);										// Enable CORS

app.use('/', express.static(STATIC_ROOT));			// Serve STATIC_ROOT at URL "/" as a static resource

// Configure '/products' endpoint
app.get('/products', function (request, response) {

    db.getProducts(request.query).then(function (succ) {
        response.statusCode = 200;
        response.json(succ);
        response.end();
    }, function (err) {
        response.statusCode = 500;
        response.send(err);
        response.end();
    });

});

app.post('/checkout', function (request, response) {

    if (request.body == null || request.body == {} || request.body == undefined || typeof request.body != 'object') {
        response.statusCode = 500;
        response.send("Bad checkout body");
        response.end();
        return;
    }

    var order = request.body;

    if (order["client_id"] == undefined || order["cart"] == undefined || order["total"] == undefined) {
        response.statusCode = 500;
        response.send("Bad checkout body");
        response.end();
        return;
    }


    if (typeof order["client_id"] != 'string' || typeof order["cart"] != 'object' || typeof order["total"] != 'number') {
        response.statusCode = 500;
        response.send("Bad checkout body");
        response.end();
        return;
    }


    var addOrder = db.addOrder(order);
    addOrder.then(function (orderId) {
        console.log("order id is:");
        console.log(orderId);
        response.send(orderId);
        response.end();
    }).catch(function (err) {
        response.statusCode = 500;
        response.send(err);
        response.end();
    })
});

// Start listening on TCP port
app.listen(PORT, function () {
    console.log('Express.js server started, listening on PORT ' + PORT);
});
