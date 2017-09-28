// Dependencies
const RC = require('ringcentral');
const http = require('http');
const fs = require('fs')

var currencySymbols = {"a":"Afghanistan Afghani = AFN; Argentina Peso = ARS; Aruba Guilder = AWG; Australia Dollar = AUD; Azerbaijan New Manat = AZN","b":"Bahamas Dollar = BSD; Barbados Dollar	= BBD; Belarus Ruble = BYN; Belize Dollar = BZD; Bermuda Dollar	= BMD; Bolivia Boliviano = BOB; Bosnia and Herzegovina Convertible Marka = BAM; Botswana Pula = BWP; Bulgaria Lev = BGN; Brazil Real = BRL; Brunei Darussalam Dollar = BND","c":"Cambodia Riel = KHR; Canada Dollar = CAD; Cayman Islands Dollar = KYD; Chile Peso = CLP; China Yuan Renminbi = CNY; Colombia Peso	= COP; Costa Rica Colon = CRC; Croatia Kuna = HRK; Cuba Peso = CUP; Czech Republic Koruna = CZK","d":"Denmark Krone	= DKK; Dominican Republic Peso = DOP","e":"East Caribbean Dollar = XCD; Egypt Pound = EGP; El Salvador Colon = SVC; Euro Member Countries = EUR","f":"Falkland Islands (Malvinas) Pound = FKP; Fiji Dollar = FJD","g":"Ghana Cedi = GHS; Gibraltar Pound = GIP; Guatemala Quetzal = GTQ; Guernsey Pound = GGP; Guyana Dollar = GYD","h":"Honduras Lempira = HNL; Hong Kong Dollar = HKD; Hungary Forint = HUF","i":"Iceland Krona = ISK; India Rupee = INR; Indonesia Rupiah = IDR; Iran Rial = IRR; Isle of Man Pound = IMP; Israel Shekel = ILS","j":"Jamaica Dollar = JMD; Japan Yen = JPY; Jersey Pound = JEP","k":"Kazakhstan Tenge = KZT; Korea (North) Won = KPW; Korea (South) Won = KRW; Kyrgyzstan Som = KGS","l":"Laos Kip = LAK; Lebanon Pound = LBP; Liberia Dollar = LRD","m":"Macedonia Denar = MKD; Malaysia Ringgit = MYR; Mauritius Rupee = MUR; Mexico Peso = MXN; Mongolia Tughrik = MNT; Mozambique Metical = MZN","n":"Namibia Dollar = NAD; Nepal Rupee = NPR; Netherlands Antilles Guilder = ANG; New Zealand Dollar = NZD; Nicaragua Cordoba = NIO; Nigeria Naira	NGN; Norway Krone = NOK","o":"Oman Rial = OMR","p":"Pakistan Rupee = PKR; Panama Balboa = PAB; Paraguay Guarani = PYG; Peru Sol = PEN; Philippines Peso = PHP; Poland Zloty = PLN","q":"Qatar Riyal = QAR","r":"Romania New Leu = RON; Russia Ruble = RUB","s":"Saint Helena Pound = SHP; Saudi Arabia Riyal = SAR; Serbia Dinar = RSD; Seychelles Rupee = SCR = Singapore Dollar = SGD; Solomon Islands Dollar = SBD; Somalia Shilling = SOS; South Africa Rand	ZAR; Sri Lanka Rupee	LKR; Sweden Krona = SEK; Switzerland Franc = CHF; Suriname Dollar	SRD; Syria Pound = SYP","t":"Taiwan New Dollar = TWD; Thailand Baht	THB; Trinidad and Tobago Dollar = TTD; Turkey Lira = TRY; Tuvalu Dollar = TVD","u":"Ukraine Hryvnia = UAH; United Kingdom Pound = GBP; United States Dollar = USD; Uruguay Peso = UYU; Uzbekistan Som = UZS","v":"Venezuela Bolivar = VEF; Viet Nam Dong = VND","w":"No currency symbol.","x":"No currency symbol.","y":"Yemen Rial = YER","z":"Zimbabwe Dollar = ZWD"};

// Instantiate RC-SDK
var rcsdk = new RC({
    server: process.env.RC_SERVER,
    appKey: process.env.RC_APP_KEY,
    appSecret: process.env.RC_APP_SECRET
});

var platform = rcsdk.platform();
var subscription = rcsdk.createSubscription();
// event notification via PubNub
subscription.on(subscription.events.notification, function(msg) {
    parseMessage(msg.body);
});

