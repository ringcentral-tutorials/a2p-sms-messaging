var path = require('path')
var http = require('http');

// Load local environment variables
if('production' !== process.env.LOCAL_ENV ) require('dotenv').load();

var port = process.env.PORT || 5000

var rc_server = null
var server = null
if (process.env.DELIVERY_MODE_TRANSPORT_TYPE == "PubNub"){
  server = http.createServer()
  rc_server = require('./pubnub')
}else {
  server = http.createServer(function(req, res) {
      if (req.method == 'POST') {
        if (req.url == "/webhooks")
          rc_server.handleWebhooksPost(req, res)
      }else{
          console.log("IGNORE OTHER METHODS")
      }
  });
  rc_server = require('./webhook')
}
server.listen(port);
rc_server.login()
