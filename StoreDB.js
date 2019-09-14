var MongoClient = require('mongodb').MongoClient;	// require the mongodb driver

/**
 * Uses mongodb v3.1.9 - [API Documentation](http://mongodb.github.io/node-mongodb-native/3.1/api/)
 * StoreDB wraps a mongoDB connection to provide a higher-level abstraction layer
 * for manipulating the objects in our bookstore app.
 */
function StoreDB(mongoUrl, dbName) {
    if (!(this instanceof StoreDB)) return new StoreDB(mongoUrl, dbName);
    this.connected = new Promise(function (resolve, reject) {
        MongoClient.connect(
            mongoUrl,
            {
                useNewUrlParser: true
            },
            function (err, client) {
                if (err) reject(err);
                else {
                    console.log('[MongoClient] Connected to ' + mongoUrl + '/' + dbName);
                    resolve(client.db(dbName));
                }
            }
        )
    });
}

StoreDB.prototype.getProducts = function (queryParams) {
    return this.connected.then(function (db) {
        return new Promise(function (resolve, reject) {
            // TODO: Implement functionality

            var revisedQuery = {};

            for (var param in queryParams) {

                if (queryParams.hasOwnProperty(param)) {
                    if (param == 'minPrice') {
                        if (revisedQuery['price'] == undefined) revisedQuery['price'] = {};

                        revisedQuery['price']['$gte'] = parseFloat(queryParams[param]);
                    } else if (param == 'maxPrice') {
                        if (revisedQuery['price'] == undefined) revisedQuery['price'] = {};
                        revisedQuery['price']['$lte'] = parseFloat(queryParams[param]);
                    } else {
                        revisedQuery['category'] = queryParams[param];
                    }
                }
            }

            db.collection("products").find(revisedQuery).toArray(function (err, res) {
                if (err) {
                    reject(err);
                } else {

                    var foundProducts = {};

                    for (var item of res) {

                        let itemName = item['_id'];

                        foundProducts[itemName] = {};

                        foundProducts[itemName]['label'] = item['label'];
                        foundProducts[itemName]['imageUrl'] = item['imageUrl'];
                        foundProducts[itemName]['price'] = item['price'];
                        foundProducts[itemName]['quantity'] = item['quantity'];
                    }


                    resolve(foundProducts);

                }
            })
        })
    })
}


StoreDB.prototype.addOrder = function (order) {
    return this.connected.then(function (db) {
            return new Promise(function (resolve, reject) {

                    if (order["client_id"] == undefined || order["cart"] == undefined || order["total"] == undefined) {
                        reject("Wrong order arguments");
                    } else {
                        db.collection("orders").insertOne(order, function (err, res) {

                            if (err) {
                                reject(err);
                            } else {

                                function decQuantity(itemName, amount) {
                                    return new Promise(function (resolve, reject) {
                                        db.collection("products").updateOne({_id: itemName}, {$inc: {quantity: -1 * amount}}, function (err, res) {
                                            if (err) {
                                                reject(err);
                                            } else {
                                                resolve(itemName);
                                            }
                                        })
                                    })
                                }

                                var decQuantityPromises = [];
                                var cart = order["cart"];

                                for (var item in cart) {
                                    if (cart.hasOwnProperty(item)) {
                                        decQuantityPromises.push(decQuantity(item, cart[item]));
                                    }
                                }

                                var result = Promise.all(decQuantityPromises);

                                result.then(function (results) {
                                    console.log("success");
                                }, function (error) {
                                    console.log("error");
                                });

                                resolve(res.insertedId);

                            }

                        })
                    }
                }
            );
        }
    );
}

module.exports = StoreDB;
