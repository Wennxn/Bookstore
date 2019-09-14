function Store(serverUrl) {
    this.serverUrl = serverUrl;
    this.stock = {};
    this.cart = {};
    this.onUpdate = null;
}

function keepActive() {
    window.alert("Hey there! Are you still planning to buy something?");
    clearTimeout(timer);
    timer = setInterval(keepActive, inactiveTime);
}

var totalPrice = 0;
var inactiveTime = 30000;
var timer = setInterval(keepActive, inactiveTime);
var displayed = [];

var store = new Store("http://localhost:3000");


store.onUpdate = function (itemName) {
    if (itemName == null) {
        let productView = document.getElementById("productView");
        renderProductList(productView, this);
    } else {
        var container = document.getElementById("product-" + itemName);
        renderProduct(container, this, itemName);
    }
    var modalContent = document.getElementById('modal-content');
    renderCart(modalContent, store);

    var menuView = document.getElementById('menuView');
    renderMenu(menuView, store);

}

Store.prototype.addItemToCart = function (itemName) {
    clearTimeout(timer);
    timer = setInterval(keepActive, inactiveTime);

    if (!this.cart.hasOwnProperty(itemName)) {
        this.cart[itemName] = 1;
        this.stock[itemName].quantity = this.stock[itemName].quantity - 1;
        totalPrice += this.stock[itemName]['price'];
    } else {
        if (this.stock[itemName].quantity < 1) {
            window.alert(itemName + " is out of stock.");
        } else {
            this.cart[itemName] = this.cart[itemName] + 1;
            this.stock[itemName].quantity = this.stock[itemName].quantity - 1;
            totalPrice += this.stock[itemName]['price'];
        }
    }
    this.onUpdate(itemName);
}

Store.prototype.removeItemFromCart = function (itemName) {
    clearTimeout(timer);
    timer = setInterval(keepActive, inactiveTime);

    if (this.cart.hasOwnProperty(itemName)) {
        this.cart[itemName] = this.cart[itemName] - 1;
        this.stock[itemName].quantity = this.stock[itemName].quantity + 1;
        totalPrice -= this.stock[itemName]['price'];

        if (this.cart[itemName] === 0) {
            delete this.cart[itemName];
        }
    }
    this.onUpdate(itemName);
}

Store.prototype.checkOut = function (onFinish) {
    var that = this;
    this.syncWithServer(function (delta) {
            // check if there was a change in the stock and create an alert
            var msg = "";
            for (changedItem in delta) {
                if (delta[changedItem].price) {
                    var oldPrice = store.stock[changedItem].price - delta[changedItem].price;
                    msg = msg + "Price of " + changedItem + " changed from $" + oldPrice + " to $" + store.stock[changedItem].price + ".\n";
                }
                if (delta[changedItem].quantity) {
                    var oldQualtity = store.stock[changedItem].quantity - delta[changedItem].quantity;
                    msg = msg + "Quantity of " + changedItem + " changed from " + oldQualtity + " to " + store.stock[changedItem].quantity + ".\n\n";
                }
            }
            if (msg.length > 0) {
                alert(msg);
            } else {

                var client_id = Math.floor((Math.random() * 2000) + 1);
                var order = {};
                order["client_id"] = client_id.toString();
                order["cart"] = that.cart;
                order["total"] = totalPrice;
                ajaxPost("http://localhost:3000/checkout", order, function (response) {
                    alert("Check out successful. Your Order ID is: " + response);
                    that.cart = {};
                    that.onUpdate();
                }, function (error) {
                    alert("Error: " + error);
                });
            }

            if (onFinish != null) {
                onFinish();
            }
        }
    );
}

function ajaxPost(url, data, onSuccess, onError) {

    var dataJsonString = JSON.stringify(data);
    var xhr = new XMLHttpRequest();

    xhr.open("POST", url);

    xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");

    xhr.onload = function () {

        let res = JSON.parse(xhr.responseText);

        if (xhr.status == 200) {
            onSuccess(res);
        } else {
            onError(res);
        }
    }

    xhr.ontimeout = function () {
        let res = JSON.parse(xhr.responseText);

        onError(res);
    };

    xhr.onerror = function () {
        let res = JSON.parse(xhr.responseText);

        onError(res);
    }

    xhr.timeout = 3000;
    xhr.send(dataJsonString);

}

