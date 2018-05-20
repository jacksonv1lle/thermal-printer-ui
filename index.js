var express = require('express'),
    htmlDir = './src/'
var app = express();



//Set content directories
app.use(express.static(__dirname + '/src'));

app.get('/', function(request, response) {
    response.sendfile(htmlDir + 'main.html');
});

var port = process.env.PORT || 5000;
	app.listen(port, '192.168.0.42', function() {
	console.log("Listening on " + port);
});