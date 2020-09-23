// Connect to the server socket
var socket = io.connect('http://127.0.0.1:5000/',
						);

// The client keeps a list of all connected clients except self
var users = {};
var isBlack = true;
var PLAYER_USERNAME = "";
var OPPONENT_USERNAME = "";
var OPPONENT_ID = "";

// Game state info
var board = []; //An array that records the stones on the chessboard
var isCurrent = false;
var stepCount = 0;
var hasWon = false;

var canvas = $("#chessboard")[0];
var prompt = $("#prompt");
var debug = $("#debug");
var context = canvas.getContext("2d");
var chessColors = ["White", "Black"];

function startGame() {
	cleanChessBoard();
	cleanState();
	drawChessBoard();
}

// Draw out the lines on the chessboard
function drawChessBoard() {
	for (var i = 0; i < 19; i++) {
		context.beginPath();
		context.moveTo((i+1) * 30, 30);
		context.lineTo((i+1) * 30, canvas.height - 30);
		context.closePath();
		context.stroke();
		context.beginPath();
		context.moveTo(30, (i+1) * 30);
		context.lineTo(canvas.width - 30, (i+1) * 30);
		context.closePath();
		context.stroke();
	}
}

// Clean all the stones on the chessboard
function cleanChessBoard() {
	context.fillStyle = "white";
	context.fillRect(0, 0, canvas.width, canvas.height);
	stepCount = 0;
}

function cleanState() {
	isBlack = true;
	PLAYER_USERNAME = "";
	OPPONENT_USERNAME = "";
	OPPONENT_ID = "";

	// Game state info
	// Initialize the board state to 0s
	for(var i=0; i<19; i++){
	   board[i] = [];
	   for(var j=0; j<19; j++){
		  board[i][j] = 0;
		}    
	}
	isCurrent = false;
	stepCount = 0;
	hasWon = false;
}

// Draw the stone at position (x, y) and fill it with color
function drawStone(x, y, color) {
	context.beginPath();
	context.arc(x, y, 13, 0, Math.PI*2, false);
	context.closePath();
	context.fillStyle = color;
	context.fill();
	context.lineWidth = 1;
	context.strokeStyle = 'black';
	context.stroke();
}

// Check if the stone location is valid
function isBoardPosValid(x, y) {
	let i = x/30-1; // chessMap horizontal index
	let j = y/30-1; // chessMap vertical index

	if (board[i][j] == 0) {
		return true;
	}
	else {
		return false;
	}
}

// Event listener fir stone placement
canvas.addEventListener("click", function(e) {
	if (hasWon) {
		alert("Game Over~");
		return;
	}

	if (!isCurrent) {
		alert("Wait for your turn");
		return;
	}

	// Check if the player clicked out of boundary
	if(e.offsetX < 15 || e.offsetX > 585 || e.offsetY < 15 || e.offsetY > 585) {
	   return;
	}

	// Round the stone position to the closest line cross
	let x = Math.floor((e.offsetX + 15) / 30 ) * 30;
	let y = Math.floor((e.offsetY + 15) / 30 ) * 30;

	// Check if the clicked stone location is valid
	let i = x/30-1; // chessMap horizontal index
	let j = y/30-1; // chessMap vertical index

	if(isBoardPosValid(x, y)) {
		socket.emit('stone placement', {
			placedBy: socket.id,
			x: x,
			y: y,
			step: stepCount,
			against: OPPONENT_ID
		});
	} 
});

window.addEventListener('beforeunload', function(e) {
	socket.disconnect();
});

function bindInviteButtonClick(socket) {
	$('.user-status').click(function (e) {
		// if the invited player is not available, reject 
		if ($(this).html() != "Invite") {
			alert("This player is not available, try later");
			return;
		}

		// if you are already in a game, reject
		if (OPPONENT_USERNAME != "") {
			alert("Finish your game first");
			return;
		}

		socket.emit('inviteGame', {
			id: $(this).data('id'),
			rematch: false
		});

		OPPONENT_USERNAME = $(this).data('name');
		console.log('sent');
	});
}

function updateDOMUserList(userList, ownId, socket) {
	var result = '';
	$.each(userList, function (index, value) {
		value.statusClass = '';
		value.statusText = 'Invite';

		if (value.against) {
			value.statusClass = 'in-game';
			value.statusText = 'In-Game';
		}
		if (value.against === ownId) {
			value.statusClass = 'game-with';
			value.statusText = 'Opponent';
			OPPONENT_USERNAME = value.name;
		}
		result += `
			<div class="user-item row align-items-center">
				<p class="user-info col-8">${value.name}</p>
				<button class="user-status col-4 ${value.statusClass}" data-id=${value.id} data-name=${value.name}>${value.statusText}</button>
			</div>
		`
	});
	$('#user-list').html(result);
	bindInviteButtonClick(socket);
}

function updatePrompt() {
	if (isCurrent) {
		prompt.text("Your turn");
	}
	else {
		prompt.text(`Waiting for ${OPPONENT_USERNAME} to place a stone`);
	}
}

function updateDebugInfo() {
	result = ""
	result += `isCurrent: ${isCurrent}<br>`;
	result += `isBlack: ${isBlack}<br>`;
	result += `ID: ${socket.id}<br>`;
	result += `OPPONENT_ID: ${OPPONENT_ID}<br>`;
	result += `OPPONENT_USERNAME: ${OPPONENT_USERNAME}<br>`;
	result += `stepCount: ${stepCount}`;
	debug.html(result);
}


// Socket event handling

// When the socket connects, start the game
socket.on('connect', function() {
	PLAYER_USERNAME = "USER"+socket.id.substring(0,8);
	prompt.text(`Welcome ${PLAYER_USERNAME}`);
	updateDebugInfo();
});

socket.on('beginGame', (json) => {
	startGame();
	console.log("Begin game", json);
	OPPONENT_ID = users[json.against].id
	OPPONENT_USERNAME = users[json.against].name;
	isCurrent = json.isBlack;
	isBlack = json.isBlack;
	updatePrompt();
	updateDebugInfo();
});

// Upon receiving the new user list, update the DOM
socket.on('userList', function(json) {
	//console.log(json);
	users = {};

	// Excluding self from the user list
	$.each(json, function(key, value) {
		if (key != socket.id) {
			users[key] = value;
		}
	});
	updateDOMUserList(users, socket.id, socket);
});

socket.on('stone placement confirm', function(json) {
	let chessColor = "";
	x = json.x;
	y = json.y;

	if (socket.id == json.placedBy) {
		chessColor = chessColors[+isBlack];
		isCurrent = false;
	}
	else {
		chessColor = chessColors[+(!isBlack)];
		isCurrent = true;
	}

	let i = x/30-1; // chessMap horizontal index
	let j = y/30-1; // chessMap vertical index

	drawStone(x, y, chessColor);
	board[i][j] = chessColor;
	
	// for(var index=0; index<4; index++) {
	// 	checkWin(i, j, chessColor, checkMode[index]);
	// }

	stepCount++;
	updatePrompt();
});

socket.on('game end', function(data) {
	let winner = data;
	let chessColor = chessColors[+isBlack];
	

	if (winner == chessColor) {
		if (confirm("You have won, play it again?")) {
			console.log(winner, chessColor);
		}
		else {
			return;
		}
	}
	else {
		if (confirm("You have lost, play it again?")) {
			console.log(winner, chessColor);
		}
		else {
			return;
		}
	}
});