function ajaxGet(url, onSuccess, onError) {
    var count = 0;

    function sendRequest() {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url);

        count += 1;

        xhr.onload = function () {
            if (xhr.status == 200) {
                var products = JSON.parse(xhr.responseText);
                onSuccess(products);
            } else {
                console.log("not success " + xhr.responseText);
                if (count <= 3) {
                    sendRequest();
                } else {
                    alert("Fail after 3 requests");
                    onError(xhr.responseText)
                }
            }
        }
        xhr.ontimeout = function () {
            if (count <= 3) {
                sendRequest();
            } else {
                console.log("not success " + xhr.responseText);
                alert("Fail up after 3 requests");
                onError(xhr.responseText)
            }
        }
        xhr.onerror = function () {
            if (count <= 3) {
                sendRequest();
            } else {
                console.log("not success " + xhr.responseText);
                alert("Fail up after 3 requests");
                onError(xhr.responseText)
            }

        };
        xhr.timeout = 3000;	 // Wait at most 3000 ms for a response
        console.log("Sending request " + xhr);
        xhr.send();
    }

    return sendRequest();
}

Store.prototype.syncWithServer = function (onSync) {
    var oldStock = store.stock;
    var delta = {};
    var that = this;

    ajaxGet(store.serverUrl + "/products",
        function (response) {

            // compute delta
            for (item in response) {
                if (!oldStock.hasOwnProperty(item)) {
                    delta[item] = {};
                    delta[item]["price"] = response[item].price;
                    delta[item]["quantity"] = response[item].quantity;
                } else {
                    if (response[item].price != oldStock[item].price) {
                        delta[item] = {};
                        delta[item]["price"] = response[item].price - oldStock[item].price;

                        var oldQuantity = 0;
                        if (store.cart.hasOwnProperty(item)) {
                            oldQuantity = oldStock[item].quantity + store.cart[item];
                        } else {
                            oldQuantity = oldStock[item].quantity;
                        }

                        if (response[item].quantity != oldQuantity) {
                            delta[item]["quantity"] = response[item].quantity - oldQuantity;
                        }
                    }
                }
            }

            // compute each stock item quantity
            for (item in store.cart) {
                if (store.cart[item] >= response[item].quantity) {
                    store.cart[item] = response[item].quantity;
                    response[item].quantity = 0;
                } else {
                    response[item].quantity -= store.cart[item];
                }
            }

            store.stock = response;

            that.onUpdate();

            if (onSync != null) {
                onSync(delta);
            }
        },
        function (error) {
            alert("Fail after 3 requests\n" + error);
        }
    );
}

store.syncWithServer(callBackSWS);


function callBackSWS(delta) {
    displayed = [];

    for (item in delta) {
        displayed.push(item);
    }

    let productView = document.getElementById("productView");
    renderProductList(productView, store);
}

Store.prototype.queryProducts = function (query, callback) {
    var self = this;
    var queryString = Object.keys(query).reduce(function (acc, key) {
        return acc + (query[key] ? ((acc ? '&' : '') + key + '=' + query[key]) : '');
    }, '');
    ajaxGet(this.serverUrl + "/products?" + queryString,
        function (products) {
            Object.keys(products)
                .forEach(function (itemName) {
                    var rem = products[itemName].quantity - (self.cart[itemName] || 0);
                    if (rem >= 0) {
                        self.stock[itemName].quantity = rem;
                    }
                    else {
                        self.stock[itemName].quantity = 0;
                        self.cart[itemName] = products[itemName].quantity;
                        if (self.cart[itemName] === 0) delete self.cart[itemName];
                    }

                    self.stock[itemName] = Object.assign(self.stock[itemName], {
                        price: products[itemName].price,
                        label: products[itemName].label,
                        imageUrl: products[itemName].imageUrl
                    });
                });
            self.onUpdate();
            callback(null, products);
        },
        function (error) {
            console.log("Error here");
            callback(error);
        }
    )
}

