# todos:
# remove the player from game session after he disconnect
from flask import Flask, render_template, request
from flask_socketio import SocketIO, join_room, leave_room
from random import seed, random
import logging
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

app = Flask(__name__)
app.config['SECRET_KEY'] = "testflaskapp"
socketio = SocketIO(app)

users = {}
roomStates = {}
chessColor = ['White', 'Black']
# modes for checking five in a row 
checkMode = [
	[1,0],#Horizontal
	[0,1],#Vertical
	[1,1],#Left diagonal
	[1,-1],#Right diagonal
]

def createNewName(id):
	return 'USER'+id[:8]

def checkUserAvailability(id):
	for room in roomStates.values():
		if room['player1'] == id or room['player2'] == id:
			return False
	return True

# Check if there are already 5 of a color in a row
def checkWin(x, y, color, room, mode):
	connectCount = 1
	board = room['boardState']

	# count the consecutive stones on the increasing side
	for i in range(1,5):
		if(board[x + i*mode[0]]):
			if(board[x + i*mode[0]][y + i*mode[1]] == color):
				connectCount += 1
			else:
				break

	# count the consecutive stones on the decreasing side
	for j in range(1,5):
		if(board[x - j*mode[0]]):
			if(board[x - j*mode[0]][y - j*mode[1]] == color):
				connectCount += 1
			else:
				break
   
	if(connectCount >= 5):
		print("{} has won".format(color))
		room['isEnded'] = True
		socketio.emit('game end', color, room=room['player1'])
		socketio.emit('game end', color, room=room['player2'])

@app.route('/')
def sessions():
	return render_template('game.html')

@socketio.on('connect')
def connectHandler():
	sessionId = request.sid
	username = 'user'+sessionId[:8]
	userInfo = {
		"id": sessionId,
		"name":username,
		"against": '',
		"current": False,
		"isBlack": False
	}
	users[sessionId] = userInfo
	print('User: {} has joined'.format(username))
	socketio.emit('userList', users, boradcast=True)

@socketio.on('disconnect')
def disconnectHandler():
	sessionId = request.sid
	username = 'user'+sessionId[:8]
	users.pop(sessionId)
	print('User: {} has left'.format(username))
	socketio.emit('userList', users, boradcast=True)
	rooms = []
	for roomId, room in roomStates.items():
		if room['player1'] == sessionId or room['player2'] == sessionId:
			rooms.append(roomId)
	for id in rooms:
		roomStates.pop(id)
	
@socketio.on('inviteGame')
def inviteGameHandler(json, methods=['GET', 'POST']):
	inviterId = request.sid
	opponentId = json['id']

	# if this is a new match
	if not json['rematch']:
		isInviterAvailable = checkUserAvailability(inviterId)
		isOpponentAvailable = checkUserAvailability(opponentId)

		if isInviterAvailable and isOpponentAvailable:
			seed()
			gameId = int(random()*1000)
			roomStates[gameId] = {}
			roomStates[gameId]['player1'] = inviterId
			roomStates[gameId]['player2'] = opponentId
			roomStates[gameId]['stepCount'] = 0
			roomStates[gameId]['boardState'] = [[0 for x in range(19)] for y in range(19)] 
			
			users[inviterId]['against'] = opponentId
			users[inviterId]['gameId'] = gameId
			users[opponentId]['against'] = inviterId
			users[opponentId]['gameId'] = gameId
			# Coin toss
			if gameId%2 == 1:
				# users[inviteId]['current'] = True
				users[inviterId]['isBlack'] = True
				users[opponentId]['isBlack'] = False
				roomStates[gameId]['currentPlayer'] = inviterId
			else:
				# users[opponentId]['current'] = True
				users[opponentId]['isBlack'] = True
				users[inviterId]['isBlack'] = False
				roomStates[gameId]['currentPlayer'] = opponentId
			
			print("Start game between {} and {} in room {}".format(inviterId, opponentId, gameId))
			socketio.emit('beginGame', users[inviterId], room=inviterId)
			socketio.emit('beginGame', users[opponentId], room=opponentId)
			socketio.emit('userList', users, broadcast=True)
	# if a rematch is requested, start a new game in a new room
	else:
		seed()
		gameId = int(random()*1000)
		roomStates[gameId] = {}
		roomStates[gameId]['player1'] = inviterId
		roomStates[gameId]['player2'] = opponentId
		roomStates[gameId]['stepCount'] = 0
		roomStates[gameId]['boardState'] = [[0 for x in range(19)] for y in range(19)] 
		
		users[inviterId]['against'] = opponentId
		users[inviterId]['gameId'] = gameId
		users[opponentId]['against'] = inviterId
		users[opponentId]['gameId'] = gameId
		# Coin toss
		if gameId%2 == 1:
			# users[inviteId]['current'] = True
			users[inviterId]['isBlack'] = True
			users[opponentId]['isBlack'] = False
			roomStates[gameId]['currentPlayer'] = inviterId
		else:
			# users[opponentId]['current'] = True
			users[opponentId]['isBlack'] = True
			users[inviterId]['isBlack'] = False
			roomStates[gameId]['currentPlayer'] = opponentId
		
		print("Start game between {} and {} in room {}".format(inviterId, opponentId, gameId))
		socketio.emit('beginGame', users[inviterId], room=inviterId)
		socketio.emit('beginGame', users[opponentId], room=opponentId)
		socketio.emit('userList', users, broadcast=True)


def isBoardPosValid(x, y, boardState):
	i = x//30-1
	j = y//30-1

	if boardState[i][j] == 0:
		return True
	else:
		return False

@socketio.on('stone placement')
def stonePlacedHandler(json, methods=['GET', 'POST']):
	#print('received a new placed stone: ' + str(json))
	
	senderPlayerId = request.sid
	receiverPlayerId = json['against']
	gameId = users[senderPlayerId]['gameId']
	senderIsBlack = users[senderPlayerId]['isBlack']

	# if not sender's turn to play, reject the attempt
	if roomStates[gameId]['currentPlayer'] != senderPlayerId:
		print("Rejected attempt due to not his turn")
		return
	
	# if the step count is not correct, reject the attempt
	if json['step'] != roomStates[gameId]['stepCount']:
		print("Rejected attempt due to wrong turn number")
		return

	if isBoardPosValid(json['x'], json['y'], roomStates[gameId]['boardState']):
		i = json['x']//30-1
		j = json['y']//30-1
		roomStates[gameId]['boardState'][i][j] = chessColor[senderIsBlack]
		roomStates[gameId]['stepCount'] += 1
		roomStates[gameId]['currentPlayer'] = receiverPlayerId
		print("{} stone palced at [{}, {}]".format(chessColor[senderIsBlack], i, j))
		#print(roomStates[gameId])

		# the stone placement attempt is verified by the server, 
		# the players can update their board
		socketio.emit('stone placement confirm', json, room=senderPlayerId)
		socketio.emit('stone placement confirm', json, room=receiverPlayerId)
		print("stone placement confirmed")

		for modeIndex in range(4):
			checkWin(i, j, chessColor[senderIsBlack], roomStates[gameId], checkMode[modeIndex])
	# if board position not valid, reject the attempt
	else:
		return

if __name__ == '__main__':
	socketio.run(app)