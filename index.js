var exports = module.exports = {}
var crypto = require('crypto');
var fix = require('fixjs');
var net = require('net');
var tls = require('tls');
var program = require('commander');
var url = require('url');
var uuid = require('uuid');
var Msgs = fix.Msgs;
var Gdax = require('gdax');
var config = require('./config')
const authedClient = new Gdax.AuthenticatedClient(config.apiKey, config.secret, config.passphrase, config.apiURI);
//------------------------------------------------------------------------------
// Use TLS
net = tls;
// Connect the stream!
var stream = net.connect({
    host: 'fix.gdax.com',
    port: '4198'
}, function() {
    console.log('connected to gdax server trough FIX API 4.2');
});
// Log errors
stream.on('error', function(err) {
    console.error(err);
});
//----------------------------
var websocket = null;
var orderbook = null;
var client = null
var session = null
var market = {
  symbol : 'symbol',
  ask : 0,
  bid: 0,
  spread:0
}
var pendings = []
//-----------------------------
function initClient(symbol) {
  account = {
    base_currency:symbol.substring(0,3),
    quote_currency:symbol.substring(4,7),
    baseAvailable:0,
    quoteAvailable:0,
    total:0
  }
  market.symbol = symbol
  market.base_currency = symbol.substring(0,3)
  market.quote_currency = symbol.substring(4,7)
  market.BaseAvailable = 0
  market.QuoteAvailable = 0
  market.TotalAsset = 0

  websocket = new Gdax.WebsocketClient(symbol)
  orderbook = new Gdax.OrderbookSync(symbol)
  client = fix.createClient(stream)

  websocket.on('message', function(data) {
    if (data.type === 'open') {
     if (data.product_id === symbol) {
       var askSide = orderbook.book.state().asks;
       var bidSide = orderbook.book.state().bids;
       if (typeof askSide[0] != 'undefined' && typeof bidSide[0] != 'undefined') {
                var  lasta =  parseFloat(askSide[0].price.toString());
                if (market.ask != lasta) {
                  market.ask = lasta
                }

                var lastb = parseFloat(bidSide[0].price.toString());
                if (market.bid != lastb) {
                  market.bid = lastb
                }
                market.spread = parseFloat(askSide[0].price.toString()) - parseFloat(bidSide[0].price.toString())
         }
     }
    }
  });

  websocket.on('errror', function(data) {
    console.log(data);
  });

  session = client.session(config.apiKey, 'Coinbase');

  session.on('logon', function() {
      console.log('logged on, '+new Date());
  });
  // Test request
  session.on('TestRequest', function(msg, next) {
      console.log('%s', msg);
      next();
  });
  // The rest of these are handlers for various FIX keywords
  session.on('ExecutionReport', function(msg, next) {
      if (msg.ExecType == 0) {
        // console.log(msg);
        }else if (msg.ExecType == 1 || msg.ExecType == 2) { // fill
          console.log('Order Filled!');
          console.log(msg);
      } else if (msg.ExecType == 3 || msg.ExecType == 4) { // done/canceled
        console.log('Order canceled');
      } else if (msg.ExecType == 'D') { // unsolicited reduce
          console.log('got unsolicited reduce, new OrderQty:', msg.OrderQty);
      } else if (msg.ExecType == 'I') {
        if (msg.Symbol == config.symbol) {
          var pendi = { side: parseFloat(msg.Side), price : parseFloat(msg.Price) }
          pendings.push(pendi)
        }
      }
      next();
  });
  session.on('OrderCancelReject', function(msg, next) {
      console.log('order cancel reject: %s', msg);
      next();
  });
  session.on('Reject', function(msg, next) {
      console.log('reject: %s', msg);
      next();
  });
  session.on('send', function(msg) {
      //msg.replace(/\s/g,/\r\n/);
      // console.log(msg);
      // console.log('sending message: %s', msg);
  });
  session.on('error', function(err) {
      console.error(err.stack);
  });
  session.on('logout', function() {
      console.log('logged out');
  });
  session.on('end', function() {
      console.log('session ended');
      stream.end();
  });
  stream.on('end', function() {
      console.log('stream ended');
  });
  //------------------------------------------------------------------------------
  // create our own Logon message so we can control the SendingTime and sign it
  var logon = new Msgs.Logon();
  logon.SendingTime = new Date();
  console.log(logon.SendingTime);
  logon.HeartBtInt = 30;
  logon.EncryptMethod = 0;
  logon.set(554, config.passphrase); // FIX 4.4 Password tag

  var presign = [
      logon.SendingTime,
      logon.MsgType,
      session.outgoing_seq_num,
      session.sender_comp_id,
      session.target_comp_id,
      config.passphrase
  ];

  var what = presign.join('\x01');
  logon.RawData = sign(what, config.secret);
  //console.log("logon.RawData: " + logon.RawData);
  session.send(logon, true);

  function sign(what, secret) {
      var key = Buffer(secret, 'base64');
      var hmac = crypto.createHmac('sha256', key);
      //console.log("presign: " + what);
      var signature = hmac.update(what).digest('base64');
      return signature;
  }
}
//----------------------------
function sendOrder(type, side, price, amount) {
  var siz = parseFloat(amount.toFixed(2))
  var order = new Msgs.NewOrderSingle();
  order.Symbol = config.symbol;
  order.ClOrdID = uuid();
  order.Side = side;
  order.HandlInst = 1;
  order.TransactTime = new Date();
  order.OrdType = type; // 2=Limit
  order.OrderQty =siz;
  order.Price = price;
  order.TimeInForce = '1'; // 1=GTC
  order.set(7928, 'D'); // STP
  session.send(order);
}
//----------------------------
function cancelOrder(ClOrdID,OrderID) {
  var cancel = new Msgs.OrderCancelRequest();
  cancel.Symbol = market.Symbol;
  cancel.OrigClOrdID = ClOrdID;
  cancel.ClOrdID = 123456;
  cancel.OrderID = OrderID;
  session.send(cancel);
}
//----------------------------
function updateData(){
  pendings = []
  var orders = new Msgs.OrderStatusRequest();
  orders.OrderID = '*'
  session.send(orders)
  //--- get account
  authedClient.getAccounts(function (err, response, data) {

    var t = 0
    var ts = 0
    for (var i = 0; i < data.length; i++) {
      if (data[i].currency === market.base_currency) {
        market.BaseAvailable = parseFloat(data[i].balance)
        t = parseFloat(data[i].balance*market.bid)
      }
      if (data[i].currency === market.quote_currency) {
        market.QuoteAvailable = parseFloat(data[i].balance)
        ts = parseFloat(data[i].balance)
        }
    }
    market.TotalAsset = t + ts
    });
}
//-----------------------------
exports.initClient = initClient
exports.updateData = updateData
exports.getData = market
exports.getOrders = pendings
exports.sendOrder = sendOrder
exports.cancelOrder = cancelOrder