function renderMenu(container, storeInstance) {
    while (container.lastChild) container.removeChild(container.lastChild);
    if (!container._filters) {
        container._filters = {
            minPrice: null,
            maxPrice: null,
            category: ''
        };
        container._refresh = function () {
            storeInstance.queryProducts(container._filters, function (err, products) {
                if (err) {
                    alert('Error occurred trying to query products');
                    console.log(err);
                }
                else {
                    displayed = Object.keys(products);
                    renderProductList(document.getElementById('productView'), storeInstance);
                }
            });
        }
    }

    var box = document.createElement('div');
    container.appendChild(box);
    box.id = 'price-filter';
    var input = document.createElement('input');
    box.appendChild(input);
    input.type = 'number';
    input.value = container._filters.minPrice;
    input.min = 0;
    input.placeholder = 'Min Price';
    input.addEventListener('blur', function (event) {
        container._filters.minPrice = event.target.value;
        container._refresh();
    });

    input = document.createElement('input');
    box.appendChild(input);
    input.type = 'number';
    input.value = container._filters.maxPrice;
    input.min = 0;
    input.placeholder = 'Max Price';
    input.addEventListener('blur', function (event) {
        container._filters.maxPrice = event.target.value;
        container._refresh();
    });

    var list = document.createElement('ul');
    container.appendChild(list);
    list.id = 'menu';
    var listItem = document.createElement('li');
    list.appendChild(listItem);
    listItem.className = 'menuItem' + (container._filters.category === '' ? ' active' : '');
    listItem.appendChild(document.createTextNode('All Items'));
    listItem.addEventListener('click', function (event) {
        container._filters.category = '';
        container._refresh()
    });
    var CATEGORIES = ['Clothing', 'Technology', 'Office', 'Outdoor'];
    for (var i in CATEGORIES) {
        var listItem = document.createElement('li');
        list.appendChild(listItem);
        listItem.className = 'menuItem' + (container._filters.category === CATEGORIES[i] ? ' active' : '');
        listItem.appendChild(document.createTextNode(CATEGORIES[i]));
        listItem.addEventListener('click', (function (i) {
            return function (event) {
                container._filters.category = CATEGORIES[i];
                container._refresh();
            }
        })(i));
    }
}


function showCart(cart) {
    clearTimeout(timer);
    timer = setInterval(keepActive, inactiveTime);

    var modalContent = document.getElementById("modal-content");
    renderCart(modalContent, store);

    var modality = document.getElementById("modal");
    modality.style.visibility = 'visible';
}

function hideCart() {
    clearTimeout(timer);
    timer = setInterval(keepActive, inactiveTime);

    var modality = document.getElementById("modal");
    modality.style.visibility = 'hidden';
}

function renderCart(container, storeInstance) {
    totalPrice = 0;
    container.innerHTML = "";

    var table = document.createElement('table');
    table.style.width = '300px';

    var inCart = storeInstance.cart;

    if (Object.getOwnPropertyNames(inCart).length === 0) {
        var p = document.createElement('p');
        p.innerHTML = "Cart is empty.";
        container.appendChild(p);
        return;
    }

    var headerRow = document.createElement('tr');
    var itemHeader = document.createElement('td');
    itemHeader.appendChild(document.createTextNode("Item"));
    itemHeader.style.fontWeight = 'bold';

    var quantityHeader = document.createElement('td');
    quantityHeader.appendChild(document.createTextNode("Quantity"));
    quantityHeader.style.fontWeight = 'bold';

    var priceHeader = document.createElement('td');
    priceHeader.appendChild(document.createTextNode("Price"));
    priceHeader.style.fontWeight = 'bold';

    headerRow.appendChild(itemHeader);
    headerRow.appendChild(quantityHeader);
    headerRow.appendChild(priceHeader);

    table.appendChild(headerRow);

    for (var p in inCart) {
        function createRows() {
            var product = p;
            if (inCart.hasOwnProperty(product)) {

                if (inCart[product] <= 0) {
                    delete inCart[product];
                } else {
                    var itemRow = document.createElement('tr');

                    var itemName = storeInstance.stock[product]['label'];
                    var nameData = document.createElement('td');
                    nameData.appendChild(document.createTextNode(itemName));

                    var itemQuantity = inCart[product];
                    var itemData = document.createElement('td');
                    itemData.appendChild(document.createTextNode(itemQuantity));

                    var itemPrice = storeInstance.stock[product]['price'] * itemQuantity;
                    totalPrice += itemPrice;
                    var priceData = document.createElement('td');
                    priceData.appendChild(document.createTextNode(itemPrice));

                    itemRow.appendChild(nameData);
                    itemRow.appendChild(itemData);
                    itemRow.appendChild(priceData);

                    if (storeInstance.stock[product].quantity > 0) {
                        var add = document.createElement('td');
                        var add_btn = document.createElement('button');
                        add_btn.innerHTML = "+";
                        add_btn.onclick = function () {
                            storeInstance.addItemToCart(product);
                        };
                        add.appendChild(add_btn);
                        itemRow.appendChild(add);
                    }

                    if (storeInstance.cart.hasOwnProperty(product)) {
                        var remove = document.createElement("td")
                        var rm_btn = document.createElement('button');
                        rm_btn.innerHTML = "-";
                        rm_btn.onclick = function () {
                            storeInstance.removeItemFromCart(product);
                        };
                        remove.appendChild(rm_btn);
                        itemRow.appendChild(remove);
                    }
                    table.appendChild(itemRow);

                }
            }
        }

        createRows();
    }

    var fillerRow = document.createElement('tr');
    var emptyData = document.createElement('td');
    emptyData.appendChild(document.createTextNode("----------------"));
    fillerRow.appendChild(emptyData);
    table.appendChild(fillerRow);

    var priceHeaderRow = document.createElement('tr');
    var totalPriceHeader = document.createElement('td');
    totalPriceHeader.appendChild(document.createTextNode("Total Price"));
    totalPriceHeader.style.fontWeight = 'bold';
    priceHeaderRow.appendChild(totalPriceHeader);
    table.appendChild(priceHeaderRow);

    var priceRow = document.createElement('tr');
    priceRow.setAttribute('id', 'total-price');
    priceRow.appendChild(document.createTextNode(totalPrice));


    // checkout button
    var checkout_btn = document.createElement('button');
    checkout_btn.setAttribute('id', 'btn-check-out');
    checkout_btn.innerHTML = "Check Out";
    checkout_btn.addEventListener("click", checkOutHandler);
    checkout_btn.addEventListener("click", checkOutHandler);


    function checkOutHandler() {
        clearTimeout(timer);
        timer = setInterval(keepActive, inactiveTime);

        document.getElementById("btn-check-out").disabled = true;
        store.checkOut(function () {
            document.getElementById("btn-check-out").disabled = false;
        });
    }

    table.appendChild(priceRow);
    container.appendChild(table);

    var checkoutBtn = document.createElement('button');
    checkoutBtn.setAttribute("id", "btn-check-out");
    checkoutBtn.innerHTML = "Checkout";
    checkoutBtn.addEventListener("click", checkoutClick);

    function checkoutClick() {

        checkoutBtn.disabled = true;
        storeInstance.checkOut(reEnable);

        function reEnable() {
            checkoutBtn.disabled = false;
        }
    }

    container.appendChild(checkoutBtn);
}


