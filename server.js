var express = require('express');
var http = require('http');
var app = express();
var server = http.createServer(app);
var io = require('socket.io').listen(server);
var fs = require('fs');

var logfile = '../canonlisten_log.txt';

var events_module = require('events');
var events = new events_module.EventEmitter();

server.listen(8080);

app.get('/', function(req, res) {
    res.redirect('http://canonlisten.tk');
})

app.set('bans', []);
app.set('users', []);

function chat_init(socket) {
    // Get name
    socket.get('name', function(err, name) {
        // Join the room
        socket.join('chat');
        
        // Broadcast a connection message
        server_notice(name + ' is now online');
        
        // Handle client messages
        socket.on('chat', function(data) {
            data.name = name;
            socket.broadcast.to('chat').emit('chat', data);
            fs.appendFile(logfile,  name + ': ' + data.message);
        });
        socket.on('typing', function(data) {
            data.name = name;
            socket.broadcast.to('chat').emit('typing', data);
        });
        
        // Handle server side events
        events.on('ban', function(data) {
            var client_ip = socket.handshake.address.address;
            if (client_ip == data.ip) {
                server_notice(name + ' (' + client_ip + ') has been banned');
                socket.disconnect();
            }
        });
        
        // Broadcast a disconnection message when the client disconnects
        socket.on('disconnect', function() {
            server_notice(name + ' is now offline');
        });
    });
}

function append_user(name) {
    var users = app.get('users');
    if (users.indexOf(name) != -1) {
        // User already exists
        return false;
    } else {
        // User does not exist, add user to list
        users.push(name);
        app.set('users', users);
        return true;
    }
}

function remove_user(name) {
    var users = app.get('users');
    var index = users.indexOf(name);
    if (index != -1) {
        // User exists, remove user from list
        users.pop(index);
        app.set('users', users);
        return true;
    } else {
        // User does not exist
        return false;
    }
}

var mod = {
    init: function(socket) {
        // Handle client messages
        socket.on('ban', function(data) {
            mod.ban.add(data.ip);
        });
        
        // Handle server side events
        events.on('ban', function(data) {
            // Send the new ban list to the moderator
            var bans = app.get('bans');
            socket.emit('ban_list', bans);
        });
    },
    ban: {
        add: function(ip) {
            var bans = app.get('bans');
            bans.push(ip);
            app.set('bans', bans);
            events.emit('ban', {'ip': ip});
        },
        remove: function(ip) {
            var bans = app.get('bans');
            bans.pop(bans.indexOf(ip));
            app.set('bans', bans);
        }
    }
}

function check_ban(socket) {
    var client_ip = socket.handshake.address.address;
    var bans = app.get('bans');
    
    if (bans.indexOf(client_ip) != -1) {
        // Client is banned
        return true;
    } else {
        // Client is not banned
        return false;
    }
}

function server_notice(message) {
    io.sockets.in('chat').emit('server', message);
    fs.appendFile(logfile, message);
}

io.sockets.on('connection', function(socket) {
    socket.on('login', function(data, callback) {
        if (data.name == 'Moderator') {
            if (password in data) {
                // Check password
                if (password == 'qwertyuiop') {
                    socket.set('name', data.name, function() {
                        chat_init(socket);
                        mod.init(socket);
                        callback('success');
                    });
                } else {
                    callback('incorrect');
                }
            } else {
                // Ask for a password
                callback('password');
            }
        } else {
            if (!check_ban(socket)) {
                if (append_user(data.name)) {
                    socket.set('name', data.name, function() {
                        chat_init(socket);
                        callback('success');
                    });
                } else {
                    callback('taken');
                }
            } else {
                callback('banned');
            }
            
        }
    });
})
