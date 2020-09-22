// Connect to the server socket
var socket = io.connect('http://127.0.0.1:5000/',
                        );

// The client keeps a list of all connected clients except self
var users = {};
var isBlack = true;
var PLAYER_USERNAME = "";
var OPPONENT_USERNAME = "";

// When the socket connects, start the game
socket.on('connect', function() {
    PLAYER_USERNAME = "USER"+socket.id.substring(0,8);
    prompt.text(`Welcome ${PLAYER_USERNAME}`);
});

socket.on('beginGame', (json) => {
    console.log("Begin game", json);
    OPPONENT_USERNAME = users[json.against].name;
    if (json.current) {
        prompt.text("Your turn");
    }
    else {
        prompt.text(`Waiting for ${OPPONENT_USERNAME} to place a stone`);
    }
    startGame();
});

// Upon receiving response from the server, display the message
socket.on('stone placed', function(json) {
	console.log(json);
})

socket.on('userList', function(json) {
    //console.log(json);
    users = {};
    $.each(json, function(key, value) {
        if (key != socket.id) {
            users[key] = value;
        }
    });
    updateDOMUserList(users, socket.id, socket);
})

var canvas = $("#chessboard")[0];
var prompt = $("#prompt");
var context = canvas.getContext("2d");

//An array that records the stones on the chessboard
var board = [];

var chessColor = ["black", "white"];
var stepCount = 0;
var hasWon = false;

// modes for checking five in a row 
var checkMode = [
    [1,0],//Horizontal
    [0,1],//Vertical
    [1,1],//Left diagonal
    [1,-1],//Right diagonal
];

function startGame() {
    // Initialize the board state to 0s
    for(var i=0; i<19; i++){
       board[i] = [];
       for(var j=0; j<19; j++){
          board[i][j] = 0;
        }    
    }
    cleanChessBoard();
    drawChessBoard();
    hasWon = false;
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
        drawStone(x, y, chessColor[stepCount % 2]);
        board[i][j] = chessColor[stepCount % 2];
        //检查当前玩家是否赢了游戏
        for(var index=0; index<4; index++) {
            checkWin(i, j, chessColor[stepCount % 2], checkMode[index]);
        }

        socket.emit('stone placed', {
            x: x,
            y: y,
            color: chessColor[stepCount % 2],
            step: stepCount
        });

        stepCount++;
        prompt.text("Current: "+chessColor[(stepCount) % 2]);
    } 
});

window.addEventListener('beforeunload', function(e) {
    socket.disconnect();
});

// Check if there are already 5 of a color in a row
function checkWin(x, y, color, mode) {
    let count = 1;
    for(var i=1; i<5; i++) {
        if(board[x + i * mode[0]]){
            if(board[x + i * mode[0]][y + i * mode[1]] == color){
                count++;
            }else{
                break;
            }
        }
    }
    
    for(var j=1;j<5;j++){
        if(board[x - j * mode[0]]){
            if(board[x - j * mode[0]][y - j * mode[1]] == color){
                count++;
            }else{
                break;
            }
        }
    }
    // if(mode == checkMode[0])
    // { console.log("水平方向有： " + count + "个" + color);}
    // if(mode == checkMode[1])
    // { console.log("竖直方向有： " + count + "个" + color);}
    // if(mode == checkMode[2])
    // { console.log("左斜方向有： " + count + "个" + color);}
    // if(mode == checkMode[3])
    // { console.log("右斜方向有： " + count + "个" + color);}
   
    if(count >= 5){
        alert(color + " you have win!");
        // 游戏结束
        hasWon = true;
    }
}

function bindInviteButtonClick(socket) {
    $('.user-status').click(function (e) {
        socket.emit('inviteGame', $(this).data('id'));
        OPPONENT_USERNAME = $(this).data('name');
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