function renderProduct(container, storeInstance, itemName) {

    var url = storeInstance.stock[itemName]['imageUrl'];
    var price = storeInstance.stock[itemName]['price'];
    var quantity = storeInstance.stock[itemName]['quantity'];
    var label = storeInstance.stock[itemName]['label'];

    container.innerHTML = "";

    container.className = "product";

    if (quantity > 0) {
        var addBtn = document.createElement("button");
        addBtn.className = "btn-add";
        addBtn.setAttribute('type', 'button');
        addBtn.innerHTML = "Add to Cart";
        addBtn.addEventListener("click", function () {
            storeInstance.addItemToCart(itemName)
        });
        container.appendChild(addBtn);
    }
    if (storeInstance.cart[itemName] > 0) {
        var removeBtn = document.createElement("button");
        removeBtn.className = "btn-remove";
        removeBtn.setAttribute('type', 'button');
        removeBtn.innerHTML = "Remove from Cart";
        removeBtn.addEventListener("click", function () {
            storeInstance.removeItemFromCart(itemName)
        });
        container.appendChild(removeBtn);
    }

    // item image
    var itemImage = document.createElement("img");
    itemImage.src = url;
    container.appendChild(itemImage);

    // item price
    var itemPrice = document.createElement("p");
    itemPrice.className = "price";
    itemPrice.innerHTML = price;
    container.appendChild(itemPrice);

    var itemCaption = document.createElement("span");
    itemCaption.className = "caption";
    itemCaption.innerHTML = label;
    container.appendChild(itemCaption);
}

function renderProductList(container, storeInstance) {
    container.innerHTML = "";
    var ul = document.createElement("ul");
    ul.id = "productList";
    for (var k = 0; k < displayed.length; k++) {
        var li = document.createElement('li');
        ul.append(li);
        renderProduct(li, storeInstance, displayed[k]);
        li.setAttribute("id", "product-" + displayed[k]);

    }
    container.append(ul);
}

window.onload = function () {
    var hideCartBtn = document.getElementById("btn-hide-cart");
    hideCartBtn.onclick = hideCart;

    document.onkeydown = function (e) {
        if (e.keyCode == 27) {
            hideCart();
        }
    }
};
