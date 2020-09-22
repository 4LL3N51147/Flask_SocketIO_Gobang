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

def createNewName(id):
    return 'USER'+id[:8]

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
    
@socketio.on('inviteGame')
def inviteGameHandler(opponentId, methods=['GET', 'POST']):
    inviteId = request.sid
    users[inviteId]['against'] = opponentId
    users[opponentId]['against'] = inviteId
    # Coin toss
    seed()
    if random() > 0.5:
        users[inviteId]['current'] = True
        users[inviteId]['isBlack'] = True
    else:
        users[opponentId]['current'] = True
        users[opponentId]['isBlack'] = True
    
    print("Start game between {} and {}".format(inviteId, opponentId))
    socketio.emit('beginGame', users[inviteId], room=inviteId)
    socketio.emit('beginGame', users[opponentId], room=opponentId)
    socketio.emit('userList', users, broadcast=True)

def messageReceived(methods=['GET', 'POST']):
    print('message was received!!!')

@socketio.on('stone placed')
def stonePlacedHandler(json, methods=['GET', 'POST']):
    print('received a new placed stone: ' + str(json))
    socketio.emit('stone placed', json, callback=messageReceived)

if __name__ == '__main__':
    socketio.run(app)