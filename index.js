var path = require('path')
var http = require('http');

// Load local environment variables
if('production' !== process.env.LOCAL_ENV ) require('dotenv').load();

var port = process.env.PORT || 5000

var server = http.createServer(function(req, res) {
    if (req.method == 'POST') {
      if (req.url == "/webhooks")
        rc_server.handleWebhooksPost(req, res);
    }else{
        console.log("IGNORE OTHER METHODS");
    }
});

server.listen(port);
var rc_server
if (process.env.DELIVERY_MODE_TRANSPORT_TYPE == "PubNub")
  rc_server = require('./pubnub');
else {
  rc_server = require('./webhook');
}
rc_server.login()
