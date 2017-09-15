# GDAX-Fix-Client
GDAX Client for connecting and develop ultra fast trading strategy, using FIX protocol

Instructions:

Digit in terminal:

npm install gdax-fix-client

or,

git clone  https://github.com/Saurox/GDAX-Fix-Client.git

for entire git repo copy 

USE:

Declare client with:

var exampleClient = require(./index)

Init client with:

example Method:  client.initClient(symbol)

here you initialize all client, websocket, rest, and fix with your symbol

Now your client is connecting and ready for send and get info, you can update market and your account data with:

Method: updateData()

your account data is ontained via rest so call this function with a minimum interval of 200 ms

Now, you can get data object with:

 Method: getData()

this is an Javascript Object with all info about market and account conditions for symbol specificated,
for retrive your open orders:
 
 Method: getOrders()

Send and cancel order method are:	

sendOrder(Type, side, price, amount)

Type in format 1 = Market, 2 = Limit Order
Side in format 1 = Buy, 2 = Sell, price and size in double value
cancelOrder(ClOrdID,OrderID)

ClOrdID = your original order id
OrderID = your order id obtained via FIX

Enjoy!!!

for contribuitions and donations:

BTC ADDRESS: 14QJZTGp6bh2SUXZNuWmZuX87DUdKYNjSt
ETH ADDRESS: 0x2eab6da667abe5f935e755bcdf8381be17d13f50
DASH ADDRESS: Xb7VHvjWPsif1dXPYfgZ9NFpZL5fBFhbGP

Thanks you!
