console.log("Initializing server!")

var express = require('express')
var app = express()
var server = require('http').Server(app)
var io = require('socket.io')(server)

if (process.env.PORT) {
	server.listen(parseInt(process.env.PORT))
} else {
	server.listen(80)
}

app.use(express.static('.'))

app.get('/', function (req, res) {
	res.sendFile(__dirname + '/main.html')
})


var playerlist = {}
var offline = {}

// PLAYER CLASS
function player(id, x, y) {
	this.id = id
	this.x = x
	this.y = y
	this.sx = 0
	this.sy = 0
}
// plant.prototype.grow = function() {
	// if (this.age < this.maxAge) this.age++
// }

var mapSize = 200 // size in tiles to be squared
var map = []
function mapGen() {
	map = []
	//var tileTypes = ["dirt", "grass", "water"]
	var tileTypes = ["grass"]
	var grassTypes = ["grass1", "grass2", "grass3"]
	for (var x = 0; x < mapSize; x++) {
		map[x] = []
		for (var y = 0; y < mapSize; y++) {
			map[x][y] = {}
			
			var type = tileTypes[Math.floor(Math.random() * tileTypes.length)]
			if (type == "grass" && Math.random() > .75) {
				type = grassTypes[Math.floor(Math.random() * grassTypes.length)]
			}
			
			map[x][y].type = type
			
			// TODO: Add objects to map; add some sort of object table
			/*if (Math.random() > 0.67 && type != "water")
				mapHtml += '<img src="tree.png" />'
			if (Math.random() > 0.9 && type != "water")
				mapHtml += '<img src="me.png" />'*/
		}
	}
}
mapGen()

function newDay() {
	console.log("new day triggered")
	var newTiles = []
	for (var x = 0; x < map.length; x++) {
		for (var y = 0; y < map[x].length; y++) {
			var changed = false
			var t = map[x][y]
			if (t.watered) {
				t.watered = false
				if (t.plant) {
					if (t.plant.age < t.plant.maxAge) t.plant.age++
				}
				changed = true
			}
			if (t.type == "plowed" && t.plant == null && Math.random() > 0.95) {
				t.type = "grass"
				changed = true
			}
			if (changed) {
				newTiles.push({x:x, y:y, tile:t})
			}
		}
	}
	return newTiles
}

io.on('connection', function (socket) {
	var username
	console.log("\nNEW CONNECTION!\n")
	
	// Send game state regardless of login
	socket.emit("map", map)
	console.log("sent map")
	socket.emit("playerlist", playerlist)
	console.log("sent playerlist:\n", playerlist)
	
	// Handle login attempt
	socket.on("login", function(data) {
		var error
		username = data.username
		console.log("player signing in:", username)
		if (offline[username]) { // && offline[data.username].password == data.password
			console.log("username found!")
			playerlist[username] = offline[username]
			delete offline[username]
		}
		else if (playerlist[username]) {
			error = "user already logged in! aborting!"
		}
		else if (username == "") {
			error = "username empty! aborting!"
		}
		else {
			console.log("username not found, creating new player")
			playerlist[username] = new player(username, 0, 0)
		}
		
		if (error) {
			socket.emit("error", error)
			return
		}
		// send ID to player who just logged in
		socket.emit("ID", username)
		console.log("sent ID")
		// send playerlist to everyone
		io.sockets.emit("new player", playerlist[username])
	})
	
	socket.on("disconnect", function() {
		//console.log(socket)
		console.log("connection closed: ", playerlist[username])
		
		offline[username] = playerlist[username]
		delete playerlist[username]
		
		io.emit("disconnect", username)
		console.log("disconnection handled")
	})
	
	socket.on("move", function(data) {
		playerlist[username].x = data.x
		playerlist[username].y = data.y
		playerlist[username].sx = data.sx
		playerlist[username].sy = data.sy
		
		var now = Date.now()
		playerlist[username].moveDate = now
		
		socket.broadcast.emit("move", {player:username, x:data.x, y:data.y, sx:data.sx, sy:data.sy, moveDate:now})
		//console.log(playerlist[username])
	})
	
	socket.on("tile", function(data) {
		// update map tile on server
		map[data.x][data.y] = data.tile
		// forward tile change to clients
		socket.broadcast.emit("tile", data)
	})
	
	socket.on("tiles", function(newTiles) {
		// update map tile on server
		for (t in newTiles) {
			map[t.x][t.y] = t.tile
		}
		// forward tile change to clients
		socket.broadcast.emit("tiles", newTiles)
	})
	
	socket.on("newDay", function() {
		// update map
		var newTiles = newDay()
		// forward tile change to clients
		console.log("new tiles:")
		console.log(newTiles)
		io.sockets.emit("tiles", newTiles)
	})
	
	socket.on("hink", function(time) {
		socket.emit("honk", time)
	})
	
	socket.on("chat", function(msg) {
		socket.broadcast.emit("chat", {username:username, message:msg})
	})
})

console.log("Server initialized!")