module.exports = {
     login: function () {
        platform.login({
                username: process.env.RC_USERNAME,
                password: process.env.RC_PASSWORD,
                extension: process.env.RC_EXTENSION
            })
            .then(function(authResponse) {
                subscribeForNotification()
            })
            .catch(function(e) {
                console.log("Failed login");
                console.error(e);
                throw e;
            });
    }
};

function subscribeForNotification(){
  fs.readFile('subscriptionId.txt', 'utf8', function (err,data) {
    if (err) {
        startPubNubSubscription()
    }else{
        readRegisteredSubscription(data)
    }
  });
}

function saveSubscriptionId(subscriptionId){
  fs.writeFile("subscriptionId.txt", subscriptionId, function(err) {
    if(err) {
      console.log(err);
    }
    console.log("SubscriptionId is saved.");
  });
}

function startPubNubSubscription () {
  var _eventFilters = [];
  _eventFilters.push('/restapi/v1.0/account/~/extension/~/message-store/instant?type=SMS');
  subscription.setEventFilters(_eventFilters)
  .register()
  .then(function(subscriptionResponse) {
      console.log("Ready to receive incoming SMS via PubNub.")
      var subscObj = subscriptionResponse.json();
      saveSubscriptionId(subscObj.id)
  })
  .catch(function(e) {
      console.error(e);
      throw e;
  });
}

function deleteSubscription(subscriptionId) {
    return platform
      .delete('/subscription/' + subscriptionId)
      .then(function (response) {
        console.log("deleted: " + subscriptionId)
      })
      .catch(function(e) {
        console.error(e);
        throw e;
      });
}

function readRegisteredSubscription(subscriptionId) {
    platform.get('/subscription')
      .then(function (response) {
        var data = response.json();
        if (data.records.length > 0){
          for(var record of data.records) {
            if (record.id == subscriptionId) {
                // delete old subscription before creating a new one
                deleteSubscription(record.id)
            }
          }
        }
        console.log("Create new subscription")
        startPubNubSubscription()
      })
      .catch(function(e) {
          console.error(e);
          throw e;
      });
}

function parseMessage(message) {
    var toNumber = message['from']['phoneNumber'];
    var command = message['subject'];
    // for testing with sandbox account. We remove the watermark text
    var watermark = "Test SMS using a RingCentral Developer account - "
    var index = command.indexOf(watermark)
    if (index > -1) {
        command = command.substr(watermark.length, command.length)
    }
    command = command.toLowerCase().trim()

    if (command == "?" || command == "help") {
        var response = 'For currency symbols, send "symbol/n", where "n" is the first alphabet letter of a country name.\nFor exchange rate, send e.g. "eur/usd", where "eur" is the base and "usd" is the target.';
        return sendSMSMessage(toNumber, response)
    } else if (command.includes('/')) {
        var currencies = command.split("/");
        var currencyBase = currencies[0].trim().toUpperCase();
        var currencyTarget = currencies[1].trim().toUpperCase();
        if (currencyBase == "SYMBOL") {
            currencyTarget = currencyTarget.toLowerCase();
            var symbols = currencySymbols[currencyTarget];
            return sendSMSMessage(toNumber, symbols)
        } else if (currencyBase.length == 3 && currencyTarget.length == 3) {
            var host = 'api.fixer.io'
            var path = '/latest?base=' + currencyBase + '&symbols=' + currencyTarget;
            http.get({
                host: host,
                path: path
            }, function(response) {
                // Continuously update stream with data
                var body = '';
                response.on('data', function(d) {
                    body += d;
                });
                response.on('end', function() {
                    // Data reception is done
                    var parsed = JSON.parse(body);
                    var exchageRate = '1' + parsed.base + '=>' + parsed.rates[currencyTarget] + currencyTarget;
                    console.log(exchageRate);
                    return sendSMSMessage(toNumber, exchageRate)
                });
            });
        } else {
           var textMessage = 'Invalid currency symbol!'
           return sendSMSMessage(toNumber, textMessage)
        }
    } else {
        var textMessage = 'Invalid command! Send HELP or ? for help.'
        return sendSMSMessage(toNumber, textMessage)
    }
}

function sendSMSMessage(toNumber, textMessage) {
    return platform.post('/account/~/extension/~/sms', {
         from: {'phoneNumber': process.env.RC_USERNAME},
         to: [{'phoneNumber': toNumber}],
         text: textMessage
       })
       .then(function (response) {

       });
}
