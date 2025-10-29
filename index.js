"use strict";

const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const fs = require('fs');

app.use('/public', express.static('public'))


// Serve the main chat interface
app.get('/', (req, res) => {
	res.sendFile(__dirname + '/index.html');
});



// Track connected usernames and their socket IDs
let usernames = {};

// Helper to find username by socket ID
const check_key = v => {
  for (const key in usernames) {
    if (usernames[key] === v) return key;
  }
  return '';
};


// Socket.IO connection handler
io.on('connection', socket => {
	// Broadcast chat messages
	socket.on('sendchat', data => {
		if (socket.username) {
			io.emit('updatechat', socket.username, data);
		} else {
			socket.emit('updatechat', 'Chat Bot', 'Error: Username not set.');
		}
	});

	// Add new user
	socket.on('adduser', username => {
		if (!username || typeof username !== 'string') {
			socket.emit('updatechat', 'Chat Bot', 'Error: Invalid username.');
			return;
		}
		socket.username = username;
		usernames[username] = socket.id;
		socket.emit('updatechat', 'Chat Bot', `${socket.username} you have joined the chat`);
		socket.emit('store_username', username);
		socket.broadcast.emit('updatechat', 'Chat Bot', `${username} has connected`);
	});

		// Remove user on disconnect
		socket.on('disconnect', () => {
			if (socket.username) {
				delete usernames[socket.username];
				socket.broadcast.emit('updatechat', 'Chat Bot', `${socket.username} has left chat`);
			}
		});

	// Private messaging: find username by socket ID
	socket.on('check_user', (asker, id) => {
		if (usernames[asker]) {
			io.to(usernames[asker]).emit('msg_user_found', check_key(id));
		} else {
			socket.emit('updatechat', 'Chat Bot', 'Error: User not found.');
		}
	});

	// Private messaging: send message to user
	socket.on('msg_user', (to_user, from_user, msg) => {
		if (usernames[to_user]) {
			io.to(usernames[to_user]).emit('msg_user_handle', from_user, msg);
			// Append chat message to file (basic persistence)
			fs.appendFile('chat_data.txt', `${from_user}: ${msg}\r\n`, err => {
				if (err) console.error('Error writing chat message:', err);
			});
		} else {
			socket.emit('updatechat', 'Chat Bot', 'Error: Recipient not found.');
		}
	});

	// Future scalability: consider using Redis or database for user/session management
	// and clustering Socket.IO for horizontal scaling.
});

http.listen(3000, () => console.log('listening on *:3000'));
    
